"""SQLAlchemy entities for the first release.

Competition sources stay authoritative for matches and results; these tables hold the
normalized projection, provenance, staff content and the change feed built from it.
"""

import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    type_annotation_map = {
        dict[str, Any]: JSONB,
        list[Any]: JSONB,
        datetime: DateTime(timezone=True),
    }


class UUIDPk:
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)


class Organization(UUIDPk, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class User(UUIDPk, Base):
    __tablename__ = "users"

    clerk_subject: Mapped[str] = mapped_column(String(200), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    disabled_at: Mapped[datetime | None]

    grants: Mapped[list["RoleGrant"]] = relationship(back_populates="user", foreign_keys="RoleGrant.user_id")


class RoleGrant(UUIDPk, Base):
    """admin: whole organization. staff: one event's content and imports. official: own assignments."""

    __tablename__ = "role_grants"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    event_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(20))
    granted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    user: Mapped[User] = relationship(back_populates="grants", foreign_keys=[user_id])


class Event(UUIDPk, Base):
    __tablename__ = "events"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    title: Mapped[str] = mapped_column(String(300))
    kind: Mapped[str] = mapped_column(String(20), default="indoor")  # indoor | beach
    timezone: Mapped[str] = mapped_column(String(64), default="America/Toronto")
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | published | archived
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    venues: Mapped[list["Venue"]] = relationship(back_populates="event", order_by="Venue.sort")
    sources: Mapped[list["Source"]] = relationship(back_populates="event", order_by="Source.name")


class Venue(UUIDPk, Base):
    __tablename__ = "venues"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(String(300))
    accessible_entrance: Mapped[str | None] = mapped_column(Text)
    directions: Mapped[str | None] = mapped_column(Text)
    map_url: Mapped[str | None] = mapped_column(String(500))
    sort: Mapped[int] = mapped_column(Integer, default=0)

    event: Mapped[Event] = relationship(back_populates="venues")
    courts: Mapped[list["Court"]] = relationship(back_populates="venue", order_by="Court.label")

    __table_args__ = (UniqueConstraint("event_id", "name"),)


class Court(UUIDPk, Base):
    __tablename__ = "courts"

    venue_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("venues.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(50))
    area: Mapped[str | None] = mapped_column(String(100))

    venue: Mapped[Venue] = relationship(back_populates="courts")

    __table_args__ = (UniqueConstraint("venue_id", "label"),)


class Division(UUIDPk, Base):
    __tablename__ = "divisions"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str | None] = mapped_column(String(30))

    __table_args__ = (UniqueConstraint("event_id", "name"),)


class EventEntry(UUIDPk, Base):
    """A team's participation in one event and division. Follows point at entries."""

    __tablename__ = "event_entries"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    division_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("divisions.id", ondelete="SET NULL"))
    team_name: Mapped[str] = mapped_column(String(200))
    club_name: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    division: Mapped[Division | None] = relationship()


class Source(UUIDPk, Base):
    """One competition data source for an event (CSV import now; vendor adapters later)."""

    __tablename__ = "sources"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    mode: Mapped[str] = mapped_column(String(30), default="manual_import")
    official_url: Mapped[str | None] = mapped_column(String(500))
    expected_check_interval_minutes: Mapped[int] = mapped_column(Integer, default=15)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | paused | unavailable
    # Bumped on every committed import so a stale preview can't be committed.
    generation: Mapped[int] = mapped_column(Integer, default=0)
    last_successful_check_at: Mapped[datetime | None]
    last_import_at: Mapped[datetime | None]
    upstream_updated_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    event: Mapped[Event] = relationship(back_populates="sources")


class ExternalMapping(UUIDPk, Base):
    __tablename__ = "external_mappings"

    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"))
    entity_type: Mapped[str] = mapped_column(String(30))
    external_id: Mapped[str] = mapped_column(String(200))
    canonical_id: Mapped[uuid.UUID]

    __table_args__ = (UniqueConstraint("source_id", "entity_type", "external_id"),)


class Match(UUIDPk, Base):
    __tablename__ = "matches"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"))
    external_id: Mapped[str] = mapped_column(String(200))
    division_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("divisions.id", ondelete="SET NULL"))
    court_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("courts.id", ondelete="SET NULL"))
    # The work team the source assigns to referee this match, if any.
    work_entry_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("event_entries.id", ondelete="SET NULL"))
    round_label: Mapped[str | None] = mapped_column(String(100))
    scheduled_start: Mapped[datetime | None]
    estimated_start: Mapped[datetime | None]
    # scheduled | in_progress | completed | cancelled | postponed. Only the source sets in_progress.
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    result_state: Mapped[str] = mapped_column(String(20), default="none")  # none | provisional | final | corrected
    revision: Mapped[int] = mapped_column(Integer, default=1)
    source_revision: Mapped[str | None] = mapped_column(String(100))
    source_updated_at: Mapped[datetime | None]
    observed_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)

    division: Mapped[Division | None] = relationship()
    court: Mapped[Court | None] = relationship()
    work_entry: Mapped["EventEntry | None"] = relationship()
    source: Mapped[Source] = relationship()
    participants: Mapped[list["MatchParticipant"]] = relationship(
        back_populates="match", order_by="MatchParticipant.slot.desc()", cascade="all, delete-orphan"
    )
    sets: Mapped[list["SetResult"]] = relationship(
        back_populates="match", order_by="SetResult.set_number", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("source_id", "external_id"),
        Index("ix_matches_event_start", "event_id", "scheduled_start"),
        Index("ix_matches_work_entry", "work_entry_id"),
    )


class MatchParticipant(UUIDPk, Base):
    __tablename__ = "match_participants"

    match_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"))
    slot: Mapped[str] = mapped_column(String(10))  # home | away
    entry_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("event_entries.id", ondelete="SET NULL"), index=True)
    placeholder_label: Mapped[str | None] = mapped_column(String(100))

    match: Mapped[Match] = relationship(back_populates="participants")
    entry: Mapped[EventEntry | None] = relationship()

    __table_args__ = (UniqueConstraint("match_id", "slot"),)


class SetResult(UUIDPk, Base):
    __tablename__ = "set_results"

    match_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"))
    set_number: Mapped[int] = mapped_column(Integer)
    home_score: Mapped[int | None] = mapped_column(Integer)
    away_score: Mapped[int | None] = mapped_column(Integer)

    match: Mapped[Match] = relationship(back_populates="sets")

    __table_args__ = (UniqueConstraint("match_id", "set_number"),)


class Announcement(UUIDPk, Base):
    __tablename__ = "announcements"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    entry_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("event_entries.id", ondelete="SET NULL"))
    division_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("divisions.id", ondelete="SET NULL"))
    category: Mapped[str] = mapped_column(String(20), default="general")  # general | schedule | venue | safety
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(20), default="draft")  # draft | published | archived
    publish_at: Mapped[datetime | None]
    expire_at: Mapped[datetime | None]
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class GuideItem(UUIDPk, Base):
    __tablename__ = "guide_items"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    venue_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("venues.id", ondelete="SET NULL"))
    # parking | food | accessibility | directions | services | help | officials
    kind: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    link_url: Mapped[str | None] = mapped_column(String(500))
    sort: Mapped[int] = mapped_column(Integer, default=0)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class PartnerCard(UUIDPk, Base):
    __tablename__ = "partner_cards"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # sponsor | merchandise | tickets | fundraiser | activity
    name: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    link_url: Mapped[str | None] = mapped_column(String(500))
    logo_url: Mapped[str | None] = mapped_column(String(500))
    booth_location: Mapped[str | None] = mapped_column(String(200))
    seller_note: Mapped[str | None] = mapped_column(String(300))
    sort: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)


class RosterPublication(UUIDPk, Base):
    """An approved public projection of a roster. Never holds birthdates, contacts or consent originals."""

    __tablename__ = "roster_publications"

    entry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("event_entries.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer)
    state: Mapped[str] = mapped_column(String(20), default="draft")  # draft | published | withdrawn
    # [{jersey, display_name, position, photo_url}] with photo_url only when approved.
    public_players: Mapped[list[Any]] = mapped_column(default=list)
    team_photo_url: Mapped[str | None] = mapped_column(String(500))
    consent_review_ref: Mapped[str | None] = mapped_column(String(200))
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    published_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    __table_args__ = (UniqueConstraint("entry_id", "version"),)


class Assignment(UUIDPk, Base):
    __tablename__ = "assignments"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    person_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    match_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("matches.id", ondelete="SET NULL"))
    court_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("courts.id", ondelete="SET NULL"))
    role: Mapped[str] = mapped_column(String(50))  # first referee, second referee, scorekeeper, line judge
    reporting_time: Mapped[datetime | None]
    source_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("sources.id", ondelete="SET NULL"))
    revision: Mapped[int] = mapped_column(Integer, default=1)

    match: Mapped[Match | None] = relationship()
    court: Mapped[Court | None] = relationship()


class ChangeEvent(Base):
    """Public, allowlisted diffs. The id doubles as the cursor for the change feed."""

    __tablename__ = "change_events"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    entity_type: Mapped[str] = mapped_column(String(30))
    entity_id: Mapped[uuid.UUID]
    entity_revision: Mapped[int] = mapped_column(Integer)
    event_type: Mapped[str] = mapped_column(String(40))
    diff: Mapped[dict[str, Any]] = mapped_column(default=dict)
    # Entries this change concerns; empty means event-wide.
    entry_ids: Mapped[list[Any]] = mapped_column(default=list)
    simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    occurred_at: Mapped[datetime] = mapped_column(default=utcnow)

    __table_args__ = (UniqueConstraint("entity_id", "entity_revision", "event_type"),)


class ImportBatch(UUIDPk, Base):
    __tablename__ = "import_batches"

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20))  # entries | matches | rosters
    filename: Mapped[str | None] = mapped_column(String(300))
    file_hash: Mapped[str] = mapped_column(String(64))
    state: Mapped[str] = mapped_column(String(20), default="staged")  # staged | committed | rejected
    expected_source_generation: Mapped[int] = mapped_column(Integer)
    summary: Mapped[dict[str, Any]] = mapped_column(default=dict)
    rows: Mapped[list[Any]] = mapped_column(default=list)
    errors: Mapped[list[Any]] = mapped_column(default=list)
    options: Mapped[dict[str, Any]] = mapped_column(default=dict)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    committed_at: Mapped[datetime | None]


class AuditEntry(Base):
    __tablename__ = "audit_entries"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(60))
    event_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    target_type: Mapped[str] = mapped_column(String(30))
    target_id: Mapped[str | None] = mapped_column(String(64))
    old_revision: Mapped[int | None] = mapped_column(Integer)
    new_revision: Mapped[int | None] = mapped_column(Integer)
    request_id: Mapped[str | None] = mapped_column(String(64))
    summary: Mapped[dict[str, Any]] = mapped_column(default=dict)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
