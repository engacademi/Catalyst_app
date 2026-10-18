"""Fictional operations examples shared by the public demo and staff workspace."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Announcement,
    ChangeEvent,
    Court,
    Event,
    Match,
    ScoreDispute,
    Source,
    User,
    Venue,
)
from app.modules.announcements import deliver_due
from app.modules.projections import event_now


def seed_demo_operations(db: Session, event: Event, *, court_label: str) -> None:
    """Add samples once; never overwrite staff edits or reopen resolved disputes."""
    if not event.is_demo:
        raise ValueError("Operations samples may only be added to demo events")
    source = db.scalar(
        select(Source).where(Source.event_id == event.id).order_by(Source.name).limit(1)
    )
    if source and (source.config or {}).get("operations_demo_seeded"):
        return
    now = event_now(event)
    court = db.scalar(
        select(Court)
        .join(Venue)
        .where(Venue.event_id == event.id, Court.label == court_label)
        .order_by(Venue.sort, Court.id)
        .limit(1)
    )
    title = f"{court_label}: running ~20 minutes late"
    if court and not db.scalar(
        select(Announcement.id).where(
            Announcement.event_id == event.id, Announcement.title == title
        )
    ):
        expiry = now + timedelta(hours=6)
        court.delay = {
            "minutes": 20,
            "posted_by": "Provincial demo operations lead",
            "posted_at": now.isoformat(),
            "expires_at": expiry.isoformat(),
        }
        db.add(
            Announcement(
                event_id=event.id,
                category="schedule",
                title=title,
                body=f"SIMULATED DEMO: {court.area_label or court_label}, {court_label} is running "
                "approximately 20 minutes late after an extended three-set match. "
                "Official start times remain unchanged; upcoming matches show estimated starts. "
                "Teams should remain near the court and check Updates for the next announcement.",
                state="published",
                publish_at=now,
                expire_at=expiry,
            )
        )
        for match in db.scalars(
            select(Match).where(
                Match.event_id == event.id,
                Match.court_id == court.id,
                Match.status.in_(["scheduled", "postponed"]),
            )
        ):
            if not db.scalar(
                select(ChangeEvent.id).where(
                    ChangeEvent.entity_id == match.id,
                    ChangeEvent.entity_revision == match.revision,
                    ChangeEvent.event_type == "delay_notice",
                )
            ):
                db.add(
                    ChangeEvent(
                        event_id=event.id,
                        entity_type="match",
                        entity_id=match.id,
                        entity_revision=match.revision,
                        event_type="delay_notice",
                        entry_ids=[
                            str(p.entry_id) for p in match.participants if p.entry_id
                        ],
                        diff={"minutes": 20, "expires_at": expiry.isoformat()},
                        simulated=True,
                    )
                )

    # Synthetic accounts have no role grants, credentials, contact details or real children.
    reports = [
        (
            "demo-parent-maple",
            "Demo parent · Maple",
            "open",
            "SIMULATED DISPUTE: Our scoresheet records the second set as 25–23. Please confirm with both scorekeepers.",
        ),
        (
            "demo-parent-cedar",
            "Demo parent · Cedar",
            "open",
            "SIMULATED DISPUTE: One set appears reversed. Please compare the signed scoresheet before confirming the winner.",
        ),
        (
            "demo-parent-harbour",
            "Demo parent · Harbour",
            "resolved",
            "SIMULATED RESOLVED DISPUTE: A duplicated set was reported. Both scorekeepers have confirmed the published result.",
        ),
    ]
    completed = list(
        db.scalars(
            select(Match)
            .where(Match.event_id == event.id, Match.status == "completed")
            .order_by(Match.scheduled_start.desc(), Match.external_id)
            .limit(3)
        )
    )
    for match, (subject, name, status, comment) in zip(completed, reports):
        reporter = db.scalar(select(User).where(User.clerk_subject == subject))
        if not reporter:
            reporter = User(clerk_subject=subject, display_name=name)
            db.add(reporter)
            db.flush()
        if not db.scalar(
            select(ScoreDispute.id).where(
                ScoreDispute.match_id == match.id,
                ScoreDispute.reporter_id == reporter.id,
            )
        ):
            db.add(
                ScoreDispute(
                    match_id=match.id,
                    reporter_id=reporter.id,
                    comment=comment,
                    status=status,
                    created_at=now - timedelta(minutes=12),
                    resolved_at=now - timedelta(minutes=3)
                    if status == "resolved"
                    else None,
                )
            )
    db.flush()
    deliver_due(db, event)
    if source:
        source.config = {**(source.config or {}), "operations_demo_seeded": True}
