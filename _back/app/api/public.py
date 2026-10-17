"""Public read endpoints. No token needed; only approved projections leave this module."""

import uuid
from datetime import date, datetime, timezone
from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings, get_settings
from app.core.db import get_db
from app.core.http import json_response, parse_uuid, parse_uuid_list
from app.models import (
    Announcement,
    ChangeEvent,
    Division,
    Event,
    EventEntry,
    GuideItem,
    Match,
    PartnerCard,
    RosterPublication,
    Venue,
)
from app.modules import projections as P
from app.modules.calendar import build_ics
from app.modules.matches import (
    STATUS_GROUPS,
    latest_changes,
    match_load_options,
    match_query,
)
from app.modules.my_day import build_my_day

router = APIRouter(prefix="/v1", tags=["public"])
DB = Annotated[Session, Depends(get_db)]


def load_event(db: Session, ref: str, *, include_unpublished: bool = False) -> Event:
    try:
        clause = Event.id == uuid.UUID(ref)
    except ValueError:
        clause = Event.slug == ref
    event = db.scalar(
        select(Event)
        .where(clause)
        .options(selectinload(Event.venues).selectinload(Venue.courts), selectinload(Event.sources))
    )
    if event is None or (not include_unpublished and event.status != "published"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return event


def sources_envelope(event: Event) -> list[dict]:
    return [P.source_public(s) for s in event.sources]


def project_matches(db: Session, event: Event, matches: list[Match]) -> list[dict]:
    latest = latest_changes(db, [m.id for m in matches])
    return [P.match_public(m, event, latest.get(m.id)) for m in matches]


@router.get("/events")
def list_events(request: Request, db: DB) -> Response:
    events = db.scalars(
        select(Event).where(Event.status == "published").order_by(Event.start_date.desc()).options(selectinload(Event.venues))
    )
    data = [{**P.event_public(e), "venues": [v.name for v in e.venues]} for e in events]
    return json_response(request, {"data": data}, max_age=60)


@router.get("/events/{event_ref}")
def get_event(event_ref: str, request: Request, db: DB) -> Response:
    event = load_event(db, event_ref)
    divisions = db.scalars(select(Division).where(Division.event_id == event.id).order_by(Division.name))
    counts = {
        "entries": db.scalar(select(func.count()).where(EventEntry.event_id == event.id)),
        "matches": db.scalar(select(func.count()).where(Match.event_id == event.id)),
    }
    payload = {
        "data": {
            **P.event_public(event),
            "venues": [P.venue_public(v) for v in event.venues],
            "divisions": [P.division_public(d) for d in divisions],
            "counts": counts,
        },
        "sources": sources_envelope(event),
    }
    return json_response(request, payload)


@router.get("/events/{event_ref}/teams")
def search_teams(
    event_ref: str,
    request: Request,
    db: DB,
    q: str | None = Query(None, max_length=100),
    division_id: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> Response:
    event = load_event(db, event_ref)
    stmt = (
        select(EventEntry)
        .outerjoin(Division, EventEntry.division_id == Division.id)
        .where(EventEntry.event_id == event.id)
        .options(selectinload(EventEntry.division))
    )
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                EventEntry.team_name.ilike(like),
                EventEntry.club_name.ilike(like),
                Division.name.ilike(like),
                Division.code.ilike(like),
            )
        )
    if division_id:
        stmt = stmt.where(EventEntry.division_id == parse_uuid(division_id, "division"))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    entries = db.scalars(stmt.order_by(Division.name, EventEntry.team_name).limit(limit).offset(offset))
    return json_response(request, {"data": [P.entry_public(e) for e in entries], "total": total})


@router.get("/events/{event_ref}/matches")
def list_matches(
    event_ref: str,
    request: Request,
    db: DB,
    entry_ids: str | None = None,
    status_group: str = Query("all", alias="status", pattern="^(all|upcoming|in_progress|results)$"),
    court_id: str | None = None,
    venue_id: str | None = None,
    division_id: str | None = None,
    day: date | None = Query(None, alias="date"),
    cursor: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> Response:
    event = load_event(db, event_ref)
    stmt = match_query(
        event.id,
        entry_ids=parse_uuid_list(entry_ids),
        status_group=status_group,
        court_id=parse_uuid(court_id, "court") if court_id else None,
        venue_id=parse_uuid(venue_id, "venue") if venue_id else None,
        division_id=parse_uuid(division_id, "division") if division_id else None,
        day=day,
        tz=event.timezone,
    )
    matches = list(db.scalars(stmt.offset(cursor).limit(limit + 1)))
    next_cursor = cursor + limit if len(matches) > limit else None
    payload = {
        "data": project_matches(db, event, matches[:limit]),
        "next_cursor": next_cursor,
        "event_revision": event.revision,
        "status_groups": list(STATUS_GROUPS),
        "sources": sources_envelope(event),
    }
    return json_response(request, payload)


@router.get("/events/{event_ref}/my-day")
def my_day(
    event_ref: str,
    request: Request,
    db: DB,
    settings: Annotated[Settings, Depends(get_settings)],
    entry_ids: str = "",
) -> Response:
    event = load_event(db, event_ref)
    followed = parse_uuid_list(entry_ids) or []
    matches = list(db.scalars(match_query(event.id, entry_ids=followed))) if followed else []
    entries = (
        db.scalars(
            select(EventEntry)
            .where(EventEntry.event_id == event.id, EventEntry.id.in_(followed))
            .options(selectinload(EventEntry.division))
        )
        if followed
        else []
    )
    summary = build_my_day(matches, set(followed), settings.assumed_match_minutes)
    payload = {
        "data": {
            **summary,
            "entries": [P.entry_public(e) for e in entries],
            "matches": {m["id"]: m for m in project_matches(db, event, matches)},
        },
        "event_revision": event.revision,
        "sources": sources_envelope(event),
    }
    return json_response(request, payload)


@router.get("/events/{event_ref}/changes")
def change_feed(
    event_ref: str,
    request: Request,
    db: DB,
    after: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
) -> Response:
    """Public change feed. Guests filter it on the device by their followed entries."""
    event = load_event(db, event_ref)
    rows = list(
        db.scalars(
            select(ChangeEvent)
            .where(ChangeEvent.event_id == event.id, ChangeEvent.id > after)
            .order_by(ChangeEvent.id.desc())
            .limit(limit)
        )
    )
    match_ids = [r.entity_id for r in rows if r.entity_type == "match"]
    matches = (
        db.scalars(select(Match).where(Match.id.in_(match_ids)).options(*match_load_options())) if match_ids else []
    )
    announcement_ids = [r.entity_id for r in rows if r.entity_type == "announcement"]
    announcements = (
        db.scalars(select(Announcement).where(Announcement.id.in_(announcement_ids))) if announcement_ids else []
    )
    payload = {
        "data": [P.change_public(r) for r in rows],
        "matches": {str(m.id): P.match_public(m, event) for m in matches},
        "announcements": {str(a.id): P.announcement_public(a) for a in announcements if a.state == "published"},
        "latest_id": rows[0].id if rows else after,
        "sources": sources_envelope(event),
    }
    return json_response(request, payload)


@router.get("/events/{event_ref}/announcements")
def announcements(event_ref: str, request: Request, db: DB) -> Response:
    event = load_event(db, event_ref)
    now = datetime.now(timezone.utc)
    rows = db.scalars(
        select(Announcement)
        .where(
            Announcement.event_id == event.id,
            Announcement.state == "published",
            or_(Announcement.publish_at.is_(None), Announcement.publish_at <= now),
            or_(Announcement.expire_at.is_(None), Announcement.expire_at > now),
        )
        .order_by(Announcement.publish_at.desc().nulls_last())
    )
    return json_response(request, {"data": [P.announcement_public(a) for a in rows]})


@router.get("/events/{event_ref}/guide")
def guide(event_ref: str, request: Request, db: DB) -> Response:
    event = load_event(db, event_ref)
    items = db.scalars(select(GuideItem).where(GuideItem.event_id == event.id).order_by(GuideItem.sort, GuideItem.title))
    partners = db.scalars(
        select(PartnerCard)
        .where(PartnerCard.event_id == event.id, PartnerCard.active.is_(True))
        .order_by(PartnerCard.sort, PartnerCard.name)
    )
    payload = {
        "data": {
            "venues": [P.venue_public(v) for v in event.venues],
            "items": [P.guide_item_public(i) for i in items],
            "partners": [P.partner_public(p) for p in partners],
        }
    }
    return json_response(request, payload, max_age=30)


@router.get("/events/{event_ref}/calendar.ics")
def calendar(
    event_ref: str,
    db: DB,
    settings: Annotated[Settings, Depends(get_settings)],
    entry_ids: str = "",
) -> Response:
    event = load_event(db, event_ref)
    followed = parse_uuid_list(entry_ids, limit=20)
    if not followed:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose at least one team")
    matches = list(db.scalars(match_query(event.id, entry_ids=followed)))
    domain = urlparse(settings.public_web_url).hostname or "courtside.local"
    body = build_ics(event, matches, uid_domain=domain, assumed_minutes=settings.assumed_match_minutes)
    return Response(
        body,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{event.slug}-snapshot.ics"'},
    )


@router.get("/entries/{entry_id}")
def get_entry(entry_id: str, request: Request, db: DB) -> Response:
    entry = db.scalar(
        select(EventEntry)
        .where(EventEntry.id == parse_uuid(entry_id, "team"))
        .options(selectinload(EventEntry.division))
    )
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found")
    event = load_event(db, str(entry.event_id))
    roster = db.scalar(
        select(RosterPublication)
        .where(RosterPublication.entry_id == entry.id, RosterPublication.state == "published")
        .order_by(RosterPublication.version.desc())
        .limit(1)
    )
    matches = list(db.scalars(match_query(event.id, entry_ids=[entry.id])))
    payload = {
        "data": {
            **P.entry_public(entry),
            "event": P.event_public(event),
            # None means no approved roster: the page shows team information without athletes.
            "roster": P.roster_public(roster),
            "matches": project_matches(db, event, matches),
        },
        "sources": sources_envelope(event),
    }
    return json_response(request, payload)


@router.get("/matches/{match_id}")
def get_match(match_id: str, request: Request, db: DB) -> Response:
    match = db.scalar(select(Match).where(Match.id == parse_uuid(match_id, "match")).options(*match_load_options()))
    if match is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found")
    event = load_event(db, str(match.event_id))
    history = db.scalars(
        select(ChangeEvent)
        .where(ChangeEvent.entity_type == "match", ChangeEvent.entity_id == match.id)
        .order_by(ChangeEvent.id.desc())
        .limit(20)
    )
    history = list(history)
    payload = {
        "data": {
            **P.match_public(match, event, history[0] if history else None),
            "event": P.event_public(event),
            "history": [P.change_public(h) for h in history],
        },
        "sources": sources_envelope(event),
    }
    return json_response(request, payload)
