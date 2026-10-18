"""Venue coordinates from OpenStreetMap Nominatim, looked up once and stored.

Nominatim's usage policy allows at most one request per second from an
identified application, so lookups are spaced and only venues without
coordinates are looked up.
"""

import json
from time import monotonic, sleep
from urllib.parse import urlencode

from sqlalchemy.orm import Session

from app.adapters.live import fetch_text
from app.models import Venue

SEARCH_URL = "https://nominatim.openstreetmap.org/search"
_last_request = 0.0


def _search(query: str, get) -> dict | None:
    global _last_request
    sleep(max(0.0, _last_request + 1 - monotonic()))
    _last_request = monotonic()
    params = {
        "format": "jsonv2",
        "limit": 1,
        "countrycodes": "ca",
        "addressdetails": 1,
        "q": query,
    }
    found = json.loads(get(f"{SEARCH_URL}?{urlencode(params)}"))
    return found[0] if found else None


def geocode_venues(db: Session, venues: list[Venue], get=fetch_text) -> None:
    """Store coordinates, and a missing city, for venues that have none; failures change nothing."""
    for venue in venues:
        if venue.latitude is not None and venue.longitude is not None:
            continue
        try:
            # The address is the most precise query; the name alone often still resolves.
            place = None
            for query in filter(None, [venue.address, venue.name]):
                place = _search(query, get)
                if place:
                    break
            if place is None:
                continue
            latitude, longitude = float(place["lat"]), float(place["lon"])
        except Exception:  # noqa: BLE001, S112 - a lookup never fails the load
            continue
        venue.latitude, venue.longitude = latitude, longitude
        address = place.get("address", {})
        venue.city = venue.city or next(
            (address[k] for k in ("city", "town", "village") if address.get(k)), None
        )
    db.commit()
