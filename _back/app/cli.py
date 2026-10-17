"""Management commands.

    python -m app.cli seed [--reset]
    python -m app.cli grant --subject user_2abc --role admin
    python -m app.cli grant --subject user_2abc --role staff --event demo-championships

Staff privileges are only ever granted here, never through a public endpoint.
"""

import argparse
import sys

from sqlalchemy import select

from app.core.db import get_sessionmaker
from app.models import Event, Organization, RoleGrant, User
from app.seed import seed


def grant(subject: str, role: str, event_slug: str | None) -> None:
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
        db.add(RoleGrant(user_id=user.id, organization_id=org.id, event_id=event_id, role=role))
        db.commit()
        print(f"Granted {role} to {subject}" + (f" for {event_slug}" if event_slug else ""))


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    seed_cmd = sub.add_parser("seed", help="Load the synthetic demo event")
    seed_cmd.add_argument("--reset", action="store_true", help="Delete and recreate the demo event")
    grant_cmd = sub.add_parser("grant", help="Grant a role to a Clerk user id")
    grant_cmd.add_argument("--subject", required=True, help="Clerk user id (the token's sub claim)")
    grant_cmd.add_argument("--role", required=True, choices=["admin", "staff", "official"])
    grant_cmd.add_argument("--event", help="Event slug; required for staff and official")
    args = parser.parse_args()

    if args.command == "seed":
        with get_sessionmaker()() as db:
            event = seed(db, reset=args.reset)
            print(f"Demo event ready: /events/{event.slug}")
    elif args.command == "grant":
        if args.role != "admin" and not args.event:
            sys.exit("--event is required for staff and official grants")
        grant(args.subject, args.role, args.event)


if __name__ == "__main__":
    main()
