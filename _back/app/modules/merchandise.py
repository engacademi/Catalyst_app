"""Official retailer destinations; checkout remains on the merchant's website."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Event, PartnerCard

OVA_SHOP = "https://ovashop.ca/ontario_volleyball_association/shop/home"
FALL_CLASSIC_SHOP = "https://canuckstuff.com/fallclassic26/shop/home"


def merchandise_card(event: Event) -> PartnerCard:
    fall = "fall classic" in event.title.lower() or "fall-classic" in event.slug
    return PartnerCard(
        event_id=event.id,
        kind="merchandise",
        name="Fall Classic merchandise" if fall else "OVA merchandise",
        body="Browse event gear and current ordering options at the official retailer.",
        link_url=FALL_CLASSIC_SHOP if fall else OVA_SHOP,
        logo_url="/events/fall-classic-merch.webp" if fall else None,
        seller_note="Sold by Canuck Stuff. Check the shop for availability, pickup and shipping options.",
        sort=1,
    )


def sync_merchandise(db: Session) -> int:
    added = 0
    for event in db.scalars(select(Event)):
        existing = db.scalar(
            select(PartnerCard).where(
                PartnerCard.event_id == event.id, PartnerCard.kind == "merchandise"
            )
        )
        card = merchandise_card(event)
        if existing is None:
            db.add(card)
            added += 1
        elif existing.name == "Championship merchandise (example)":
            for field in ("name", "body", "link_url", "logo_url", "seller_note"):
                setattr(existing, field, getattr(card, field))
    db.flush()
    return added
