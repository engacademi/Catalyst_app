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


def build_my_day(
    matches: list[Match],
    followed: set[uuid.UUID],
    assumed_minutes: int,
    start_times=None,
) -> dict:
    """Return ids grouped for the My Day screen.

    matches may contain duplicates (one per followed participant); each match appears once.
    """
    start_at = lambda m: start_times.get(m.id) if start_times is not None else _start(m)
    unique = list({m.id: m for m in matches}.values())
    open_matches = [m for m in unique if m.status in OPEN_STATUSES]
    timed = sorted(
        (m for m in open_matches if start_at(m)),
        key=lambda m: (start_at(m), m.external_id),
    )
    awaiting = [m for m in open_matches if not start_at(m)]

    next_by_entry: dict[str, str] = {}
    for m in timed:
        for entry_id in _followed_in(m, followed):
            next_by_entry.setdefault(str(entry_id), str(m.id))

    # Only matches a followed team plays in can clash; a followed division's other
    # matches run on parallel courts by design.
    window = timedelta(minutes=assumed_minutes)
    conflicts: list[dict] = []
    group: list[Match] = []
    group_end: datetime | None = None
    for m in (m for m in timed if _followed_in(m, followed)):
        start = start_at(m)
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
        "next_match_id": str(timed[0].id) if timed else None,
        "next_by_entry": next_by_entry,
        "upcoming_ids": [str(m.id) for m in timed],
        "awaiting_schedule_ids": [str(m.id) for m in awaiting],
        "completed_ids": [
            str(m.id)
            for m in sorted(
                (m for m in unique if m.status == "completed"),
                key=lambda m: start_at(m) or EPOCH,
                reverse=True,
            )
        ],
        "conflicts": conflicts,
        "assumed_match_minutes": assumed_minutes,
    }


def _conflict(group: list[Match]) -> dict:
    venues = {_venue_id(m) for m in group if _venue_id(m)}
    return {
        "match_ids": [str(m.id) for m in group],
        "different_venues": len(venues) > 1,
    }
