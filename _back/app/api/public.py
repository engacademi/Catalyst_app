"""Public read endpoints. No token needed; only approved projections leave this module."""

import uuid
from datetime import date, datetime
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
        .options(
            selectinload(Event.venues).selectinload(Venue.courts),
            selectinload(Event.sources),
        )
    )
    if event is None or (not include_unpublished and event.status != "published"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return event


def selection(
    db: Session, event: Event, entry_ids: str | None, division_ids: str | None
):
    entries = parse_uuid_list(entry_ids) or []
    divisions = parse_uuid_list(division_ids) or []
    if not entries and not divisions:
        return [], []
    selected = list(
        db.scalars(
            select(EventEntry.id).where(
                EventEntry.event_id == event.id,
                or_(EventEntry.id.in_(entries), EventEntry.division_id.in_(divisions)),
            )
        )
    )
    valid_divisions = list(
        db.scalars(
            select(Division.id).where(
                Division.event_id == event.id, Division.id.in_(divisions)
            )
        )
    )
    return selected, valid_divisions


def sources_envelope(event: Event) -> list[dict]:
    return [P.source_public(s) for s in event.sources]


def project_matches(db: Session, event: Event, matches: list[Match]) -> list[dict]:
    latest = latest_changes(db, [m.id for m in matches])
    return [P.match_public(m, event, latest.get(m.id)) for m in matches]


@router.get("/events")
def list_events(request: Request, db: DB) -> Response:
    events = db.scalars(
        select(Event)
        .where(Event.status == "published")
        .order_by(Event.start_date.desc())
        .options(selectinload(Event.venues))
    )
    # Aggregate team counts once for popularity ordering, without per-event queries.
    counts = dict(db.execute(select(EventEntry.event_id, func.count()).group_by(EventEntry.event_id)).all())
    data = [{**P.event_public(e), "venues": [v.name for v in e.venues],
             "venue_locations": [{"city": v.city, "latitude": v.latitude, "longitude": v.longitude} for v in e.venues],
             "team_count": counts.get(e.id, 0)} for e in events]
    return json_response(request, {"data": data}, max_age=60)


@router.get("/events/{event_ref}")
def get_event(event_ref: str, request: Request, db: DB) -> Response:
    event = load_event(db, event_ref)
    divisions = db.scalars(
        select(Division).where(Division.event_id == event.id).order_by(Division.name)
    )
    counts = {
        "entries": db.scalar(
            select(func.count()).where(EventEntry.event_id == event.id)
        ),
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
    entries = db.scalars(
        stmt.order_by(Division.name, EventEntry.team_name).limit(limit).offset(offset)
    )
    return json_response(
        request, {"data": [P.entry_public(e) for e in entries], "total": total}
    )


@router.get("/events/{event_ref}/matches")
def list_matches(
    event_ref: str,
    request: Request,
    db: DB,
    entry_ids: str | None = None,
    division_ids: str | None = None,
    q: str | None = Query(None, max_length=200),
    status_group: str = Query(
        "all", alias="status", pattern="^(all|upcoming|in_progress|results)$"
    ),
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
        entry_ids=selection(db, event, entry_ids, division_ids)[0]
        if entry_ids is not None or division_ids is not None
        else None,
        division_ids=selection(db, event, entry_ids, division_ids)[1],
        status_group=status_group,
        court_id=parse_uuid(court_id, "court") if court_id else None,
        venue_id=parse_uuid(venue_id, "venue") if venue_id else None,
        division_id=parse_uuid(division_id, "division") if division_id else None,
        day=day,
        tz=event.timezone,
    )
    if q and q.strip():
        from app.models import MatchParticipant
        like = "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        stmt = stmt.where(or_(
            Match.external_id.ilike(like), Match.round_label.ilike(like),
            Match.id.in_(select(MatchParticipant.match_id).join(EventEntry, MatchParticipant.entry_id == EventEntry.id).where(or_(EventEntry.team_name.ilike(like), EventEntry.club_name.ilike(like)))),
        ))
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
    division_ids: str = "",
) -> Response:
    event = load_event(db, event_ref)
    followed, followed_divisions = selection(db, event, entry_ids, division_ids)
    matches = (
        list(
            db.scalars(
                match_query(
                    event.id, entry_ids=followed, division_ids=followed_divisions
                )
            )
        )
        if followed or followed_divisions
        else []
    )
    entries = (
        db.scalars(
            select(EventEntry)
            .where(EventEntry.event_id == event.id, EventEntry.id.in_(followed))
            .options(selectinload(EventEntry.division))
        )
        if followed
        else []
    )
    playing = [
        m
        for m in matches
        if any(p.entry_id in followed for p in m.participants)
        or m.division_id in followed_divisions
    ]
    starts = {
        m.id: datetime.fromisoformat(P.match_timing(m, event)["estimated_start"])
        if P.match_timing(m, event)["estimated_start"]
        else m.scheduled_start
        for m in playing
    }
    summary = build_my_day(
        playing, set(followed), settings.assumed_match_minutes, start_times=starts
    )
    payload = {
        "data": {
            **summary,
            "work_duties": [
                P.match_public(m, event)
                for m in matches
                if m.work_entry_id in followed
                and m.status not in ("completed", "cancelled")
            ],
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
    before: int | None = Query(None, ge=1),
    limit: int = Query(100, ge=1, le=200),
) -> Response:
    """Public change feed. Guests filter it on the device by their followed entries."""
    event = load_event(db, event_ref)
    rows = list(
        db.scalars(
            select(ChangeEvent)
            .where(
                ChangeEvent.event_id == event.id,
                ChangeEvent.id > after,
                ChangeEvent.id < before if before else True,
            )
            .order_by(ChangeEvent.id.desc())
            .limit(limit + 1)
        )
    )
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_before = rows[-1].id if has_more and rows else None
    latest_id = rows[0].id if rows else after
    match_ids = [r.entity_id for r in rows if r.entity_type == "match"]
    matches = (
        list(
            db.scalars(
                select(Match)
                .where(Match.id.in_(match_ids))
                .options(*match_load_options())
            )
        )
        if match_ids
        else []
    )
    announcement_ids = [r.entity_id for r in rows if r.entity_type == "announcement"]
    now = P.event_now(event)
    notices = (
        list(
            db.scalars(
                select(Announcement).where(Announcement.id.in_(announcement_ids))
            )
        )
        if announcement_ids
        else []
    )
    visible = {
        a.id: a
        for a in notices
        if a.state == "published"
        and (not a.publish_at or a.publish_at <= now)
        and (not a.expire_at or a.expire_at > now)
    }
    rows = [
        r for r in rows if r.entity_type != "announcement" or r.entity_id in visible
    ]
    payload = {
        "data": [
            {
                **P.change_public(r),
                "division_id": str(visible[r.entity_id].division_id)
                if r.entity_id in visible and visible[r.entity_id].division_id
                else None,
            }
            for r in rows
        ],
        "matches": {str(m.id): P.match_public(m, event) for m in matches},
        "announcements": {
            str(a.id): P.announcement_public(a) for a in visible.values()
        },
        "next_before": next_before,
        "divisions": {str(m.id): str(m.division_id) for m in matches if m.division_id},
        "latest_id": latest_id,
        "sources": sources_envelope(event),
    }
    return json_response(request, payload)


@router.get("/events/{event_ref}/announcements")
def announcements(event_ref: str, request: Request, db: DB) -> Response:
    event = load_event(db, event_ref)
    now = P.event_now(event)
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
    items = db.scalars(
        select(GuideItem)
        .where(GuideItem.event_id == event.id)
        .order_by(GuideItem.sort, GuideItem.title)
    )
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
    division_ids: str = "",
) -> Response:
    event = load_event(db, event_ref)
    followed, followed_divisions = selection(db, event, entry_ids, division_ids)
    if not followed:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose at least one team"
        )
    matches = list(
        db.scalars(
            match_query(event.id, entry_ids=followed, division_ids=followed_divisions)
        )
    )
    domain = urlparse(settings.public_web_url).hostname or "courtside.local"
    body = build_ics(
        event,
        matches,
        uid_domain=domain,
        assumed_minutes=settings.assumed_match_minutes,
    )
    return Response(
        body,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{event.slug}-snapshot.ics"'
        },
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
        .where(
            RosterPublication.entry_id == entry.id,
            RosterPublication.state == "published",
        )
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
    match = db.scalar(
        select(Match)
        .where(Match.id == parse_uuid(match_id, "match"))
        .options(*match_load_options())
    )
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


@router.get("/events/{event_ref}/selection")
def followed_selection(
    event_ref: str, request: Request, db: DB, division_ids: str = ""
):
    event = load_event(db, event_ref)
    entries, _ = selection(db, event, "", division_ids)
    return json_response(request, {"data": [str(e) for e in entries]})


@router.get("/events/{event_ref}/pathway")
def pathway(event_ref: str, request: Request, db: DB, division_id: str):
    event = load_event(db, event_ref)
    division = db.get(Division, parse_uuid(division_id))
    if not division or division.event_id != event.id:
        raise HTTPException(404, "Division not found")
    rows = list(db.scalars(match_query(event.id, division_id=division.id)))
    rounds = {}
    for match in rows:
        rounds.setdefault(match.round_label or "Round to be confirmed", []).append(
            match
        )
    return json_response(
        request,
        {
            "data": [
                {"label": label, "matches": project_matches(db, event, matches)}
                for label, matches in rounds.items()
            ],
            "sources": sources_envelope(event),
            "note": "Official source progression. Positions and winner/loser labels are displayed as supplied; this app does not calculate seeds or tie-breaks.",
        },
    )
