from sqlalchemy import select
from app.models import Match, Source, Venue
from tests.conftest import ADMIN, OFFICIAL


def test_discovery_locations_and_staff_edit(client, db, demo):
    venue = db.scalar(select(Venue).where(Venue.event_id == demo.id))
    result = client.patch(
        f"/v1/admin/venues/{venue.id}",
        headers=ADMIN,
        json={
            "name": venue.name,
            "city": "Toronto",
            "latitude": 43.65,
            "longitude": -79.38,
        },
    )
    assert result.status_code == 200
    events = client.get("/v1/events").json()["data"]
    assert events[0]["team_count"] == 12
    assert any(
        v["city"] == "Toronto" and v["latitude"] == 43.65
        for v in events[0]["venue_locations"]
    )
    assert (
        client.patch(
            f"/v1/admin/venues/{venue.id}",
            headers=ADMIN,
            json={"name": venue.name, "latitude": 100},
        ).status_code
        == 422
    )


def test_staff_match_edits_revision_permissions_and_changes(client, db, demo):
    match = db.scalar(select(Match).where(Match.event_id == demo.id))
    url = f"/v1/admin/matches/{match.id}"
    body = {
        "expected_revision": match.revision,
        "scheduled_start": "2026-10-18T14:00:00-04:00",
        "round_label": "Gold medal",
    }
    assert client.patch(url, json=body).status_code == 401
    assert client.patch(url, json=body, headers=OFFICIAL).status_code == 403
    result = client.patch(url, json=body, headers=ADMIN)
    assert result.status_code == 200
    assert client.patch(url, json=body, headers=ADMIN).status_code == 409
    detail = client.get(f"/v1/matches/{match.id}").json()["data"]
    assert detail["round_label"] == "Gold medal"
    assert any(c["event_type"] == "time_changed" for c in detail["history"])
    assert any(c["event_type"] == "details_changed" for c in detail["history"])
    revision = result.json()["data"]["revision"]
    assert (
        client.patch(
            url,
            headers=ADMIN,
            json={
                "expected_revision": revision,
                "scheduled_start": "2026-10-18T14:00:00",
            },
        ).status_code
        == 422
    )
    source = db.get(Source, match.source_id)
    source.mode = "aes"
    db.commit()
    assert (
        client.patch(
            url,
            headers=ADMIN,
            json={"expected_revision": revision, "round_label": "Final"},
        ).status_code
        == 409
    )


def test_match_search_and_event_date_validation(client, demo):
    rows = client.get("/v1/events/demo-championships/matches?q=Lakeshore").json()[
        "data"
    ]
    assert rows
    assert all(
        "Lakeshore" in ((m["home"]["team_name"] or "") + (m["away"]["team_name"] or ""))
        for m in rows
    )
    assert (
        client.get("/v1/events/demo-championships/matches?q=zzzz-nonexistent").json()[
            "data"
        ]
        == []
    )
    assert (
        client.patch(
            f"/v1/admin/events/{demo.id}",
            headers=ADMIN,
            json={"start_date": "2027-02-02", "end_date": "2027-01-01"},
        ).status_code
        == 422
    )
