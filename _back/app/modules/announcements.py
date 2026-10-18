"""Announcement delivery: visibility, audiences and the change-feed entry.

A published announcement enters the change feed only once it is visible. A notice
scheduled for later gets its change event when its publication time passes, so its
cursor id is newer than anything a guest could have marked as seen before then.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Announcement, ChangeEvent, Event, EventEntry
from app.modules import projections as P

PUBLISHED = "announcement_published"


def is_visible(a: Announcement, now: datetime) -> bool:
    return (
        a.state == "published"
        and (not a.publish_at or a.publish_at <= now)
        and (not a.expire_at or a.expire_at > now)
    )


def audiences(db: Session, notices: list[Announcement]) -> dict:
    """Entry ids each notice targets. A division notice reaches every team in it, so
    following one team is enough to get its division's briefings. Empty is event-wide."""
    division_ids = {a.division_id for a in notices if a.division_id}
    by_division: dict = {d: [] for d in division_ids}
    if division_ids:
        for entry_id, division_id in db.execute(
            select(EventEntry.id, EventEntry.division_id).where(
                EventEntry.division_id.in_(division_ids)
            )
        ):
            by_division[division_id].append(str(entry_id))
    return {
        a.id: [str(a.entry_id)]
        if a.entry_id
        else sorted(by_division[a.division_id])
        if a.division_id
        else []
        for a in notices
    }


def deliver_due(db: Session, event: Event) -> int:
    """Write the change event for every published notice that is visible now and has
    none yet. Safe to run on every read: concurrent callers collide on the unique key."""
    now = P.event_now(event)
    delivered = select(ChangeEvent.entity_id).where(
        ChangeEvent.event_id == event.id, ChangeEvent.event_type == PUBLISHED
    )
    due = [
        a
        for a in db.scalars(
            select(Announcement).where(
                Announcement.event_id == event.id,
                Announcement.state == "published",
                Announcement.id.not_in(delivered),
            )
        )
        if is_visible(a, now)
    ]
    if not due:
        return 0
    real_now = datetime.now(UTC)
    audience = audiences(db, due)
    for a in due:
        # Stamp the real-world moment the notice went live, which differs from
        # publish_at only when a demo clock is running.
        went_live = real_now - (now - a.publish_at) if a.publish_at else real_now
        db.execute(
            insert(ChangeEvent)
            .values(
                event_id=event.id,
                entity_type="announcement",
                entity_id=a.id,
                entity_revision=a.revision,
                event_type=PUBLISHED,
                diff={"title": a.title, "category": a.category},
                entry_ids=audience[a.id],
                occurred_at=min(went_live, real_now),
            )
            .on_conflict_do_nothing()
        )
    db.flush()
    return len(due)
