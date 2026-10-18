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
    from app.models import EventEntry, RosterPublication

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


from fastapi import HTTPException
from pydantic import BaseModel, Field

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
    from app.models import AuditEntry, EventEntry, RosterPublication, utcnow

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


# Account type is a preference. Only OVA-issued grants authorize event writes.
from typing import Literal

from sqlalchemy import delete

from app.models import AccountFollow, AccountProfile, Event, EventEntry, User


def profile_data(db, principal):
    p = db.get(AccountProfile, principal.user.id)
    entry = db.get(EventEntry, p.team_entry_id) if p and p.team_entry_id else None
    followers = (
        list(
            db.scalars(
                select(User)
                .join(AccountFollow, AccountFollow.follower_id == User.id)
                .where(
                    AccountFollow.player_id == principal.user.id,
                    User.disabled_at.is_(None),
                )
                .order_by(User.display_name, User.id)
            )
        )
        if p and p.account_type == "player"
        else []
    )
    return {
        "user_id": str(principal.user.id),
        "display_name": principal.user.display_name or "Volleyball fan",
        "account_type": p.account_type if p else None,
        "officer_type": p.officer_type if p else None,
        "discoverable": p.discoverable if p else False,
        "team_entry_id": str(entry.id) if entry else None,
        "team_name": entry.team_name if entry else None,
        "followers": [
            {"id": str(u.id), "display_name": u.display_name or "Volleyball fan"}
            for u in followers
        ],
    }


@router.get("/profile")
def my_profile(db: Annotated[Session, Depends(get_db)], principal: CurrentPrincipal):
    return {"data": profile_data(db, principal)}


class AccountIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    account_type: Literal["spectator", "player", "officer"]
    officer_type: Literal["coach", "referee"] | None = None
    team_entry_id: str | None = None
    discoverable: bool = False


@router.put("/profile")
def update_profile(
    body: AccountIn,
    db: Annotated[Session, Depends(get_db)],
    principal: CurrentPrincipal,
):
    if not body.display_name.strip():
        raise HTTPException(422, "Enter a display name")
    if body.account_type == "officer" and not body.officer_type:
        raise HTTPException(422, "Choose coach or referee")
    entry = (
        db.get(EventEntry, parse_uuid(body.team_entry_id))
        if body.team_entry_id
        else None
    )
    if body.team_entry_id and (
        not entry
        or not db.scalar(
            select(Event.id).where(
                Event.id == entry.event_id, Event.status == "published"
            )
        )
    ):
        raise HTTPException(422, "Choose a team in a published tournament")
    p = db.get(AccountProfile, principal.user.id)
    if not p:
        p = AccountProfile(user_id=principal.user.id)
        db.add(p)
    principal.user.display_name = body.display_name.strip()
    p.account_type = body.account_type
    p.officer_type = body.officer_type if body.account_type == "officer" else None
    p.team_entry_id = entry.id if entry and body.account_type == "player" else None
    p.discoverable = body.discoverable and body.account_type == "player"
    if not p.discoverable:
        db.execute(
            delete(AccountFollow).where(AccountFollow.player_id == principal.user.id)
        )
    db.commit()
    return {"data": profile_data(db, principal)}


@router.get("/players")
def find_players(
    db: Annotated[Session, Depends(get_db)], principal: CurrentPrincipal, q: str = ""
):
    if len(q) > 100:
        raise HTTPException(422, "Search is too long")
    following = set(
        db.scalars(
            select(AccountFollow.player_id).where(
                AccountFollow.follower_id == principal.user.id
            )
        )
    )
    rows = db.execute(
        select(User, AccountProfile)
        .join(AccountProfile, AccountProfile.user_id == User.id)
        .where(
            User.disabled_at.is_(None),
            User.id != principal.user.id,
            AccountProfile.account_type == "player",
            AccountProfile.discoverable.is_(True),
            User.display_name.icontains(q.strip(), autoescape=True),
        )
        .order_by(User.display_name, User.id)
        .limit(50)
    )
    return {
        "data": [
            {
                "id": str(u.id),
                "display_name": u.display_name,
                "team_name": db.get(EventEntry, p.team_entry_id).team_name
                if p.team_entry_id
                else None,
                "following": u.id in following,
            }
            for u, p in rows
        ]
    }


@router.put("/players/{player_id}/follow")
def follow_player(
    player_id: str, db: Annotated[Session, Depends(get_db)], principal: CurrentPrincipal
):
    target = parse_uuid(player_id)
    profile = db.get(AccountProfile, target)
    user = db.get(User, target)
    if (
        target == principal.user.id
        or not profile
        or profile.account_type != "player"
        or not profile.discoverable
        or not user
        or user.disabled_at
    ):
        raise HTTPException(404, "Player unavailable")
    from sqlalchemy.dialects.postgresql import insert

    db.execute(
        insert(AccountFollow)
        .values(follower_id=principal.user.id, player_id=target)
        .on_conflict_do_nothing()
    )
    db.commit()
    return {"following": True}


@router.delete("/players/{player_id}/follow", status_code=204)
def unfollow_player(
    player_id: str, db: Annotated[Session, Depends(get_db)], principal: CurrentPrincipal
):
    db.execute(
        delete(AccountFollow).where(
            AccountFollow.follower_id == principal.user.id,
            AccountFollow.player_id == parse_uuid(player_id),
        )
    )
    db.commit()


class ScoreDisputeIn(BaseModel):
    comment: str = Field("", max_length=1000)


@router.post("/matches/{match_id}/disputes", status_code=201)
def submit_score_dispute(match_id: str, body: ScoreDisputeIn, db: Annotated[Session, Depends(get_db)], principal: CurrentPrincipal):
    from sqlalchemy.dialects.postgresql import insert

    from app.models import ScoreDispute
    match = db.get(Match, parse_uuid(match_id))
    event = db.get(Event, match.event_id) if match else None
    if not match or not event or event.status != "published":
        raise HTTPException(404, "Match not found")
    if match.status not in {"in_progress", "completed"}:
        raise HTTPException(409, "A score can be disputed once a match is live or completed")
    db.execute(insert(ScoreDispute).values(match_id=match.id, reporter_id=principal.user.id, comment=body.comment.strip()).on_conflict_do_nothing(index_elements=["match_id", "reporter_id"]))
    db.commit()
    return {"data": {"submitted": True}}
