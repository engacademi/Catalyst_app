"""Management commands.

    python -m app.cli seed [--reset]
    python -m app.cli grant --subject user_2abc --role admin
    python -m app.cli grant --subject user_2abc --role staff --event demo-championships
    python -m app.cli aes-load <event_key>
    python -m app.cli aes-discover [--year 2026]
    python -m app.cli myteam-load

Staff privileges are only ever granted here, never through a public endpoint.
"""

import argparse
import json
import re
import sys
from datetime import date, datetime
from urllib.parse import quote
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.adapters.aes import aes_event_url, search_aes_championships
from app.adapters.live import fetch_text
from app.adapters.myteam import local_date, upcoming_events
from app.core.db import get_sessionmaker
from app.models import Event, Organization, RoleGrant, Source, User, Venue
from app.seed import TZ, seed


def grant(
    subject: str, role: str, event_slug: str | None, entry_id: str | None = None
) -> None:
    with get_sessionmaker()() as db:
        org = db.scalar(select(Organization).limit(1))
        if org is None:
            org = Organization(name="Ontario Volleyball Association")
            db.add(org)
            db.flush()
        event_id = None
        if event_slug:
            event = db.scalar(select(Event).where(Event.slug == event_slug))
            if event is None:
                sys.exit(f"No event with slug {event_slug}")
            event_id = event.id
        user = db.scalar(select(User).where(User.clerk_subject == subject))
        if user is None:
            user = User(clerk_subject=subject)
            db.add(user)
            db.flush()
        import uuid

        from app.models import EventEntry

        entry = db.get(EventEntry, uuid.UUID(entry_id)) if entry_id else None
        if role == "coach" and (not entry or entry.event_id != event_id):
            sys.exit(
                "Coach grant requires --entry with a team UUID in the selected event"
            )
        db.add(
            RoleGrant(
                user_id=user.id,
                organization_id=org.id,
                event_id=event_id,
                role=role,
                entry_id=entry.id if entry else None,
            )
        )
        db.commit()
        print(
            f"Granted {role} to {subject}"
            + (f" for {event_slug}" if event_slug else "")
        )


def aes_load(event_key: str, get=fetch_text) -> Event:
    """Create or refresh an event from AES by its key."""
    from app.modules.sync import sync_source

    url = aes_event_url(event_key)
    key = quote(event_key, safe="")
    data = json.loads(get(url))
    slug = re.sub(r"[^a-z0-9]+", "-", data["Name"].lower()).strip("-")[:100]
    with get_sessionmaker()() as db:
        # The vendor key is the identity; titles can change or share a slug.
        sources = list(db.scalars(select(Source).where(Source.mode == "aes")))
        matching = [s for s in sources if s.config.get("event_key") == event_key]
        if len(matching) > 1:
            raise ValueError(
                "Multiple AES sources use this key; resolve them before loading"
            )
        source = matching[0] if matching else None
        event = db.get(Event, source.event_id) if source else None
        if event is None and db.scalar(select(Event.id).where(Event.slug == slug)):
            raise ValueError(
                "Event slug already belongs to another source; connect AES in the staff workspace"
            )
        if event is None:
            org = db.scalar(select(Organization).limit(1))
            if org is None:
                org = Organization(name="Ontario Volleyball Association")
                db.add(org)
                db.flush()
            venue, _, address = (data.get("Location") or "").partition(" (")
            event = Event(
                organization_id=org.id,
                slug=slug,
                title=data["Name"],
                kind="indoor",
                timezone=TZ,
                start_date=date.fromisoformat(data["StartDate"][:10]),
                end_date=date.fromisoformat(data["EndDate"][:10]),
                status="published",
            )
            db.add(event)
            db.flush()
            if venue:
                db.add(
                    Venue(
                        event_id=event.id,
                        name=venue.strip(),
                        address=address.rstrip(")") or None,
                    )
                )
            source = Source(
                event_id=event.id,
                name="AES",
                mode="aes",
                official_url=f"https://results.advancedeventsystems.com/event/{key}",
                config={"authorized": True, "event_key": event_key},
            )
            db.add(source)
        db.commit()
        result = sync_source(source.id)
        if not result["ok"]:
            sys.exit(result["message"])
        db.refresh(event)
        return event


def aes_discover(year: int | None = None, get=fetch_text) -> list:
    """Find Ontario Championships events on AES and load each; one failure skips only that event."""
    results = []
    for found in search_aes_championships(get):
        if year and not found["startDate"].startswith(str(year)):
            continue
        try:
            results.append((found["name"], aes_load(found["eventSchedulerKey"], get)))
        except (Exception, SystemExit) as exc:  # noqa: BLE001 - report, keep going
            results.append((found["name"], exc))
    return results


def myteam_load(today: date, get=fetch_text) -> list[Event]:
    """Create or refresh every upcoming OVA beach event on MyTeam.click."""
    from app.modules.sync import sync_source

    loaded = []
    for data in upcoming_events(today, get):
        day = local_date(data["date"])
        title = data["name"].strip()
        slug = re.sub(r"[^a-z0-9]+", "-", f"{title} {day}".lower()).strip("-")[:100]
        with get_sessionmaker()() as db:
            # The MyTeam.click event id is the identity; titles repeat across the season.
            sources = db.scalars(select(Source).where(Source.mode == "myteam"))
            source = next(
                (s for s in sources if s.config.get("event_id") == data["_id"]), None
            )
            event = db.get(Event, source.event_id) if source else None
            if event is None and db.scalar(select(Event.id).where(Event.slug == slug)):
                raise ValueError(f"Event slug {slug} already belongs to another source")
            if event is None:
                org = db.scalar(select(Organization).limit(1))
                if org is None:
                    org = Organization(name="Ontario Volleyball Association")
                    db.add(org)
                    db.flush()
                event = Event(
                    organization_id=org.id,
                    slug=slug,
                    kind="beach",
                    timezone=TZ,
                    status="published",
                )
                db.add(event)
            event.title, event.start_date, event.end_date = title, day, day
            db.flush()
            if source is None:
                for loc in data["locList"]:
                    db.add(Venue(event_id=event.id, name=loc["name"]))
                source = Source(
                    event_id=event.id,
                    name="MyTeam.click",
                    mode="myteam",
                    # Polling picks up the draw once MyTeam.click publishes it.
                    config={
                        "authorized": True,
                        "auto_sync": True,
                        "event_id": data["_id"],
                    },
                )
                db.add(source)
            db.commit()
            result = sync_source(source.id)
            if not result["ok"]:
                sys.exit(result["message"])
            db.refresh(event)
            loaded.append(event)
    return loaded


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser(
        "seed-testing",
        help="Add two varied synthetic tournaments without resetting data",
    )
    seed_cmd = sub.add_parser("seed", help="Load the synthetic demo event")
    seed_cmd.add_argument(
        "--reset", action="store_true", help="Delete and recreate the demo event"
    )
    grant_cmd = sub.add_parser("grant", help="Grant a role to a Clerk user id")
    grant_cmd.add_argument(
        "--subject", required=True, help="Clerk user id (the token's sub claim)"
    )
    grant_cmd.add_argument(
        "--role", required=True, choices=["admin", "staff", "official", "coach"]
    )
    grant_cmd.add_argument("--entry", help="Team UUID for a coach grant")
    grant_cmd.add_argument(
        "--event", help="Event slug; required for staff and official"
    )
    aes_cmd = sub.add_parser("aes-load", help="Create or refresh an event from AES")
    aes_cmd.add_argument("event_key", help="The key in the AES event URL")
    discover_cmd = sub.add_parser(
        "aes-discover", help="Find Ontario Championships on AES and load each"
    )
    discover_cmd.add_argument("--year", type=int, help="Only events starting this year")
    sub.add_parser(
        "myteam-load",
        help="Create or refresh upcoming OVA beach events from MyTeam.click",
    )
    args = parser.parse_args()

    if args.command == "seed-testing":
        from app.seed import seed_testing

        with get_sessionmaker()() as db:
            events = seed_testing(db)
            print(f"Testing tournaments added: {len(events)}")
    elif args.command == "seed":
        with get_sessionmaker()() as db:
            event = seed(db, reset=args.reset)
            print(f"Demo event ready: /events/{event.slug}")
    elif args.command == "grant":
        if args.role != "admin" and not args.event:
            sys.exit("--event is required for staff and official grants")
        grant(args.subject, args.role, args.event, args.entry)
    elif args.command == "aes-load":
        event = aes_load(args.event_key)
        print(f"AES event ready: /events/{event.slug}")
    elif args.command == "aes-discover":
        results = aes_discover(args.year)
        for name, result in results:
            if isinstance(result, Event):
                print(f"AES event ready: /events/{result.slug}")
            else:
                print(f"AES event failed: {name}: {result}")
        if any(not isinstance(r, Event) for _, r in results):
            sys.exit(1)
    elif args.command == "myteam-load":
        for event in myteam_load(datetime.now(ZoneInfo(TZ)).date()):
            print(f"MyTeam.click event ready: /events/{event.slug}")


if __name__ == "__main__":
    main()
