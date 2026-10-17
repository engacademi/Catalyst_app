from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app.models import Source
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
    assert db.scalar(select(func.count()).select_from(Event)) == 4
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
