"""Photos of real event venues, from Wikimedia Commons.

Each file is copied into the web app under /venues/ so tiles never hotlink Commons. The
licences (CC BY 2.0 and CC BY-SA 4.0) require crediting the photographer, so every photo
carries its credit line.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Venue

COMMONS = "via Wikimedia Commons"
EXHIBITION_PLACE = (
    "/venues/exhibition-place.jpg",
    f"Photo: Laslovarga, CC BY-SA 4.0, {COMMONS}",
)

# Venue names exactly as the connectors and the demo seed create them.
VENUE_PHOTOS = {
    "Enercare Centre": (
        "/venues/enercare-centre.jpg",
        f"Photo: Fabian Roudra Baroi, CC BY-SA 4.0, {COMMONS}",
    ),
    "Niagara Falls Convention Centre": (
        "/venues/niagara-falls-convention-centre.jpg",
        f"Photo: Hannah Clover, CC BY-SA 4.0, {COMMONS}",
    ),
    "David Suzuki SS": (
        "/venues/david-suzuki-ss.jpg",
        f"Photo: Jeff Hitchcock, CC BY 2.0, {COMMONS}",
    ),
    "Downsview": (
        "/venues/downsview-hangar.jpg",
        f"Photo: Vujcic, CC BY 2.0, {COMMONS}",
    ),
    # The demo event's simulated halls sit at Exhibition Place.
    "Exhibition Sports Centre": EXHIBITION_PLACE,
    "Annex Gym": EXHIBITION_PLACE,
}


def add_venue_photos(db: Session) -> int:
    """Give known venues their photo. A photo staff have set is never replaced."""
    venues = db.scalars(
        select(Venue).where(
            Venue.name.in_(list(VENUE_PHOTOS)), Venue.photo_url.is_(None)
        )
    ).all()
    for venue in venues:
        venue.photo_url, venue.photo_credit = VENUE_PHOTOS[venue.name]
    return len(venues)
