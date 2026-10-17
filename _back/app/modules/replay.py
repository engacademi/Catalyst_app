"""Demo replay: a finished AES event shown as it stood at demo time.

AES reports every match of a past event as completed. While the event's demo time is on, a
match from an AES source whose official start plus the assumed match length is still after
the event clock is presented as scheduled with no set scores, so it counts as not started
everywhere (Next Match, delay notices, estimated starts, results lists).

This is a read-time view only: stored matches, results and change events never change, and
clearing demo time shows the real results again.
"""

from datetime import datetime, timedelta

from app.core.config import get_settings
from app.models import Event, Match, Source
from app.modules.clock import demo_time_on, event_now
from app.modules.started import has_started


def replays_source(source: Source) -> bool:
    """A source read from AES by its event key (live or from recorded responses)."""
    return bool(source.external_key)


def replaying(event: Event) -> bool:
    return demo_time_on(event) and any(replays_source(s) for s in event.sources)


class ReplayedMatch:
    """A match as it looked before it was played: scheduled, no scores. Everything else is the match's own."""

    status = "scheduled"
    result_state = "none"
    sets: tuple = ()

    def __init__(self, match: Match):
        self._match = match

    def __getattr__(self, name: str):
        return getattr(self._match, name)


def present(event: Event, matches: list[Match], now: datetime | None = None) -> list:
    """The matches as attendees see them at the event clock. Unchanged unless demo time is on."""
    if not demo_time_on(event):
        return list(matches)
    now = now or event_now(event)
    window = timedelta(minutes=get_settings().assumed_match_minutes)
    return [_at(m, now, window) for m in matches]


def _at(match: Match, now: datetime, window: timedelta):
    if (
        match.scheduled_start is None
        or not has_started(match)
        or not replays_source(match.source)
        or match.scheduled_start + window <= now
    ):
        return match
    return ReplayedMatch(match)
