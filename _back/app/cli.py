"""Management commands.

    python -m app.cli seed [--reset]
    python -m app.cli grant --subject user_2abc --role admin
    python -m app.cli grant --subject user_2abc --role staff --event demo-championships
    python -m app.cli aes-load <event_key>

Staff privileges are only ever granted here, never through a public endpoint.
"""

import argparse
import json
import re
import sys
from datetime import date
from urllib.parse import quote

from sqlalchemy import select

from app.adapters.live import fetch_text
from app.core.db import get_sessionmaker
from app.models import Event, Organization, RoleGrant, Source, User, Venue, utcnow
from app.seed import TZ, seed

AES_DEMO_TIME = "2026-04-19T09:40:00-04:00"


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
    """Create or refresh an event from AES by its key, with the demo clock at AES_DEMO_TIME."""
    from app.modules.sync import sync_source

    key = quote(event_key, safe="")
    data = json.loads(get(f"https://results.advancedeventsystems.com/api/event/{key}"))
    slug = re.sub(r"[^a-z0-9]+", "-", data["Name"].lower()).strip("-")[:100]
    with get_sessionmaker()() as db:
        event = db.scalar(select(Event).where(Event.slug == slug))
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
                # The demo clock only runs on demo events.
                is_demo=True,
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
            db.add(
                Source(
                    event_id=event.id,
                    name="AES",
                    mode="aes",
                    official_url=f"https://results.advancedeventsystems.com/event/{key}",
                    config={"authorized": True, "event_key": event_key},
                )
            )
        event.demo_clock = {"at": AES_DEMO_TIME, "set_at": utcnow().isoformat()}
        db.commit()
        source = db.scalar(
            select(Source).where(Source.event_id == event.id, Source.mode == "aes")
        )
        result = sync_source(source.id)
        if not result["ok"]:
            sys.exit(result["message"])
        db.refresh(event)
        return event


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
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
    args = parser.parse_args()

    if args.command == "seed":
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


if __name__ == "__main__":
    main()
