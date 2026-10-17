"""Synthetic demo event. Every team, player and partner here is fictional.

The seed loads its schedule through the same CSV staging and commit path staff use, so the
demo exercises the real import pipeline. Dates are relative to today so My Day has upcoming
matches whenever the demo runs.
"""

import csv
import io
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import (
    Announcement,
    Assignment,
    ChangeEvent,
    Event,
    GuideItem,
    Match,
    Organization,
    PartnerCard,
    RoleGrant,
    Source,
    User,
    Venue,
    utcnow,
)
from app.modules.imports import commit_import, stage_import

DEMO_SLUG = "demo-championships"
TZ = "America/Toronto"

DIVISIONS = {
    "15U Boys D1": (
        "15UB D1",
        [
            "Lakeshore Thunder",
            "North Bay Breakers",
            "Cedar Ridge Rally",
            "Kingston Tide",
        ],
    ),
    "6v6 Girls D1": (
        "6v6G D1",
        [
            "Harbourfront Heat",
            "Maple Grove Spikers",
            "Riverside Rockets",
            "Bayview Blaze",
        ],
    ),
    "TLS Girls D1": (
        "TLSG D1",
        ["Greenfield Flyers", "Summit Strikers", "Westwood Waves", "Oakville Orbit"],
    ),
}
CLUBS = ["Lakeshore VC", "Northern Lights VC", "Cedar VC", "Limestone VC"]
FIRST_NAMES = [
    "Avery",
    "Jordan",
    "Riley",
    "Sam",
    "Taylor",
    "Morgan",
    "Casey",
    "Jamie",
    "Quinn",
    "Drew",
]


def _csv(rows: list[dict]) -> bytes:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue().encode()


def _import(
    db: Session, event: Event, source: Source, kind: str, rows: list[dict], **options
) -> None:
    batch = stage_import(
        db,
        event=event,
        source=source,
        kind=kind,
        filename=f"seed-{kind}.csv",
        content=_csv(rows),
        options={"strict": True, **options},
        actor_id=None,
    )
    if batch.errors or any(r["action"] == "error" for r in batch.rows):
        raise RuntimeError(
            f"Seed {kind} import failed: {batch.errors or [r for r in batch.rows if r['errors']]}"
        )
    commit_import(db, batch.id, None, "seed")
    db.refresh(source)


def _ext(division: str, index: int) -> str:
    return f"{DIVISIONS[division][0].replace(' ', '-')}-{index + 1}"


def _matches(
    division: str, start_day: date, court_offset: int, venue: str, now: datetime
) -> list[dict]:
    """Round robin in one pool, then a final whose slots wait on the semifinal results."""
    tz = ZoneInfo(TZ)
    pairs = [(0, 1), (2, 3), (0, 2), (1, 3), (0, 3), (1, 2)]
    rows = []
    for number, (home, away) in enumerate(pairs):
        start = datetime.combine(start_day, time(9, 0), tzinfo=tz) + timedelta(
            hours=number // 2 * 1
        )
        court = f"Court {court_offset + number % 2}"
        done = start + timedelta(minutes=75) < now
        rows.append(
            {
                "external_match_id": f"{_ext(division, 0)[:-2]}-M{number + 1}",
                "division": division,
                "scheduled_start": start.isoformat(),
                "venue": venue,
                "court": court,
                "home_entry_id": _ext(division, home),
                "away_entry_id": _ext(division, away),
                "home_placeholder": "",
                "away_placeholder": "",
                "round": "Pool A",
                "status": "completed" if done else "scheduled",
                "set_scores": ("25-21 22-25 15-12" if number % 2 else "25-18 25-20")
                if done
                else "",
            }
        )
    final_start = datetime.combine(
        start_day + timedelta(days=1), time(10, 0), tzinfo=tz
    )
    rows.append(
        {
            "external_match_id": f"{_ext(division, 0)[:-2]}-GOLD",
            "division": division,
            "scheduled_start": final_start.isoformat(),
            "venue": venue,
            "court": f"Court {court_offset}",
            "home_entry_id": "",
            "away_entry_id": "",
            "home_placeholder": "1st Pool A",
            "away_placeholder": "2nd Pool A",
            "round": "Gold medal",
            "status": "scheduled",
            "set_scores": "",
        }
    )
    rows.append(
        {
            "external_match_id": f"{_ext(division, 0)[:-2]}-BRONZE",
            "division": division,
            "scheduled_start": "",
            "venue": venue,
            "court": f"Court {court_offset + 1}",
            "home_entry_id": "",
            "away_entry_id": "",
            "home_placeholder": "3rd Pool A",
            "away_placeholder": "4th Pool A",
            "round": "Bronze medal",
            "status": "scheduled",
            "set_scores": "",
        }
    )
    return rows


def seed(db: Session, *, reset: bool = False) -> Event:
    existing = db.scalar(select(Event).where(Event.slug == DEMO_SLUG))
    if existing and not reset:
        return existing
    if existing:
        # Bulk delete so the database's ON DELETE CASCADE removes everything under the event.
        db.execute(delete(Event).where(Event.id == existing.id))
        db.commit()

    org = db.scalar(select(Organization).limit(1))
    if org is None:
        org = Organization(name="Ontario Volleyball Association")
        db.add(org)
        db.flush()

    today = datetime.now(ZoneInfo(TZ)).date()
    event = Event(
        organization_id=org.id,
        slug=DEMO_SLUG,
        title="Ontario Championships Demo (simulated source)",
        kind="indoor",
        timezone=TZ,
        start_date=today,
        end_date=today + timedelta(days=1),
        status="published",
        is_demo=True,
    )
    db.add(event)
    db.flush()
    hall_a = Venue(
        event_id=event.id,
        name="Hall A",
        address="100 Princes' Blvd, Toronto, ON",
        city="Toronto",
        latitude=43.6532,  # Simulated demo location at the Toronto city reference point.
        longitude=-79.3832,
        accessible_entrance="Step-free entrance at Door 2 on the east side, beside accessible parking.",
        directions="From the main lobby, follow the green signs past registration. Courts 1 and 2 are on the left.",
        sort=0,
    )
    hall_b = Venue(
        event_id=event.id,
        name="Hall B",
        address="100 Princes' Blvd, Toronto, ON",
        city="Toronto",
        latitude=43.6532,  # Simulated demo location at the Toronto city reference point.
        longitude=-79.3832,
        accessible_entrance="Elevator from the lobby to level 2; step-free route marked with blue floor decals.",
        directions="Take the elevator or stairs to level 2 and turn right. Courts 3 and 4 are at the far end.",
        sort=1,
    )
    db.add_all([hall_a, hall_b])
    primary = Source(
        event_id=event.id, name="Demo fixture A (not a live feed)", mode="demo_fixture"
    )
    secondary = Source(
        event_id=event.id, name="Demo fixture B (second platform)", mode="demo_fixture"
    )
    db.add_all([primary, secondary])
    db.commit()

    # Two divisions come from one source and the third from another, to show two platforms
    # feeding the same screens.
    now = datetime.now(ZoneInfo(TZ))
    for source, divisions in (
        (primary, ["15U Boys D1", "6v6 Girls D1"]),
        (secondary, ["TLS Girls D1"]),
    ):
        entries = [
            {
                "external_entry_id": _ext(name, i),
                "team_name": team,
                "club_name": CLUBS[i],
                "division": name,
                "division_code": DIVISIONS[name][0],
            }
            for name in divisions
            for i, team in enumerate(DIVISIONS[name][1])
        ]
        _import(db, event, source, "entries", entries)
        match_rows = []
        for n, name in enumerate(divisions):
            venue = "Hall A" if source is primary and n == 0 else "Hall B"
            court_offset = 1 if venue == "Hall A" else 3
            if source is secondary:
                court_offset = 5
            match_rows += _matches(name, today, court_offset, venue, now)
        _import(db, event, source, "matches", match_rows)

    roster_rows = []
    for team_index, name in enumerate(["15U Boys D1", "6v6 Girls D1"]):
        for jersey in range(1, 11):
            roster_rows.append(
                {
                    "external_entry_id": _ext(name, 0),
                    "jersey": str(jersey),
                    "display_name": f"{FIRST_NAMES[(jersey + team_index) % 10]} {chr(64 + jersey)}.",
                    "position": ["Setter", "Outside", "Middle", "Opposite", "Libero"][
                        jersey % 5
                    ],
                    # Player 7's photo is supplied without approval, so it must not appear publicly.
                    "photo_url": "/demo/player-placeholder.svg" if jersey == 7 else "",
                    "photo_approved": "no" if jersey == 7 else "",
                }
            )
    _import(
        db, event, primary, "rosters", roster_rows, consent_review_ref="DEMO-REVIEW-001"
    )

    db.add_all(
        [
            Announcement(
                event_id=event.id,
                category="general",
                title="Welcome to the demo championships",
                body="Doors open at 8:00. Teams check in at the registration desk in the main lobby.",
                state="published",
                publish_at=utcnow(),
            ),
            Announcement(
                event_id=event.id,
                category="venue",
                title="Food court opens at 10:00",
                body="Draft: confirm with the venue before publishing.",
                state="draft",
            ),
        ]
    )
    db.flush()
    for a in db.scalars(
        select(Announcement).where(
            Announcement.event_id == event.id, Announcement.state == "published"
        )
    ):
        db.add(
            ChangeEvent(
                event_id=event.id,
                entity_type="announcement",
                entity_id=a.id,
                entity_revision=a.revision,
                event_type="announcement_published",
                diff={"title": a.title, "category": a.category},
                entry_ids=[],
            )
        )

    db.add_all(
        [
            GuideItem(
                event_id=event.id,
                kind="parking",
                title="Parking",
                sort=0,
                body="Paid parking in the Princes' Blvd garage. Accessible spaces on level 1 near Door 2. "
                "The lot fills by 9:30 on Saturday, so allow extra time.",
            ),
            GuideItem(
                event_id=event.id,
                kind="accessibility",
                title="Accessibility",
                sort=1,
                body="Step-free routes to every court. Quiet room beside the first aid station in the lobby. "
                "Ask any volunteer in a green shirt for help.",
            ),
            GuideItem(
                event_id=event.id,
                kind="food",
                title="Food and drink",
                sort=2,
                body="Food court in the main lobby, open 10:00 to 18:00. Water refill stations by every court.",
            ),
            GuideItem(
                event_id=event.id,
                kind="services",
                title="First aid and lost & found",
                sort=3,
                body="First aid is beside the registration desk. Lost & found is at the info booth.",
            ),
            GuideItem(
                event_id=event.id,
                kind="help",
                title="Need help?",
                sort=4,
                body="Visit the info booth in the main lobby. For an emergency, tell any volunteer or call 911.",
            ),
            GuideItem(
                event_id=event.id,
                kind="officials",
                title="Referee and scorekeeper briefing",
                sort=5,
                body="Officials report to the officials' room 30 minutes before their first assignment. "
                "Scoresheets and the scoring guide are at each court's scorer table. "
                "Submit completed scoresheets to the head referee after each match.",
            ),
        ]
    )
    db.add_all(
        [
            PartnerCard(
                event_id=event.id,
                kind="fundraiser",
                name="OVA 50/50 draw",
                sort=0,
                body="Support Ontario volleyball. Tickets are sold on the official 50/50 site.",
                link_url="https://ova5050.org",
                seller_note="Sold and refunded by the 50/50 operator.",
            ),
            PartnerCard(
                event_id=event.id,
                kind="merchandise",
                name="Championship merchandise (example)",
                sort=1,
                body="Event shirts and hoodies. Pick up at the merch booth.",
                booth_location="Main lobby, beside registration",
                link_url="https://www.ontariovolleyball.org/",
                seller_note="Example card. Checkout happens on the seller's site.",
            ),
            PartnerCard(
                event_id=event.id,
                kind="sponsor",
                name="Example Sports Co.",
                sort=2,
                body="Example sponsor card. Visit the booth for a ball-handling challenge.",
                booth_location="Hall A, near Court 1",
            ),
        ]
    )

    ensure_dev_users(db, org, event)
    db.commit()
    return event


def ensure_dev_users(db: Session, org: Organization, event: Event) -> None:
    """Local-only identities for AUTH_MODE=dev: dev-admin (admin) and dev-official (official)."""
    admin = db.scalar(select(User).where(User.clerk_subject == "dev-admin")) or User(
        clerk_subject="dev-admin", display_name="Dev admin"
    )
    official = db.scalar(
        select(User).where(User.clerk_subject == "dev-official")
    ) or User(clerk_subject="dev-official", display_name="Dev official")
    coach = db.scalar(select(User).where(User.clerk_subject == "dev-coach")) or User(
        clerk_subject="dev-coach", display_name="Dev coach"
    )
    db.add_all([admin, official, coach])
    db.flush()
    if not db.scalar(
        select(RoleGrant).where(
            RoleGrant.user_id == admin.id, RoleGrant.role == "admin"
        )
    ):
        db.add(RoleGrant(user_id=admin.id, organization_id=org.id, role="admin"))
    db.add(
        RoleGrant(
            user_id=official.id,
            organization_id=org.id,
            event_id=event.id,
            role="official",
        )
    )
    db.flush()
    from app.models import EventEntry

    entry = db.scalar(
        select(EventEntry)
        .where(EventEntry.event_id == event.id)
        .order_by(EventEntry.team_name)
        .limit(1)
    )
    db.add(
        RoleGrant(
            user_id=coach.id,
            organization_id=org.id,
            event_id=event.id,
            entry_id=entry.id,
            role="coach",
        )
    )
    matches = list(
        db.scalars(
            select(Match)
            .where(
                Match.event_id == event.id,
                Match.status == "scheduled",
                Match.scheduled_start.is_not(None),
            )
            .order_by(Match.scheduled_start)
            .limit(2)
        )
    )
    for match, role in zip(matches, ["First referee", "Scorekeeper"]):
        db.add(
            Assignment(
                event_id=event.id,
                person_user_id=official.id,
                match_id=match.id,
                court_id=match.court_id,
                role=role,
                reporting_time=match.scheduled_start - timedelta(minutes=30),
            )
        )
