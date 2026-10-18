"""Explicit, one-time staff grants for verified Clerk accounts and demo events."""

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Event, RoleGrant, User


def verified_subject(email: str, secret: str, *, fetch=None) -> str:
    if not secret:
        raise ValueError("CLERK_SECRET_KEY must be configured")
    email = email.strip().casefold()
    if not email or "@" not in email:
        raise ValueError("A valid email address is required")
    request = Request(
        "https://api.clerk.com/v1/users?" + urlencode({"email_address[]": email}),
        headers={"Authorization": "Bearer " + secret},
    )
    if fetch is None:
        with urlopen(request, timeout=20) as response:
            users = json.load(response)
    else:
        users = fetch(request)
    matches = [
        user
        for user in users
        if any(
            address.get("email_address", "").casefold() == email
            and (address.get("verification") or {}).get("status") == "verified"
            for address in user.get("email_addresses", [])
        )
    ]
    if len(matches) != 1:
        raise ValueError("Expected exactly one Clerk account with this verified email")
    return matches[0]["id"]


def grant_demo_staff(db: Session, subject: str) -> list[Event]:
    events = list(
        db.scalars(select(Event).where(Event.is_demo.is_(True)).order_by(Event.slug))
    )
    if not events:
        raise ValueError("No demo events exist; seed them before granting access")
    user = db.scalar(select(User).where(User.clerk_subject == subject))
    if user is None:
        user = User(clerk_subject=subject)
        db.add(user)
        db.flush()
    if user.disabled_at:
        raise ValueError("Account is disabled")
    for event in events:
        grant = db.scalar(
            select(RoleGrant).where(
                RoleGrant.user_id == user.id,
                RoleGrant.event_id == event.id,
                RoleGrant.role == "staff",
                RoleGrant.entry_id.is_(None),
            )
        )
        if grant is None:
            db.add(
                RoleGrant(
                    user_id=user.id,
                    organization_id=event.organization_id,
                    event_id=event.id,
                    role="staff",
                )
            )
        else:
            grant.expires_at = None
    db.flush()
    return events
