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
from pydantic import BaseModel, Field, HttpUrl, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.adapters.aes_adapter import Fetch, http_fetch, results_url
from app.api.public import load_event
from app.core.auth import CurrentPrincipal, Principal, require_event_role
from app.core.config import get_settings
from app.core.db import get_db
from app.core.http import parse_uuid
from app.models import (
    Announcement,
    AuditEntry,
    ChangeEvent,
    Court,
    DelayNotice,
    Event,
    EventEntry,
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
from app.modules.clock import clear_demo_time, event_now, jump_demo_time, set_demo_time
from app.modules.delays import (
    active_notices,
    clear_notice,
    is_active,
    post_notice,
    record_change,
)
from app.modules.imports import commit_import, stage_import
from app.modules.matches import (
    MATCH_STATUSES,
    apply_match_state,
    current_state,
    match_load_options,
)
from app.modules.refresh import SourceUnavailable, refresh_source

router = APIRouter(prefix="/v1/admin", tags=["admin"])
DB = Annotated[Session, Depends(get_db)]
STAFF = {"staff"}


def audit(db: Session, request: Request, principal: Principal, action: str, event_id, target, old=None, new=None, **summary):
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
        raise HTTPException(status.HTTP_409_CONFLICT, "Someone else changed this. Reload and try again.")


def staff_event(db: Session, principal: Principal, event_id: str) -> Event:
    event = load_event(db, event_id, include_unpublished=True)
    require_event_role(principal, event.id, STAFF)
    return event


def get_owned(db: Session, principal: Principal, model, obj_id: str):
    obj = db.get(model, parse_uuid(obj_id))
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    event_id = obj.event_id if hasattr(obj, "event_id") else None
    if model is RosterPublication:
        event_id = db.get(EventEntry, obj.entry_id).event_id
    if model is Venue or model is Source:
        event_id = obj.event_id
    require_event_role(principal, event_id, STAFF)
    return obj


# ---- identity ---------------------------------------------------------------


@router.get("/me")
def me(principal: CurrentPrincipal) -> dict:
    return {
        "user_id": str(principal.user.id),
        "subject": principal.user.clerk_subject,
        "grants": [
            {"role": g.role, "event_id": str(g.event_id) if g.event_id else None, "expires_at": P.iso(g.expires_at)}
            for g in principal.grants
        ],
        "is_staff": any(g.role in ("admin", "staff") for g in principal.grants),
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
    return {"data": [P.event_public(e) for e in events if principal.has_role(STAFF, e.id)]}


@router.post("/events", status_code=201)
def create_event(body: EventIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    if not principal.has_role(set()):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only organization admins can create events")
    if body.end_date < body.start_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "End date is before start date")
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
    entries = db.scalars(select(EventEntry).where(EventEntry.event_id == event.id).order_by(EventEntry.team_name))
    return {
        "data": {
            **P.event_public(event),
            "venues": [P.venue_public(v) for v in event.venues],
            "sources": [{**P.source_public(s), "generation": s.generation} for s in event.sources],
            "entries": [{"id": str(e.id), "team_name": e.team_name, "club_name": e.club_name} for e in entries],
        }
    }


@router.patch("/events/{event_id}")
def update_event(event_id: str, body: EventPatch, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    check_revision(event.revision, body.expected_revision)
    old = event.revision
    for key, value in body.model_dump(exclude_unset=True, exclude={"expected_revision"}).items():
        setattr(event, key, value)
    event.revision += 1
    audit(db, request, principal, "event.update", event.id, event, old, event.revision)
    db.commit()
    return {"data": P.event_public(event)}


class VenueIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    address: str | None = None
    accessible_entrance: str | None = None
    directions: str | None = None
    map_url: HttpUrl | None = None
    sort: int = 0


@router.post("/events/{event_id}/venues", status_code=201)
def create_venue(event_id: str, body: VenueIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    venue = Venue(event_id=event.id, **{**body.model_dump(), "map_url": str(body.map_url) if body.map_url else None})
    db.add(venue)
    db.flush()
    audit(db, request, principal, "venue.create", event.id, venue)
    db.commit()
    db.refresh(venue)
    return {"data": P.venue_public(venue)}


@router.patch("/venues/{venue_id}")
def update_venue(venue_id: str, body: VenueIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    venue = get_owned(db, principal, Venue, venue_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(venue, key, str(value) if key == "map_url" and value else value)
    audit(db, request, principal, "venue.update", venue.event_id, venue)
    db.commit()
    return {"data": P.venue_public(venue)}


class CourtIn(BaseModel):
    area: str | None = Field(None, max_length=100)


@router.patch("/courts/{court_id}")
def update_court(court_id: str, body: CourtIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    court = db.get(Court, parse_uuid(court_id))
    if court is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    require_event_role(principal, court.venue.event_id, STAFF)
    before = court.area
    court.area = (body.area or "").strip() or None
    audit(db, request, principal, "court.update", court.venue.event_id, court, area=[before, court.area])
    db.commit()
    return {"data": P.court_public(court)}


class DelayNoticeIn(BaseModel):
    minutes: int = Field(ge=1, le=600)
    duration_minutes: int = Field(60, ge=5, le=24 * 60)


def _post_delay(db: Session, request: Request, principal: Principal, event: Event, court: Court, body: DelayNoticeIn) -> DelayNotice:
    notice, replaced = post_notice(
        db, event, court.id, body.minutes, body.duration_minutes, principal.user.id, event_now(event)
    )
    audit(
        db, request, principal, "delay_notice.post", event.id, notice,
        court=court.label, minutes=notice.minutes, expires_at=P.iso(notice.expires_at),
        replaced=str(replaced.id) if replaced else None,
    )
    record_change(db, notice, "delay_posted", 1)
    return notice


@router.post("/courts/{court_id}/delay-notices", status_code=201)
def post_delay_notice(court_id: str, body: DelayNoticeIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    court = db.get(Court, parse_uuid(court_id))
    if court is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    require_event_role(principal, court.venue.event_id, STAFF)
    notice = _post_delay(db, request, principal, db.get(Event, court.venue.event_id), court, body)
    db.commit()
    return {"data": P.delay_notice_public(notice)}


class AreaDelayIn(DelayNoticeIn):
    area: str = Field(min_length=1, max_length=100)


@router.post("/venues/{venue_id}/delay-notices", status_code=201)
def post_area_delay_notices(venue_id: str, body: AreaDelayIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    """One notice per court in the venue's area, each clearable on its own."""
    venue = get_owned(db, principal, Venue, venue_id)
    area = body.area.strip().casefold()
    courts = sorted((c for c in venue.courts if c.area and c.area.strip().casefold() == area), key=lambda c: c.label)
    if not courts:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No courts in that area")
    event = db.get(Event, venue.event_id)
    notices = [_post_delay(db, request, principal, event, court, body) for court in courts]
    db.commit()
    return {"data": [{**P.delay_notice_public(n), "court": P.court_public(n.court)} for n in notices]}


@router.get("/events/{event_id}/delay-notices")
def list_delay_notices(event_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    notices = active_notices(db, event.id, event_now(event)).values()
    return {"data": [{**P.delay_notice_public(n), "court": P.court_public(n.court)} for n in notices]}


@router.post("/delay-notices/{notice_id}/clear")
def clear_delay_notice(notice_id: str, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    notice = get_owned(db, principal, DelayNotice, notice_id)
    event = db.get(Event, notice.event_id)
    now = event_now(event)
    if is_active(notice, now):
        clear_notice(notice, principal.user.id, now)
        audit(db, request, principal, "delay_notice.clear", event.id, notice, court=notice.court.label, minutes=notice.minutes)
        record_change(db, notice, "delay_cleared", 2)
        db.commit()
    return {"data": P.delay_notice_public(notice)}


EVENT_KEY = Field(None, min_length=8, max_length=300, pattern=r"^[A-Za-z0-9_-]+$")


class SourceIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    mode: Literal["manual_import", "demo_fixture", "aes", "timu", "myteam"] = "manual_import"
    official_url: HttpUrl | None = None
    external_key: str | None = EVENT_KEY
    expected_check_interval_minutes: int = Field(15, ge=1, le=1440)

    @model_validator(mode="after")
    def aes_needs_key(self):
        if self.mode == "aes" and not self.external_key:
            raise ValueError("An AES source needs its AES event key")
        return self


class SourcePatch(BaseModel):
    status: Literal["active", "paused", "unavailable"] | None = None
    official_url: HttpUrl | None = None
    external_key: str | None = EVENT_KEY
    expected_check_interval_minutes: int | None = Field(None, ge=1, le=1440)


@router.post("/events/{event_id}/sources", status_code=201)
def create_source(event_id: str, body: SourceIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    data = body.model_dump()
    data["official_url"] = str(body.official_url) if body.official_url else None
    if body.mode == "aes" and not data["official_url"]:
        data["official_url"] = results_url(body.external_key)
    source = Source(event_id=event.id, **data)
    db.add(source)
    db.flush()
    audit(db, request, principal, "source.create", event.id, source, mode=source.mode)
    db.commit()
    return {"data": P.source_public(source)}


@router.patch("/sources/{source_id}")
def update_source(source_id: str, body: SourcePatch, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    source = get_owned(db, principal, Source, source_id)
    before = source.status
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(source, key, str(value) if key == "official_url" and value else value)
    audit(db, request, principal, "source.update", source.event_id, source, status=[before, source.status])
    db.commit()
    return {"data": P.source_public(source)}


@router.get("/sources/{source_id}/health")
def source_health(source_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    source = get_owned(db, principal, Source, source_id)
    batches = db.scalars(
        select(ImportBatch).where(ImportBatch.source_id == source.id).order_by(ImportBatch.created_at.desc()).limit(10)
    )
    return {
        "data": {
            **P.source_public(source),
            "generation": source.generation,
            "last_check_error": source.last_check_error,
            "recent_imports": [_batch_summary(b) for b in batches],
        }
    }


def aes_fetch() -> Fetch:
    return http_fetch


class RefreshIn(BaseModel):
    kind: Literal["entries", "matches"] = "entries"


@router.post("/sources/{source_id}/refresh", status_code=201)
def refresh(
    source_id: str,
    body: RefreshIn,
    db: DB,
    principal: CurrentPrincipal,
    fetch: Annotated[Fetch, Depends(aes_fetch)],
) -> dict:
    """Read a live source and stage the result for the same preview and commit as an upload."""
    source = get_owned(db, principal, Source, source_id)
    event = db.get(Event, source.event_id)
    try:
        batch = refresh_source(db, event=event, source=source, kind=body.kind, fetch=fetch, actor_id=principal.user.id)
    except SourceUnavailable as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"{exc}. The last committed data is still shown.") from exc
    return {"data": {**_batch_summary(batch), "errors": batch.errors, "rows": batch.rows}}


# ---- imports ---------------------------------------------------------------------


def _batch_summary(batch: ImportBatch) -> dict[str, Any]:
    return {
        "id": str(batch.id),
        "kind": batch.kind,
        "filename": batch.filename,
        "state": batch.state,
        "summary": batch.summary,
        "error_count": len(batch.errors) + sum(1 for r in batch.rows if r["action"] == "error"),
        "created_at": P.iso(batch.created_at),
        "committed_at": P.iso(batch.committed_at),
    }


@router.post("/imports", status_code=201)
async def upload_import(
    db: DB,
    principal: CurrentPrincipal,
    event_id: Annotated[str, Form()],
    source_id: Annotated[str, Form()],
    kind: Annotated[Literal["entries", "matches", "rosters"], Form()],
    file: Annotated[UploadFile, File()],
    strict: Annotated[bool, Form()] = True,
    consent_review_ref: Annotated[str | None, Form(max_length=200)] = None,
) -> dict:
    event = staff_event(db, principal, event_id)
    source = db.get(Source, parse_uuid(source_id, "source"))
    if source is None or source.event_id != event.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source not found for this event")
    content = await file.read()
    batch = stage_import(
        db,
        event=event,
        source=source,
        kind=kind,
        filename=file.filename,
        content=content,
        options={"strict": strict, "consent_review_ref": consent_review_ref or None},
        actor_id=principal.user.id,
    )
    return {"data": {**_batch_summary(batch), "errors": batch.errors, "rows": batch.rows}}


@router.get("/imports/{batch_id}")
def get_import(batch_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    batch = get_owned(db, principal, ImportBatch, batch_id)
    return {"data": {**_batch_summary(batch), "errors": batch.errors, "rows": batch.rows}}


@router.post("/imports/{batch_id}/commit")
def commit(batch_id: str, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    get_owned(db, principal, ImportBatch, batch_id)
    batch = commit_import(db, parse_uuid(batch_id), principal.user.id, request.state.request_id)
    return {"data": _batch_summary(batch)}


@router.get("/events/{event_id}/imports")
def list_imports(event_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    batches = db.scalars(
        select(ImportBatch).where(ImportBatch.event_id == event.id).order_by(ImportBatch.created_at.desc()).limit(50)
    )
    return {"data": [_batch_summary(b) for b in batches]}


# ---- announcements -----------------------------------------------------------------


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=1, max_length=4000)
    category: Literal["general", "schedule", "venue", "safety"] = "general"
    entry_id: uuid.UUID | None = None
    division_id: uuid.UUID | None = None
    expire_at: datetime | None = None


class AnnouncementPatch(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=200)
    body: str | None = Field(None, min_length=1, max_length=4000)
    category: Literal["general", "schedule", "venue", "safety"] | None = None
    expire_at: datetime | None = None
    expected_revision: int | None = None


@router.get("/events/{event_id}/announcements")
def admin_announcements(event_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    rows = db.scalars(
        select(Announcement).where(Announcement.event_id == event.id).order_by(Announcement.created_at.desc())
    )
    return {"data": [P.announcement_admin(a) for a in rows]}


@router.post("/events/{event_id}/announcements", status_code=201)
def create_announcement(event_id: str, body: AnnouncementIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    if body.entry_id:
        entry = db.get(EventEntry, body.entry_id)
        if entry is None or entry.event_id != event.id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Team is not in this event")
    a = Announcement(event_id=event.id, created_by=principal.user.id, **body.model_dump())
    db.add(a)
    db.flush()
    audit(db, request, principal, "announcement.create", event.id, a, new=1)
    db.commit()
    return {"data": P.announcement_admin(a)}


@router.patch("/announcements/{announcement_id}")
def update_announcement(
    announcement_id: str, body: AnnouncementPatch, request: Request, db: DB, principal: CurrentPrincipal
) -> dict:
    a = get_owned(db, principal, Announcement, announcement_id)
    check_revision(a.revision, body.expected_revision)
    old = a.revision
    for key, value in body.model_dump(exclude_unset=True, exclude={"expected_revision"}).items():
        setattr(a, key, value)
    a.revision += 1
    audit(db, request, principal, "announcement.update", a.event_id, a, old, a.revision)
    db.commit()
    return {"data": P.announcement_admin(a)}


@router.post("/announcements/{announcement_id}/publish")
def publish_announcement(announcement_id: str, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    a = get_owned(db, principal, Announcement, announcement_id)
    if a.state == "published":
        return {"data": P.announcement_admin(a)}
    old = a.revision
    a.state = "published"
    a.publish_at = utcnow()
    a.revision += 1
    db.add(
        ChangeEvent(
            event_id=a.event_id,
            entity_type="announcement",
            entity_id=a.id,
            entity_revision=a.revision,
            event_type="announcement_published",
            diff={"title": a.title, "category": a.category},
            entry_ids=[str(a.entry_id)] if a.entry_id else [],
        )
    )
    audit(db, request, principal, "announcement.publish", a.event_id, a, old, a.revision)
    db.commit()
    return {"data": P.announcement_admin(a)}


@router.post("/announcements/{announcement_id}/archive")
def archive_announcement(announcement_id: str, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    a = get_owned(db, principal, Announcement, announcement_id)
    old = a.revision
    a.state = "archived"
    a.revision += 1
    audit(db, request, principal, "announcement.archive", a.event_id, a, old, a.revision)
    db.commit()
    return {"data": P.announcement_admin(a)}


# ---- guide content and partners ---------------------------------------------------


class GuideItemIn(BaseModel):
    kind: Literal["parking", "food", "accessibility", "directions", "services", "help", "officials"]
    title: str = Field(min_length=2, max_length=200)
    body: str = Field("", max_length=4000)
    link_url: HttpUrl | None = None
    venue_id: uuid.UUID | None = None
    sort: int = 0


class PartnerIn(BaseModel):
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
        data = self.model_dump()
        if self.link_url and self.link_url.scheme != "https":
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Partner links must use https")
        data["link_url"] = str(self.link_url) if self.link_url else None
        return data


def _guide_data(body: GuideItemIn) -> dict:
    data = body.model_dump()
    data["link_url"] = str(body.link_url) if body.link_url else None
    return data


@router.post("/events/{event_id}/guide-items", status_code=201)
def create_guide_item(event_id: str, body: GuideItemIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    item = GuideItem(event_id=event.id, **_guide_data(body))
    db.add(item)
    db.flush()
    audit(db, request, principal, "guide.create", event.id, item, new=1)
    db.commit()
    return {"data": P.guide_item_public(item)}


@router.put("/guide-items/{item_id}")
def update_guide_item(item_id: str, body: GuideItemIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    item = get_owned(db, principal, GuideItem, item_id)
    old = item.revision
    for key, value in _guide_data(body).items():
        setattr(item, key, value)
    item.revision += 1
    audit(db, request, principal, "guide.update", item.event_id, item, old, item.revision)
    db.commit()
    return {"data": P.guide_item_public(item)}


@router.delete("/guide-items/{item_id}", status_code=204)
def delete_guide_item(item_id: str, request: Request, db: DB, principal: CurrentPrincipal) -> None:
    item = get_owned(db, principal, GuideItem, item_id)
    audit(db, request, principal, "guide.delete", item.event_id, item, item.revision)
    db.delete(item)
    db.commit()


@router.get("/events/{event_id}/partners")
def admin_partners(event_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    rows = db.scalars(select(PartnerCard).where(PartnerCard.event_id == event.id).order_by(PartnerCard.sort))
    return {"data": [P.partner_public(p) for p in rows]}


@router.post("/events/{event_id}/partners", status_code=201)
def create_partner(event_id: str, body: PartnerIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    card = PartnerCard(event_id=event.id, **body.clean())
    db.add(card)
    db.flush()
    audit(db, request, principal, "partner.create", event.id, card, new=1)
    db.commit()
    return {"data": P.partner_public(card)}


@router.put("/partners/{partner_id}")
def update_partner(partner_id: str, body: PartnerIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    card = get_owned(db, principal, PartnerCard, partner_id)
    old = card.revision
    for key, value in body.clean().items():
        setattr(card, key, value)
    card.revision += 1
    audit(db, request, principal, "partner.update", card.event_id, card, old, card.revision)
    db.commit()
    return {"data": P.partner_public(card)}


@router.delete("/partners/{partner_id}", status_code=204)
def delete_partner(partner_id: str, request: Request, db: DB, principal: CurrentPrincipal) -> None:
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
        "published_at": P.iso(r.published_at),
        "created_at": P.iso(r.created_at),
    }


class PublishRosterIn(BaseModel):
    consent_review_ref: str = Field(min_length=2, max_length=200)


@router.get("/entries/{entry_id}/rosters")
def entry_rosters(entry_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    entry = get_owned(db, principal, EventEntry, entry_id)
    rows = db.scalars(
        select(RosterPublication).where(RosterPublication.entry_id == entry.id).order_by(RosterPublication.version.desc())
    )
    return {"data": [_roster_admin(r) for r in rows]}


@router.post("/rosters/{roster_id}/publish")
def publish_roster(roster_id: str, body: PublishRosterIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    roster = get_owned(db, principal, RosterPublication, roster_id)
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
    audit(db, request, principal, "roster.publish", event_id, roster, new=roster.version)
    db.commit()
    return {"data": _roster_admin(roster)}


@router.post("/rosters/{roster_id}/withdraw")
def withdraw_roster(roster_id: str, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
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
def simulate_change(event_id: str, body: SimulateIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    """Demo events only: apply a pretend source change through the real revision pipeline."""
    event = staff_event(db, principal, event_id)
    if not event.is_demo:
        raise HTTPException(status.HTTP_409_CONFLICT, "Simulated changes are only allowed on demo events")
    match = db.scalar(select(Match).where(Match.id == body.match_id, Match.event_id == event.id).options(*match_load_options()))
    if match is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found")
    state = current_state(match)
    if body.court_label:
        venue_id = body.venue_id or (match.court.venue_id if match.court else None)
        if venue_id is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose a venue for the new court")
        court = db.scalar(select(Court).where(Court.venue_id == venue_id, Court.label == body.court_label))
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
    audit(db, request, principal, "match.simulate", event.id, match, old, match.revision, events=[c.event_type for c in changes])
    event.revision += 1
    db.commit()
    return {"data": {"revision": match.revision, "change_events": [c.event_type for c in changes]}}


# ---- demo clock ------------------------------------------------------------------------


class DemoTimeIn(BaseModel):
    demo_time: datetime


class DemoJumpIn(BaseModel):
    minutes: int = Field(15, ge=1, le=24 * 60)


def demo_clock_event(db: Session, principal: Principal, event_id: str) -> Event:
    event = staff_event(db, principal, event_id)
    if not get_settings().demo_mode:
        raise HTTPException(status.HTTP_409_CONFLICT, "Demo time is only available when the API runs in demo mode")
    return event


@router.put("/events/{event_id}/demo-clock")
def set_demo_clock(event_id: str, body: DemoTimeIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    event = demo_clock_event(db, principal, event_id)
    if body.demo_time.tzinfo is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Demo time needs a time zone offset")
    set_demo_time(event, body.demo_time)
    audit(db, request, principal, "event.demo_time.set", event.id, event, demo_time=body.demo_time.isoformat())
    db.commit()
    return {"data": P.event_public(event)}


@router.post("/events/{event_id}/demo-clock/jump")
def jump_demo_clock(event_id: str, body: DemoJumpIn, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    event = demo_clock_event(db, principal, event_id)
    if event.demo_time is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Set a demo time first")
    jump_demo_time(event, body.minutes)
    audit(db, request, principal, "event.demo_time.jump", event.id, event, minutes=body.minutes)
    db.commit()
    return {"data": P.event_public(event)}


@router.delete("/events/{event_id}/demo-clock")
def clear_demo_clock(event_id: str, request: Request, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    clear_demo_time(event)
    audit(db, request, principal, "event.demo_time.clear", event.id, event)
    db.commit()
    return {"data": P.event_public(event)}


# ---- audit -------------------------------------------------------------------------------


@router.get("/events/{event_id}/audit")
def audit_log(event_id: str, db: DB, principal: CurrentPrincipal) -> dict:
    event = staff_event(db, principal, event_id)
    rows = db.scalars(
        select(AuditEntry).where(AuditEntry.event_id == event.id).order_by(AuditEntry.id.desc()).limit(100)
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
