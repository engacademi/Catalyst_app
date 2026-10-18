"""OVA's real 2026 Ontario Championships sponsors and their engagement counters.

The list comes from https://www.ontariovolleyball.org/ocs-sponsorship (names, links and
logos as OVA publishes them). Logos are copied into the web app under /sponsors/ so the
ribbon never hotlinks OVA's CDN.

Engagement counters are plain aggregates per partner card and placement. No visitor
identity, device id or IP address is stored.
"""

from dataclasses import dataclass

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Event, PartnerCard, PartnerEngagement, utcnow


@dataclass(frozen=True)
class Sponsor:
    name: str
    link_url: str
    logo: str
    body: str


OVA_SPONSORS = [
    Sponsor(
        "Mikasa Sports Canada",
        "https://www.mikasasports.ca/en",
        "mikasa-canada.png",
        "Volleyballs and team equipment.",
    ),
    Sponsor(
        "Canuckstuff",
        "https://www.canuckstuff.com/store/volleyball/1",
        "canuckstuff.png",
        "Canada's volleyball source for shoes, kneepads and team gear.",
    ),
    Sponsor(
        "Hudl",
        "https://www.hudl.com/solutions/club/volleyball",
        "hudl.png",
        "Video and analysis tools for volleyball clubs.",
    ),
    Sponsor(
        "Hudson Travel Group",
        "https://htgsports.com/",
        "hudson-travel-group.png",
        "HTG Sports Services: team travel and event hotels.",
    ),
    Sponsor(
        "Six Pack Recruiting",
        "https://sixpackrecruiting.com/",
        "six-pack-recruiting.png",
        "College recruiting support for volleyball athletes.",
    ),
    Sponsor(
        "Timu",
        "https://timu.ca/",
        "timu.png",
        "Mobile eScoreboards and live tournament results.",
    ),
    Sponsor(
        "Government of Ontario",
        "https://www.ontario.ca/page/ministry-tourism-culture-and-sport",
        "government-of-ontario.png",
        "Ontario Championships partner.",
    ),
    Sponsor(
        "Destination Toronto",
        "https://www.destinationtoronto.com/",
        "destination-toronto.png",
        "Plan your visit: places to eat, stay and explore in Toronto.",
    ),
    Sponsor(
        "City of Toronto",
        "https://www.toronto.ca/",
        "city-of-toronto.png",
        "Ontario Championships partner.",
    ),
]

# Placeholder names earlier seeds created. They are replaced by the real sponsors.
FICTIONAL_SPONSORS = {
    "Example Sports Co.",
    "Rally Athletics · Example",
    "Courtside Hydration · Example",
    "Northstar Sport · Example",
}

PLACEMENTS = ("ribbon", "guide", "message")
ACTIONS = ("view", "click")


def sponsor_cards(event: Event, start_sort: int = 10) -> list[PartnerCard]:
    return [
        PartnerCard(
            event_id=event.id,
            kind="sponsor",
            name=s.name,
            body=s.body,
            link_url=s.link_url,
            logo_url=f"/sponsors/{s.logo}",
            sort=start_sort + i,
        )
        for i, s in enumerate(OVA_SPONSORS)
    ]


def sync_ova_sponsors(db: Session) -> int:
    """Give demo events and Ontario Championships the real sponsor cards.

    Idempotent and safe to run on every deploy: it removes the fictional placeholder
    sponsors, adds any real sponsor an event is missing, and fills a missing logo or link
    on an existing card. Staff edits to names, copy, order and visibility are kept.
    """
    events = db.scalars(
        select(Event).where(
            or_(Event.is_demo.is_(True), Event.title.ilike("%Ontario Championships%"))
        )
    ).all()
    added = 0
    for event in events:
        cards = db.scalars(
            select(PartnerCard).where(
                PartnerCard.event_id == event.id, PartnerCard.kind == "sponsor"
            )
        ).all()
        by_name = {}
        for card in cards:
            if card.name in FICTIONAL_SPONSORS:
                db.delete(card)
            else:
                by_name[card.name] = card
        for card in sponsor_cards(event):
            existing = by_name.get(card.name)
            if existing is None:
                db.add(card)
                added += 1
                continue
            if not existing.logo_url:
                existing.logo_url = card.logo_url
            if not existing.link_url:
                existing.link_url = card.link_url
    db.commit()
    return added


def record_engagement(
    db: Session, items: list[tuple[PartnerCard, str, str]]
) -> None:
    """Add one view or click per item to its card's placement counter."""
    for card, placement, action in items:
        views, clicks = (1, 0) if action == "view" else (0, 1)
        stmt = insert(PartnerEngagement).values(
            partner_id=card.id,
            event_id=card.event_id,
            placement=placement,
            views=views,
            clicks=clicks,
            updated_at=utcnow(),
        )
        db.execute(
            stmt.on_conflict_do_update(
                index_elements=["partner_id", "placement"],
                set_={
                    "views": PartnerEngagement.views + views,
                    "clicks": PartnerEngagement.clicks + clicks,
                    "updated_at": stmt.excluded.updated_at,
                },
            )
        )
    db.commit()


def engagement_report(db: Session, event: Event) -> list[dict]:
    """Views and clicks per sponsor card of one event.

    The guide and message (sponsor popup) placements count this event's cards. The Discover ribbon is app-wide and
    shows each sponsor once, so its counts are the sponsor's ribbon totals across every
    card with the same name, whichever event's card the ribbon happened to carry.
    """
    cards = db.scalars(
        select(PartnerCard)
        .where(PartnerCard.event_id == event.id, PartnerCard.kind == "sponsor")
        .order_by(PartnerCard.sort, PartnerCard.name)
    ).all()
    # Guide cards and sponsor messages are per event; the ribbon is app-wide.
    scoped = {
        (row.partner_id, row.placement): row
        for row in db.scalars(
            select(PartnerEngagement).where(
                PartnerEngagement.event_id == event.id,
                PartnerEngagement.placement != "ribbon",
            )
        )
    }
    ribbon = {
        name: (views, clicks)
        for name, views, clicks in db.execute(
            select(
                PartnerCard.name,
                func.sum(PartnerEngagement.views),
                func.sum(PartnerEngagement.clicks),
            )
            .join(PartnerCard, PartnerCard.id == PartnerEngagement.partner_id)
            .where(
                PartnerEngagement.placement == "ribbon",
                PartnerCard.name.in_([card.name for card in cards]),
            )
            .group_by(PartnerCard.name)
        )
    }
    rows = []
    for card in cards:
        ribbon_views, ribbon_clicks = ribbon.get(card.name, (0, 0))
        placements = {
            "ribbon": {"views": int(ribbon_views), "clicks": int(ribbon_clicks)}
        }
        for placement in ("guide", "message"):
            row = scoped.get((card.id, placement))
            placements[placement] = {
                "views": row.views if row else 0,
                "clicks": row.clicks if row else 0,
            }
        views = sum(p["views"] for p in placements.values())
        clicks = sum(p["clicks"] for p in placements.values())
        rows.append(
            {
                "partner_id": str(card.id),
                "name": card.name,
                "logo_url": card.logo_url,
                "active": card.active,
                "placements": placements,
                "views": views,
                "clicks": clicks,
                "ctr": round(clicks / views, 4) if views else None,
            }
        )
    return rows
