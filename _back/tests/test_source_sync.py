from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app.models import Source, utcnow
from tests.conftest import ADMIN


def test_failed_source_refresh_preserves_schedule(client, db, demo, monkeypatch):
    source = db.scalar(select(Source).where(Source.event_id == demo.id))
    source.mode = "aes"
    source.config = {"authorized": True, "event_key": "key"}
    db.commit()
    from app.modules import sync

    def denied(*args):
        raise ValueError("Source unavailable")

    monkeypatch.setattr(sync, "fetch_snapshot", denied)
    response = client.post(f"/v1/admin/sources/{source.id}/refresh", headers=ADMIN)
    assert response.status_code == 200 and response.json()["data"]["ok"] is False
    assert client.get("/v1/events/demo-championships/matches").json()["data"]
    detail = client.get("/v1/events/demo-championships").json()
    assert (
        next(s for s in detail["sources"] if s["id"] == str(source.id))["freshness"]
        == "unavailable"
    )


def test_paused_source_does_not_request_upstream(client, db, demo, monkeypatch):
    source = db.scalar(select(Source).where(Source.event_id == demo.id))
    source.status = "paused"
    db.commit()
    from app.modules import sync

    monkeypatch.setattr(
        sync,
        "fetch_snapshot",
        lambda *_: (_ for _ in ()).throw(AssertionError("Must not fetch")),
    )
    assert (
        client.post(f"/v1/admin/sources/{source.id}/refresh", headers=ADMIN).json()[
            "data"
        ]["ok"]
        is False
    )


def test_pausing_live_source_warns_attendees_at_once(client, db, demo):
    source = db.scalar(select(Source).where(Source.event_id == demo.id))
    source.mode = "aes"
    source.config = {"authorized": True, "event_key": "key", "last_sync_success": True}
    source.last_successful_check_at = utcnow()
    db.commit()

    def freshness():
        detail = client.get("/v1/events/demo-championships").json()
        return next(s for s in detail["sources"] if s["id"] == str(source.id))

    assert freshness()["freshness"] == "current"
    response = client.patch(
        f"/v1/admin/sources/{source.id}", json={"status": "paused"}, headers=ADMIN
    )
    assert response.status_code == 200
    assert freshness()["freshness"] == "paused"
    # Retained schedule stays visible, and cards carry the source's last check.
    match = client.get("/v1/events/demo-championships/matches").json()["data"][0]
    assert match["source"]["freshness"] == "paused"
    assert match["source"]["last_checked_at"] == freshness()["last_checked_at"]


def test_auto_sync_toggle_keeps_source_config(client, db, demo):
    source = db.scalar(select(Source).where(Source.event_id == demo.id))
    source.mode = "aes"
    source.config = {"authorized": True, "event_key": "key"}
    db.commit()
    response = client.patch(
        f"/v1/admin/sources/{source.id}",
        json={"auto_sync": True, "expected_check_interval_minutes": 5},
        headers=ADMIN,
    )
    data = response.json()["data"]
    assert (data["auto_sync"], data["check_interval_minutes"]) == (True, 5)
    db.expire_all()
    assert db.get(Source, source.id).config == {
        "authorized": True,
        "event_key": "key",
        "auto_sync": True,
    }


def test_aes_load_builds_event_from_recordings_and_is_idempotent(
    client, db, monkeypatch
):
    from app.adapters.aes import read_aes
    from app.cli import aes_load
    from app.models import ChangeEvent, Event
    from app.modules import sync
    from tests_unit.test_sources import AES_KEY, recorded

    monkeypatch.setattr(
        sync, "fetch_snapshot", lambda mode, config: read_aes(config, get=recorded())
    )
    event = aes_load(AES_KEY, get=recorded())
    loaded = db.scalar(select(Source).where(Source.event_id == event.id))
    assert loaded.config["auto_sync"] is True
    listed = next(
        e for e in client.get("/v1/events").json()["data"] if e["slug"] == event.slug
    )
    assert listed["title"].startswith("2026 Ontario Championships - Event 2")
    assert (listed["start_date"], listed["end_date"]) == ("2026-04-19", "2026-04-21")
    assert listed["venues"] == ["Enercare Centre"] and listed["kind"] == "indoor"
    assert listed["demo_now"] is None
    teams = client.get(f"/v1/events/{event.slug}/teams").json()
    assert teams["total"] == 46
    matches = client.get(
        f"/v1/events/{event.slug}/matches", params={"limit": 200}
    ).json()["data"]
    assert len(matches) == 148
    match = next(m for m in matches if m["source_match_id"] == "-50085")
    assert match["court"]["label"] == "Court 51"
    assert match["division"]["code"] == "15UB D2"
    assert [(s["home"], s["away"]) for s in match["sets"]] == [(25, 11), (25, 10)]
    assert match["home"]["team_name"] == "Niagara Rapids Tornadoes"
    start = datetime.fromisoformat(match["scheduled_start"])
    assert start.astimezone(ZoneInfo("America/Toronto")).isoformat() == (
        "2026-04-19T15:00:00-04:00"
    )

    changes = db.scalar(select(func.count()).select_from(ChangeEvent))
    source = db.scalar(select(Source).where(Source.event_id == event.id))
    source.config = {**source.config, "last_timestamp": None}  # force a full re-read
    db.commit()
    aes_load(AES_KEY, get=recorded())
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(Event)) == 1
    assert db.scalar(select(func.count()).select_from(Source)) == 1
    assert db.scalar(select(func.count()).select_from(ChangeEvent)) == changes
    assert client.get(f"/v1/events/{event.slug}/teams").json()["total"] == 46


def test_aes_loader_coexists_with_mobile_seed_and_preserves_staff_metadata(
    client, db, monkeypatch
):
    import json

    from app.adapters.aes import read_aes
    from app.cli import aes_load
    from app.models import Event, Venue
    from app.modules import sync
    from app.seed import seed, seed_testing
    from tests_unit.test_sources import AES_KEY, recorded

    seed(db)  # Provides the same organization and test admin used by PR 22.
    seed_testing(db)
    seeded_event_ids = set(db.scalars(select(Event.id)))
    monkeypatch.setattr(
        sync, "fetch_snapshot", lambda mode, config: read_aes(config, get=recorded())
    )
    event = aes_load(AES_KEY, get=recorded())
    venue = db.scalar(select(Venue).where(Venue.event_id == event.id))
    response = client.patch(
        f"/v1/admin/venues/{venue.id}",
        headers=ADMIN,
        json={
            "name": venue.name,
            "city": "Toronto",
            "latitude": 43.63,
            "longitude": -79.41,
        },
    )
    assert response.status_code == 200
    matches = client.get(f"/v1/events/{event.slug}/matches").json()["data"]
    match = matches[0]
    assert (
        client.patch(
            f"/v1/admin/matches/{match['id']}",
            headers=ADMIN,
            json={"expected_revision": match["revision"], "status": "cancelled"},
        ).status_code
        == 409
    )  # PR 22 must keep connected AES schedules upstream-owned.

    def renamed(url):
        data = json.loads(recorded()(url))
        if url.endswith(AES_KEY):
            data["Name"] = "Renamed upstream championship"
        return json.dumps(data)

    assert aes_load(AES_KEY, get=renamed).id == event.id
    db.expire_all()
    db.refresh(venue)
    assert (venue.city, venue.latitude, venue.longitude) == ("Toronto", 43.63, -79.41)
    assert not db.get(Event, event.id).is_demo
    assert set(db.scalars(select(Event.id))) == seeded_event_ids | {event.id}
    assert seed_testing(db) == []
    listed = next(
        e for e in client.get("/v1/events").json()["data"] if e["id"] == str(event.id)
    )
    assert listed["venue_locations"][0]["latitude"] == 43.63


def test_aes_loader_refuses_title_collision_with_unrelated_event(db, demo):
    import json

    import pytest

    from app.cli import aes_load
    from app.models import Event
    from tests_unit.test_sources import AES_KEY, recorded

    metadata = json.loads(recorded()(f"https://example.org/{AES_KEY}"))
    metadata["Name"] = demo.slug
    with pytest.raises(ValueError, match="Event slug already belongs"):
        aes_load(AES_KEY, get=lambda _: json.dumps(metadata))
    assert db.scalar(select(func.count()).select_from(Event)) == 1


def test_aes_discover_loads_found_championships_and_is_idempotent(
    client, db, monkeypatch
):
    from app.adapters.aes import read_aes
    from app.cli import aes_discover
    from app.models import ChangeEvent, Event
    from app.modules import sync
    from tests_unit.test_sources import AES_KEY, SEARCH, recorded

    monkeypatch.setattr(
        sync, "fetch_snapshot", lambda mode, config: read_aes(config, get=recorded())
    )

    def get(url):
        if "/api/landing/events?" in url:
            return SEARCH.read_text()
        if AES_KEY in url:
            return recorded()(url)
        raise ValueError("not recorded")  # only Event 2 has recorded results

    results = aes_discover(year=2026, get=get)
    assert [name for name, _ in results] == [
        "2026 Ontario Championships - Event 3 (6v6B, 16U, 18U)",
        "2026 Ontario Championships - Event 2 (6v6G, TLSG, 15UB)",
        "2026 Ontario Championships - Event 1 (TLSB, 15UG, 17UB/G)",
        "2026 Ontario Championships - 4v4 Boys and Girls",
    ]
    loaded = [r for _, r in results if isinstance(r, Event)]
    assert len(loaded) == 1 and loaded[0].start_date.isoformat() == "2026-04-19"
    assert client.get(f"/v1/events/{loaded[0].slug}/teams").json()["total"] == 46
    changes = db.scalar(select(func.count()).select_from(ChangeEvent))

    aes_discover(year=2026, get=get)
    assert db.scalar(select(func.count()).select_from(Event)) == 1
    assert db.scalar(select(func.count()).select_from(Source)) == 1
    assert db.scalar(select(func.count()).select_from(ChangeEvent)) == changes


def test_myteam_load_creates_upcoming_beach_events_and_is_idempotent(
    client, db, monkeypatch
):
    from datetime import date

    from app.adapters.myteam import read_myteam
    from app.cli import myteam_load
    from app.models import Event
    from app.modules import sync
    from tests_unit.test_myteam import recorded

    monkeypatch.setattr(
        sync, "fetch_snapshot", lambda mode, config: read_myteam(config, get=recorded)
    )
    # The 2027-04-04 event is already past; the 2027-04-18 one is dated today.
    events = myteam_load(date(2027, 4, 18), get=recorded)
    assert [e.title for e in events] == ["WBT - Downsview- 18U"]
    listed = client.get("/v1/events").json()["data"]
    assert len(listed) == 1
    event = listed[0]
    assert (event["start_date"], event["end_date"]) == ("2027-04-18", "2027-04-18")
    assert (event["kind"], event["venues"], event["demo_now"]) == (
        "beach",
        ["Downsview"],
        None,
    )
    assert client.get(f"/v1/events/{event['slug']}/teams").json()["total"] == 2
    assert client.get(f"/v1/events/{event['slug']}/matches").json()["data"] == []

    assert [e.id for e in myteam_load(date(2027, 4, 18), get=recorded)] == [
        events[0].id
    ]
    assert db.scalar(select(func.count()).select_from(Event)) == 1
    assert db.scalar(select(func.count()).select_from(Source)) == 1
    assert client.get(f"/v1/events/{event['slug']}/teams").json()["total"] == 2


def test_timu_load_builds_upcoming_events_from_recordings_and_is_idempotent(
    client, db, monkeypatch
):
    from datetime import date

    from app.adapters.timu import read_timu
    from app.cli import timu_load
    from app.models import ChangeEvent, Event, Venue
    from app.modules import sync
    from tests_unit.test_sources import timu_recorded

    monkeypatch.setattr(
        sync, "fetch_snapshot", lambda mode, config: read_timu(config, get=timu_recorded)
    )
    [event] = timu_load(get=timu_recorded, today=date(2026, 10, 19))
    listed = next(
        e for e in client.get("/v1/events").json()["data"] if e["slug"] == event.slug
    )
    assert listed["title"] == "15U Girls Spook & Spike Showdown - Exhibition"
    assert (listed["start_date"], listed["end_date"]) == ("2026-10-24", "2026-10-24")
    assert listed["venues"] == ["North London Optimist Community"]
    assert listed["kind"] == "indoor" and listed["demo_now"] is None
    venue = db.scalar(select(Venue).where(Venue.event_id == event.id))
    assert venue.address == "1345 Cheapside St, London, ON N5V 3N9"
    assert client.get(f"/v1/events/{event.slug}/teams").json()["total"] == 9
    matches = {
        m["source_match_id"]: m
        for m in client.get(
            f"/v1/events/{event.slug}/matches", params={"limit": 200}
        ).json()["data"]
    }
    assert len(matches) == 21
    first = matches["1000"]
    assert first["court"]["label"] == "Court 1"
    assert (first["home"]["team_name"], first["away"]["team_name"]) == (
        "Jr Gryphons Guardians",
        "Humana Embers",
    )
    start = datetime.fromisoformat(first["scheduled_start"])
    assert start.astimezone(ZoneInfo("America/Toronto")).isoformat() == (
        "2026-10-24T08:45:00-04:00"
    )
    assert matches["1003"]["scheduled_start"] is None

    changes = db.scalar(select(func.count()).select_from(ChangeEvent))
    timu_load(get=timu_recorded, today=date(2026, 10, 19))
    timu_load("4190", get=timu_recorded)
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(Event)) == 1
    assert db.scalar(select(func.count()).select_from(Source)) == 1
    assert db.scalar(select(func.count()).select_from(ChangeEvent)) == changes


def test_timu_load_keeps_title_tier_once_and_turns_on_polling(db, monkeypatch):
    from app.adapters.timu import read_timu
    from app.cli import timu_load
    from app.modules import sync
    from tests_unit.test_sources import timu_recorded

    monkeypatch.setattr(
        sync, "fetch_snapshot", lambda mode, config: read_timu(config, get=timu_recorded)
    )
    [event] = timu_load("4196", get=timu_recorded)
    assert event.title == "18U Girls Storm Ice Fall Exhibition"
    assert event.slug == "18u-girls-storm-ice-fall-exhibition"
    source = db.scalar(select(Source).where(Source.event_id == event.id))
    assert source.config["auto_sync"] is True

    # A source loaded before polling was switched on gets it on refresh.
    source.config = {k: v for k, v in source.config.items() if k != "auto_sync"}
    db.commit()
    timu_load("4196", get=timu_recorded)
    db.expire_all()
    assert db.get(Source, source.id).config["auto_sync"] is True
