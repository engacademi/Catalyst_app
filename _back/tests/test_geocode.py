import math
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from app.models import Event, Organization, Venue

GEOCODE = Path(__file__).resolve().parents[1] / "sample_data" / "geocode"
RECORDED = {
    "100 Princes' Blvd, Toronto, ON M6K 3C3": "enercare-centre.json",
    "1345 Cheapside St, London, ON N5V 3N9": "north-london-optimist.json",
    "15800 Yonge St, Aurora, ON L4G 3H7": "st-andrews-college.json",
}


def nominatim(calls=None):
    """Serve recorded Nominatim searches by query; tests never call Nominatim live."""

    def get(url):
        q = parse_qs(urlsplit(url).query)["q"][0]
        if calls is not None:
            calls.append(q)
        if q not in RECORDED:
            return "[]"
        return (GEOCODE / RECORDED[q]).read_text()

    return get


def venue(db, name, address=None, **fields):
    org = Organization(name="Ontario Volleyball Association")
    db.add(org)
    db.flush()
    event = Event(
        organization_id=org.id,
        slug=f"event-{name.lower().replace(' ', '-')}",
        title=name,
        kind="indoor",
        timezone="America/Toronto",
        start_date=date(2026, 10, 24),
        end_date=date(2026, 10, 24),
        status="published",
    )
    db.add(event)
    db.flush()
    v = Venue(event_id=event.id, name=name, address=address, **fields)
    db.add(v)
    db.commit()
    return v


def test_geocode_stores_coordinates_and_city_from_address(db):
    from app.modules.geocode import geocode_venues

    v = venue(
        db, "North London Optimist Community", "1345 Cheapside St, London, ON N5V 3N9"
    )
    geocode_venues(db, [v], get=nominatim())
    db.refresh(v)
    assert (v.latitude, v.longitude, v.city) == (43.015113, -81.208542, "London")


def test_geocode_takes_town_as_city_and_keeps_an_existing_city(db):
    from app.modules.geocode import geocode_venues

    aurora = venue(db, "St Andrews College", "15800 Yonge St, Aurora, ON L4G 3H7")
    toronto = venue(
        db,
        "Enercare Centre",
        "100 Princes' Blvd, Toronto, ON M6K 3C3",
        city="Exhibition Place",
    )
    geocode_venues(db, [aurora, toronto], get=nominatim())
    assert (aurora.latitude, aurora.longitude, aurora.city) == (
        44.0121267,
        -79.4781637,
        "Aurora",
    )
    assert (toronto.latitude, toronto.city) == (43.6353558, "Exhibition Place")


def test_geocode_skips_venues_that_already_have_coordinates(db):
    from app.modules.geocode import geocode_venues

    calls = []
    v = venue(
        db,
        "Enercare Centre",
        "100 Princes' Blvd, Toronto, ON M6K 3C3",
        latitude=1.0,
        longitude=2.0,
    )
    geocode_venues(db, [v], get=nominatim(calls))
    assert calls == [] and (v.latitude, v.longitude) == (1.0, 2.0)


def test_geocode_falls_back_to_the_venue_name(db):
    from app.modules.geocode import geocode_venues

    calls = []
    RECORDED["Downsview"] = "enercare-centre.json"
    try:
        v = venue(db, "Downsview")
        geocode_venues(db, [v], get=nominatim(calls))
    finally:
        del RECORDED["Downsview"]
    assert calls == ["Downsview"] and v.latitude == 43.6353558


def test_failed_lookup_leaves_the_venue_unchanged(db):
    from app.modules.geocode import geocode_venues

    def down(url):
        raise ValueError("Nominatim unavailable")

    unknown = venue(db, "Nowhere Gym", "1 Nowhere Rd")
    offline = venue(db, "Enercare Centre", "100 Princes' Blvd, Toronto, ON M6K 3C3")
    geocode_venues(db, [unknown], get=nominatim())
    geocode_venues(db, [offline], get=down)
    db.refresh(unknown)
    db.refresh(offline)
    assert (unknown.latitude, unknown.longitude, unknown.city) == (None, None, None)
    assert (offline.latitude, offline.longitude, offline.city) == (None, None, None)


def test_lookups_are_spaced_a_second_apart(db, waits):
    from app.modules.geocode import geocode_venues

    london = venue(
        db, "North London Optimist Community", "1345 Cheapside St, London, ON N5V 3N9"
    )
    aurora = venue(db, "St Andrews College", "15800 Yonge St, Aurora, ON L4G 3H7")
    geocode_venues(db, [london, aurora], get=nominatim())
    assert waits[-1] > 0.9


def km_from_toronto(lat, lon):
    """Great-circle distance from the Toronto reference point Discover uses."""
    r = math.radians
    a = (
        math.sin(r(lat - 43.6532) / 2) ** 2
        + math.cos(r(43.6532)) * math.cos(r(lat)) * math.sin(r(lon + 79.3832) / 2) ** 2
    )
    return 2 * 6371 * math.asin(math.sqrt(a))


def test_loaded_event_near_toronto_lists_its_venue_location(client, db, monkeypatch):
    from app.adapters.timu import read_timu
    from app.cli import timu_load
    from app.modules import sync
    from tests_unit.test_sources import timu_recorded

    monkeypatch.setattr(
        sync,
        "fetch_snapshot",
        lambda mode, config: read_timu(config, get=timu_recorded),
    )

    def get(url):
        return nominatim()(url) if "nominatim" in url else timu_recorded(url)

    timu_load("4196", get=get)
    [event] = client.get("/v1/events").json()["data"]
    [where] = event["venue_locations"]
    assert (where["city"], where["latitude"], where["longitude"]) == (
        "Aurora",
        44.0121267,
        -79.4781637,
    )
    # Discover's "Near Toronto" lists events with a venue within 100 km.
    assert km_from_toronto(where["latitude"], where["longitude"]) < 100


def test_geocode_venues_command_backfills_missing_coordinates_once(db):
    from app.cli import geocode_all

    london = venue(
        db, "North London Optimist Community", "1345 Cheapside St, London, ON N5V 3N9"
    )
    aurora = venue(db, "St Andrews College", "15800 Yonge St, Aurora, ON L4G 3H7")
    calls = []
    geocode_all(get=nominatim(calls))
    assert len(calls) == 2
    geocode_all(get=nominatim(calls))
    assert len(calls) == 2
    db.refresh(london)
    db.refresh(aurora)
    assert (london.city, aurora.city) == ("London", "Aurora")
