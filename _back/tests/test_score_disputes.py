from sqlalchemy import select

from app.models import ChangeEvent, Court, Match, Venue
from app.showcase import seed_staff_showcase


def test_disputes_are_private_idempotent_and_reviewable(client, db):
    event = seed_staff_showcase(db)
    match = db.scalar(select(Match).where(Match.event_id == event.id, Match.status == "in_progress"))
    path = f"/v1/me/matches/{match.id}/disputes"
    assert client.post(path, json={}).status_code == 401
    reporter = {"X-Dev-User": "dev-official"}
    for _ in range(2):
        assert client.post(path, headers=reporter, json={"comment": "Score appears reversed"}).status_code == 201
    assert client.post(path, headers=reporter, json={"comment": "x" * 1001}).status_code == 422
    listing = f"/v1/admin/events/{event.id}/disputes"
    assert client.get(listing, headers={"X-Dev-User": "outsider"}).status_code == 403
    admin = {"X-Dev-User": "dev-admin"}
    rows = client.get(listing, headers=admin).json()["data"]
    assert len(rows) == 1
    response = client.patch(f"/v1/admin/disputes/{rows[0]['id']}/resolve", headers=admin, json={})
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "resolved"


def test_court_notice_without_scheduled_matches_still_notifies(client, db):
    event = seed_staff_showcase(db)
    venue = db.scalar(select(Venue).where(Venue.event_id == event.id))
    court = Court(venue_id=venue.id, label="Empty demo court")
    db.add(court)
    db.commit()
    response = client.patch(f"/v1/admin/courts/{court.id}/notice", headers={"X-Dev-User": "dev-admin"}, json={"delay_minutes": 15})
    assert response.status_code == 200
    assert db.scalar(select(ChangeEvent.id).where(ChangeEvent.event_id == event.id, ChangeEvent.entity_type == "announcement", ChangeEvent.event_type == "announcement_published"))
