"""A clearly synthetic Fall Classic scenario with official OVA visual resources.

Images, venue and store: https://www.ontariovolleyball.org/fall-classic
Court assignments, teams, schedules and scores remain fictional demo data.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Announcement, Division, Event, GuideItem, Venue

FALL_SLUG = "demo-fall-classic-2026"
FALL_PAGE = "https://www.ontariovolleyball.org/fall-classic"
FALL_MAP = "https://cdn3.sportngin.com/attachments/photo/8ccb-220956438/Fall_Classic_Event_Map_2026_Oct_14.png"


def configure_fall_classic(db: Session, event: Event) -> None:
    if not event.is_demo or event.slug != FALL_SLUG:
        raise ValueError("Fall Classic customization is restricted to its demo event")
    for index, venue in enumerate(
        db.scalars(select(Venue).where(Venue.event_id == event.id).order_by(Venue.sort))
    ):
        venue.name = "Cohere Centre" if index == 0 else "Cohere Centre · Demo Annex"
        venue.address = "4899 Uplands Dr, Ottawa, ON K1V 2N6"
        venue.city = "Ottawa"
        venue.latitude, venue.longitude = (
            45.4215,
            -75.6972,
        )  # City reference for browsing.
        venue.accessible_entrance = (
            "Check the official event page for confirmed accessible entrances."
        )
        venue.directions = "Demo court assignments are fictional. Consult the official venue map for the real event layout."
        venue.photo_url = "/events/fall-classic-banner.webp"
        venue.photo_credit = "Image: Ontario Volleyball Association · Fall Classic"
        venue.map_url = "/events/fall-classic-map.webp"
    names = {
        "15U Boys D1": "16U Boys",
        "6v6 Girls D1": "16U Girls Division 1",
        "TLS Girls D1": "18U Girls",
    }
    for division in db.scalars(select(Division).where(Division.event_id == event.id)):
        division.name = names.get(division.name, division.name)
    for notice in db.scalars(
        select(Announcement).where(
            Announcement.event_id == event.id,
            Announcement.title == "Welcome to the demo championships",
        )
    ):
        notice.title = "Welcome to the Fall Classic demo"
        notice.body = "Fictional teams and scores demonstrate the Fall Classic experience. Find official venue information, the map and merchandise in the Venue tab."
    db.add(
        GuideItem(
            event_id=event.id,
            kind="help",
            title="Official Fall Classic event information",
            body="OVA's official page has the November 2026 event details, travel information and merchandise ordering links. Matches in this demo are simulated around today's date.",
            link_url=FALL_PAGE,
            sort=8,
        )
    )
    db.flush()
