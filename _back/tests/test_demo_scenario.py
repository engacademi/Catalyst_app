"""The demo scenario: real dates, upcoming matches, and the scripted transitions."""

from datetime import UTC, datetime

from sqlalchemy import select

from app.models import Court, Event, EventEntry, Match, RoleGrant, Source, User
from app.seed import (
    COACH_TEAM,
    MAYA_TEAM,
    SIBLING_TEAM,
    SOURCE_A,
    publish_playoff_draw,
    seed,
    seed_testing,
    set_feed_outage,
)
from tests.conftest import ADMIN

BASE = "/v1/events/demo-championships"


def team(db, name):
    return db.scalar(select(EventEntry.id).where(EventEntry.team_name == name))


def my_day(client, *names_ids):
    return client.get(
        f"{BASE}/my-day", params={"entry_ids": ",".join(map(str, names_ids))}
    ).json()["data"]


def test_followed_teams_have_timed_matches_duty_and_areas(client, db, demo):
    maya, sibling = team(db, MAYA_TEAM), team(db, SIBLING_TEAM)
    day = my_day(client, maya, sibling)
    upcoming = [day["matches"][i] for i in day["upcoming_ids"]]
    now = datetime.now(UTC)
    assert upcoming and all(
        datetime.fromisoformat(m["scheduled_start"]) > now for m in upcoming
    )
    first = day["matches"][day["next_by_entry"][str(maya)]]
    assert first["court"]["label"] == "Court 3 · Hall C"
    assert str(sibling) in day["next_by_entry"]
    duty = day["work_duties"]
    assert [m["work_entry_id"] for m in duty] == [str(maya)]
    assert datetime.fromisoformat(duty[0]["scheduled_start"]) > datetime.fromisoformat(
        first["scheduled_start"]
    )
    # One overlap later in the day; the Hall C delay adds a second one (demo step 4).
    assert len(day["conflicts"]) == 1
    hall_c = db.scalar(select(Court).where(Court.area_label == "Hall C"))
    posted = client.patch(
        f"/v1/admin/courts/{hall_c.id}/notice",
        headers=ADMIN,
        json={"delay_minutes": 20, "apply_to_area": True},
    )
    assert posted.status_code == 200
    delayed = my_day(client, maya, sibling)
    assert len(delayed["conflicts"]) == 2
    assert delayed["matches"][first["id"]]["estimate_source"] == "OVA staff"
    assert all(
        c.area_label for c in db.scalars(select(Court)) if c.venue.event_id == demo.id
    )
    assert not demo.demo_clock


def test_guide_rosters_and_registration_draft(client, db, demo):
    guide = client.get(f"{BASE}/guide").json()["data"]
    kinds = {item["kind"] for item in guide["items"]}
    assert {"parking", "food", "accessibility", "help", "officials"} <= kinds
    roster = client.get(f"/v1/entries/{team(db, MAYA_TEAM)}").json()["data"]["roster"]
    photos = {p["jersey"]: p["photo_url"] for p in roster["players"]}
    assert photos[7] is None and all(photos[j] for j in photos if j != 7)
    reviews = client.get(
        "/v1/me/roster-reviews", headers={"X-Dev-User": "dev-coach"}
    ).json()["data"]
    assert [(r["team"], r["state"]) for r in reviews] == [(COACH_TEAM, "draft")]
    assert reviews[0]["review"]["photos_withheld"] == 1
    assert "Birth Year" not in str(reviews[0]["players"])


def test_playoff_draw_fills_placeholders_once(client, db, demo):
    maya = team(db, MAYA_TEAM)
    after = client.get(f"{BASE}/changes").json()["latest_id"]
    assert publish_playoff_draw(db) > 0
    feed = client.get(f"{BASE}/changes", params={"after": after}).json()["data"]
    resolved = [c for c in feed if c["event_type"] == "participants_resolved"]
    assert len(resolved) == 6 and any(str(maya) in c["entry_ids"] for c in resolved)
    day = my_day(client, maya)
    rounds = {day["matches"][i]["round_label"] for i in day["upcoming_ids"]}
    assert "Gold medal" in rounds
    assert not day["awaiting_schedule_ids"]
    assert publish_playoff_draw(db) == 0


def test_feed_outage_keeps_schedule_and_reset_restores(client, db, demo):
    result = set_feed_outage(db)
    assert result["ok"] is False
    detail = client.get(BASE).json()
    feed_a = next(s for s in detail["sources"] if s["name"] == SOURCE_A)
    assert feed_a["freshness"] == "unavailable" and feed_a["last_error"]
    assert client.get(f"{BASE}/matches").json()["data"]
    assert set_feed_outage(db, down=False)["ok"] is True

    set_feed_outage(db)
    publish_playoff_draw(db)
    maya, event_id = team(db, MAYA_TEAM), demo.id
    seed(db, reset=True)
    assert team(db, MAYA_TEAM) == maya
    assert db.scalar(select(Event.id).where(Event.slug == "demo-championships")) == (
        event_id
    )
    sources = client.get(BASE).json()["sources"]
    assert {s["freshness"] for s in sources} == {"imported_snapshot"}
    assert (
        my_day(client, maya)["matches"][
            my_day(client, maya)["next_by_entry"][str(maya)]
        ]["round_label"]
        == "Pool A"
    )
    gold = db.scalar(select(Match).where(Match.external_id == "15UB-D1-GOLD"))
    assert all(p.entry_id is None for p in gold.participants)


def test_rebuild_keeps_grants_and_leaves_real_events_alone(client, db, demo):
    judge = User(clerk_subject="judge-coach")
    db.add(judge)
    db.flush()
    db.add(
        RoleGrant(
            user_id=judge.id,
            organization_id=demo.organization_id,
            event_id=demo.id,
            entry_id=team(db, MAYA_TEAM),
            role="coach",
        )
    )
    real = Event(
        organization_id=demo.organization_id,
        slug="real-event",
        title="Real event",
        start_date=demo.start_date,
        end_date=demo.end_date,
        status="published",
    )
    db.add(real)
    db.add(Source(event=real, name="AES", mode="aes"))
    db.commit()
    grants = db.scalar(
        select(RoleGrant.id).where(RoleGrant.user_id == judge.id).limit(1)
    )
    assert grants
    seed_testing(db)
    seed_testing(db)
    kept = list(db.scalars(select(RoleGrant).where(RoleGrant.user_id == judge.id)))
    assert [g.entry_id for g in kept] == [team(db, MAYA_TEAM)]
    dev = db.scalar(select(User).where(User.clerk_subject == "dev-official"))
    # One official grant on the demo event; the staff showcase holds its own.
    dev_grants = select(RoleGrant).where(
        RoleGrant.user_id == dev.id, RoleGrant.event_id == demo.id
    )
    assert len(list(db.scalars(dev_grants))) == 1
    assert db.scalar(select(Source.name).where(Source.event_id == real.id)) == "AES"


def test_provincial_operations_are_actionable_and_preserve_staff_changes(
    client, db, demo
):
    import uuid

    from app.demo_operations import seed_demo_operations
    from app.models import Announcement, ScoreDispute, Venue

    assert demo.title == "Provincial Champions 2026 · Demo"
    reports = client.get(f"/v1/admin/events/{demo.id}/disputes", headers=ADMIN)
    assert reports.status_code == 200
    reports = reports.json()["data"]
    assert sorted(r["status"] for r in reports) == ["open", "open", "resolved"]
    report = next(r for r in reports if r["status"] == "open")
    match = db.get(Match, uuid.UUID(report["match_id"]))
    corrected = client.patch(
        f"/v1/admin/matches/{match.id}",
        headers=ADMIN,
        json={
            "expected_revision": match.revision,
            "sets": [[25, 23], [25, 21]],
        },
    )
    assert corrected.status_code == 200
    assert (
        client.patch(
            f"/v1/admin/disputes/{report['id']}/resolve", headers=ADMIN
        ).status_code
        == 200
    )
    # Re-running the add-on must not reopen disputes or overwrite a lead's delay edits.
    court = db.scalar(
        select(Court).where(
            Court.venue_id.in_(select(Venue.id).where(Venue.event_id == demo.id)),
            Court.label == "Court 4",
        )
    )
    court.delay = {**court.delay, "minutes": 10}
    seed_demo_operations(db, demo, court_label="Court 4")
    db.commit()
    db.expire_all()
    assert db.get(ScoreDispute, uuid.UUID(report["id"])).status == "resolved"
    assert court.delay["minutes"] == 10
    assert len(list(db.scalars(select(ScoreDispute)))) == 3
    notice = db.scalar(
        select(Announcement).where(
            Announcement.event_id == demo.id,
            Announcement.title == "Court 4: running ~20 minutes late",
        )
    )
    assert notice and notice.expire_at and notice.state == "published"
    feed = client.get(f"{BASE}/changes").json()["data"]
    assert any(c["event_type"] == "delay_notice" for c in feed)
    assert any(
        c["event_type"] == "announcement_published" and c["entity_id"] == str(notice.id)
        for c in feed
    )
