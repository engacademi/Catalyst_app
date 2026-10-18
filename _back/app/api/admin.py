"""Staff workspace API. Every route checks a scoped role grant in the database."""

import uuid
from datetime import date, datetime
from typing import Annotated, Any, Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.public import load_event
from app.core.auth import CurrentPrincipal, Principal, require_event_role
from app.core.db import get_db
from app.core.http import parse_uuid
from app.models import (
    Announcement,
    AuditEntry,
    ChangeEvent,
    Court,
    Division,
    Event,
    EventEntry,
    ExternalMapping,
    GuideItem,
    ImportBatch,
    Match,
    PartnerCard,
    RosterPublication,
    Source,
    Venue,
    utcnow,
)
from app.modules import projections as P
from app.modules.announcements import deliver_due
from app.modules.imports import commit_import, stage_import
from app.modules.sponsors import engagement_report
from app.modules.matches import (
    MATCH_STATUSES,
    apply_match_state,
    current_state,
    match_load_options,
)

router = APIRouter(prefix="/v1/admin", tags=["admin"])
DB = Annotated[Session, Depends(get_db)]
STAFF = {"staff", "coach", "official"}


def audit(
    db: Session,
    request: Request,
    principal: Principal,
    action: str,
    event_id,
    target,
    old=None,
    new=None,
    **summary,
):
    db.add(
        AuditEntry(
            actor_user_id=principal.user.id,
            action=action,
            event_id=event_id,
            target_type=type(target).__tablename__,
            target_id=str(target.id),
            old_revision=old,
            new_revision=new,
            request_id=request.state.request_id,
            summary=summary,
        )
    )


def check_revision(current: int, expected: int | None) -> None:
    if expected is not None and expected != current:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Someone else changed this. Reload and try again."
        )


def staff_event(db: Session, principal: Principal, event_id: str) -> Event:
    event = load_event(db, event_id, include_unpublished=True)
    require_event_role(principal, event.id, STAFF)
    return event


def get_owned(db: Session, principal: Principal, model, obj_id: str):
    obj = db.scalar(
        select(model).where(model.id == parse_uuid(obj_id)).with_for_update()
    )
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    event_id = obj.event_id if hasattr(obj, "event_id") else None
    if model is RosterPublication:
        event_id = db.get(EventEntry, obj.entry_id).event_id
    if model is Venue or model is Source:
        event_id = obj.event_id
    require_event_role(principal, event_id, STAFF)
    if model.__name__ == "Assignment" or (
        model is ImportBatch and obj.kind == "assignments"
    ):
        require_event_role(principal, event_id, {"staff"})
    return obj


# ---- identity ---------------------------------------------------------------


@router.get("/me")
def me(principal: CurrentPrincipal) -> dict:
    return {
        "user_id": str(principal.user.id),
        "subject": principal.user.clerk_subject,
        "grants": [
            {
                "role": g.role,
                "event_id": str(g.event_id) if g.event_id else None,
                "entry_id": str(g.entry_id) if g.entry_id else None,
                "expires_at": P.iso(g.expires_at),
            }
            for g in principal.grants
        ],
        "is_staff": any(
            g.role in ("admin", "staff", "coach", "official") for g in principal.grants
        ),
    }


# ---- events, venues, sources --------------------------------------------------


class EventIn(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,98}$")
    title: str = Field(min_length=3, max_length=300)
    kind: Literal["indoor", "beach"] = "indoor"
    timezone: str = "America/Toronto"
    start_date: date
    end_date: date
    is_demo: bool = False


class EventPatch(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=300)
    kind: Literal["indoor", "beach"] | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: Literal["draft", "published", "archived"] | None = None
    expected_revision: int | None = None


@router.get("/events")
def admin_events(db: DB, principal: CurrentPrincipal) -> dict:
    events = db.scalars(select(Event).order_by(Event.start_date.desc()))
    return {
        "data": [P.event_public(e) for e in events if principal.has_role(STAFF, e.id)]
    }


@router.post("/events", status_code=201)
def create_event(
    body: EventIn, request: Request, db: DB, principal: CurrentPrincipal
) -> dict:
    if not principal.has_role(set()):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only organization admins can create events"
        )
    if body.end_date < body.start_date:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "End date is before start date"
        )
    if db.scalar(select(Event.id).where(Event.slug == body.slug)):
        raise HTTPException(status.HTTP_409_CONFLICT, "That event link is already used")
    org_id = next(g.organization_id for g in principal.grants if g.role == "admin")
    event = Event(organization_id=org_id, **body.model_dump())
    db.add(event)
    db.flush()
    db.add(Source(event_id=event.id, name="Approved CSV import", mode="manual_import"))
    audit(db, request, principal, "event.create", event.id, event, new=1)
    db.commit()
    return {"data": P.event_public(event)}


@router.get("/events/{event_id}")
def admin_event(event_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    entries = db.scalars(
        select(EventEntry)
        .where(EventEntry.event_id == event.id)
        .order_by(EventEntry.team_name)
    )
    return {
        "data": {
            **P.event_public(event),
            "venues": [P.venue_public(v) for v in event.venues],
            "sources": [
                {**P.source_public(s), "config": s.config, "generation": s.generation}
                for s in event.sources
            ],
            "divisions": [
                P.division_public(d)
                for d in db.scalars(
                    select(Division).where(Division.event_id == event.id)
                )
            ],
            "entries": [
                {"id": str(e.id), "team_name": e.team_name, "club_name": e.club_name}
                for e in entries
            ],
        }
    }


@router.patch("/events/{event_id}")
def update_event(
    event_id: str,
    body: EventPatch,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
) -> dict:
    event = staff_event(db, principal, event_id)
    db.refresh(event, with_for_update=True)
    if any(
        value is None
        for value in body.model_dump(
            exclude_unset=True, exclude={"expected_revision"}
        ).values()
    ):
        raise HTTPException(422, "Event details cannot be empty")
    check_revision(event.revision, body.expected_revision)
    if (body.end_date or event.end_date) < (body.start_date or event.start_date):
        raise HTTPException(422, "End date must not precede start date")
    old = event.revision
    for key, value in body.model_dump(
        exclude_unset=True, exclude={"expected_revision"}
    ).items():
        setattr(event, key, value)
    event.revision += 1
    audit(db, request, principal, "event.update", event.id, event, old, event.revision)
    db.commit()
    return {"data": P.event_public(event)}


class VenueIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    address: str | None = None
    city: str | None = Field(None, max_length=150)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    accessible_entrance: str | None = None
    directions: str | None = None
    map_url: HttpUrl | None = None
    # A bundled path such as /venues/enercare-centre.jpg or a full image URL.
    photo_url: str | None = Field(None, max_length=500)
    photo_credit: str | None = Field(None, max_length=300)
    sort: int = 0


@router.post("/events/{event_id}/venues", status_code=201)
def create_venue(
    event_id: str, body: VenueIn, request: Request, db: DB, principal: CurrentPrincipal
) -> dict:
    event = staff_event(db, principal, event_id)
    venue = Venue(
        event_id=event.id,
        **{**body.model_dump(), "map_url": str(body.map_url) if body.map_url else None},
    )
    db.add(venue)
    db.flush()
    audit(db, request, principal, "venue.create", event.id, venue)
    db.commit()
    db.refresh(venue)
    return {"data": P.venue_public(venue)}


@router.patch("/venues/{venue_id}")
def update_venue(
    venue_id: str, body: VenueIn, request: Request, db: DB, principal: CurrentPrincipal
) -> dict:
    venue = get_owned(db, principal, Venue, venue_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(venue, key, str(value) if key == "map_url" and value else value)
    audit(db, request, principal, "venue.update", venue.event_id, venue)
    db.commit()
    return {"data": P.venue_public(venue)}


class SourceIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    mode: Literal["manual_import", "demo_fixture", "aes", "timu", "myteam"] = (
        "manual_import"
    )
    official_url: HttpUrl | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    expected_check_interval_minutes: int = Field(15, ge=1, le=1440)


class SourcePatch(BaseModel):
    config: dict[str, Any] | None = None
    status: Literal["active", "paused", "unavailable"] | None = None
    official_url: HttpUrl | None = None
    expected_check_interval_minutes: int | None = Field(None, ge=1, le=1440)
    # Merged into config so the toggle can't clobber keys like event_key.
    auto_sync: bool | None = None


@router.post("/events/{event_id}/sources", status_code=201)
def create_source(
    event_id: str, body: SourceIn, request: Request, db: DB, principal: CurrentPrincipal
) -> dict:
    event = staff_event(db, principal, event_id)
    data = body.model_dump()
    data["official_url"] = str(body.official_url) if body.official_url else None
    source = Source(event_id=event.id, **data)
    db.add(source)
    db.flush()
    audit(db, request, principal, "source.create", event.id, source, mode=source.mode)
    db.commit()
    return {"data": P.source_public(source)}


@router.patch("/sources/{source_id}")
def update_source(
    source_id: str,
    body: SourcePatch,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
) -> dict:
    source = get_owned(db, principal, Source, source_id)
    before = source.status
    changes = body.model_dump(exclude_unset=True)
    auto_sync = changes.pop("auto_sync", None)
    for key, value in changes.items():
        setattr(source, key, str(value) if key == "official_url" and value else value)
    if auto_sync is not None:
        source.config = {**source.config, "auto_sync": auto_sync}
    audit(
        db,
        request,
        principal,
        "source.update",
        source.event_id,
        source,
        status=[before, source.status],
    )
    db.commit()
    return {"data": P.source_public(source)}


@router.get("/sources/{source_id}/health")
def source_health(source_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    source = get_owned(db, principal, Source, source_id)
    batches = db.scalars(
        select(ImportBatch)
        .where(ImportBatch.source_id == source.id)
        .order_by(ImportBatch.created_at.desc())
        .limit(10)
    )
    return {
        "data": {
            **P.source_public(source),
            "generation": source.generation,
            "recent_imports": [_batch_summary(b) for b in batches],
        }
    }


# ---- imports ---------------------------------------------------------------------


def _batch_summary(batch: ImportBatch) -> dict[str, Any]:
    return {
        "id": str(batch.id),
        "kind": batch.kind,
        "filename": batch.filename,
        "state": batch.state,
        "summary": batch.summary,
        "error_count": len(batch.errors)
        + sum(1 for r in batch.rows if r["action"] == "error"),
        "created_at": P.iso(batch.created_at),
        "committed_at": P.iso(batch.committed_at),
    }


@router.post("/imports", status_code=201)
async def upload_import(
    db: DB,
    principal: CurrentPrincipal,
    event_id: Annotated[str, Form()],
    source_id: Annotated[str, Form()],
    kind: Annotated[Literal["entries", "matches", "rosters", "assignments"], Form()],
    file: Annotated[UploadFile, File()],
    strict: Annotated[bool, Form()] = True,
    consent_review_ref: Annotated[str | None, Form(max_length=200)] = None,
    column_mapping: Annotated[str | None, Form()] = None,
    team_mapping: Annotated[str | None, Form()] = None,
) -> dict:
    event = staff_event(db, principal, event_id)
    if kind == "assignments":
        require_event_role(principal, event.id, {"staff"})
    source = db.get(Source, parse_uuid(source_id, "source"))
    if source is None or source.event_id != event.id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Source not found for this event"
        )
    from app.core.config import get_settings

    content = await file.read(get_settings().import_max_bytes + 1)
    if len(content) > get_settings().import_max_bytes:
        raise HTTPException(422, "File exceeds 5 MB")
    import json

    try:
        columns = json.loads(column_mapping) if column_mapping else None
        teams = json.loads(team_mapping) if team_mapping else {}
        if not isinstance(teams, dict) or (
            columns is not None and not isinstance(columns, dict)
        ):
            raise ValueError()
        for mapped in teams.values():
            uuid.UUID(mapped)
    except (ValueError, TypeError):
        raise HTTPException(422, "Invalid column or team mapping")
    if columns:
        if kind != "rosters":
            raise HTTPException(
                422, "Column mapping is only supported for registration rosters"
            )
        from app.modules.operations import map_registration

        content = map_registration(content, columns, teams)
    batch = stage_import(
        db,
        event=event,
        source=source,
        kind=kind,
        filename=file.filename,
        content=content,
        options={
            "strict": strict,
            "consent_review_ref": consent_review_ref or None,
            "team_mapping": teams,
            "require_review": bool(columns),
        },
        actor_id=principal.user.id,
    )
    return {
        "data": {**_batch_summary(batch), "errors": batch.errors, "rows": batch.rows}
    }


@router.get("/imports/{batch_id}")
def get_import(batch_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    batch = get_owned(db, principal, ImportBatch, batch_id)
    return {
        "data": {**_batch_summary(batch), "errors": batch.errors, "rows": batch.rows}
    }


@router.post("/imports/{batch_id}/commit")
def commit(
    batch_id: str, request: Request, db: DB, principal: CurrentPrincipal
) -> dict:
    get_owned(db, principal, ImportBatch, batch_id)
    batch = commit_import(
        db, parse_uuid(batch_id), principal.user.id, request.state.request_id
    )
    return {"data": _batch_summary(batch)}


@router.get("/events/{event_id}/imports")
def list_imports(event_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    batches = db.scalars(
        select(ImportBatch)
        .where(ImportBatch.event_id == event.id)
        .order_by(ImportBatch.created_at.desc())
        .limit(50)
    )
    return {
        "data": [
            _batch_summary(b)
            for b in batches
            if b.kind != "assignments" or principal.has_role({"staff"}, event.id)
        ]
    }


# ---- announcements -----------------------------------------------------------------


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=1, max_length=4000)
    category: Literal["general", "schedule", "venue", "safety"] = "general"
    entry_id: uuid.UUID | None = None
    division_id: uuid.UUID | None = None
    expire_at: datetime | None = None
    publish_at: datetime | None = None


class AnnouncementPatch(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=200)
    body: str | None = Field(None, min_length=1, max_length=4000)
    category: Literal["general", "schedule", "venue", "safety"] | None = None
    expire_at: datetime | None = None
    publish_at: datetime | None = None
    expected_revision: int | None = None


@router.get("/events/{event_id}/announcements")
def admin_announcements(event_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    rows = db.scalars(
        select(Announcement)
        .where(Announcement.event_id == event.id)
        .order_by(Announcement.created_at.desc())
    )
    return {"data": [P.announcement_admin(a) for a in rows]}


@router.post("/events/{event_id}/announcements", status_code=201)
def create_announcement(
    event_id: str,
    body: AnnouncementIn,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
) -> dict:
    event = staff_event(db, principal, event_id)
    if body.entry_id:
        entry = db.get(EventEntry, body.entry_id)
        if entry is None or entry.event_id != event.id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "Team is not in this event"
            )
    if body.division_id:
        division = db.get(Division, body.division_id)
        if not division or division.event_id != event.id:
            raise HTTPException(422, "Division is not in this event")
    if body.entry_id and body.division_id:
        raise HTTPException(422, "Choose one announcement audience")
    for stamp in (body.publish_at, body.expire_at):
        if stamp and stamp.tzinfo is None:
            raise HTTPException(422, "Announcement times need a timezone")
    if body.expire_at and body.expire_at <= (body.publish_at or P.event_now(event)):
        raise HTTPException(422, "Expiry must be after publication")
    a = Announcement(
        event_id=event.id, created_by=principal.user.id, **body.model_dump()
    )
    db.add(a)
    db.flush()
    audit(db, request, principal, "announcement.create", event.id, a, new=1)
    db.commit()
    return {"data": P.announcement_admin(a)}


@router.patch("/announcements/{announcement_id}")
def update_announcement(
    announcement_id: str,
    body: AnnouncementPatch,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
) -> dict:
    a = get_owned(db, principal, Announcement, announcement_id)
    check_revision(a.revision, body.expected_revision)
    old = a.revision
    for key, value in body.model_dump(
        exclude_unset=True, exclude={"expected_revision"}
    ).items():
        setattr(a, key, value)
    a.revision += 1
    audit(db, request, principal, "announcement.update", a.event_id, a, old, a.revision)
    db.commit()
    return {"data": P.announcement_admin(a)}


@router.post("/announcements/{announcement_id}/publish")
def publish_announcement(
    announcement_id: str, request: Request, db: DB, principal: CurrentPrincipal
) -> dict:
    a = get_owned(db, principal, Announcement, announcement_id)
    if a.state == "published":
        return {"data": P.announcement_admin(a)}
    old = a.revision
    event = db.get(Event, a.event_id)
    a.state = "published"
    a.publish_at = a.publish_at or P.event_now(event)
    a.revision += 1
    db.flush()
    # A scheduled notice enters the change feed when its time comes, not now.
    deliver_due(db, event)
    audit(
        db, request, principal, "announcement.publish", a.event_id, a, old, a.revision
    )
    db.commit()
    return {"data": P.announcement_admin(a)}


@router.post("/announcements/{announcement_id}/archive")
def archive_announcement(
    announcement_id: str, request: Request, db: DB, principal: CurrentPrincipal
) -> dict:
    a = get_owned(db, principal, Announcement, announcement_id)
    old = a.revision
    a.state = "archived"
    a.revision += 1
    audit(
        db, request, principal, "announcement.archive", a.event_id, a, old, a.revision
    )
    db.commit()
    return {"data": P.announcement_admin(a)}


# ---- guide content and partners ---------------------------------------------------


class GuideItemIn(BaseModel):
    expected_revision: int | None = None
    kind: Literal[
        "parking",
        "food",
        "accessibility",
        "directions",
        "services",
        "help",
        "officials",
        "media_photo",
        "media_video",
        "media_album",
    ]
    title: str = Field(min_length=2, max_length=200)
    body: str = Field("", max_length=4000)
    link_url: HttpUrl | None = None
    venue_id: uuid.UUID | None = None
    sort: int = 0


class PartnerIn(BaseModel):
    expected_revision: int | None = None
    kind: Literal["sponsor", "merchandise", "tickets", "fundraiser", "activity"]
    name: str = Field(min_length=2, max_length=200)
    body: str = Field("", max_length=2000)
    link_url: HttpUrl | None = None
    logo_url: str | None = Field(None, max_length=500)
    booth_location: str | None = Field(None, max_length=200)
    seller_note: str | None = Field(None, max_length=300)
    sort: int = 0
    active: bool = True

    def clean(self) -> dict:
        data = self.model_dump(exclude={"expected_revision"})
        if self.link_url and self.link_url.scheme != "https":
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "Partner links must use https"
            )
        data["link_url"] = str(self.link_url) if self.link_url else None
        return data


def _guide_data(body: GuideItemIn) -> dict:
    if body.kind.startswith("media_") and (
        not body.link_url or body.link_url.scheme != "https"
    ):
        raise HTTPException(422, "Media requires an https photo, video or album link")
    data = body.model_dump(exclude={"expected_revision"})
    data["link_url"] = str(body.link_url) if body.link_url else None
    return data


@router.get("/events/{event_id}/guide-items")
def admin_guide(event_id: str, db: DB, principal: CurrentPrincipal):
    event = staff_event(db, principal, event_id)
    rows = db.scalars(
        select(GuideItem)
        .where(GuideItem.event_id == event.id)
        .order_by(GuideItem.sort, GuideItem.title)
    )
    return {"data": {"items": [P.guide_item_public(row) for row in rows]}}


@router.post("/events/{event_id}/guide-items", status_code=201)
def create_guide_item(
    event_id: str,
    body: GuideItemIn,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
) -> dict:
    event = staff_event(db, principal, event_id)
    item = GuideItem(event_id=event.id, **_guide_data(body))
    db.add(item)
    db.flush()
    audit(db, request, principal, "guide.create", event.id, item, new=1)
    db.commit()
    return {"data": P.guide_item_public(item)}


@router.put("/guide-items/{item_id}")
def update_guide_item(
    item_id: str,
    body: GuideItemIn,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
) -> dict:
    item = get_owned(db, principal, GuideItem, item_id)
    check_revision(item.revision, body.expected_revision)
    old = item.revision
    for key, value in _guide_data(body).items():
        setattr(item, key, value)
    item.revision += 1
    audit(
        db, request, principal, "guide.update", item.event_id, item, old, item.revision
    )
    db.commit()
    return {"data": P.guide_item_public(item)}


@router.delete("/guide-items/{item_id}", status_code=204)
def delete_guide_item(
    item_id: str, request: Request, db: DB, principal: CurrentPrincipal
) -> None:
    item = get_owned(db, principal, GuideItem, item_id)
    audit(db, request, principal, "guide.delete", item.event_id, item, item.revision)
    db.delete(item)
    db.commit()


@router.get("/events/{event_id}/partners")
def admin_partners(event_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    rows = db.scalars(
        select(PartnerCard)
        .where(PartnerCard.event_id == event.id)
        .order_by(PartnerCard.sort)
    )
    return {"data": [P.partner_public(p) for p in rows]}


@router.get("/events/{event_id}/sponsor-report")
def sponsor_report(event_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    """Views, clicks and click-through rate per sponsor card, split by placement."""
    event = staff_event(db, principal, event_id)
    return {"data": engagement_report(db, event)}


@router.post("/events/{event_id}/partners", status_code=201)
def create_partner(
    event_id: str,
    body: PartnerIn,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
) -> dict:
    event = staff_event(db, principal, event_id)
    card = PartnerCard(event_id=event.id, **body.clean())
    db.add(card)
    db.flush()
    audit(db, request, principal, "partner.create", event.id, card, new=1)
    db.commit()
    return {"data": P.partner_public(card)}


@router.put("/partners/{partner_id}")
def update_partner(
    partner_id: str,
    body: PartnerIn,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
) -> dict:
    card = get_owned(db, principal, PartnerCard, partner_id)
    check_revision(card.revision, body.expected_revision)
    old = card.revision
    for key, value in body.clean().items():
        setattr(card, key, value)
    card.revision += 1
    audit(
        db,
        request,
        principal,
        "partner.update",
        card.event_id,
        card,
        old,
        card.revision,
    )
    db.commit()
    return {"data": P.partner_public(card)}


@router.delete("/partners/{partner_id}", status_code=204)
def delete_partner(
    partner_id: str, request: Request, db: DB, principal: CurrentPrincipal
) -> None:
    card = get_owned(db, principal, PartnerCard, partner_id)
    audit(db, request, principal, "partner.delete", card.event_id, card, card.revision)
    db.delete(card)
    db.commit()


# ---- rosters -------------------------------------------------------------------------


def _roster_admin(r: RosterPublication) -> dict:
    return {
        "id": str(r.id),
        "version": r.version,
        "state": r.state,
        "players": r.public_players,
        "team_photo_url": r.team_photo_url,
        "consent_review_ref": r.consent_review_ref,
        "review": r.review,
        "published_at": P.iso(r.published_at),
        "created_at": P.iso(r.created_at),
    }


class PublishRosterIn(BaseModel):
    consent_review_ref: str = Field(min_length=2, max_length=200)


@router.get("/entries/{entry_id}/rosters")
def entry_rosters(entry_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    entry = get_owned(db, principal, EventEntry, entry_id)
    rows = db.scalars(
        select(RosterPublication)
        .where(RosterPublication.entry_id == entry.id)
        .order_by(RosterPublication.version.desc())
    )
    return {"data": [_roster_admin(r) for r in rows]}


@router.post("/rosters/{roster_id}/publish")
def publish_roster(
    roster_id: str,
    body: PublishRosterIn,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
) -> dict:
    roster = get_owned(db, principal, RosterPublication, roster_id)
    if roster.state == "withdrawn":
        raise HTTPException(
            409,
            "Withdrawn versions cannot be republished; import a newly approved version",
        )
    if roster.review.get("required") and roster.review.get("state") != "approved":
        raise HTTPException(409, "Team review is required before publication")
    for other in db.scalars(
        select(RosterPublication).where(
            RosterPublication.entry_id == roster.entry_id,
            RosterPublication.state == "published",
            RosterPublication.id != roster.id,
        )
    ):
        other.state = "superseded"
    roster.state = "published"
    roster.consent_review_ref = body.consent_review_ref
    roster.reviewed_by = principal.user.id
    roster.published_at = utcnow()
    event_id = db.get(EventEntry, roster.entry_id).event_id
    audit(
        db, request, principal, "roster.publish", event_id, roster, new=roster.version
    )
    db.commit()
    return {"data": _roster_admin(roster)}


@router.post("/rosters/{roster_id}/withdraw")
def withdraw_roster(
    roster_id: str, request: Request, db: DB, principal: CurrentPrincipal
) -> dict:
    roster = get_owned(db, principal, RosterPublication, roster_id)
    roster.state = "withdrawn"
    event_id = db.get(EventEntry, roster.entry_id).event_id
    audit(db, request, principal, "roster.withdraw", event_id, roster, roster.version)
    db.commit()
    return {"data": _roster_admin(roster)}


# ---- demo simulation -------------------------------------------------------------------


class SimulateIn(BaseModel):
    match_id: uuid.UUID
    court_label: str | None = Field(None, max_length=50)
    venue_id: uuid.UUID | None = None
    scheduled_start: datetime | None = None
    status: str | None = None
    sets: list[tuple[int, int]] | None = None


@router.post("/events/{event_id}/simulate-change")
def simulate_change(
    event_id: str,
    body: SimulateIn,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
) -> dict:
    """Demo events only: apply a pretend source change through the real revision pipeline."""
    event = staff_event(db, principal, event_id)
    if not event.is_demo:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Simulated changes are only allowed on demo events",
        )
    match = db.scalar(
        select(Match)
        .where(Match.id == body.match_id, Match.event_id == event.id)
        .options(*match_load_options())
    )
    if match is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found")
    state = current_state(match)
    if body.court_label:
        venue_id = body.venue_id or (match.court.venue_id if match.court else None)
        if venue_id is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Choose a venue for the new court",
            )
        court = db.scalar(
            select(Court).where(
                Court.venue_id == venue_id, Court.label == body.court_label
            )
        )
        if court is None:
            court = Court(venue_id=venue_id, label=body.court_label)
            db.add(court)
            db.flush()
        state.court_id = court.id
    if body.scheduled_start:
        state.scheduled_start = body.scheduled_start
    if body.status:
        if body.status not in MATCH_STATUSES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown status")
        state.status = body.status
    if body.sets is not None:
        state.sets = [tuple(s) for s in body.sets]
    old = match.revision
    changes = apply_match_state(db, match, state, simulated=True)
    audit(
        db,
        request,
        principal,
        "match.simulate",
        event.id,
        match,
        old,
        match.revision,
        events=[c.event_type for c in changes],
    )
    event.revision += 1
    db.commit()
    return {
        "data": {
            "revision": match.revision,
            "change_events": [c.event_type for c in changes],
        }
    }


# ---- audit -------------------------------------------------------------------------------


@router.get("/events/{event_id}/audit")
def audit_log(event_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    rows = db.scalars(
        select(AuditEntry)
        .where(AuditEntry.event_id == event.id)
        .order_by(AuditEntry.id.desc())
        .limit(100)
    )
    return {
        "data": [
            {
                "id": r.id,
                "action": r.action,
                "target_type": r.target_type,
                "target_id": r.target_id,
                "old_revision": r.old_revision,
                "new_revision": r.new_revision,
                "summary": r.summary,
                "created_at": P.iso(r.created_at),
            }
            for r in rows
        ]
    }


@router.post("/sources/{source_id}/refresh")
def refresh_source(source_id: str, db: DB, principal: CurrentPrincipal):
    source = get_owned(db, principal, Source, source_id)
    source_id, actor_id = source.id, principal.user.id
    db.rollback()  # Release this request's connection before the independent sync session.
    from app.modules.sync import sync_source

    return {"data": sync_source(source_id, actor_id)}


@router.get("/sources/{source_id}/registration-mappings")
def registration_mappings(source_id: str, db: DB, principal: CurrentPrincipal):
    from app.modules.imports import REGISTRATION_TEAM

    source = get_owned(db, principal, Source, source_id)
    rows = db.execute(
        select(ExternalMapping, EventEntry.team_name)
        .join(EventEntry, EventEntry.id == ExternalMapping.canonical_id)
        .where(
            ExternalMapping.source_id == source.id,
            ExternalMapping.entity_type == REGISTRATION_TEAM,
            EventEntry.event_id == source.event_id,
        )
        .order_by(ExternalMapping.external_id)
    )
    return {
        "data": [
            {
                "external_id": m.external_id,
                "entry_id": str(m.canonical_id),
                "team_name": team_name,
            }
            for m, team_name in rows
        ]
    }


@router.delete("/sources/{source_id}/registration-mappings/{external_id}")
def forget_registration_mapping(
    source_id: str, external_id: str, db: DB, principal: CurrentPrincipal
):
    from app.modules.imports import REGISTRATION_TEAM

    source = get_owned(db, principal, Source, source_id)
    mapping = db.scalar(
        select(ExternalMapping).where(
            ExternalMapping.source_id == source.id,
            ExternalMapping.entity_type == REGISTRATION_TEAM,
            ExternalMapping.external_id == external_id,
        )
    )
    if mapping is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mapping not found")
    db.delete(mapping)
    db.add(
        AuditEntry(
            actor_user_id=principal.user.id,
            action="registration_mapping.forget",
            event_id=source.event_id,
            target_type="source",
            target_id=str(source.id),
            summary={"external_id": external_id},
        )
    )
    db.commit()
    return {"data": {"external_id": external_id}}


@router.post("/registration/columns")
async def registration_columns(
    principal: CurrentPrincipal, file: Annotated[UploadFile, File()]
):
    if not principal.has_role({"staff"}):
        # Event staff have scoped grants; any current staff grant suffices to inspect their file.
        if not any(g.role == "staff" for g in principal.grants):
            raise HTTPException(403, "Staff access required")
    import csv
    import io

    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(422, "File exceeds 5 MB")
    try:
        headers = csv.DictReader(io.StringIO(content.decode("utf-8-sig"))).fieldnames
        if not headers or len(headers) > 100:
            raise ValueError()
        return {"data": headers}
    except (UnicodeError, ValueError, csv.Error):
        raise HTTPException(422, "Choose a UTF-8 CSV export with a header row")


@router.get("/events/{event_id}/assignments")
def assignments_admin(event_id: str, db: DB, principal: CurrentPrincipal):
    from app.models import Assignment, User

    event = staff_event(db, principal, event_id)
    require_event_role(principal, event.id, {"staff"})
    rows = db.scalars(
        select(Assignment)
        .where(Assignment.event_id == event.id)
        .order_by(Assignment.reporting_time)
    )
    return {
        "data": [
            {
                "id": str(a.id),
                "subject": db.get(User, a.person_user_id).clerk_subject,
                "role": a.role,
                "match_id": str(a.match_id) if a.match_id else None,
                "reporting_time": P.iso(a.reporting_time),
                "revision": a.revision,
            }
            for a in rows
        ]
    }


class AssignmentIn(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    match_id: uuid.UUID
    role: str = Field(min_length=2, max_length=50)
    reporting_time: datetime
    expected_revision: int | None = None


def write_assignment(body, event, db, assignment=None):
    from app.models import Assignment, RoleGrant, User

    user = db.scalar(
        select(User).where(
            User.clerk_subject == body.subject, User.disabled_at.is_(None)
        )
    )
    grant = (
        db.scalar(
            select(RoleGrant).where(
                RoleGrant.user_id == user.id,
                RoleGrant.role == "official",
                RoleGrant.event_id == event.id,
            )
        )
        if user
        else None
    )
    if not grant or (grant.expires_at and grant.expires_at <= utcnow()):
        raise HTTPException(
            422, "Grant this subject an official role for the event first"
        )
    match = db.get(Match, body.match_id)
    if not match or match.event_id != event.id:
        raise HTTPException(422, "Match is not in this event")
    if body.reporting_time.tzinfo is None:
        raise HTTPException(422, "Reporting time must include a timezone")
    if assignment:
        check_revision(assignment.revision, body.expected_revision)
        assignment.revision += 1
    else:
        assignment = Assignment(
            event_id=event.id, role=body.role, person_user_id=user.id
        )
        db.add(assignment)
    assignment.person_user_id, assignment.match_id = user.id, match.id
    assignment.court_id, assignment.role, assignment.reporting_time = (
        match.court_id,
        body.role,
        body.reporting_time,
    )
    db.flush()
    return assignment


@router.post("/events/{event_id}/assignments", status_code=201)
def create_assignment(
    event_id: str,
    body: AssignmentIn,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
):
    event = staff_event(db, principal, event_id)
    require_event_role(principal, event.id, {"staff"})
    a = write_assignment(body, event, db)
    audit(db, request, principal, "assignment.create", event.id, a, new=1)
    db.commit()
    return {"data": {"id": str(a.id)}}


@router.put("/assignments/{assignment_id}")
def update_assignment(
    assignment_id: str,
    body: AssignmentIn,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
):
    from app.models import Assignment

    a = get_owned(db, principal, Assignment, assignment_id)
    event = staff_event(db, principal, str(a.event_id))
    a = write_assignment(body, event, db, a)
    audit(db, request, principal, "assignment.update", event.id, a, new=a.revision)
    db.commit()
    return {"data": {"id": str(a.id), "revision": a.revision}}


@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(
    assignment_id: str, request: Request, db: DB, principal: CurrentPrincipal
):
    from app.models import Assignment

    a = get_owned(db, principal, Assignment, assignment_id)
    audit(db, request, principal, "assignment.delete", a.event_id, a)
    # Remove the import identity too, allowing a subsequent approved reimport.
    from sqlalchemy import delete

    from app.models import ExternalMapping

    db.execute(
        delete(ExternalMapping).where(
            ExternalMapping.entity_type == "assignment",
            ExternalMapping.canonical_id == a.id,
        )
    )
    db.delete(a)
    db.commit()


class ClockIn(BaseModel):
    at: datetime | None = None
    advance_minutes: int = Field(0, ge=0, le=1440)
    reset: bool = False


@router.post("/events/{event_id}/clock")
def demo_clock(
    event_id: str, body: ClockIn, request: Request, db: DB, principal: CurrentPrincipal
):
    event = staff_event(db, principal, event_id)
    if not event.is_demo:
        raise HTTPException(409, "Demo clock is unavailable for real events")
    if body.at and body.at.tzinfo is None:
        raise HTTPException(422, "Demo time requires a timezone")
    from datetime import timedelta

    at = body.at or P.event_now(event)
    event.demo_clock = (
        {}
        if body.reset
        else {
            "at": (at + timedelta(minutes=body.advance_minutes)).isoformat(),
            "set_at": utcnow().isoformat(),
        }
    )
    audit(db, request, principal, "demo.clock", event.id, event)
    db.commit()
    return {"data": P.event_public(event)}


class CourtNoticeIn(BaseModel):
    area_label: str | None = Field(None, max_length=150)
    delay_minutes: int = Field(0, ge=0, le=240)
    duration_minutes: int = Field(60, ge=1, le=1440)
    apply_to_area: bool = False


@router.patch("/courts/{court_id}/notice")
def court_notice(
    court_id: str,
    body: CourtNoticeIn,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
):
    from datetime import timedelta

    court = db.get(Court, parse_uuid(court_id))
    if not court:
        raise HTTPException(404, "Court not found")
    venue = db.get(Venue, court.venue_id)
    event = staff_event(db, principal, str(venue.event_id))
    if "area_label" in body.model_fields_set:
        court.area_label = body.area_label or None
    courts = (
        list(
            db.scalars(
                select(Court).where(
                    Court.venue_id == venue.id, Court.area_label == court.area_label
                )
            )
        )
        if body.apply_to_area and court.area_label
        else [court]
    )
    now = P.event_now(event)
    for c in courts:
        c.delay = (
            {
                "minutes": body.delay_minutes,
                "posted_at": now.isoformat(),
                "expires_at": (
                    now + timedelta(minutes=body.duration_minutes)
                ).isoformat(),
                "posted_by": principal.user.display_name or "OVA staff",
            }
            if body.delay_minutes
            else {}
        )
        affected = list(db.scalars(
            select(Match)
            .where(Match.court_id == c.id, Match.status.in_(["scheduled", "postponed"]))
            .options(*match_load_options())
        ))
        for m in affected:
            m.revision += 1
            db.add(
                ChangeEvent(
                    event_id=event.id,
                    entity_type="match",
                    entity_id=m.id,
                    entity_revision=m.revision,
                    event_type="delay_notice" if body.delay_minutes else "delay_cleared",
                    entry_ids=[str(p.entry_id) for p in m.participants if p.entry_id],
                    diff={
                        "minutes": body.delay_minutes,
                        "expires_at": c.delay.get("expires_at"),
                    },
                    simulated=event.is_demo,
                )
            )
        if not affected:
            notice = Announcement(
                event_id=event.id, category="schedule", state="published",
                title=f"{c.label}: " + (f"running ~{body.delay_minutes} minutes late" if body.delay_minutes else "delay cleared"),
                body=(f"{principal.user.display_name or 'Event staff'} updated the court notice. "
                      f"Official match times remain unchanged. Check the match schedule for estimates. "
                      f"Notice valid for {body.duration_minutes} minutes."),
                created_by=principal.user.id,
            )
            db.add(notice)
            db.flush()
            db.add(ChangeEvent(event_id=event.id, entity_type="announcement", entity_id=notice.id, entity_revision=notice.revision, event_type="announcement_published", entry_ids=[], diff={}, simulated=event.is_demo))
        audit(
            db,
            request,
            principal,
            "court.notice",
            event.id,
            c,
            minutes=body.delay_minutes,
        )
    db.commit()
    return {"data": [P.court_public(c) for c in courts]}


@router.get("/events/{event_id}/matches")
def staff_matches(
    event_id: str,
    db: DB,
    principal: CurrentPrincipal,
    cursor: int = 0,
    limit: int = 100,
):
    event = staff_event(db, principal, event_id)
    from app.api.public import project_matches
    from app.modules.matches import match_query

    if cursor < 0 or not 1 <= limit <= 200:
        raise HTTPException(422, "Invalid page size or cursor")
    rows = list(db.scalars(match_query(event.id).offset(cursor).limit(limit + 1)))
    return {
        "data": project_matches(db, event, rows[:limit]),
        "next_cursor": cursor + limit if len(rows) > limit else None,
    }


class MatchEditIn(BaseModel):
    expected_revision: int = Field(ge=1)
    sets: list[tuple[int, int]] | None = Field(None, max_length=5)
    scheduled_start: datetime | None = None
    court_id: uuid.UUID | None = None
    round_label: str | None = Field(None, max_length=200)
    status: (
        Literal["scheduled", "in_progress", "completed", "cancelled", "postponed"]
        | None
    ) = None
    home_entry_id: uuid.UUID | None = None
    away_entry_id: uuid.UUID | None = None
    home_placeholder: str | None = Field(None, max_length=200)
    away_placeholder: str | None = Field(None, max_length=200)


@router.patch("/matches/{match_id}")
def edit_imported_match(
    match_id: str,
    body: MatchEditIn,
    request: Request,
    db: DB,
    principal: CurrentPrincipal,
):
    match = db.scalar(
        select(Match)
        .where(Match.id == parse_uuid(match_id))
        .with_for_update()
        .options(*match_load_options())
    )
    if match is None:
        raise HTTPException(404, "Match not found")
    event = staff_event(db, principal, str(match.event_id))
    check_revision(match.revision, body.expected_revision)
    if match.source.mode not in {"manual_import", "demo_fixture"}:
        raise HTTPException(
            409,
            "Edit this connected match in its official platform, then refresh the source. Local changes would be overwritten.",
        )
    state = current_state(match)
    updates = body.model_dump(exclude_unset=True, exclude={"expected_revision"})
    if (
        "scheduled_start" in updates
        and body.scheduled_start is not None
        and body.scheduled_start.tzinfo is None
    ):
        raise HTTPException(422, "Start time must include a timezone")
    if body.court_id is not None:
        court = db.get(Court, body.court_id)
        if court is None or court.venue.event_id != event.id:
            raise HTTPException(422, "Court must belong to this event")
    for slot_name in ("home", "away"):
        entry_id = getattr(body, f"{slot_name}_entry_id")
        if entry_id is not None:
            entry = db.get(EventEntry, entry_id)
            if entry is None or entry.event_id != event.id:
                raise HTTPException(422, "Team must belong to this event")
        slot = getattr(state, slot_name)
        if f"{slot_name}_entry_id" in updates:
            slot.entry_id = entry_id
            if entry_id:
                slot.placeholder = None
        if f"{slot_name}_placeholder" in updates and not slot.entry_id:
            slot.placeholder = getattr(body, f"{slot_name}_placeholder")
    if state.home.entry_id and state.home.entry_id == state.away.entry_id:
        raise HTTPException(422, "A team cannot play itself")
    for field in ("scheduled_start", "court_id", "round_label", "status"):
        if field in updates:
            if field == "status" and updates[field] is None:
                raise HTTPException(422, "Status cannot be empty")
            setattr(state, field, updates[field])
    if "scheduled_start" in updates:
        state.estimated_start = None
    if body.sets is not None:
        if any(h < 0 or a < 0 or h > 199 or a > 199 for h, a in body.sets):
            raise HTTPException(422, "Set scores must be between 0 and 199")
        state.sets = body.sets
    old = match.revision
    apply_match_state(db, match, state, simulated=event.is_demo)
    event.revision += 1
    audit(
        db, request, principal, "match.staff_edit", event.id, match, old, match.revision
    )
    db.commit()
    return {"data": {"revision": match.revision}}


# Organization administrators grant event access; account onboarding never does.
from app.models import RoleGrant, User


def organization_admin(principal, event):
    if not any(
        g.role == "admin" and g.organization_id == event.organization_id
        for g in principal.grants
    ):
        raise HTTPException(403, "Only an OVA administrator can manage event access")


@router.get("/events/{event_id}/access")
def event_access(event_id: str, db: DB, principal: CurrentPrincipal):
    event = load_event(db, event_id, include_unpublished=True)
    organization_admin(principal, event)
    grants = list(db.scalars(select(RoleGrant).where(RoleGrant.event_id == event.id)))
    users = list(
        db.scalars(
            select(User)
            .where(User.disabled_at.is_(None))
            .order_by(User.display_name, User.id)
            .limit(500)
        )
    )
    return {
        "data": [
            {
                "id": str(g.id),
                "user_id": str(g.user_id),
                "role": g.role,
                "entry_id": str(g.entry_id) if g.entry_id else None,
            }
            for g in grants
        ],
        "users": [
            {"id": str(u.id), "display_name": u.display_name or u.clerk_subject}
            for u in users
        ],
    }


class AccessIn(BaseModel):
    user_id: str
    role: Literal["staff", "coach", "official"]
    entry_id: str | None = None


@router.post("/events/{event_id}/access", status_code=201)
def grant_event_access(
    event_id: str, body: AccessIn, request: Request, db: DB, principal: CurrentPrincipal
):
    event = load_event(db, event_id, include_unpublished=True)
    organization_admin(principal, event)
    user = db.get(User, parse_uuid(body.user_id))
    if not user or user.disabled_at:
        raise HTTPException(422, "Choose an active account")
    entry = db.get(EventEntry, parse_uuid(body.entry_id)) if body.entry_id else None
    if body.entry_id and (not entry or entry.event_id != event.id):
        raise HTTPException(422, "Team is not in this tournament")
    if body.role == "coach" and not entry:
        raise HTTPException(422, "Choose the coach's team")
    existing = db.scalar(
        select(RoleGrant).where(
            RoleGrant.event_id == event.id,
            RoleGrant.user_id == user.id,
            RoleGrant.role == body.role,
            RoleGrant.entry_id == (entry.id if entry else None),
        )
    )
    if existing:
        return {"data": {"id": str(existing.id)}}
    grant = RoleGrant(
        user_id=user.id,
        organization_id=event.organization_id,
        event_id=event.id,
        role=body.role,
        entry_id=entry.id if entry else None,
        granted_by=principal.user.id,
    )
    db.add(grant)
    db.flush()
    audit(
        db,
        request,
        principal,
        "access.grant",
        event.id,
        grant,
        role=body.role,
        user_id=str(user.id),
    )
    db.commit()
    return {"data": {"id": str(grant.id)}}


@router.delete("/events/{event_id}/access/{grant_id}", status_code=204)
def revoke_event_access(
    event_id: str, grant_id: str, request: Request, db: DB, principal: CurrentPrincipal
):
    event = load_event(db, event_id, include_unpublished=True)
    organization_admin(principal, event)
    grant = db.get(RoleGrant, parse_uuid(grant_id))
    if not grant or grant.event_id != event.id or grant.role == "admin":
        raise HTTPException(404, "Grant not found")
    audit(
        db,
        request,
        principal,
        "access.revoke",
        event.id,
        grant,
        role=grant.role,
        user_id=str(grant.user_id),
    )
    db.delete(grant)
    db.commit()


class CourtIn(BaseModel):
    label: str = Field(min_length=1, max_length=100)
    area_label: str | None = Field(None, max_length=100)


@router.post("/venues/{venue_id}/courts", status_code=201)
def add_court(
    venue_id: str, body: CourtIn, request: Request, db: DB, principal: CurrentPrincipal
):
    venue = get_owned(db, principal, Venue, venue_id)
    if not body.label.strip():
        raise HTTPException(422, "Enter a court label")
    if db.scalar(
        select(Court.id).where(
            Court.venue_id == venue.id, Court.label == body.label.strip()
        )
    ):
        raise HTTPException(409, "That court label is already in use at this venue")
    court = Court(
        venue_id=venue.id, label=body.label.strip(), area_label=body.area_label
    )
    db.add(court)
    db.flush()
    audit(
        db, request, principal, "court.create", venue.event_id, court, label=court.label
    )
    db.commit()
    return {"data": P.court_public(court)}


@router.patch("/courts/{court_id}")
def update_court(
    court_id: str, body: CourtIn, request: Request, db: DB, principal: CurrentPrincipal
):
    court = db.get(Court, parse_uuid(court_id))
    if not court:
        raise HTTPException(404, "Court not found")
    venue = db.get(Venue, court.venue_id)
    staff_event(db, principal, str(venue.event_id))
    if not body.label.strip():
        raise HTTPException(422, "Enter a court label")
    if db.scalar(
        select(Court.id).where(
            Court.venue_id == venue.id,
            Court.label == body.label.strip(),
            Court.id != court.id,
        )
    ):
        raise HTTPException(409, "That court label is already in use at this venue")
    old_label = court.label
    court.label = body.label.strip()
    court.area_label = body.area_label
    audit(
        db,
        request,
        principal,
        "court.update",
        venue.event_id,
        court,
        old_label=old_label,
        label=court.label,
    )
    db.commit()
    return {"data": P.court_public(court)}


@router.get("/events/{event_id}/disputes")
def score_disputes(event_id: str, db: DB, principal: CurrentPrincipal):
    from app.models import ScoreDispute
    event = staff_event(db, principal, event_id)
    rows = db.execute(select(ScoreDispute, Match).join(Match, Match.id == ScoreDispute.match_id).where(Match.event_id == event.id).order_by(ScoreDispute.created_at.desc()).limit(200))
    return {"data": [{"id": str(d.id), "match_id": str(m.id), "match_label": m.external_id, "comment": d.comment, "status": d.status, "created_at": P.iso(d.created_at)} for d, m in rows]}


@router.patch("/disputes/{dispute_id}/resolve")
def resolve_score_dispute(dispute_id: str, request: Request, db: DB, principal: CurrentPrincipal):
    from app.models import ScoreDispute
    dispute = db.get(ScoreDispute, parse_uuid(dispute_id))
    if not dispute:
        raise HTTPException(404, "Dispute not found")
    match = db.get(Match, dispute.match_id)
    event = staff_event(db, principal, str(match.event_id))
    dispute.status = "resolved"
    dispute.resolved_at = utcnow()
    audit(db, request, principal, "score_dispute.resolve", event.id, dispute)
    db.commit()
    return {"data": {"id": str(dispute.id), "status": dispute.status}}
