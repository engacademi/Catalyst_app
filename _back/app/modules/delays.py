"""Delay notices and the estimated starts they give matches.

A notice belongs to one court. It is active from posting until it expires or staff clear it,
judged by the event clock. The official start is never changed (ADR 0002).
"""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import ChangeEvent, DelayNotice, Event, Match

ESTIMATE_BY_SOURCE = "source"
ESTIMATE_BY_STAFF = "ova_staff"
UNSTARTED_STATUSES = {"scheduled", "postponed"}


def is_active(notice: DelayNotice, now: datetime) -> bool:
    return notice.cleared_at is None and notice.expires_at > now


def active_notices(db: Session, event_id: uuid.UUID, now: datetime) -> dict[uuid.UUID, DelayNotice]:
    """The active notice for each court of the event, keyed by court id."""
    rows = db.scalars(
        select(DelayNotice)
        .where(DelayNotice.event_id == event_id, DelayNotice.cleared_at.is_(None), DelayNotice.expires_at > now)
        .order_by(DelayNotice.posted_at)
    )
    return {n.court_id: n for n in rows}


def has_started(match: Match) -> bool:
    """The source marked it in progress or completed, or it has set scores."""
    if match.status not in UNSTARTED_STATUSES:
        return True
    return any(s.home_score is not None or s.away_score is not None for s in match.sets)


def notice_for(match: Match, notices: dict[uuid.UUID, DelayNotice]) -> DelayNotice | None:
    """The court's active notice, if the match is on that court and hasn't started."""
    notice = notices.get(match.court_id) if match.court_id else None
    return notice if notice and not has_started(match) else None


def estimated_start(match: Match, notice: DelayNotice | None) -> tuple[datetime | None, str | None]:
    """(estimated start, who it came from). A source-published estimate beats the staff one."""
    if match.estimated_start:
        return match.estimated_start, ESTIMATE_BY_SOURCE
    if notice and match.scheduled_start:
        return match.scheduled_start + timedelta(minutes=notice.minutes), ESTIMATE_BY_STAFF
    return None, None


def expected_soon(match: Match, notice: DelayNotice | None, now: datetime) -> bool:
    """Its estimated (or official) start has passed but the source hasn't marked it started.

    Shown as "Expected to start soon", never "In progress": the source hasn't said it began.
    """
    if match.status != "scheduled" or has_started(match):
        return False
    start = estimated_start(match, notice)[0] or match.scheduled_start
    return start is not None and start <= now


def post_notice(
    db: Session, event: Event, court_id: uuid.UUID, minutes: int, duration_minutes: int, actor_id, now: datetime
) -> tuple[DelayNotice, DelayNotice | None]:
    """Post a notice for the court, replacing its active one. Returns (new notice, replaced notice)."""
    replaced = active_notices(db, event.id, now).get(court_id)
    if replaced:
        clear_notice(replaced, actor_id, now)
    notice = DelayNotice(
        event_id=event.id,
        court_id=court_id,
        minutes=minutes,
        posted_by=actor_id,
        posted_at=now,
        expires_at=now + timedelta(minutes=duration_minutes),
    )
    db.add(notice)
    db.flush()
    return notice, replaced


def clear_notice(notice: DelayNotice, actor_id, now: datetime) -> None:
    notice.cleared_at = now
    notice.cleared_by = actor_id


def record_change(db: Session, notice: DelayNotice, event_type: str, revision: int) -> ChangeEvent:
    """A delay_posted or delay_cleared change for followers of entries still to play on the court."""
    matches = db.scalars(
        select(Match)
        .where(Match.court_id == notice.court_id)
        .options(selectinload(Match.participants), selectinload(Match.sets), selectinload(Match.source))
    )
    from app.modules.replay import present  # replay builds on has_started

    shown = present(db.get(Event, notice.event_id), list(matches))
    entry_ids = sorted({str(p.entry_id) for m in shown if not has_started(m) for p in m.participants if p.entry_id})
    court = notice.court
    change = ChangeEvent(
        event_id=notice.event_id,
        entity_type="delay_notice",
        entity_id=notice.id,
        entity_revision=revision,
        event_type=event_type,
        diff={
            "court_id": str(court.id),
            "court": court.label,
            "area": court.area,
            "venue": court.venue.name,
            "minutes": notice.minutes,
            "posted_at": notice.posted_at.isoformat(),
            "expires_at": notice.expires_at.isoformat(),
        },
        entry_ids=entry_ids,
    )
    db.add(change)
    return change
