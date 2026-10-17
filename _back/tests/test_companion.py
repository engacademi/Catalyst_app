from datetime import timedelta
from sqlalchemy import select
from app.models import (
    Division,
    EventEntry,
    Match,
    RosterPublication,
    RoleGrant,
    User,
    Source,
    utcnow,
)
from tests.conftest import ADMIN, OFFICIAL


def test_division_follow_includes_unresolved_matches(client, db, demo):
    division = db.scalar(select(Division).where(Division.event_id == demo.id))
    result = client.get(
        "/v1/events/demo-championships/my-day",
        params={"division_ids": str(division.id)},
    )
    assert result.status_code == 200
    day = result.json()["data"]
    assert len(day["entries"]) == 4
    assert day["awaiting_schedule_ids"]
    assert len(set(day["matches"])) == 8
    assert client.get(
        "/v1/events/demo-championships/selection",
        params={"division_ids": str(division.id)},
    ).json()["data"]


def test_change_history_cursor_and_division_targeting(client, db, demo):
    division = db.scalar(select(Division).where(Division.event_id == demo.id))
    for i in range(3):
        a = client.post(
            f"/v1/admin/events/{demo.id}/announcements",
            headers=ADMIN,
            json={
                "title": f"Division notice {i}",
                "body": "Bring water",
                "division_id": str(division.id),
            },
        ).json()["data"]
        client.post(f"/v1/admin/announcements/{a['id']}/publish", headers=ADMIN)
    first = client.get("/v1/events/demo-championships/changes?limit=2").json()
    second = client.get(
        "/v1/events/demo-championships/changes",
        params={"limit": 2, "before": first["next_before"]},
    ).json()
    assert first["data"][0]["division_id"] == str(division.id)
    assert {c["id"] for c in first["data"]}.isdisjoint(c["id"] for c in second["data"])


def test_expired_and_future_announcements_absent_from_feed(client, db, demo):
    future = utcnow() + timedelta(hours=2)
    a = client.post(
        f"/v1/admin/events/{demo.id}/announcements",
        headers=ADMIN,
        json={
            "title": "Future notice",
            "body": "Later",
            "publish_at": future.isoformat(),
        },
    ).json()["data"]
    client.post(f"/v1/admin/announcements/{a['id']}/publish", headers=ADMIN)
    assert (
        a["id"]
        not in client.get("/v1/events/demo-championships/changes").json()[
            "announcements"
        ]
    )


def test_vendor_csv_fallback_stays_snapshot(client, db, demo):
    source = Source(
        event_id=demo.id,
        name="AES approved export",
        mode="aes",
        config={"event_key": "test"},
    )
    db.add(source)
    db.commit()
    result = client.post(
        "/v1/admin/imports",
        headers=ADMIN,
        data={"event_id": str(demo.id), "source_id": str(source.id), "kind": "entries"},
        files={
            "file": (
                "teams.csv",
                b"external_entry_id,team_name,division\nX,Example Team,Test Division\n",
            )
        },
    )
    assert result.status_code == 201
    client.post(
        f"/v1/admin/imports/{result.json()['data']['id']}/commit", headers=ADMIN
    )
    event = client.get("/v1/events/demo-championships").json()
    assert (
        next(s for s in event["sources"] if s["id"] == str(source.id))["freshness"]
        == "imported_snapshot"
    )


def test_registration_mapping_coach_review_and_publish(client, db, demo):
    entry = db.scalar(select(EventEntry).where(EventEntry.event_id == demo.id))
    source = db.scalar(select(Source).where(Source.event_id == demo.id))
    coach = User(clerk_subject="coach-test")
    db.add(coach)
    db.flush()
    db.add(
        RoleGrant(
            user_id=coach.id,
            organization_id=demo.organization_id,
            event_id=demo.id,
            entry_id=entry.id,
            role="coach",
        )
    )
    db.commit()
    import json

    result = client.post(
        "/v1/admin/imports",
        headers=ADMIN,
        data={
            "event_id": str(demo.id),
            "source_id": str(source.id),
            "kind": "rosters",
            "column_mapping": json.dumps(
                {
                    "external_entry_id": "Team ID",
                    "jersey": "Number",
                    "display_name": "Display Name",
                    "photo_url": "Photo",
                    "photo_approved": "Approved",
                }
            ),
            "team_mapping": json.dumps({"REG1": str(entry.id)}),
        },
        files={
            "file": (
                "registration.csv",
                b"Team ID,Number,Display Name,Photo,Approved\nREG1,4,Example A.,https://example.org/a.jpg,no\n",
            )
        },
    )
    assert result.status_code == 201, result.text
    client.post(
        f"/v1/admin/imports/{result.json()['data']['id']}/commit", headers=ADMIN
    )
    roster = db.scalar(
        select(RosterPublication)
        .where(RosterPublication.entry_id == entry.id)
        .order_by(RosterPublication.version.desc())
    )
    assert roster.state == "draft" and roster.public_players[0]["photo_url"] is None
    publish = f"/v1/admin/rosters/{roster.id}/publish"
    assert (
        client.post(
            publish, headers=ADMIN, json={"consent_review_ref": "Approved-2026"}
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"/v1/me/roster-reviews/{roster.id}",
            headers=OFFICIAL,
            json={"approved": True},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/v1/me/roster-reviews/{roster.id}",
            headers={"X-Dev-User": "coach-test"},
            json={"approved": True},
        ).status_code
        == 200
    )
    assert (
        client.post(
            publish, headers=ADMIN, json={"consent_review_ref": "Approved-2026"}
        ).status_code
        == 200
    )
    client.post(f"/v1/admin/rosters/{roster.id}/withdraw", headers=ADMIN)
    assert (
        client.post(
            publish, headers=ADMIN, json={"consent_review_ref": "Approved-2026"}
        ).status_code
        == 409
    )


def test_official_assignment_crud_is_private(client, db, demo):
    match = db.scalar(select(Match).where(Match.event_id == demo.id))
    body = {
        "subject": "dev-official",
        "role": "Line judge",
        "match_id": str(match.id),
        "reporting_time": utcnow().isoformat(),
    }
    created = client.post(
        f"/v1/admin/events/{demo.id}/assignments", headers=ADMIN, json=body
    )
    assert created.status_code == 201, created.text
    aid = created.json()["data"]["id"]
    assert any(
        a["id"] == aid
        for a in client.get("/v1/me/assignments", headers=OFFICIAL).json()["data"]
    )
    assert not any(
        a["id"] == aid
        for a in client.get("/v1/me/assignments", headers=ADMIN).json()["data"]
    )
    assert (
        client.get(
            f"/v1/admin/events/{demo.id}/assignments", headers=OFFICIAL
        ).status_code
        == 403
    )
    assert (
        client.put(
            f"/v1/admin/assignments/{aid}",
            headers=ADMIN,
            json={**body, "expected_revision": 1, "role": "Scorekeeper"},
        ).status_code
        == 200
    )
    assert (
        client.put(
            f"/v1/admin/assignments/{aid}",
            headers=ADMIN,
            json={**body, "expected_revision": 1},
        ).status_code
        == 409
    )
    assert (
        client.delete(f"/v1/admin/assignments/{aid}", headers=ADMIN).status_code == 204
    )


def test_delay_never_changes_official_start_and_expires_with_demo_clock(
    client, db, demo
):
    match = db.scalar(
        select(Match).where(
            Match.event_id == demo.id,
            Match.scheduled_start.is_not(None),
            Match.status == "scheduled",
        )
    )
    original = match.scheduled_start
    clock = original - timedelta(minutes=30)
    assert (
        client.post(
            f"/v1/admin/events/{demo.id}/clock",
            headers=ADMIN,
            json={"at": clock.isoformat()},
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/v1/admin/courts/{match.court_id}/notice",
            headers=ADMIN,
            json={"area_label": "Hall C", "delay_minutes": 20, "duration_minutes": 60},
        ).status_code
        == 200
    )
    data = client.get(f"/v1/matches/{match.id}").json()["data"]
    assert data["scheduled_start"] == original.isoformat()
    assert data["estimate_source"] == "OVA staff" and "Hall C" in data["court"]["label"]
    assert (
        client.post(
            f"/v1/admin/events/{demo.id}/clock",
            headers=ADMIN,
            json={"advance_minutes": 90},
        ).status_code
        == 200
    )
    assert client.get(f"/v1/matches/{match.id}").json()["data"]["delay_notice"] is None


def test_pathway_keeps_source_rounds(client, db, demo):
    division = db.scalar(select(Division).where(Division.event_id == demo.id))
    result = client.get(
        "/v1/events/demo-championships/pathway",
        params={"division_id": str(division.id)},
    ).json()
    assert {"Pool A", "Gold medal", "Bronze medal"} <= {
        r["label"] for r in result["data"]
    }
    assert all(m["source_match_id"] for r in result["data"] for m in r["matches"])
