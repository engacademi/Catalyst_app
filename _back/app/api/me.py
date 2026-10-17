"""Endpoints scoped to the signed-in user."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.auth import CurrentPrincipal
from app.core.db import get_db
from app.core.http import json_response
from app.models import Assignment, Court, Match
from app.modules import projections as P
from app.modules.matches import match_load_options

router = APIRouter(prefix="/v1/me", tags=["me"])


@router.get("/assignments")
def my_assignments(request: Request, db: Annotated[Session, Depends(get_db)], principal: CurrentPrincipal) -> Response:
    """An official sees only their own imported assignments, never anyone else's."""
    rows = db.scalars(
        select(Assignment)
        .where(Assignment.person_user_id == principal.user.id)
        .options(
            selectinload(Assignment.match).options(*match_load_options()),
            selectinload(Assignment.court).selectinload(Court.venue),
        )
        .order_by(Assignment.reporting_time.asc().nulls_last())
    )
    data = []
    for a in rows:
        match: Match | None = a.match
        data.append(
            {
                "id": str(a.id),
                "event_id": str(a.event_id),
                "role": a.role,
                "reporting_time": P.iso(a.reporting_time),
                "revision": a.revision,
                "court": P.court_public(a.court or (match.court if match else None)),
                "match": P.match_public(match, match.source.event) if match else None,
            }
        )
    return json_response(request, {"data": data}, private=True)
