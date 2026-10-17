from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models import EventEntry, Match
from tests.conftest import ADMIN, OFFICIAL


def entry_id(db, name: str) -> str:
    return str(db.scalar(select(EventEntry.id).where(EventEntry.team_name == name)))


def test_health(client):
    assert client.get("/health/live").json() == {"status": "ok"}
    assert client.get("/health/ready").status_code == 200


def test_event_and_team_search(client, demo):
    events = client.get("/v1/events").json()["data"]
    assert events[0]["slug"] == "demo-championships" and events[0]["is_demo"]
    detail = client.get("/v1/events/demo-championships").json()
    assert detail["data"]["counts"]["entries"] == 12
    assert {s["freshness"] for s in detail["sources"]} == {"imported_snapshot"}
    found = client.get("/v1/events/demo-championships/teams", params={"q": "TLSG"}).json()
    assert found["total"] == 4
    assert client.get("/v1/events/not-real").status_code == 404


def test_etag_returns_304(client, demo):
    first = client.get("/v1/events/demo-championships/matches")
    again = client.get("/v1/events/demo-championships/matches", headers={"If-None-Match": first.headers["etag"]})
    assert again.status_code == 304


def test_my_day_merges_two_sources_and_dedupes(client, db, demo):
    a, b, c = entry_id(db, "Lakeshore Thunder"), entry_id(db, "North Bay Breakers"), entry_id(db, "Greenfield Flyers")
    data = client.get("/v1/events/demo-championships/my-day", params={"entry_ids": f"{a},{b},{c}"}).json()["data"]
    sources = {m["source"]["name"] for m in data["matches"].values()}
    assert len(sources) == 2
    # Lakeshore Thunder plays North Bay Breakers once; that match appears once.
    ids = data["upcoming_ids"] + data["completed_ids"] + data["awaiting_schedule_ids"]
    assert len(ids) == len(set(ids))
    assert data["assumed_match_minutes"] == 60


def test_public_roster_omits_withheld_photo(client, db, demo):
    team = client.get(f"/v1/entries/{entry_id(db, 'Lakeshore Thunder')}").json()["data"]
    players = team["roster"]["players"]
    assert len(players) == 10
    assert all(p["photo_url"] is None for p in players)
    assert set(players[0]) == {"jersey", "display_name", "position", "photo_url"}
    # A team with no approved roster shows no athletes at all.
    assert client.get(f"/v1/entries/{entry_id(db, 'Kingston Tide')}").json()["data"]["roster"] is None


def test_admin_requires_identity_and_grant(client, demo):
    assert client.get("/v1/admin/events").status_code == 401
    assert client.post(
        f"/v1/admin/events/{demo.id}/announcements", json={"title": "Hi there", "body": "x"}, headers=OFFICIAL
    ).status_code == 403
    assert client.get("/v1/admin/events", headers={"X-Dev-User": "stranger"}).json()["data"] == []


def test_publish_announcement_reaches_change_feed(client, db, demo):
    team = entry_id(db, "Lakeshore Thunder")
    created = client.post(
        f"/v1/admin/events/{demo.id}/announcements",
        json={"title": "Court 2 delayed", "body": "Running 15 minutes late.", "category": "schedule", "entry_id": team},
        headers=ADMIN,
    ).json()["data"]
    assert created["state"] == "draft"
    assert all(a["id"] != created["id"] for a in client.get("/v1/events/demo-championships/announcements").json()["data"])

    client.post(f"/v1/admin/announcements/{created['id']}/publish", headers=ADMIN)
    feed = client.get("/v1/events/demo-championships/changes").json()
    latest = feed["data"][0]
    assert latest["event_type"] == "announcement_published" and latest["entry_ids"] == [team]
    assert created["id"] in feed["announcements"]

    stale = client.patch(f"/v1/admin/announcements/{created['id']}", json={"title": "New title", "expected_revision": 1}, headers=ADMIN)
    assert stale.status_code == 409


def test_simulated_court_change(client, db, demo):
    match = db.scalar(select(Match).where(Match.status == "scheduled", Match.scheduled_start.is_not(None)).limit(1))
    after = client.get("/v1/events/demo-championships/changes").json()["latest_id"]
    result = client.post(
        f"/v1/admin/events/{demo.id}/simulate-change",
        json={"match_id": str(match.id), "court_label": "Court 9"},
        headers=ADMIN,
    ).json()["data"]
    assert result["change_events"] == ["court_changed"]
    feed = client.get("/v1/events/demo-championships/changes", params={"after": after}).json()
    assert [c["event_type"] for c in feed["data"]] == ["court_changed"]
    assert feed["data"][0]["simulated"] is True
    detail = client.get(f"/v1/matches/{match.id}").json()["data"]
    assert detail["court"]["label"] == "Court 9" and detail["latest_change"]["event_type"] == "court_changed"


def test_admin_csv_upload_preview_and_commit(client, demo):
    detail = client.get(f"/v1/admin/events/{demo.id}", headers=ADMIN).json()["data"]
    source = detail["sources"][0]["id"]
    csv = b"external_entry_id,team_name,club_name,division\nNEW-1,Brand New Team,New VC,15U Boys D1\n"
    staged = client.post(
        "/v1/admin/imports",
        data={"event_id": str(demo.id), "source_id": source, "kind": "entries"},
        files={"file": ("entries.csv", csv, "text/csv")},
        headers=ADMIN,
    ).json()["data"]
    assert staged["summary"]["add"] == 1 and staged["state"] == "staged"
    committed = client.post(f"/v1/admin/imports/{staged['id']}/commit", headers=ADMIN).json()["data"]
    assert committed["state"] == "committed"
    # Retrying the commit is safe.
    assert client.post(f"/v1/admin/imports/{staged['id']}/commit", headers=ADMIN).status_code == 200


def test_unavailable_source_keeps_schedule_and_says_so(client, demo):
    detail = client.get(f"/v1/admin/events/{demo.id}", headers=ADMIN).json()["data"]
    client.patch(f"/v1/admin/sources/{detail['sources'][0]['id']}", json={"status": "unavailable"}, headers=ADMIN)
    matches = client.get("/v1/events/demo-championships/matches").json()
    assert matches["data"], "the last known schedule is still served"
    assert "unavailable" in {s["freshness"] for s in matches["sources"]}


def test_calendar_snapshot(client, db, demo):
    team = entry_id(db, "Lakeshore Thunder")
    ics = client.get("/v1/events/demo-championships/calendar.ics", params={"entry_ids": team})
    assert ics.headers["content-type"].startswith("text/calendar")
    assert "BEGIN:VEVENT" in ics.text and "SEQUENCE:1" in ics.text and "Snapshot" in ics.text


def test_official_sees_only_own_assignments(client, demo):
    mine = client.get("/v1/me/assignments", headers=OFFICIAL).json()["data"]
    assert len(mine) == 2 and mine[0]["court"] is not None
    assert client.get("/v1/me/assignments", headers=ADMIN).json()["data"] == []


def test_admin_creates_beach_event(client):
    from app.core.db import get_sessionmaker
    from app.models import Organization, RoleGrant, User

    with get_sessionmaker()() as db:
        org = Organization(name="OVA")
        user = User(clerk_subject="boss")
        db.add_all([org, user])
        db.flush()
        db.add(RoleGrant(user_id=user.id, organization_id=org.id, role="admin"))
        db.commit()
    today = datetime.now(timezone.utc).date()
    created = client.post(
        "/v1/admin/events",
        json={"slug": "beach-2027", "title": "Beach Ontario Championships", "kind": "beach",
              "start_date": str(today), "end_date": str(today + timedelta(days=2))},
        headers={"X-Dev-User": "boss"},
    )
    assert created.status_code == 201 and created.json()["data"]["kind"] == "beach"
    assert client.get("/v1/events/beach-2027").status_code == 404, "drafts stay private"


def test_demo_reset_deletes_cleanly(client, db, demo):
    from app.seed import seed

    match = db.scalar(select(Match).where(Match.status == "scheduled").limit(1))
    client.post(f"/v1/admin/events/{demo.id}/simulate-change", json={"match_id": str(match.id), "court_label": "Court 8"}, headers=ADMIN)
    fresh = seed(db, reset=True)
    assert fresh.id != demo.id
    assert client.get("/v1/events/demo-championships").json()["data"]["counts"]["entries"] == 12


DEMO_TIME = "2026-04-19T09:40:00-04:00"


@pytest.fixture
def demo_mode(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "demo_mode", True)


def test_demo_time_is_refused_outside_demo_mode(client, demo):
    refused = client.put(f"/v1/admin/events/{demo.id}/demo-clock", json={"demo_time": DEMO_TIME}, headers=ADMIN)
    assert refused.status_code == 409
    event = client.get("/v1/events/demo-championships").json()["data"]
    assert event["demo_time"] is False


class FakeClock:
    def __init__(self, start: datetime):
        self.now = start

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def real_clock(monkeypatch):
    clock = FakeClock(datetime(2026, 10, 18, 14, 0, tzinfo=timezone.utc))
    monkeypatch.setattr("app.modules.clock.real_now", clock)
    return clock


def event_now(client) -> tuple[datetime, bool]:
    event = client.get("/v1/events/demo-championships").json()["data"]
    return datetime.fromisoformat(event["now"]), event["demo_time"]


def test_demo_clock_ticks_jumps_and_clears(client, demo, demo_mode, real_clock):
    clock = f"/v1/admin/events/{demo.id}/demo-clock"
    assert client.put(clock, json={"demo_time": DEMO_TIME}, headers=ADMIN).status_code == 200
    assert event_now(client) == (datetime.fromisoformat(DEMO_TIME), True)

    real_clock.now += timedelta(minutes=5)
    assert event_now(client)[0] == datetime.fromisoformat("2026-04-19T09:45:00-04:00")

    jumped = client.post(f"{clock}/jump", json={}, headers=ADMIN).json()["data"]
    assert datetime.fromisoformat(jumped["now"]) == datetime.fromisoformat("2026-04-19T10:00:00-04:00")
    assert event_now(client)[0] == datetime.fromisoformat("2026-04-19T10:00:00-04:00")

    client.delete(clock, headers=ADMIN)
    assert event_now(client) == (real_clock.now, False)
    assert client.post(f"{clock}/jump", json={}, headers=ADMIN).status_code == 409


APRIL_MATCHES = b"""external_match_id,division,scheduled_start,venue,court,home_entry_id,away_entry_id,round,status
APR-1,15U Boys D1,2026-04-19T08:00:00-04:00,Hall A,Court 1,15UB-D1-1,15UB-D1-2,Pool B,scheduled
APR-2,15U Boys D1,2026-04-19T10:00:00-04:00,Hall A,Court 1,15UB-D1-1,15UB-D1-3,Pool B,scheduled
"""


def test_my_day_picks_next_match_by_demo_time(client, db, demo, demo_mode):
    source = client.get(f"/v1/admin/events/{demo.id}", headers=ADMIN).json()["data"]["sources"][0]["id"]
    staged = client.post(
        "/v1/admin/imports",
        data={"event_id": str(demo.id), "source_id": source, "kind": "matches"},
        files={"file": ("matches.csv", APRIL_MATCHES, "text/csv")},
        headers=ADMIN,
    ).json()["data"]
    client.post(f"/v1/admin/imports/{staged['id']}/commit", headers=ADMIN)
    team = entry_id(db, "Lakeshore Thunder")
    april = {str(m.external_id): str(m.id) for m in db.scalars(select(Match).where(Match.external_id.like("APR-%")))}

    def next_match() -> str | None:
        return client.get("/v1/events/demo-championships/my-day", params={"entry_ids": team}).json()["data"]["next_match_id"]

    clock = f"/v1/admin/events/{demo.id}/demo-clock"
    client.put(clock, json={"demo_time": "2026-04-19T07:30:00-04:00"}, headers=ADMIN)
    assert next_match() == april["APR-1"]
    client.put(clock, json={"demo_time": DEMO_TIME}, headers=ADMIN)
    assert next_match() == april["APR-2"]
