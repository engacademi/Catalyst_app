from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models import EventEntry, Match
from tests.conftest import ADMIN, OFFICIAL
from tests.test_aes import EVENT_KEY as AES_KEY
from tests.test_aes import recorded


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


def aes_source(client, fetch) -> str:
    from app.api.admin import aes_fetch
    from app.main import app

    app.dependency_overrides[aes_fetch] = lambda: fetch
    created = client.post(
        "/v1/admin/events",
        json={"slug": "ontario-2", "title": "Ontario Championships Event 2", "start_date": "2026-04-19", "end_date": "2026-04-21"},
        headers=ADMIN,
    ).json()["data"]
    client.patch(f"/v1/admin/events/{created['id']}", json={"status": "published"}, headers=ADMIN)
    source = client.post(
        f"/v1/admin/events/{created['id']}/sources",
        json={"name": "AES Event 2", "mode": "aes", "external_key": AES_KEY},
        headers=ADMIN,
    )
    assert source.status_code == 201
    assert source.json()["data"]["official_url"] == f"https://results.advancedeventsystems.com/event/{AES_KEY}"
    return source.json()["data"]["id"]


@pytest.fixture
def no_overrides():
    from app.main import app

    yield
    app.dependency_overrides.clear()


def test_aes_source_needs_an_event_key(client, demo):
    response = client.post(f"/v1/admin/events/{demo.id}/sources", json={"name": "AES", "mode": "aes"}, headers=ADMIN)
    assert response.status_code == 422


def test_aes_refresh_preview_commit_then_search_and_follow(client, demo, no_overrides):
    source_id = aes_source(client, recorded())
    staged = client.post(f"/v1/admin/sources/{source_id}/refresh", json={"kind": "entries"}, headers=ADMIN)
    assert staged.status_code == 201
    preview = staged.json()["data"]
    assert preview["state"] == "staged" and preview["summary"]["found"] == {"divisions": 2, "clubs": 38, "teams": 46}
    assert {r["action"] for r in preview["rows"]} == {"add"}
    assert client.get("/v1/events/ontario-2/teams", params={"q": "Woodstock"}).json()["total"] == 0

    assert client.post(f"/v1/admin/imports/{preview['id']}/commit", headers=ADMIN).json()["data"]["state"] == "committed"
    found = client.get("/v1/events/ontario-2/teams", params={"q": "Woodstock"}).json()
    assert found["total"] == 1 and found["data"][0]["team_name"] == "Woodstock Warriors"
    assert client.get("/v1/events/ontario-2/teams", params={"q": "TLSG D7"}).json()["total"] == 20

    team = found["data"][0]["id"]
    assert client.get(f"/v1/entries/{team}").json()["data"]["team_name"] == "Woodstock Warriors"
    assert client.get("/v1/events/ontario-2/my-day", params={"entry_ids": team}).status_code == 200

    aes = next(s for s in client.get("/v1/events/ontario-2").json()["sources"] if s["mode"] == "aes")
    upstream = datetime.fromisoformat(aes["upstream_updated_at"])
    assert upstream == datetime(2026, 4, 28, 13, 43, 1, 963904, tzinfo=timezone.utc), "AES last-update time"
    assert aes["freshness"] == "current"


def test_aes_outage_keeps_teams_and_shows_unavailable(client, demo, no_overrides):
    from app.api.admin import aes_fetch
    from app.main import app

    source_id = aes_source(client, recorded())
    preview = client.post(f"/v1/admin/sources/{source_id}/refresh", json={"kind": "entries"}, headers=ADMIN).json()["data"]
    client.post(f"/v1/admin/imports/{preview['id']}/commit", headers=ADMIN)

    def down(url: str) -> bytes:
        raise TimeoutError("timed out")

    app.dependency_overrides[aes_fetch] = lambda: down
    failed = client.post(f"/v1/admin/sources/{source_id}/refresh", json={"kind": "entries"}, headers=ADMIN)
    assert failed.status_code == 502 and "AES" in failed.json()["detail"]

    health = client.get(f"/v1/admin/sources/{source_id}/health", headers=ADMIN).json()["data"]
    assert health["status"] == "unavailable" and health["unavailable_since"] and health["last_check_error"]
    aes = next(s for s in client.get("/v1/events/ontario-2").json()["sources"] if s["mode"] == "aes")
    assert aes["freshness"] == "unavailable" and aes["unavailable_since"] == health["unavailable_since"]
    assert client.get("/v1/events/ontario-2/teams").json()["total"] == 46
