"""Management commands.

    python -m app.cli seed [--reset]
    python -m app.cli demo-setup [--offline]
    python -m app.cli grant --subject user_2abc --role admin
    python -m app.cli grant --subject user_2abc --role staff --event demo-championships

Staff privileges are only ever granted here, never through a public endpoint.
"""

import argparse
import sys

from sqlalchemy import select

from app.core.config import get_settings
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


def demo_setup(offline: bool) -> None:
    from app.demo_setup import DEMO_TIME, EVENT_B_FILES, setup_demo

    with get_sessionmaker()() as db:
        result = setup_demo(db, offline=offline)
        if result.aes_live:
            print(f"Event A (AES, live): /events/{result.event_a.slug}")
        else:
            reason = "--offline" if offline else "AES unreachable"
            print(f"Event A (AES, recorded responses: {reason}): /events/{result.event_a.slug}")
        print(f"Event B (simulated CSV): /events/{result.event_b.slug}")
        print(f"Demo time on both: {DEMO_TIME:%A %B %-d, %-I:%M %p}")
        print(f"Files to upload to Event B during the demo: {EVENT_B_FILES}/step-5-playoff-filled.csv, step-6-court-change.csv")
    if not get_settings().demo_mode:
        print("Note: start the API with DEMO_MODE=true or demo time and the banner stay off.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    seed_cmd = sub.add_parser("seed", help="Load the synthetic demo event")
    seed_cmd.add_argument("--reset", action="store_true", help="Delete and recreate the demo event")
    demo_cmd = sub.add_parser("demo-setup", help="Rebuild both demo events: AES Event 2 and a simulated CSV event")
    demo_cmd.add_argument("--offline", action="store_true", help="Use the recorded AES responses instead of calling AES")
    grant_cmd = sub.add_parser("grant", help="Grant a role to a Clerk user id")
    grant_cmd.add_argument("--subject", required=True, help="Clerk user id (the token's sub claim)")
    grant_cmd.add_argument("--role", required=True, choices=["admin", "staff", "official"])
    grant_cmd.add_argument("--event", help="Event slug; required for staff and official")
    args = parser.parse_args()

    if args.command == "seed":
        with get_sessionmaker()() as db:
            event = seed(db, reset=args.reset)
            print(f"Demo event ready: /events/{event.slug}")
    elif args.command == "demo-setup":
        demo_setup(args.offline)
    elif args.command == "grant":
        if args.role != "admin" and not args.event:
            sys.exit("--event is required for staff and official grants")
        grant(args.subject, args.role, args.event)


if __name__ == "__main__":
    main()
