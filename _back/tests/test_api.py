from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.models import Division, EventEntry, Match
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


def test_my_day_with_followed_division_and_entry(client, db, demo):
    team = entry_id(db, "Lakeshore Thunder")
    division = str(db.scalar(select(Division.id).where(Division.name == "TLS Girls D1")))
    data = client.get(
        "/v1/events/demo-championships/my-day", params={"entry_ids": team, "division_ids": division}
    ).json()["data"]
    # The Next Match card and the main schedule use followed teams only.
    mine = data["upcoming_ids"] + data["awaiting_schedule_ids"] + data["completed_ids"]
    assert mine and all(team in (data["matches"][i]["home"]["entry_id"], data["matches"][i]["away"]["entry_id"]) for i in mine)
    assert data["next_match_id"] in data["upcoming_ids"] or data["next_match_id"] is None
    [section] = data["division_sections"]
    assert section["division"]["name"] == "TLS Girls D1"
    listed = section["upcoming_ids"] + section["awaiting_schedule_ids"] + section["completed_ids"]
    total = db.scalar(select(func.count()).select_from(Match).where(Match.division_id == section["division"]["id"]))
    assert len(listed) == total and not set(listed) & set(mine)
    assert {data["matches"][i]["division"]["name"] for i in listed} == {"TLS Girls D1"}


def test_my_day_with_only_a_followed_division(client, db, demo):
    division = str(db.scalar(select(Division.id).where(Division.name == "15U Boys D1")))
    data = client.get("/v1/events/demo-championships/my-day", params={"division_ids": division}).json()["data"]
    assert data["next_match_id"] is None and data["upcoming_ids"] == []
    assert data["division_sections"][0]["upcoming_ids"]


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


def test_court_area_label_reaches_public_data(client, db, demo):
    match = db.scalar(select(Match).where(Match.court_id.is_not(None)).limit(1))
    court = str(match.court_id)
    assert client.get(f"/v1/matches/{match.id}").json()["data"]["court"]["area"] is None
    assert client.patch(f"/v1/admin/courts/{court}", json={"area": "Hall C, north side"}, headers=OFFICIAL).status_code == 403

    updated = client.patch(f"/v1/admin/courts/{court}", json={"area": "Hall C, north side"}, headers=ADMIN)
    assert updated.status_code == 200 and updated.json()["data"]["area"] == "Hall C, north side"
    assert client.get(f"/v1/matches/{match.id}").json()["data"]["court"]["area"] == "Hall C, north side"
    listed = client.get("/v1/events/demo-championships/matches").json()["data"]
    assert any(m["court"] and m["court"]["area"] == "Hall C, north side" for m in listed)
    guide = client.get("/v1/events/demo-championships/guide").json()["data"]
    courts = [c for v in guide["venues"] for c in v["courts"]]
    assert {"id": court, "label": match.court.label, "area": "Hall C, north side"} in courts

    client.patch(f"/v1/admin/courts/{court}", json={"area": "  "}, headers=ADMIN)
    assert client.get(f"/v1/matches/{match.id}").json()["data"]["court"]["area"] is None
    assert any(a["action"] == "court.update" for a in client.get(f"/v1/admin/events/{demo.id}/audit", headers=ADMIN).json()["data"])


def test_filled_placeholder_reaches_followers_updates_and_my_day(client, db, demo):
    gold = db.scalar(select(Match).where(Match.external_id == "15UB-D1-GOLD"))
    thunder = entry_id(db, "Lakeshore Thunder")
    assert str(gold.id) not in client.get("/v1/events/demo-championships/my-day", params={"entry_ids": thunder}).json()["data"]["matches"]
    after = client.get("/v1/events/demo-championships/changes").json()["latest_id"]

    start = gold.scheduled_start.isoformat()
    csv = (
        "external_match_id,division,round,scheduled_start,venue,court,home_entry_id,away_entry_id,home_placeholder,away_placeholder,status\n"
        f"15UB-D1-GOLD,15U Boys D1,Gold medal,{start},{gold.court.venue.name},{gold.court.label},15UB-D1-1,,,2nd Pool A,scheduled\n"
    ).encode()
    staged = client.post(
        "/v1/admin/imports",
        data={"event_id": str(demo.id), "source_id": str(gold.source_id), "kind": "matches"},
        files={"file": ("matches.csv", csv, "text/csv")},
        headers=ADMIN,
    ).json()["data"]
    client.post(f"/v1/admin/imports/{staged['id']}/commit", headers=ADMIN)

    feed = client.get("/v1/events/demo-championships/changes", params={"after": after}).json()
    assert [(c["event_type"], c["entry_ids"]) for c in feed["data"]] == [("next_match_set", [thunder])]
    assert feed["data"][0]["diff"]["round"] == "Gold medal"
    assert feed["data"][0]["diff"]["filled"][0]["team_name"] == "Lakeshore Thunder"
    my_day = client.get("/v1/events/demo-championships/my-day", params={"entry_ids": thunder}).json()["data"]
    assert str(gold.id) in my_day["matches"]


def test_imported_work_team_shows_as_a_work_duty_in_my_day(client, db, demo):
    detail = client.get(f"/v1/admin/events/{demo.id}", headers=ADMIN).json()["data"]
    source = next(s["id"] for s in detail["sources"] if s["name"].startswith("Demo fixture A"))
    start = (datetime.now(timezone.utc) + timedelta(days=1)).replace(microsecond=0).isoformat()
    csv = (
        "external_match_id,division,scheduled_start,venue,court,home_entry_id,away_entry_id,work_entry_id,round,status\n"
        f"15UB-D1-M2,15U Boys D1,{start},Hall A,Court 2,15UB-D1-3,15UB-D1-4,15UB-D1-1,Pool A,scheduled\n"
    ).encode()
    staged = client.post(
        "/v1/admin/imports",
        data={"event_id": str(demo.id), "source_id": source, "kind": "matches"},
        files={"file": ("matches.csv", csv, "text/csv")},
        headers=ADMIN,
    ).json()["data"]
    client.post(f"/v1/admin/imports/{staged['id']}/commit", headers=ADMIN)

    thunder = entry_id(db, "Lakeshore Thunder")
    data = client.get("/v1/events/demo-championships/my-day", params={"entry_ids": thunder}).json()["data"]
    [duty] = data["work_duties"]
    assert duty["entry_id"] == thunder
    assert duty["match_id"] not in data["upcoming_ids"] + data["completed_ids"] + data["awaiting_schedule_ids"]
    worked = data["matches"][duty["match_id"]]
    assert (worked["home"]["team_name"], worked["away"]["team_name"]) == ("Cedar Ridge Rally", "Kingston Tide")
    assert worked["court"]["label"] == "Court 2"
    assert datetime.fromisoformat(worked["scheduled_start"]) == datetime.fromisoformat(start)
    assert worked["work_entry"] == {"entry_id": thunder, "team_name": "Lakeshore Thunder"}

    others = client.get("/v1/events/demo-championships/my-day", params={"entry_ids": entry_id(db, "North Bay Breakers")}).json()["data"]
    assert others["work_duties"] == []


def test_change_feed_names_the_division_of_each_change(client, db, demo):
    division = db.scalar(select(Division).where(Division.name == "TLS Girls D1"))
    match = db.scalar(select(Match).where(Match.division_id == division.id, Match.status == "scheduled").limit(1))
    after = client.get("/v1/events/demo-championships/changes").json()["latest_id"]
    client.post(
        f"/v1/admin/events/{demo.id}/simulate-change",
        json={"match_id": str(match.id), "court_label": "Court 9"},
        headers=ADMIN,
    )
    notice = client.post(
        f"/v1/admin/events/{demo.id}/announcements",
        json={"title": "TLS pool moved", "body": "Pool A plays in Hall C.", "category": "schedule", "division_id": str(division.id)},
        headers=ADMIN,
    ).json()["data"]
    client.post(f"/v1/admin/announcements/{notice['id']}/publish", headers=ADMIN)
    feed = client.get("/v1/events/demo-championships/changes", params={"after": after}).json()["data"]
    assert [(c["event_type"], c["division_id"]) for c in feed] == [
        ("announcement_published", str(division.id)),
        ("court_changed", str(division.id)),
    ]


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


DELAY_MATCHES = b"""external_match_id,division,scheduled_start,venue,court,home_entry_id,away_entry_id,round,status,estimated_start
DLY-1,15U Boys D1,2026-04-19T09:00:00-04:00,Hall A,Court 7,15UB-D1-1,15UB-D1-2,Pool C,in_progress,
DLY-2,15U Boys D1,2026-04-19T10:00:00-04:00,Hall A,Court 7,15UB-D1-1,15UB-D1-3,Pool C,scheduled,
DLY-3,15U Boys D1,2026-04-19T11:00:00-04:00,Hall A,Court 7,15UB-D1-2,15UB-D1-3,Pool C,scheduled,
DLY-4,15U Boys D1,2026-04-19T10:00:00-04:00,Hall A,Court 8,15UB-D1-4,15UB-D1-3,Pool C,scheduled,
"""


@pytest.fixture
def delay_court(client, db, demo, demo_mode, real_clock):
    """Court 7 with one match in progress and two to come, at demo time 9:40 on April 19."""
    source = client.get(f"/v1/admin/events/{demo.id}", headers=ADMIN).json()["data"]["sources"][0]["id"]
    staged = client.post(
        "/v1/admin/imports",
        data={"event_id": str(demo.id), "source_id": source, "kind": "matches"},
        files={"file": ("matches.csv", DELAY_MATCHES, "text/csv")},
        headers=ADMIN,
    ).json()["data"]
    client.post(f"/v1/admin/imports/{staged['id']}/commit", headers=ADMIN)
    client.put(f"/v1/admin/events/{demo.id}/demo-clock", json={"demo_time": DEMO_TIME}, headers=ADMIN)
    matches = {m.external_id: m for m in db.scalars(select(Match).where(Match.external_id.like("DLY-%")))}
    return {"court": str(matches["DLY-2"].court_id), "source": source, **{k: str(m.id) for k, m in matches.items()}}


def public_match(client, match_id: str) -> dict:
    return client.get(f"/v1/matches/{match_id}").json()["data"]


def at(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def test_delay_notice_gives_unstarted_matches_on_the_court_an_estimated_start(client, demo, delay_court):
    posted = client.post(
        f"/v1/admin/courts/{delay_court['court']}/delay-notices", json={"minutes": 20}, headers=ADMIN
    )
    assert posted.status_code == 201
    notice = posted.json()["data"]
    assert notice["minutes"] == 20
    assert at(notice["posted_at"]) == datetime.fromisoformat(DEMO_TIME)
    assert at(notice["expires_at"]) == datetime.fromisoformat("2026-04-19T10:40:00-04:00")

    upcoming = public_match(client, delay_court["DLY-2"])
    assert at(upcoming["scheduled_start"]) == datetime.fromisoformat("2026-04-19T10:00:00-04:00")
    assert at(upcoming["estimated_start"]) == datetime.fromisoformat("2026-04-19T10:20:00-04:00")
    assert upcoming["estimated_start_by"] == "ova_staff"
    assert upcoming["delay_notice"]["minutes"] == 20
    assert upcoming["delay_notice"]["posted_by"] == "OVA staff"

    listed = client.get("/v1/events/demo-championships/matches", params={"court_id": delay_court["court"]}).json()["data"]
    later = next(m for m in listed if m["id"] == delay_court["DLY-3"])
    assert at(later["estimated_start"]) == datetime.fromisoformat("2026-04-19T11:20:00-04:00")

    started = public_match(client, delay_court["DLY-1"])
    assert started["estimated_start"] is None and started["delay_notice"] is None
    other_court = public_match(client, delay_court["DLY-4"])
    assert other_court["estimated_start"] is None and other_court["delay_notice"] is None

    audit = client.get(f"/v1/admin/events/{demo.id}/audit", headers=ADMIN).json()["data"]
    assert any(a["action"] == "delay_notice.post" and a["summary"]["minutes"] == 20 for a in audit)


def test_delay_notice_expires_by_the_event_clock(client, demo, delay_court, real_clock):
    client.post(
        f"/v1/admin/courts/{delay_court['court']}/delay-notices",
        json={"minutes": 20, "duration_minutes": 30},
        headers=ADMIN,
    )
    real_clock.now += timedelta(minutes=29)
    assert public_match(client, delay_court["DLY-3"])["delay_notice"]["minutes"] == 20

    # Demo time 10:10 is past the notice's expiry even though only a minute of real time passed.
    real_clock.now += timedelta(minutes=1)
    client.post(f"/v1/admin/events/{demo.id}/demo-clock/jump", json={"minutes": 1}, headers=ADMIN)
    expired = public_match(client, delay_court["DLY-3"])
    assert expired["delay_notice"] is None and expired["estimated_start"] is None
    assert at(expired["scheduled_start"]) == datetime.fromisoformat("2026-04-19T11:00:00-04:00")


def test_staff_clear_a_delay_notice_early(client, demo, delay_court):
    notice = client.post(
        f"/v1/admin/courts/{delay_court['court']}/delay-notices", json={"minutes": 15}, headers=ADMIN
    ).json()["data"]
    assert client.post(f"/v1/admin/delay-notices/{notice['id']}/clear", headers=OFFICIAL).status_code == 403

    cleared = client.post(f"/v1/admin/delay-notices/{notice['id']}/clear", headers=ADMIN)
    assert cleared.status_code == 200
    assert at(cleared.json()["data"]["cleared_at"]) == datetime.fromisoformat(DEMO_TIME)
    match = public_match(client, delay_court["DLY-2"])
    assert match["delay_notice"] is None and match["estimated_start"] is None

    actions = [a["action"] for a in client.get(f"/v1/admin/events/{demo.id}/audit", headers=ADMIN).json()["data"]]
    assert actions[:2] == ["delay_notice.clear", "delay_notice.post"]


def test_source_estimate_replaces_the_staff_estimate_but_the_notice_stays(client, demo, delay_court):
    csv = (
        b"external_match_id,division,scheduled_start,venue,court,home_entry_id,away_entry_id,round,status,estimated_start\n"
        b"DLY-3,15U Boys D1,2026-04-19T11:00:00-04:00,Hall A,Court 7,15UB-D1-2,15UB-D1-3,Pool C,scheduled,2026-04-19T11:35:00-04:00\n"
    )
    staged = client.post(
        "/v1/admin/imports",
        data={"event_id": str(demo.id), "source_id": delay_court["source"], "kind": "matches"},
        files={"file": ("matches.csv", csv, "text/csv")},
        headers=ADMIN,
    ).json()["data"]
    client.post(f"/v1/admin/imports/{staged['id']}/commit", headers=ADMIN)
    client.post(f"/v1/admin/courts/{delay_court['court']}/delay-notices", json={"minutes": 20}, headers=ADMIN)

    sourced = public_match(client, delay_court["DLY-3"])
    assert at(sourced["scheduled_start"]) == datetime.fromisoformat("2026-04-19T11:00:00-04:00")
    assert at(sourced["estimated_start"]) == datetime.fromisoformat("2026-04-19T11:35:00-04:00")
    assert sourced["estimated_start_by"] == "source"
    assert sourced["delay_notice"]["minutes"] == 20

    staff = public_match(client, delay_court["DLY-2"])
    assert (at(staff["estimated_start"]), staff["estimated_start_by"]) == (
        datetime.fromisoformat("2026-04-19T10:20:00-04:00"),
        "ova_staff",
    )


def test_posting_and_clearing_a_delay_reach_followers_of_teams_still_to_play_on_the_court(client, demo, delay_court):
    after = client.get("/v1/events/demo-championships/changes").json()["latest_id"]
    notice = client.post(
        f"/v1/admin/courts/{delay_court['court']}/delay-notices", json={"minutes": 20}, headers=ADMIN
    ).json()["data"]
    client.post(f"/v1/admin/delay-notices/{notice['id']}/clear", headers=ADMIN)

    feed = client.get("/v1/events/demo-championships/changes", params={"after": after}).json()["data"]
    assert [c["event_type"] for c in feed] == ["delay_cleared", "delay_posted"]
    posted = feed[1]
    assert posted["entity_type"] == "delay_notice" and posted["entity_id"] == notice["id"]
    assert posted["diff"]["court"] == "Court 7" and posted["diff"]["minutes"] == 20
    assert at(posted["diff"]["expires_at"]) == datetime.fromisoformat("2026-04-19T10:40:00-04:00")

    still_to_play = {
        side["entry_id"]
        for key in ("DLY-2", "DLY-3")
        for side in (public_match(client, delay_court[key])["home"], public_match(client, delay_court[key])["away"])
    }
    elsewhere = {public_match(client, delay_court["DLY-4"])["home"]["entry_id"]}
    assert set(posted["entry_ids"]) == still_to_play and not elsewhere & set(posted["entry_ids"])
    assert set(feed[0]["entry_ids"]) == still_to_play


def test_a_delay_reaches_no_one_when_nothing_on_the_court_is_still_to_play(client, db, demo, delay_court):
    """Court 9's only match was due at 7:00 and the source never marked it started. At 9:40 it isn't upcoming."""
    overdue = (
        b"external_match_id,division,scheduled_start,venue,court,home_entry_id,away_entry_id,round,status,estimated_start\n"
        b"DLY-5,15U Boys D1,2026-04-19T07:00:00-04:00,Hall A,Court 9,15UB-D1-1,15UB-D1-4,Pool C,scheduled,\n"
    )
    staged = client.post(
        "/v1/admin/imports",
        data={"event_id": str(demo.id), "source_id": delay_court["source"], "kind": "matches"},
        files={"file": ("matches.csv", overdue, "text/csv")},
        headers=ADMIN,
    ).json()["data"]
    client.post(f"/v1/admin/imports/{staged['id']}/commit", headers=ADMIN)
    court_9 = db.scalar(select(Match).where(Match.external_id == "DLY-5")).court_id
    court_8 = public_match(client, delay_court["DLY-4"])["court"]
    for court in (delay_court["court"], court_8["id"], str(court_9)):
        client.patch(f"/v1/admin/courts/{court}", json={"area": "Hall A north"}, headers=ADMIN)
    after = client.get("/v1/events/demo-championships/changes").json()["latest_id"]

    notices = client.post(
        f"/v1/admin/venues/{court_8['venue_id']}/delay-notices", json={"area": "Hall A north", "minutes": 25}, headers=ADMIN
    ).json()["data"]
    assert sorted(n["court"]["label"] for n in notices) == ["Court 7", "Court 8", "Court 9"]

    feed = client.get("/v1/events/demo-championships/changes", params={"after": after}).json()["data"]
    assert sorted(c["diff"]["court"] for c in feed) == ["Court 7", "Court 8"]
    assert all(c["entry_ids"] for c in feed), "a change with no entries would show to everyone"
    audit = client.get(f"/v1/admin/events/{demo.id}/audit", headers=ADMIN).json()["data"]
    assert sum(a["action"] == "delay_notice.post" for a in audit) == 3

    [court_9_notice] = [n for n in notices if n["court"]["label"] == "Court 9"]
    client.post(f"/v1/admin/delay-notices/{court_9_notice['id']}/clear", headers=ADMIN)
    feed = client.get("/v1/events/demo-championships/changes", params={"after": after}).json()["data"]
    assert len(feed) == 2


def test_replacing_a_delay_tells_followers_the_old_one_is_cleared(client, demo, delay_court):
    court = delay_court["court"]
    first = client.post(f"/v1/admin/courts/{court}/delay-notices", json={"minutes": 20}, headers=ADMIN).json()["data"]
    after = client.get("/v1/events/demo-championships/changes").json()["latest_id"]
    second = client.post(f"/v1/admin/courts/{court}/delay-notices", json={"minutes": 35}, headers=ADMIN).json()["data"]

    feed = client.get("/v1/events/demo-championships/changes", params={"after": after}).json()["data"]
    assert sorted((c["event_type"], c["entity_id"]) for c in feed) == sorted(
        [("delay_cleared", first["id"]), ("delay_posted", second["id"])]
    )
    assert all(c["entry_ids"] for c in feed)


def test_staff_see_active_delay_notices_with_their_court(client, demo, delay_court):
    client.post(f"/v1/admin/courts/{delay_court['court']}/delay-notices", json={"minutes": 20}, headers=ADMIN)
    replacement = client.post(
        f"/v1/admin/courts/{delay_court['court']}/delay-notices", json={"minutes": 35}, headers=ADMIN
    ).json()["data"]
    [active] = client.get(f"/v1/admin/events/{demo.id}/delay-notices", headers=ADMIN).json()["data"]
    assert active["id"] == replacement["id"] and active["minutes"] == 35
    assert active["court"]["label"] == "Court 7" and active["court"]["venue_name"] == "Hall A"
    assert client.get(f"/v1/admin/events/{demo.id}/delay-notices", headers=OFFICIAL).status_code == 403


def test_posting_for_an_area_gives_each_of_its_courts_its_own_notice(client, db, demo, delay_court):
    court_8 = public_match(client, delay_court["DLY-4"])["court"]
    venue = court_8["venue_id"]
    for court in (delay_court["court"], court_8["id"]):
        client.patch(f"/v1/admin/courts/{court}", json={"area": "Hall A north"}, headers=ADMIN)
    body = {"area": "Hall A north", "minutes": 25}
    assert client.post(f"/v1/admin/venues/{venue}/delay-notices", json=body, headers=OFFICIAL).status_code == 403
    assert client.post(
        f"/v1/admin/venues/{venue}/delay-notices", json={**body, "area": "Nowhere"}, headers=ADMIN
    ).status_code == 404

    posted = client.post(f"/v1/admin/venues/{venue}/delay-notices", json=body, headers=ADMIN)
    assert posted.status_code == 201
    notices = posted.json()["data"]
    assert sorted(n["court"]["label"] for n in notices) == ["Court 7", "Court 8"]
    assert {n["minutes"] for n in notices} == {25}
    active = client.get(f"/v1/admin/events/{demo.id}/delay-notices", headers=ADMIN).json()["data"]
    assert sorted(n["court"]["label"] for n in active) == ["Court 7", "Court 8"]
    for key, official in (("DLY-2", "10:00"), ("DLY-4", "10:00")):
        delayed = public_match(client, delay_court[key])
        assert at(delayed["scheduled_start"]) == datetime.fromisoformat(f"2026-04-19T{official}:00-04:00")
        assert at(delayed["estimated_start"]) == datetime.fromisoformat("2026-04-19T10:25:00-04:00")
        assert delayed["estimated_start_by"] == "ova_staff"

    court_7_notice = next(n for n in notices if n["court"]["label"] == "Court 7")
    client.post(f"/v1/admin/delay-notices/{court_7_notice['id']}/clear", headers=ADMIN)
    assert public_match(client, delay_court["DLY-2"])["estimated_start"] is None
    assert public_match(client, delay_court["DLY-4"])["delay_notice"]["minutes"] == 25
    audit = client.get(f"/v1/admin/events/{demo.id}/audit", headers=ADMIN).json()["data"]
    assert [a["action"] for a in audit].count("delay_notice.post") == 2


def test_my_day_orders_by_estimated_start_and_says_expected_to_start_soon(client, demo, delay_court):
    team = public_match(client, delay_court["DLY-2"])["away"]["entry_id"]
    client.post(f"/v1/admin/courts/{delay_court['court']}/delay-notices", json={"minutes": 30}, headers=ADMIN)
    day = client.get("/v1/events/demo-championships/my-day", params={"entry_ids": team}).json()["data"]
    order = [i for i in day["upcoming_ids"] if i in (delay_court["DLY-2"], delay_court["DLY-4"])]
    # Court 7 runs ~30 min late, so Court 8's 10:00 match comes before Court 7's (official 10:00, est. ~10:30).
    assert order == [delay_court["DLY-4"], delay_court["DLY-2"]]
    assert day["matches"][delay_court["DLY-2"]]["estimated_start_by"] == "ova_staff"
    assert day["expected_soon_ids"] == []

    client.post(f"/v1/admin/events/{demo.id}/demo-clock/jump", json={"minutes": 35}, headers=ADMIN)
    day = client.get("/v1/events/demo-championships/my-day", params={"entry_ids": team}).json()["data"]
    assert delay_court["DLY-4"] in day["expected_soon_ids"] and delay_court["DLY-2"] not in day["expected_soon_ids"]
    assert day["matches"][delay_court["DLY-4"]]["expected_to_start_soon"] is True
    assert day["matches"][delay_court["DLY-4"]]["status"] == "scheduled"
    assert public_match(client, delay_court["DLY-2"])["expected_to_start_soon"] is False
    assert public_match(client, delay_court["DLY-4"])["expected_to_start_soon"] is True


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


def test_aes_matches_refresh_shows_in_my_day_and_match_centre(client, demo, no_overrides):
    source_id = aes_source(client, recorded())
    teams = client.post(f"/v1/admin/sources/{source_id}/refresh", json={"kind": "entries"}, headers=ADMIN).json()["data"]
    client.post(f"/v1/admin/imports/{teams['id']}/commit", headers=ADMIN)

    staged = client.post(f"/v1/admin/sources/{source_id}/refresh", json={"kind": "matches"}, headers=ADMIN)
    assert staged.status_code == 201
    preview = staged.json()["data"]
    assert preview["kind"] == "matches" and preview["summary"]["add"] == 148
    assert preview["summary"]["found"] == {"matches": 148, "courts": 14}
    assert client.get("/v1/events/ontario-2/matches").json()["data"] == [], "nothing shows before commit"
    client.post(f"/v1/admin/imports/{preview['id']}/commit", headers=ADMIN)

    team = client.get("/v1/events/ontario-2/teams", params={"q": "Woodstock"}).json()["data"][0]["id"]
    day = client.get("/v1/events/ontario-2/my-day", params={"entry_ids": team}).json()["data"]
    shown = [m for m in day["matches"].values() if team in (m["home"]["entry_id"], m["away"]["entry_id"])]
    assert len(shown) == 6
    assert all(m["source"]["mode"] == "aes" and m["source"]["freshness"] == "current" for m in shown)

    centre = client.get("/v1/events/ontario-2/matches", params={"entry_ids": team}).json()
    first = centre["data"][0]
    assert first["court"]["label"].startswith("Court ") and first["court"]["venue_name"] == "Enercare Centre"
    assert first["sets"] and first["source"]["name"] == "AES Event 2"
