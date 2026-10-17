"""My Day: one itinerary across every followed entry.

Overlap warnings use an assumed match length (settings.assumed_match_minutes). The API
labels it as an assumption; the source doesn't publish match end times.
"""

import uuid
from datetime import datetime, timedelta, timezone

from app.models import Match

OPEN_STATUSES = {"scheduled", "in_progress", "postponed"}
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def _start(match: Match) -> datetime | None:
    return match.estimated_start or match.scheduled_start


def _followed_in(match: Match, followed: set[uuid.UUID]) -> list[uuid.UUID]:
    return [p.entry_id for p in match.participants if p.entry_id in followed]


def _venue_id(match: Match) -> uuid.UUID | None:
    return match.court.venue_id if match.court else None


def build_my_day(matches: list[Match], followed: set[uuid.UUID], assumed_minutes: int, *, now: datetime) -> dict:
    """Return ids grouped for the My Day screen.

    matches may contain duplicates (one per followed participant); each match appears once.
    A match a followed entry only works (referees) is a work duty, not one of its matches.
    now is the event clock (demo time when it is on). The next match is the first one whose
    assumed length hasn't run out by then.
    """
    everything = list({m.id: m for m in matches}.values())
    unique = [m for m in everything if _followed_in(m, followed)]
    duties = sorted(
        (m for m in everything if m.work_entry_id in followed and m.status in OPEN_STATUSES),
        key=lambda m: (_start(m) or datetime.max.replace(tzinfo=timezone.utc), m.external_id),
    )
    timed, awaiting, completed = _bucket(unique)

    window = timedelta(minutes=assumed_minutes)
    ahead = [m for m in timed if _start(m) + window > now]

    next_by_entry: dict[str, str] = {}
    for m in ahead:
        for entry_id in _followed_in(m, followed):
            next_by_entry.setdefault(str(entry_id), str(m.id))

    conflicts: list[dict] = []
    group: list[Match] = []
    group_end: datetime | None = None
    for m in timed:
        start = _start(m)
        if group and group_end and start < group_end:
            group.append(m)
            group_end = max(group_end, start + window)
            continue
        if len(group) > 1:
            conflicts.append(_conflict(group))
        group, group_end = [m], start + window
    if len(group) > 1:
        conflicts.append(_conflict(group))

    return {
        "next_match_id": str(ahead[0].id) if ahead else None,
        "next_by_entry": next_by_entry,
        "upcoming_ids": [str(m.id) for m in timed],
        "awaiting_schedule_ids": [str(m.id) for m in awaiting],
        "completed_ids": [str(m.id) for m in completed],
        "conflicts": conflicts,
        "work_duties": [{"match_id": str(m.id), "entry_id": str(m.work_entry_id)} for m in duties],
        "assumed_match_minutes": assumed_minutes,
    }


def build_division_section(matches: list[Match]) -> dict:
    """One followed division's matches, grouped like the followed teams' schedule."""
    timed, awaiting, completed = _bucket(list({m.id: m for m in matches}.values()))
    return {
        "upcoming_ids": [str(m.id) for m in timed],
        "awaiting_schedule_ids": [str(m.id) for m in awaiting],
        "completed_ids": [str(m.id) for m in completed],
    }


def _bucket(unique: list[Match]) -> tuple[list[Match], list[Match], list[Match]]:
    open_matches = [m for m in unique if m.status in OPEN_STATUSES]
    timed = sorted((m for m in open_matches if _start(m)), key=lambda m: (_start(m), m.external_id))
    awaiting = [m for m in open_matches if not _start(m)]
    completed = sorted(
        (m for m in unique if m.status == "completed"), key=lambda m: _start(m) or EPOCH, reverse=True
    )
    return timed, awaiting, completed


def _conflict(group: list[Match]) -> dict:
    venues = {_venue_id(m) for m in group if _venue_id(m)}
    return {"match_ids": [str(m.id) for m in group], "different_venues": len(venues) > 1}
