"""Idempotent, fictional staff workspace covering the editable event tools."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Announcement,
    Court,
    Event,
    EventEntry,
    GuideItem,
    Match,
    Organization,
    PartnerCard,
    RosterPublication,
    Source,
    Venue,
    utcnow,
)
from app.seed import TZ, _import, ensure_dev_users

SLUG = "staff-showcase"


def seed_staff_showcase(db: Session) -> Event:
    event = db.scalar(select(Event).where(Event.slug == SLUG))
    source = (
        db.scalar(
            select(Source).where(
                Source.event_id == event.id, Source.name == "Staff showcase fixture"
            )
        )
        if event
        else None
    )
    if source and (source.config or {}).get("showcase_ready"):
        seed_showcase_live_matches(db, event, source)
        return event
    org = db.scalar(select(Organization).limit(1))
    if not org:
        org = Organization(name="Ontario Volleyball Association")
        db.add(org)
        db.flush()
    now = datetime.now(ZoneInfo(TZ)).replace(second=0, microsecond=0)
    if not event:
        event = Event(
            organization_id=org.id,
            slug=SLUG,
            title="Staff Showcase · Demo Tournament",
            kind="indoor",
            timezone=TZ,
            start_date=now.date(),
            end_date=now.date() + timedelta(days=1),
            status="draft",
            is_demo=True,
            demo_clock={"at": now.isoformat(), "set_at": utcnow().isoformat()},
        )
        db.add(event)
        db.flush()
    if not source:
        source = Source(
            event_id=event.id,
            name="Staff showcase fixture",
            mode="demo_fixture",
            config={"showcase_ready": False},
        )
        db.add(source)
        db.flush()
    for index, name in enumerate(["Showcase Hall A", "Showcase Hall B"]):
        if not db.scalar(
            select(Venue.id).where(Venue.event_id == event.id, Venue.name == name)
        ):
            db.add(
                Venue(
                    event_id=event.id,
                    name=name,
                    city="Toronto",
                    address="Synthetic demonstration venue, Toronto, ON",
                    latitude=43.6532,
                    longitude=-79.3832,
                    accessible_entrance="Step-free east entrance beside the welcome desk.",
                    directions=f"Follow the {'green' if not index else 'sage'} signs from the lobby.",
                    sort=index,
                )
            )
    db.flush()
    names = [
        "Maple Aces",
        "Lakeside Rally",
        "Northstar Spikers",
        "Cedar United",
        "Harbour Heat",
        "Summit Flyers",
        "Riverside Waves",
        "Bayview Blaze",
    ]
    entries = []
    matches = []
    for division_index, division in enumerate(["16U Open", "18U Open"]):
        code = f"D{division_index + 1}"
        entries += [
            {
                "external_entry_id": f"{code}-T{i + 1}",
                "team_name": f"{name} {16 + division_index * 2}U",
                "club_name": f"{name.split()[0]} Demo Club",
                "division": division,
                "division_code": code,
            }
            for i, name in enumerate(names)
        ]

        def match(mid, round_label, home, away, minutes, status, hslot="", aslot=""):
            return {
                "external_match_id": f"{code}-{mid}",
                "division": division,
                "scheduled_start": (now + timedelta(minutes=minutes)).isoformat(),
                "venue": f"Showcase Hall {'A' if not division_index else 'B'}",
                "court": f"Court {1 if mid.endswith('1') else 2}",
                "court_area": f"Hall {'A' if not division_index else 'B'}",
                "home_entry_id": f"{code}-T{home}" if home else "",
                "away_entry_id": f"{code}-T{away}" if away else "",
                "home_placeholder": f"W {code}-{hslot}" if hslot else "",
                "away_placeholder": f"W {code}-{aslot}" if aslot else "",
                "round": round_label,
                "status": status,
                "set_scores": "25-21 25-19"
                if status == "completed"
                else "25-23"
                if status == "in_progress"
                else "",
                "work_entry_id": f"{code}-T8",
            }

        matches += [
            match(
                f"Q{i + 1}",
                "Quarterfinals",
                i * 2 + 1,
                i * 2 + 2,
                -240 + i * 20,
                "completed",
            )
            for i in range(4)
        ]
        matches.append(
            match(
                "S1",
                "Semifinals",
                1,
                3,
                -20 if not division_index else -90,
                "in_progress" if not division_index else "completed",
                "Q1",
                "Q2",
            )
        )
        matches.append(
            match(
                "S2",
                "Semifinals",
                5,
                7,
                60 if not division_index else -60,
                "scheduled" if not division_index else "completed",
                "Q3",
                "Q4",
            )
        )
        matches.append(
            match(
                "F1",
                "Final",
                0 if not division_index else 1,
                0 if not division_index else 5,
                150 if not division_index else -10,
                "scheduled" if not division_index else "completed",
                "S1",
                "S2",
            )
        )
    _import(db, event, source, "entries", entries)
    _import(db, event, source, "matches", matches)
    roster = [
        {
            "external_entry_id": f"D{d}-T{team}",
            "jersey": str(jersey),
            "display_name": f"Demo Athlete {d}{team}{jersey}",
            "position": ["Setter", "Outside", "Middle", "Libero"][jersey % 4],
            "photo_url": "",
            "photo_approved": "no",
        }
        for d in [1, 2]
        for team in [1, 2]
        for jersey in range(1, 7)
    ]
    _import(
        db,
        event,
        source,
        "rosters",
        roster,
        consent_review_ref="SYNTHETIC-SHOWCASE-ONLY",
    )
    published = db.scalar(
        select(RosterPublication)
        .where(
            RosterPublication.entry_id.in_(
                select(EventEntry.id).where(EventEntry.event_id == event.id)
            )
        )
        .limit(1)
    )
    if published:
        published.state = "published"
        published.published_at = utcnow()
    for title, category, state, body in [
        (
            "Welcome, courtside!",
            "general",
            "published",
            "This fictional event is ready to explore. Try editing a match, posting a court delay, or publishing your own announcement.",
        ),
        (
            "Hall A court update",
            "schedule",
            "published",
            "Court 1 is running approximately 15 minutes late. Check the match centre for the latest timing.",
        ),
        (
            "Lunch at the venue",
            "venue",
            "draft",
            "The demo food counter opens at noon. Edit and publish this draft to try the announcement workflow.",
        ),
    ]:
        if not db.scalar(
            select(Announcement.id).where(
                Announcement.event_id == event.id, Announcement.title == title
            )
        ):
            db.add(
                Announcement(
                    event_id=event.id,
                    title=title,
                    category=category,
                    state=state,
                    body=body,
                    publish_at=utcnow() if state == "published" else None,
                )
            )
    for i, (kind, title, body, link) in enumerate(
        [
            (
                "parking",
                "Parking",
                "Demo parking is beside the east entrance. This is a fictional venue guide.",
                None,
            ),
            (
                "food",
                "Food & water",
                "Demo snacks in the lobby; water refill stations between courts.",
                None,
            ),
            (
                "accessibility",
                "Accessible routes",
                "Step-free entrances and accessible viewing spaces at every demo court.",
                None,
            ),
            (
                "help",
                "Welcome desk",
                "Demo volunteers at the lobby desk can help you find your court.",
                None,
            ),
            (
                "officials",
                "Team Lead briefing",
                "Check in at the demo operations desk 30 minutes before your assignment.",
                None,
            ),
            (
                "media_photo",
                "Volleyball illustration · sample media",
                "A synthetic illustration demonstrating the event media section.",
                "https://catalyst-five-gamma.vercel.app/discover-volleyball.png",
            ),
        ]
    ):
        if not db.scalar(
            select(GuideItem.id).where(
                GuideItem.event_id == event.id, GuideItem.title == title
            )
        ):
            db.add(
                GuideItem(
                    event_id=event.id,
                    kind=kind,
                    title=title,
                    body=body,
                    link_url=link,
                    sort=i,
                )
            )
    for i, (name, message) in enumerate(
        [
            (
                "Rally Athletics · Example",
                "Rally Athletics loves volleyball. See you courtside!",
            ),
            (
                "Courtside Hydration · Example",
                "Great rallies start with a water break. We’re cheering you on!",
            ),
            (
                "Northstar Sport · Example",
                "Big serves. Bigger smiles. Enjoy your next game!",
            ),
        ]
    ):
        if not db.scalar(
            select(PartnerCard.id).where(
                PartnerCard.event_id == event.id, PartnerCard.name == name
            )
        ):
            db.add(
                PartnerCard(
                    event_id=event.id,
                    kind="sponsor",
                    name=name,
                    body=message,
                    link_url="https://example.org",
                    sort=i,
                    active=True,
                )
            )
    courts = list(
        db.scalars(
            select(Court).where(
                Court.venue_id.in_(select(Venue.id).where(Venue.event_id == event.id))
            )
        )
    )
    for court in courts:
        court.area_label = (
            "Hall A"
            if court.venue_id
            == db.scalar(
                select(Venue.id).where(
                    Venue.event_id == event.id, Venue.name == "Showcase Hall A"
                )
            )
            else "Hall B"
        )
    if courts:
        courts[0].delay = {
            "minutes": 15,
            "posted_by": "Demo event team",
            "posted_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=3)).isoformat(),
        }
    ensure_dev_users(db, org, event)
    source.config = {**(source.config or {}), "showcase_ready": True}
    event.status = "published"
    seed_showcase_live_matches(db, event, source)
    db.commit()
    return event


def seed_showcase_live_matches(db: Session, event: Event, source: Source) -> None:
    """Add live pool examples once, preserving all previously edited matches."""
    from app.modules.projections import event_now

    now = event_now(event).astimezone(ZoneInfo(TZ)).replace(second=0, microsecond=0)
    rows = []
    for division, label, hall in [(1, "16U Open", "A"), (2, "18U Open", "B")]:
        external_id = f"D{division}-LIVE"
        if db.scalar(
            select(Match.id).where(
                Match.source_id == source.id, Match.external_id == external_id
            )
        ):
            continue
        rows.append(
            {
                "external_match_id": external_id,
                "division": label,
                "scheduled_start": (now - timedelta(minutes=15)).isoformat(),
                "venue": f"Showcase Hall {hall}",
                "court": "Court 2",
                "home_entry_id": f"D{division}-T5",
                "away_entry_id": f"D{division}-T6",
                "home_placeholder": "",
                "away_placeholder": "",
                "round": "Live exhibition",
                "status": "in_progress",
                "set_scores": "25-22",
            }
        )
    if rows:
        _import(db, event, source, "matches", rows)
        db.commit()
