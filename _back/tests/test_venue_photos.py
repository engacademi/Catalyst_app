from sqlalchemy import select

from app.models import Venue
from app.modules.venue_photos import VENUE_PHOTOS, add_venue_photos
from tests.conftest import ADMIN


def _venue(db, event, name):
    return db.scalar(select(Venue).where(Venue.event_id == event.id, Venue.name == name))


def test_known_venues_get_their_credited_photo(client, demo):
    events = client.get("/v1/events").json()["data"]
    tile = next(e for e in events if e["slug"] == demo.slug)
    photos = {v["name"]: v for v in tile["venue_locations"]}
    assert photos["Exhibition Sports Centre"]["photo_url"] == "/venues/exhibition-place.jpg"
    assert "Wikimedia Commons" in photos["Exhibition Sports Centre"]["photo_credit"]


def test_new_venue_with_a_known_name_gets_its_photo(db, demo):
    db.add(Venue(event_id=demo.id, name="Enercare Centre"))
    db.commit()
    assert _venue(db, demo, "Enercare Centre").photo_url == VENUE_PHOTOS["Enercare Centre"][0]
    db.add(Venue(event_id=demo.id, name="Unknown Gym"))
    db.commit()
    assert _venue(db, demo, "Unknown Gym").photo_url is None


def test_staff_photo_is_kept(client, db, demo):
    venue = _venue(db, demo, "Exhibition Sports Centre")
    response = client.patch(
        f"/v1/admin/venues/{venue.id}",
        json={
            "name": venue.name,
            "photo_url": "https://example.org/hall.jpg",
            "photo_credit": "Photo: OVA",
        },
        headers=ADMIN,
    )
    assert response.status_code == 200, response.text
    assert add_venue_photos(db) == 0
    db.expire_all()
    venue = _venue(db, demo, "Exhibition Sports Centre")
    assert (venue.photo_url, venue.photo_credit) == ("https://example.org/hall.jpg", "Photo: OVA")


def test_backfill_fills_existing_venues_without_a_photo(db, demo):
    venue = _venue(db, demo, "Annex Gym")
    venue.photo_url = venue.photo_credit = None
    db.commit()
    assert add_venue_photos(db) == 1
    assert venue.photo_url == "/venues/exhibition-place.jpg"
