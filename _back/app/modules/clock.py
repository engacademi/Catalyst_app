"""The event clock: real time, or the event's demo time when the API runs in demo mode.

Demo time ticks forward with real time from the moment staff set it.
"""

from datetime import datetime, timedelta, timezone

from app.core.config import get_settings
from app.models import Event


def real_now() -> datetime:
    return datetime.now(timezone.utc)


def demo_time_on(event: Event) -> bool:
    return get_settings().demo_mode and event.demo_time is not None and event.demo_time_set_at is not None


def event_now(event: Event) -> datetime:
    now = real_now()
    if not demo_time_on(event):
        return now
    return event.demo_time + (now - event.demo_time_set_at)


def set_demo_time(event: Event, demo_time: datetime) -> None:
    event.demo_time = demo_time
    event.demo_time_set_at = real_now()


def jump_demo_time(event: Event, minutes: int) -> None:
    event.demo_time = event.demo_time + timedelta(minutes=minutes)


def clear_demo_time(event: Event) -> None:
    event.demo_time = None
    event.demo_time_set_at = None
