"""Synthetic demo events. Every team, player and partner here is fictional.

The seed loads its schedule through the same CSV staging and commit path staff use, so the
demo exercises the real import pipeline. Times are relative to the real current time (there
is no demo clock), so every rebuild has finished, live and upcoming matches. A rebuild keeps
the event row, its role grants and its team and division ids, so follows on a device and
staff access survive a redeploy.
"""

import csv
import io
import uuid
from datetime import datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import (
    AccountProfile,
    Announcement,
    Assignment,
    ChangeEvent,
    Division,
    Event,
    EventEntry,
    GuideItem,
    ImportBatch,
    Match,
    Organization,
    PartnerCard,
    RoleGrant,
    Source,
    User,
    Venue,
    utcnow,
)
from app.modules.announcements import deliver_due
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

# The demo script's family: a parent follows Maya's team and her sibling's team.
MAYA_TEAM = "Lakeshore Thunder"
SIBLING_TEAM = "Harbourfront Heat"
# Harbourfront Heat's roster arrives from the registration export and waits for its coach.
COACH_TEAM = "Harbourfront Heat"
SOURCE_A = "Simulated feed A (demo)"
SOURCE_B = "Simulated feed B (demo, second platform)"
REGISTRATION_EXPORT = (
    Path(__file__).resolve().parents[1] / "sample_data" / "demo_registration_export.csv"
)
REGISTRATION_COLUMNS = {
    "external_entry_id": "Registration Team ID",
    "jersey": "Jersey Number",
    "display_name": "Public Name",
    "position": "Position",
    "photo_url": "Headshot URL",
    "photo_approved": "Photo Consent",
}

# Venue, courts and the area label shown beside each court number.
LAYOUT = {
    "15U Boys D1": ("Exhibition Sports Centre", ("Court 3", "Court 4"), "Hall C"),
    "6v6 Girls D1": ("Exhibition Sports Centre", ("Court 1", "Court 2"), "Hall A"),
    "TLS Girls D1": ("Annex Gym", ("Court 5", "Court 6"), "Annex"),
}
# Pool A round robin: home, away, court, minutes from the anchor time, status, set scores,
# work team. Maya's next match is in Hall C 45 minutes out; her sibling plays in Hall A 70
# minutes after that, so a 20-minute Hall C delay makes the two overlap (demo step 4).
POOLS = {
    "15U Boys D1": [
        (0, 1, 0, -120, "completed", "25-18 25-20", None),
        (2, 3, 1, -120, "completed", "25-21 22-25 15-12", None),
        (0, 2, 0, 45, "scheduled", "", None),
        (1, 3, 1, 45, "scheduled", "", None),
        (1, 2, 1, 180, "scheduled", "", 0),  # Lakeshore Thunder referees this one.
        (0, 3, 0, 255, "scheduled", "", None),
    ],
    "6v6 Girls D1": [
        (0, 1, 0, -75, "completed", "25-23 25-19", None),
        (2, 3, 1, -30, "in_progress", "25-22", None),
        (0, 2, 0, 115, "scheduled", "", None),
        (1, 3, 1, 115, "scheduled", "", None),
        (0, 3, 0, 240, "scheduled", "", None),
        (1, 2, 1, 240, "scheduled", "", None),
    ],
    # Finished this morning, so its medal matches are the honest next step.
    "TLS Girls D1": [
        (0, 1, 0, -240, "completed", "25-19 25-21", None),
        (2, 3, 1, -240, "completed", "25-21 22-25 15-12", None),
        (0, 2, 0, -180, "completed", "25-17 25-22", None),
        (1, 3, 1, -180, "completed", "23-25 25-20 15-11", None),
        (0, 3, 0, -120, "completed", "25-15 25-18", None),
        (1, 2, 1, -120, "completed", "25-23 26-24", None),
    ],
}
# Medal matches: key, round, placeholders, court, start (minutes from the anchor, a time
# tomorrow, or None while the source hasn't published one).
MEDALS = {
    "15U Boys D1": [
        ("GOLD", "Gold medal", ("1st Pool A", "2nd Pool A"), 0, time(10, 0)),
        ("BRONZE", "Bronze medal", ("3rd Pool A", "4th Pool A"), 1, None),
    ],
    "6v6 Girls D1": [
        ("GOLD", "Gold medal", ("1st Pool A", "2nd Pool A"), 0, time(11, 0)),
        ("BRONZE", "Bronze medal", ("3rd Pool A", "4th Pool A"), 1, time(11, 0)),
    ],
    "TLS Girls D1": [
        ("GOLD", "Gold medal", ("1st Pool A", "2nd Pool A"), 0, 150),
        ("BRONZE", "Bronze medal", ("3rd Pool A", "4th Pool A"), 1, None),
    ],
}
# What the simulated source publishes once it resolves the playoff slots (demo step 5).
PLAYOFF_DRAW = {
    "15U Boys D1": {"GOLD": (0, 2), "BRONZE": (1, 3)},
    "6v6 Girls D1": {"GOLD": (0, 1), "BRONZE": (2, 3)},
    "TLS Girls D1": {"GOLD": (0, 1), "BRONZE": (2, 3)},
}


def _csv(rows: list[dict]) -> bytes:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue().encode()


def _import(
    db: Session,
    event: Event,
    source: Source,
    kind: str,
    rows: list[dict] | None = None,
    *,
    content: bytes | None = None,
    filename: str | None = None,
    **options,
) -> ImportBatch:
    batch = stage_import(
        db,
        event=event,
        source=source,
        kind=kind,
        filename=filename or f"seed-{kind}.csv",
        content=content if content is not None else _csv(rows),
        options={"strict": True, **options},
        actor_id=None,
    )
    if batch.errors or any(r["action"] == "error" for r in batch.rows):
        raise RuntimeError(
            f"Seed {kind} import failed: {batch.errors or [r for r in batch.rows if r['errors']]}"
        )
    commit_import(db, batch.id, None, "seed")
    db.refresh(source)
    return batch


def _ext(division: str, index: int) -> str:
    return f"{DIVISIONS[division][0].replace(' ', '-')}-{index + 1}"


def _prefix(division: str) -> str:
    return DIVISIONS[division][0].replace(" ", "-")


def anchor_time(now: datetime | None = None) -> datetime:
    """The scenario's reference time: the current Toronto time, down to the quarter hour."""
    now = (now or datetime.now(ZoneInfo(TZ))).astimezone(ZoneInfo(TZ))
    return now.replace(minute=now.minute - now.minute % 15, second=0, microsecond=0)


def _start(spec, anchor: datetime) -> datetime | None:
    if spec is None:
        return None
    if isinstance(spec, time):
        return datetime.combine(
            anchor.date() + timedelta(days=1), spec, tzinfo=ZoneInfo(TZ)
        )
    return anchor + timedelta(minutes=spec)


def _match_row(division: str, external_id: str, start, court: str, **cells) -> dict:
    venue, _, area = LAYOUT[division]
    return {
        "external_match_id": external_id,
        "division": division,
        "scheduled_start": start.isoformat() if start else "",
        "venue": venue,
        "court": court,
        "court_area": area,
        "home_entry_id": cells.get("home", ""),
        "away_entry_id": cells.get("away", ""),
        "home_placeholder": cells.get("home_placeholder", ""),
        "away_placeholder": cells.get("away_placeholder", ""),
        "round": cells["round"],
        "status": cells.get("status", "scheduled"),
        "set_scores": cells.get("scores", ""),
        "work_entry_id": cells.get("work", ""),
    }


def _matches(division: str, anchor: datetime) -> list[dict]:
    """Pool A round robin, then medal matches whose slots wait on the source."""
    courts = LAYOUT[division][1]
    rows = []
    for number, (home, away, court, minutes, status, scores, work) in enumerate(
        POOLS[division], start=1
    ):
        rows.append(
            _match_row(
                division,
                f"{_prefix(division)}-M{number}",
                anchor + timedelta(minutes=minutes),
                courts[court],
                home=_ext(division, home),
                away=_ext(division, away),
                round="Pool A",
                status=status,
                scores=scores,
                work=_ext(division, work) if work is not None else "",
            )
        )
    for key, round_label, (home, away), court, when in MEDALS[division]:
        rows.append(
            _match_row(
                division,
                f"{_prefix(division)}-{key}",
                _start(when, anchor),
                courts[court],
                home_placeholder=home,
                away_placeholder=away,
                round=round_label,
            )
        )
    return rows


def _empty_demo_event(
    db: Session, org: Organization, slug: str, **fields
) -> tuple[Event, dict]:
    """Return the synthetic event emptied for a rebuild, with what must survive it.

    The event row and its event-wide role grants stay. Coach grants and account team
    choices point at entries, so they are carried over by team name.
    """
    fields = {"status": "published", "is_demo": True, "demo_clock": {}, **fields}
    event = db.scalar(select(Event).where(Event.slug == slug))
    kept: dict = {"grants": [], "profiles": []}
    if event is None:
        event = Event(organization_id=org.id, slug=slug, timezone=TZ, **fields)
        db.add(event)
        db.flush()
        return event, kept
    if not event.is_demo:
        raise RuntimeError(f"Event {slug} holds real data; refusing to rebuild it")
    teams = dict(
        db.execute(
            select(EventEntry.id, EventEntry.team_name).where(
                EventEntry.event_id == event.id
            )
        ).all()
    )
    kept["grants"] = [
        {
            "user_id": g.user_id,
            "organization_id": g.organization_id,
            "role": g.role,
            "team": teams[g.entry_id],
            "granted_by": g.granted_by,
            "expires_at": g.expires_at,
        }
        for g in db.scalars(
            select(RoleGrant).where(RoleGrant.entry_id.in_(list(teams)))
        )
    ]
    kept["profiles"] = [
        (p.user_id, teams[p.team_entry_id])
        for p in db.scalars(
            select(AccountProfile).where(AccountProfile.team_entry_id.in_(list(teams)))
        )
    ]
    # Sources cascade to their matches, mappings and imports; entries to coach grants
    # and rosters.
    for model in (
        ChangeEvent,
        Announcement,
        GuideItem,
        PartnerCard,
        Assignment,
        ImportBatch,
        Source,
        EventEntry,
        Division,
        Venue,
    ):
        db.execute(delete(model).where(model.event_id == event.id))
    for name, value in fields.items():
        setattr(event, name, value)
    db.flush()
    return event, kept


def _restore(db: Session, event: Event, kept: dict) -> None:
    teams = dict(
        db.execute(
            select(EventEntry.team_name, EventEntry.id).where(
                EventEntry.event_id == event.id
            )
        ).all()
    )
    for grant in kept["grants"]:
        entry_id = teams.get(grant.pop("team"))
        if entry_id:
            db.add(RoleGrant(event_id=event.id, entry_id=entry_id, **grant))
    for user_id, team in kept["profiles"]:
        profile = db.get(AccountProfile, user_id)
        if profile and team in teams:
            profile.team_entry_id = teams[team]


def _organization(db: Session) -> Organization:
    org = db.scalar(select(Organization).limit(1))
    if org is None:
        org = Organization(name="Ontario Volleyball Association")
        db.add(org)
        db.flush()
    return org


def seed(db: Session, *, reset: bool = False, now: datetime | None = None) -> Event:
    """Load the demo event, or with reset rebuild it around the current time."""
    existing = db.scalar(select(Event).where(Event.slug == DEMO_SLUG))
    if existing and not reset:
        return existing

    org = _organization(db)
    anchor = anchor_time(now)
    event, kept = _empty_demo_event(
        db,
        org,
        DEMO_SLUG,
        title="Ontario Championships Demo (simulated source)",
        kind="indoor",
        start_date=(anchor - timedelta(hours=4)).date(),
        end_date=anchor.date() + timedelta(days=1),
    )
    main_hall = Venue(
        event_id=event.id,
        name="Exhibition Sports Centre",
        address="100 Princes' Blvd, Toronto, ON",
        city="Toronto",
        latitude=43.6532,  # Simulated demo location at the Toronto city reference point.
        longitude=-79.3832,
        accessible_entrance="Step-free entrance at Door 2 on the east side, beside accessible parking. "
        "An elevator by registration goes up to Hall C.",
        directions="Hall A (Courts 1 and 2) is on the left past registration. "
        "Hall C (Courts 3 and 4) is on level 2: take the elevator or stairs and follow the green signs.",
        sort=0,
    )
    annex = Venue(
        event_id=event.id,
        name="Annex Gym",
        address="100 Princes' Blvd, Toronto, ON",
        city="Toronto",
        latitude=43.6532,  # Simulated demo location at the Toronto city reference point.
        longitude=-79.3832,
        accessible_entrance="Level entrance from the covered walkway, with automatic doors.",
        directions="A five-minute walk from the main lobby along the covered walkway. "
        "Courts 5 and 6 are inside the Annex.",
        sort=1,
    )
    db.add_all([main_hall, annex])
    # A failed refresh of feed A is how the demo shows a source outage (demo step 9).
    primary = Source(event_id=event.id, name=SOURCE_A, mode="demo_fixture")
    secondary = Source(event_id=event.id, name=SOURCE_B, mode="demo_fixture")
    db.add_all([primary, secondary])
    db.commit()

    # Two divisions come from one source and the third from another, to show two platforms
    # feeding the same screens.
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
        # Ids derived from the event and external ids keep follows valid after a rebuild.
        _import(
            db,
            event,
            source,
            "entries",
            entries,
            id_namespace=str(uuid.uuid5(event.id, source.name)),
        )
        match_rows = [row for name in divisions for row in _matches(name, anchor)]
        _import(db, event, source, "matches", match_rows)

    # Maya's team has a published roster with approved photos. Player 7's photo was
    # supplied without approval, so it must not appear publicly.
    roster_rows = [
        {
            "external_entry_id": _ext("15U Boys D1", 0),
            "jersey": str(jersey),
            "display_name": f"{FIRST_NAMES[jersey % 10]} {chr(64 + jersey)}.",
            "position": ["Setter", "Outside", "Middle", "Opposite", "Libero"][
                jersey % 5
            ],
            "photo_url": f"/demo/athlete-{(jersey - 1) % 4 + 1}.svg",
            "photo_approved": "no" if jersey == 7 else "yes",
            "team_photo_url": "/demo/team-photo.svg" if jersey == 1 else "",
            "team_photo_approved": "yes" if jersey == 1 else "",
        }
        for jersey in range(1, 11)
    ]
    _import(
        db, event, primary, "rosters", roster_rows, consent_review_ref="DEMO-REVIEW-001"
    )
    # Harbourfront Heat's roster comes from the registration export, mapped the way staff
    # map it in Registration, and waits as a draft for the coach's review (demo step 7).
    from app.modules.operations import map_registration

    coach_team = db.scalar(
        select(EventEntry.id).where(
            EventEntry.event_id == event.id, EventEntry.team_name == COACH_TEAM
        )
    )
    teams = {"REG-6V6G-0142": str(coach_team)}
    _import(
        db,
        event,
        primary,
        "rosters",
        content=map_registration(
            REGISTRATION_EXPORT.read_bytes(), REGISTRATION_COLUMNS, teams
        ),
        filename=REGISTRATION_EXPORT.name,
        team_mapping=teams,
        require_review=True,
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
    deliver_due(db, event)

    db.add_all(
        [
            GuideItem(
                event_id=event.id,
                kind="parking",
                title="Parking",
                sort=0,
                body="Paid parking in the Princes' Blvd garage. Accessible spaces on level 1 near Door 2. "
                "The lot fills by mid-morning, so allow extra time.",
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

    _restore(db, event, kept)
    ensure_dev_users(db, org, event)
    db.commit()
    return event


def ensure_dev_users(db: Session, org: Organization, event: Event) -> None:
    """Local-only identities for AUTH_MODE=dev: dev-admin (admin), dev-official (official)
    and dev-coach (coach of the team whose roster waits for review)."""
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
    # A rebuild keeps event grants, so only add the ones that are missing.
    held = set(
        db.execute(
            select(RoleGrant.user_id, RoleGrant.role).where(
                RoleGrant.event_id == event.id
            )
        ).all()
    )
    if (official.id, "official") not in held:
        db.add(
            RoleGrant(
                user_id=official.id,
                organization_id=org.id,
                event_id=event.id,
                role="official",
            )
        )
    # The demo event's coach runs COACH_TEAM; other events (the staff showcase)
    # fall back to their first team by name.
    entry = db.scalar(
        select(EventEntry).where(
            EventEntry.event_id == event.id, EventEntry.team_name == COACH_TEAM
        )
    ) or db.scalar(
        select(EventEntry)
        .where(EventEntry.event_id == event.id)
        .order_by(EventEntry.team_name)
        .limit(1)
    )
    if (coach.id, "coach") not in held:
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


def seed_testing(db: Session) -> list[Event]:
    """Rebuild the synthetic events around the current time. Real events are untouched.

    Runs on every deploy, so the demo event always has upcoming matches.
    """
    added = [seed(db, reset=True)]
    org = _organization(db)
    now = datetime.now(ZoneInfo(TZ)).replace(second=0, microsecond=0)
    fixtures = [
        (
            "test-lakeside-beach",
            "Lakeside Beach Open",
            "beach",
            now.date() - timedelta(days=14),
            "Lakeside Courts",
            43.6388,
            -79.3816,
            "Toronto",
        ),
        (
            "test-autumn-invitational",
            "Autumn Invitational",
            "indoor",
            now.date(),
            "Hamilton Sports Hall",
            43.2557,
            -79.8711,
            "Hamilton",
        ),
    ]
    for slug, title, kind, day, venue, lat, lon, city in fixtures:
        event, kept = _empty_demo_event(
            db,
            org,
            slug,
            title=title,
            kind=kind,
            start_date=day,
            end_date=day + timedelta(days=1),
        )
        db.add(
            Venue(
                event_id=event.id,
                name=venue,
                city=city,
                latitude=lat,
                longitude=lon,
                directions="Synthetic testing venue. Coordinates are city reference points.",
            )
        )
        source = Source(
            event_id=event.id, name="Test tournament fixture", mode="demo_fixture"
        )
        db.add(source)
        db.flush()
        names = (
            ["Lakeside Aces", "Hamilton Heights", "Toronto Sparks", "Waterloo Waves"]
            if kind == "indoor"
            else [
                "Sunset Servers",
                "Lakefront Rally",
                "Sandstorm Duo",
                "Beachside Block",
            ]
        )
        _import(
            db,
            event,
            source,
            "entries",
            [
                {
                    "external_entry_id": f"T{i}",
                    "team_name": name,
                    "club_name": f"{city} Test Club",
                    "division": "Open",
                    "division_code": "OPEN",
                }
                for i, name in enumerate(names)
            ],
            id_namespace=str(uuid.uuid5(event.id, source.name)),
        )
        rows = []
        for i, (home, away) in enumerate([(0, 1), (2, 3), (0, 2), (1, 3)]):
            start = (
                (now + timedelta(minutes=[-120, -20, 90, 180][i]))
                if kind == "indoor"
                else datetime.combine(day, time(9 + i), tzinfo=ZoneInfo(TZ))
            )
            status = (
                "completed"
                if kind == "beach" or i == 0
                else "in_progress"
                if i == 1
                else "scheduled"
            )
            rows.append(
                {
                    "external_match_id": f"M{i}",
                    "division": "Open",
                    "scheduled_start": start.isoformat(),
                    "venue": venue,
                    "court": f"Court {i % 2 + 1}",
                    "home_entry_id": f"T{home}",
                    "away_entry_id": f"T{away}",
                    "home_placeholder": "",
                    "away_placeholder": "",
                    "round": "Pool A" if i < 2 else "Final round",
                    "status": status,
                    "set_scores": "25-21 25-19"
                    if status == "completed"
                    else "25-22"
                    if status == "in_progress"
                    else "",
                }
            )
        _import(db, event, source, "matches", rows)
        db.add_all(
            [
                PartnerCard(
                    event_id=event.id,
                    kind="sponsor",
                    name=name,
                    body="Fictional sponsor for interface testing.",
                    sort=i,
                )
                for i, name in enumerate(
                    [
                        "Rally Athletics · Example",
                        "Courtside Hydration · Example",
                        "Northstar Sport · Example",
                    ]
                )
            ]
        )
        db.add(
            GuideItem(
                event_id=event.id,
                kind="parking",
                title="Venue parking",
                body="Testing fixture: confirm real parking arrangements before travel.",
            )
        )
        _restore(db, event, kept)
        added.append(event)
    from app.showcase import seed_staff_showcase

    seed_staff_showcase(db)
    db.commit()
    return added


def _demo_event(db: Session) -> Event:
    event = db.scalar(select(Event).where(Event.slug == DEMO_SLUG))
    if event is None:
        raise RuntimeError("No demo event; run seed-testing or demo-reset first")
    return event


def publish_playoff_draw(db: Session) -> int:
    """Demo step 5: the simulated sources resolve every medal-match placeholder.

    The draw goes through the import pipeline, so followers get "Next match set" updates.
    A medal match without a time takes its division's gold-medal time. Returns the number
    of change events; publishing the same draw again changes nothing.
    """
    event = _demo_event(db)
    emitted = 0
    for source in db.scalars(select(Source).where(Source.event_id == event.id)):
        rows = []
        for division, draw in PLAYOFF_DRAW.items():
            found = {
                key: db.scalar(
                    select(Match).where(
                        Match.source_id == source.id,
                        Match.external_id == f"{_prefix(division)}-{key}",
                    )
                )
                for key in draw
            }
            for key, (home, away) in draw.items():
                match = found[key]
                if match is None or match.court is None:
                    continue
                start = match.scheduled_start or found["GOLD"].scheduled_start
                slots = {p.slot: p.placeholder_label or "" for p in match.participants}
                row = _match_row(
                    division,
                    match.external_id,
                    start,
                    match.court.label,
                    home=_ext(division, home),
                    away=_ext(division, away),
                    home_placeholder=slots.get("home", ""),
                    away_placeholder=slots.get("away", ""),
                    round=match.round_label,
                    status=match.status,
                )
                # Keep the venue and area the match has now, in case staff moved it.
                row["venue"] = match.court.venue.name
                row["court_area"] = match.court.area_label or ""
                rows.append(row)
        if rows:
            batch = _import(
                db, event, source, "matches", rows, filename="playoff-draw.csv"
            )
            emitted += batch.summary.get("change_events", 0)
    return emitted


def set_feed_outage(db: Session, down: bool = True) -> dict:
    """Demo step 9: make feed A unreachable (or reachable again) and refresh it.

    The refresh runs the real sync path, so a failure keeps the last schedule and marks
    the source unavailable, exactly as a vendor outage would.
    """
    from app.modules.sync import sync_source

    event = _demo_event(db)
    source = db.scalar(
        select(Source).where(Source.event_id == event.id, Source.name == SOURCE_A)
    )
    if source is None:
        raise RuntimeError(f"No {SOURCE_A} source; run demo-reset first")
    source.config = {**source.config, "simulated_outage": down}
    if source.status == "paused":
        source.status = "active"
    db.commit()
    return sync_source(source.id)


def demo_summary(db: Session) -> list[str]:
    """Lines the CLI prints so a presenter can find the scenario's moving parts."""
    event = _demo_event(db)
    teams = dict(
        db.execute(
            select(EventEntry.team_name, EventEntry.id).where(
                EventEntry.event_id == event.id
            )
        ).all()
    )
    return [
        f"Demo event: /events/{event.slug} ({event.start_date} to {event.end_date})",
        f"Maya's team: {MAYA_TEAM} {teams[MAYA_TEAM]}",
        f"Sibling's team: {SIBLING_TEAM} {teams[SIBLING_TEAM]}",
        f"Roster awaiting coach review: {COACH_TEAM} {teams[COACH_TEAM]}",
    ]
