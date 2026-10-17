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
def my_assignments(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    principal: CurrentPrincipal,
) -> Response:
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


@router.get("/roster-reviews")
def my_roster_reviews(
    db: Annotated[Session, Depends(get_db)], principal: CurrentPrincipal
):
    from app.models import RosterPublication, EventEntry

    allowed = [g.entry_id for g in principal.grants if g.role == "coach" and g.entry_id]
    rows = db.scalars(
        select(RosterPublication)
        .where(
            RosterPublication.entry_id.in_(allowed),
            RosterPublication.state != "withdrawn",
        )
        .order_by(RosterPublication.created_at.desc())
    )
    return {
        "data": [
            {
                "id": str(r.id),
                "team": db.get(EventEntry, r.entry_id).team_name,
                "version": r.version,
                "players": r.public_players,
                "review": r.review,
                "state": r.state,
            }
            for r in rows
        ]
    }


from pydantic import BaseModel, Field
from fastapi import HTTPException
from app.core.http import parse_uuid


class ReviewIn(BaseModel):
    approved: bool
    note: str = Field("", max_length=1000)


@router.post("/roster-reviews/{roster_id}")
def review_roster(
    roster_id: str,
    body: ReviewIn,
    db: Annotated[Session, Depends(get_db)],
    principal: CurrentPrincipal,
):
    from app.models import RosterPublication, utcnow, AuditEntry, EventEntry

    r = db.scalar(
        select(RosterPublication)
        .where(RosterPublication.id == parse_uuid(roster_id))
        .with_for_update()
    )
    if not r or not any(
        g.role == "coach" and g.entry_id == r.entry_id for g in principal.grants
    ):
        raise HTTPException(403, "This roster is not assigned to you")
    if r.state != "draft":
        raise HTTPException(409, "Only draft rosters can be reviewed")
    r.review = {
        **r.review,
        "state": "approved" if body.approved else "changes_requested",
        "note": body.note,
        "reviewed_at": utcnow().isoformat(),
        "reviewer_id": str(principal.user.id),
    }
    entry = db.get(EventEntry, r.entry_id)
    db.add(
        AuditEntry(
            actor_user_id=principal.user.id,
            event_id=entry.event_id,
            action="roster.review",
            target_type="roster_publications",
            target_id=str(r.id),
            summary={"approved": body.approved, "version": r.version},
        )
    )
    db.commit()
    return {"data": r.review}
