"""Loading matches and applying new source state with revisions and change events."""

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Select, and_, or_, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.orm import Session, selectinload

from app.models import (
    ChangeEvent,
    Court,
    EventEntry,
    Match,
    MatchParticipant,
    SetResult,
    utcnow,
)
from app.modules.projections import iso

STATUS_GROUPS = {
    "upcoming": ("scheduled", "postponed"),
    "in_progress": ("in_progress",),
    "results": ("completed",),
}
MATCH_STATUSES = {"scheduled", "in_progress", "completed", "cancelled", "postponed"}


def match_load_options():
    return (
        selectinload(Match.participants)
        .selectinload(MatchParticipant.entry)
        .selectinload(EventEntry.division),
        selectinload(Match.sets),
        selectinload(Match.court).selectinload(Court.venue),
        selectinload(Match.division),
        selectinload(Match.work_entry),
        selectinload(Match.source),
    )


def match_query(
    event_id: uuid.UUID,
    *,
    entry_ids: list[uuid.UUID] | None = None,
    division_ids: list[uuid.UUID] | None = None,
    status_group: str | None = None,
    court_id: uuid.UUID | None = None,
    division_id: uuid.UUID | None = None,
    venue_id: uuid.UUID | None = None,
    day: date | None = None,
    tz: str = "America/Toronto",
) -> Select[tuple[Match]]:
    stmt = (
        select(Match).where(Match.event_id == event_id).options(*match_load_options())
    )
    if entry_ids is not None:
        stmt = stmt.where(
            or_(
                Match.work_entry_id.in_(entry_ids),
                Match.id.in_(
                    select(MatchParticipant.match_id).where(
                        MatchParticipant.entry_id.in_(entry_ids)
                    )
                ),
                Match.division_id.in_(division_ids or []),
            )
        )
    if status_group and status_group != "all":
        stmt = stmt.where(Match.status.in_(STATUS_GROUPS[status_group]))
    if court_id:
        stmt = stmt.where(Match.court_id == court_id)
    if venue_id:
        stmt = stmt.where(
            Match.court_id.in_(select(Court.id).where(Court.venue_id == venue_id))
        )
    if division_id:
        stmt = stmt.where(Match.division_id == division_id)
    if day:
        start = datetime.combine(day, time.min, tzinfo=ZoneInfo(tz))
        stmt = stmt.where(
            and_(
                Match.scheduled_start >= start,
                Match.scheduled_start < start + timedelta(days=1),
            )
        )
    # Unscheduled matches sort last so they stay discoverable without crowding the top.
    return stmt.order_by(Match.scheduled_start.asc().nulls_last(), Match.external_id)


def latest_changes(
    db: Session, match_ids: list[uuid.UUID]
) -> dict[uuid.UUID, ChangeEvent]:
    if not match_ids:
        return {}
    rows = db.scalars(
        select(ChangeEvent)
        .where(ChangeEvent.entity_type == "match", ChangeEvent.entity_id.in_(match_ids))
        .order_by(ChangeEvent.entity_id, ChangeEvent.id.desc())
        .ext(distinct_on(ChangeEvent.entity_id))
    )
    return {row.entity_id: row for row in rows}


@dataclass
class Slot:
    entry_id: uuid.UUID | None = None
    placeholder: str | None = None


@dataclass
class MatchState:
    """The normalized state a source reports for one match."""

    division_id: uuid.UUID | None
    court_id: uuid.UUID | None
    round_label: str | None
    scheduled_start: datetime | None
    estimated_start: datetime | None
    status: str
    home: Slot
    away: Slot
    sets: list[tuple[int | None, int | None]] = field(default_factory=list)
    source_revision: str | None = None
    source_updated_at: datetime | None = None


def _slot(match: Match, slot: str) -> Slot:
    for p in match.participants:
        if p.slot == slot:
            return Slot(p.entry_id, p.placeholder_label)
    return Slot()


def current_state(match: Match) -> MatchState:
    return MatchState(
        division_id=match.division_id,
        court_id=match.court_id,
        round_label=match.round_label,
        scheduled_start=match.scheduled_start,
        estimated_start=match.estimated_start,
        status=match.status,
        home=_slot(match, "home"),
        away=_slot(match, "away"),
        sets=[(s.home_score, s.away_score) for s in match.sets],
        source_revision=match.source_revision,
        source_updated_at=match.source_updated_at,
    )


def changed_fields(before: MatchState, after: MatchState) -> list[str]:
    fields = []
    for name in (
        "division_id",
        "court_id",
        "round_label",
        "scheduled_start",
        "estimated_start",
        "status",
        "sets",
    ):
        if getattr(before, name) != getattr(after, name):
            fields.append(name)
    if (before.home, before.away) != (after.home, after.away):
        fields.append("participants")
    return fields


def _court_label(db: Session, court_id: uuid.UUID | None) -> str | None:
    if court_id is None:
        return None
    court = db.get(Court, court_id)
    return f"{court.label} ({court.venue.name})" if court else None


def _result_state(before: MatchState, after: MatchState, previous: str) -> str:
    has_scores = any(h is not None and a is not None for h, a in after.sets)
    if not has_scores:
        return "none"
    if previous in ("final", "corrected") and before.sets != after.sets:
        return "corrected"
    if previous in ("final", "corrected"):
        return previous
    return "final" if after.status == "completed" else "provisional"


def apply_match_state(
    db: Session,
    match: Match,
    after: MatchState,
    *,
    simulated: bool = False,
    is_new: bool = False,
) -> list[ChangeEvent]:
    """Write `after` onto `match`. Material changes bump the revision and emit change events.

    Returns the change events added to the session (none for new or unchanged matches).
    """
    before = current_state(match)
    fields = [] if is_new else changed_fields(before, after)
    if not is_new and not fields:
        match.observed_at = utcnow()
        return []

    previous_result_state = match.result_state
    match.division_id = after.division_id
    match.court_id = after.court_id
    match.round_label = after.round_label
    if not is_new and "scheduled_start" in fields:
        from app.models import Event
        from app.modules.projections import event_now

        match.official_time_revised_at = event_now(db.get(Event, match.event_id))
    match.scheduled_start = after.scheduled_start
    match.estimated_start = after.estimated_start
    match.status = after.status
    match.source_revision = after.source_revision
    match.source_updated_at = after.source_updated_at
    match.observed_at = utcnow()
    match.result_state = _result_state(before, after, previous_result_state)

    if is_new or "participants" in fields:
        by_slot = {p.slot: p for p in match.participants}
        for slot_name, slot in (("home", after.home), ("away", after.away)):
            participant = by_slot.get(slot_name)
            if participant is None:
                participant = MatchParticipant(slot=slot_name)
                match.participants.append(participant)
            participant.entry_id = slot.entry_id
            participant.placeholder_label = slot.placeholder
    if is_new or "sets" in fields:
        match.sets.clear()
        db.flush()
        for number, (home, away) in enumerate(after.sets, start=1):
            match.sets.append(
                SetResult(set_number=number, home_score=home, away_score=away)
            )

    if is_new:
        return []

    match.revision += 1
    entry_ids = sorted(
        {
            str(e)
            for e in (
                before.home.entry_id,
                before.away.entry_id,
                after.home.entry_id,
                after.away.entry_id,
            )
            if e
        }
    )
    events: list[tuple[str, dict]] = []
    if "scheduled_start" in fields or "estimated_start" in fields:
        events.append(
            (
                "time_changed",
                {
                    "scheduled_start": [
                        iso(before.scheduled_start),
                        iso(after.scheduled_start),
                    ],
                    "estimated_start": [
                        iso(before.estimated_start),
                        iso(after.estimated_start),
                    ],
                },
            )
        )
    if "court_id" in fields:
        events.append(
            (
                "court_changed",
                {
                    "court": [
                        _court_label(db, before.court_id),
                        _court_label(db, after.court_id),
                    ]
                },
            )
        )
    if "status" in fields:
        events.append(("status_changed", {"status": [before.status, after.status]}))
    if "sets" in fields:
        kind = (
            "result_corrected" if match.result_state == "corrected" else "result_posted"
        )
        events.append((kind, {"sets": [before.sets, after.sets]}))
    if "participants" in fields:
        events.append(("participants_resolved", {}))

    created = []
    for event_type, diff in events:
        change = ChangeEvent(
            event_id=match.event_id,
            entity_type="match",
            entity_id=match.id,
            entity_revision=match.revision,
            event_type=event_type,
            diff=diff,
            entry_ids=entry_ids,
            simulated=simulated,
        )
        db.add(change)
        created.append(change)
    return created


def entry_filter(entry_ids: list[uuid.UUID]):
    """SQL filter for change events touching any of `entry_ids` or the whole event."""
    clauses = [ChangeEvent.entry_ids == []]
    clauses += [ChangeEvent.entry_ids.contains([str(e)]) for e in entry_ids]
    return or_(*clauses)
