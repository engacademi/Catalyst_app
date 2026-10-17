"""Identity verification and scoped role checks.

Frontend route guards are cosmetic; every write and private read goes through these
dependencies, which consult current role grants in the database.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.models import RoleGrant, User


@dataclass
class Principal:
    user: User
    grants: list[RoleGrant]

    def has_role(self, roles: set[str], event_id: uuid.UUID | None = None) -> bool:
        for grant in self.grants:
            if grant.role == "admin":
                return True
            if grant.role in roles and (grant.event_id is None or grant.event_id == event_id):
                return True
        return False


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True)


def verify_clerk_token(token: str, settings: Settings) -> str:
    """Return the verified subject or raise 401."""
    if not settings.jwks_url or not settings.auth_issuer:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Authentication is not configured")
    try:
        key = _jwks_client(settings.jwks_url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            issuer=settings.auth_issuer,
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session token") from exc
    azp = claims.get("azp")
    if settings.clerk_authorized_parties and azp not in settings.clerk_authorized_parties:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token issued for another origin")
    return str(claims["sub"])


def _resolve_subject(
    settings: Settings, authorization: str | None, x_dev_user: str | None
) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        if settings.auth_mode == "clerk":
            return verify_clerk_token(authorization[7:].strip(), settings)
    if settings.dev_auth_allowed and x_dev_user:
        return x_dev_user.strip()
    return None


def get_principal(
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
    x_dev_user: Annotated[str | None, Header()] = None,
) -> Principal:
    subject = _resolve_subject(settings, authorization, x_dev_user)
    if not subject:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required")
    user = db.scalar(select(User).where(User.clerk_subject == subject))
    if user is None:
        # New users get no staff grants; an admin bootstraps grants via the CLI.
        user = User(clerk_subject=subject)
        db.add(user)
        db.commit()
    if user.disabled_at:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")
    now = datetime.now(timezone.utc)
    grants = list(
        db.scalars(
            select(RoleGrant).where(
                RoleGrant.user_id == user.id,
                or_(RoleGrant.expires_at.is_(None), RoleGrant.expires_at > now),
            )
        )
    )
    return Principal(user=user, grants=grants)


CurrentPrincipal = Annotated[Principal, Depends(get_principal)]


def require_event_role(principal: Principal, event_id: uuid.UUID, roles: set[str]) -> None:
    if not principal.has_role(roles, event_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have access to this event")
