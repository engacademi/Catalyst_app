from sqlalchemy import select

from app.models import Event, PartnerCard
from app.modules.merchandise import FALL_CLASSIC_SHOP, OVA_SHOP, sync_merchandise
from app.seed import seed_testing
from tests.conftest import ADMIN


def test_every_seeded_venue_has_merchandise_with_the_right_shop(client, db):
    seed_testing(db)
    for event in db.scalars(select(Event)):
        guide = client.get(f"/v1/events/{event.slug}/guide").json()["data"]
        merch = [p for p in guide["partners"] if p["kind"] == "merchandise"]
        assert len(merch) == 1
        assert merch[0]["link_url"] == (
            FALL_CLASSIC_SHOP if event.slug == "demo-fall-classic-2026" else OVA_SHOP
        )
    fall = db.scalar(select(Event).where(Event.slug == "demo-fall-classic-2026"))
    guide = client.get(f"/v1/events/{fall.slug}/guide").json()["data"]
    assert all(
        v["photo_url"] == "/events/fall-classic-banner.webp" for v in guide["venues"]
    )
    assert all(v["map_url"] == "/events/fall-classic-map.webp" for v in guide["venues"])
    assert {
        d["name"]
        for d in client.get(f"/v1/events/{fall.slug}").json()["data"]["divisions"]
    } == {"16U Boys", "16U Girls Division 1", "18U Girls"}


def test_merchandise_sync_keeps_staff_seller_edits_and_new_events_get_a_card(
    client, db, demo
):
    card = db.scalar(
        select(PartnerCard).where(
            PartnerCard.event_id == demo.id, PartnerCard.kind == "merchandise"
        )
    )
    card.link_url = "https://example.org/approved-event-store"
    db.commit()
    assert sync_merchandise(db) == 0
    assert card.link_url == "https://example.org/approved-event-store"
    created = client.post(
        "/v1/admin/events",
        headers=ADMIN,
        json={
            "slug": "merch-event",
            "title": "New Fall Classic",
            "kind": "indoor",
            "timezone": "America/Toronto",
            "start_date": str(demo.start_date),
            "end_date": str(demo.end_date),
        },
    )
    assert created.status_code == 201
    event = db.scalar(select(Event).where(Event.slug == "merch-event"))
    card = db.scalar(
        select(PartnerCard).where(
            PartnerCard.event_id == event.id, PartnerCard.kind == "merchandise"
        )
    )
    assert card.link_url == FALL_CLASSIC_SHOP
