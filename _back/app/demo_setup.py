"""Prepare the two-event demo in one step (requirements section 9).

Event A is real: AES Event 2, connected by its event key, refreshed and committed through the
same refresh pipeline staff use. If AES can't be reached, the recorded Event 2 responses in
sample_data/aes_event2 are loaded instead and the source says so.

Event B is simulated: fictional teams imported from the CSV files in sample_data/demo, standing
in for an event on another platform. Two more files there are for the presenter to upload
during the demo (a filled playoff slot and a court change).

Both events are deleted and rebuilt on every run, so running it twice leaves the same state.
"""

import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.adapters.aes_adapter import Fetch, http_fetch, results_url
from app.adapters.base import SourceUnavailable
from app.models import Court, Event, Organization, Source, Venue
from app.modules.clock import set_demo_time
from app.modules.imports import commit_import, stage_import
from app.modules.refresh import refresh_source
from app.seed import TZ, add_event_content, ensure_admin

EVENT_A_SLUG = "ontario-championships-event-2"
EVENT_B_SLUG = "ontario-championships-simulated"
AES_EVENT_KEY = "MjAyNl9PbnRhcmlvX0NoYW1waW9uc2hpcHNfX19FdmVudF8yX182djZHX19UTFNHX18xNVVCXw2"
DEMO_TIME = datetime(2026, 4, 19, 9, 40, tzinfo=ZoneInfo(TZ))

SAMPLE_DATA = Path(__file__).resolve().parent.parent / "sample_data"
RECORDED_AES = SAMPLE_DATA / "aes_event2"
EVENT_B_FILES = SAMPLE_DATA / "demo"

# OVA hasn't supplied a court map (Org Q-11), so courts are grouped into halls by number.
HALLS = ((20, "Hall A"), (40, "Hall B"), (58, "Hall C"))


@dataclass
class DemoSetup:
    event_a: Event
    event_b: Event
    aes_live: bool


def demo_area(court_label: str) -> str | None:
    match = re.search(r"\d+", court_label)
    if not match:
        return None
    number = int(match.group())
    return next((hall for last, hall in HALLS if number <= last), None)


def halls_directions() -> str:
    """"Courts 1 to 20 are in Hall A, 21 to 40 in Hall B and 41 to 58 in Hall C.", from HALLS."""
    firsts = [1] + [last + 1 for last, _ in HALLS[:-1]]
    ranges = [f"{first} to {last} in {hall}" for first, (last, hall) in zip(firsts, HALLS)]
    ranges[0] = ranges[0].replace(" in ", " are in ")
    return f"Courts {', '.join(ranges[:-1])} and {ranges[-1]}."


def recorded_fetch(directory: Path = RECORDED_AES) -> Fetch:
    """Serve the recorded AES responses by path, the way the AES site would."""

    def fetch(url: str) -> bytes:
        path = url.split(AES_EVENT_KEY, 1)[1].strip("/")
        file = directory / f"{path.replace('/', '_') or 'event'}.json"
        if not file.exists():
            raise OSError(f"No recorded AES response for {path or 'the event'}")
        return file.read_bytes()

    return fetch


def setup_demo(db: Session, *, fetch: Fetch = http_fetch, offline: bool = False) -> DemoSetup:
    """offline skips AES and loads the recorded responses, labelled as such."""
    org = db.scalar(select(Organization).limit(1))
    if org is None:
        org = Organization(name="Ontario Volleyball Association")
        db.add(org)
        db.flush()
    for slug in (EVENT_A_SLUG, EVENT_B_SLUG):
        db.execute(delete(Event).where(Event.slug == slug))
    db.commit()

    event_a = None
    if not offline:
        try:
            event_a = _event_a(db, org, fetch, recorded=False)
        except SourceUnavailable:
            db.rollback()
            db.execute(delete(Event).where(Event.slug == EVENT_A_SLUG))
            db.commit()
    aes_live = event_a is not None
    event_a = event_a or _event_a(db, org, recorded_fetch(), recorded=True)
    event_b = _event_b(db, org)

    for event in (event_a, event_b):
        set_demo_time(event, DEMO_TIME)
    ensure_admin(db, org)
    db.commit()
    return DemoSetup(event_a=event_a, event_b=event_b, aes_live=aes_live)


def _event_a(db: Session, org: Organization, fetch: Fetch, *, recorded: bool) -> Event:
    event = Event(
        organization_id=org.id,
        slug=EVENT_A_SLUG,
        title="Ontario Championships Event 2",
        timezone=TZ,
        start_date=date(2026, 4, 19),
        end_date=date(2026, 4, 21),
        status="published",
    )
    db.add(event)
    db.flush()
    source = Source(
        event_id=event.id,
        name="AES Event 2",
        mode="aes",
        external_key=AES_EVENT_KEY,
        official_url=results_url(AES_EVENT_KEY),
    )
    db.add(source)
    db.commit()

    for kind in ("entries", "matches"):
        db.refresh(source)
        batch = refresh_source(db, event=event, source=source, kind=kind, fetch=fetch, actor_id=None)
        _commit(db, batch, f"AES {kind}")

    for venue in db.scalars(select(Venue).where(Venue.event_id == event.id)):
        venue.directions = "Court areas are demo groupings by court number. OVA hasn't supplied a court map yet."
        for court in venue.courts:
            area = demo_area(court.label)
            court.area = f"{area} (demo area)" if area else None
    if recorded:
        # A replay of saved responses isn't a live check, so it reads as an imported snapshot.
        source.name = "AES Event 2 (recorded responses, not live)"
        source.mode = "demo_fixture"
    db.commit()
    return event


def _event_b(db: Session, org: Organization) -> Event:
    event = Event(
        organization_id=org.id,
        slug=EVENT_B_SLUG,
        title="Ontario Championships Event B (simulated)",
        timezone=TZ,
        start_date=date(2026, 4, 19),
        end_date=date(2026, 4, 19),
        status="published",
        is_demo=True,
    )
    db.add(event)
    db.flush()
    db.add(
        Venue(
            event_id=event.id,
            name="Enercare Centre",
            address="100 Princes' Blvd, Toronto, ON",
            directions=f"Simulated event. {halls_directions()}",
        )
    )
    source = Source(event_id=event.id, name="MyTeam.click event (simulated CSV import)", mode="demo_fixture")
    db.add(source)
    db.commit()

    for kind, options in (("entries", {}), ("matches", {}), ("rosters", {"consent_review_ref": "DEMO-REVIEW-002"})):
        db.refresh(source)
        content = (EVENT_B_FILES / f"event-b-{kind}.csv").read_bytes()
        batch = stage_import(
            db,
            event=event,
            source=source,
            kind=kind,
            filename=f"event-b-{kind}.csv",
            content=content,
            options={"strict": True, **options},
            actor_id=None,
        )
        _commit(db, batch, f"Event B {kind}")

    for court in db.scalars(select(Court).join(Venue).where(Venue.event_id == event.id)):
        court.area = demo_area(court.label)
    add_event_content(db, event)
    db.commit()
    return event


def _commit(db: Session, batch, what: str) -> None:
    errors = batch.errors or [r for r in batch.rows if r["action"] == "error"]
    if errors:
        raise RuntimeError(f"{what} import failed: {errors[:5]}")
    commit_import(db, batch.id, None, "demo-setup")

