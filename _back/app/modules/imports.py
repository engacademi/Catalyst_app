"""Staged CSV imports: validate and preview, then commit atomically.

Rules from the implementation spec:
- Identifiers resolve through external mappings; no team is matched by a similar name.
- Imports are partial: a missing row never cancels a match.
- Commit checks the source generation recorded at preview, so a stale preview is refused.
- Replaying an identical file changes nothing and emits no change events.
"""

import hashlib
import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.adapters.csv_adapter import ADAPTERS
from app.core.config import get_settings
from app.models import (
    AuditEntry,
    Court,
    Division,
    Event,
    EventEntry,
    ExternalMapping,
    ImportBatch,
    Match,
    RosterPublication,
    Source,
    Venue,
    utcnow,
)
from app.modules.operations import stage_assignments, commit_assignments
from app.modules.matches import (
    MatchState,
    Slot,
    apply_match_state,
    changed_fields,
    current_state,
)


def _mapping(
    db: Session, source_id: uuid.UUID, entity_type: str, external_id: str
) -> uuid.UUID | None:
    return db.scalar(
        select(ExternalMapping.canonical_id).where(
            ExternalMapping.source_id == source_id,
            ExternalMapping.entity_type == entity_type,
            ExternalMapping.external_id == external_id,
        )
    )


def _division(db: Session, event_id: uuid.UUID, name: str) -> Division | None:
    return db.scalar(
        select(Division).where(Division.event_id == event_id, Division.name == name)
    )


def _venue(db: Session, event_id: uuid.UUID, name: str) -> Venue | None:
    return db.scalar(
        select(Venue).where(Venue.event_id == event_id, Venue.name == name)
    )


def _court(db: Session, venue_id: uuid.UUID, label: str) -> Court | None:
    return db.scalar(
        select(Court).where(Court.venue_id == venue_id, Court.label == label)
    )


def _dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def stage_import(
    db: Session,
    *,
    event: Event,
    source: Source,
    kind: str,
    filename: str | None,
    content: bytes,
    options: dict[str, Any],
    actor_id: uuid.UUID | None,
) -> ImportBatch:
    settings = get_settings()
    if len(content) > settings.import_max_bytes:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "File is larger than 5 MB"
        )
    adapter = ADAPTERS.get("manual_import")
    if adapter is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Source mode {source.mode} has no import adapter",
        )

    parsed = adapter.parse(
        kind, content, timezone=event.timezone, strict=options.get("strict", True)
    )
    errors = list(parsed.errors)
    if len(parsed.rows) > settings.import_max_rows:
        errors.append(f"File has more than {settings.import_max_rows} rows")

    staged: list[dict[str, Any]] = []
    if not errors:
        staged = {
            "entries": _stage_entries,
            "matches": _stage_matches,
            "rosters": lambda db, event, source, rows: _stage_rosters(
                db, event, source, rows, options
            ),
            "assignments": stage_assignments,
        }[kind](db, event, source, parsed.rows)

    file_hash = hashlib.sha256(content).hexdigest()
    previous = db.scalar(
        select(ImportBatch.id).where(
            ImportBatch.source_id == source.id,
            ImportBatch.kind == kind,
            ImportBatch.file_hash == file_hash,
            ImportBatch.state == "committed",
        )
    )
    counts: dict[str, int] = {"add": 0, "change": 0, "unchanged": 0, "error": 0}
    for row in staged:
        counts[row["action"]] += 1
    batch = ImportBatch(
        event_id=event.id,
        source_id=source.id,
        kind=kind,
        filename=filename,
        file_hash=file_hash,
        expected_source_generation=source.generation,
        rows=staged,
        errors=errors,
        options=options,
        created_by=actor_id,
        summary={
            **counts,
            "warnings": parsed.warnings,
            "identical_to_batch": str(previous) if previous else None,
        },
    )
    db.add(batch)
    db.commit()
    return batch


def _row(
    parsed,
    action: str,
    changes: list[str] | None = None,
    extra_errors: list[str] | None = None,
    **data,
):
    errs = parsed.errors + (extra_errors or [])
    return {
        "row": parsed.row,
        "external_id": parsed.external_id,
        "action": "error" if errs else action,
        "changes": changes or [],
        "errors": errs,
        "data": {**parsed.data, **data},
    }


def _stage_entries(db: Session, event: Event, source: Source, rows) -> list[dict]:
    out = []
    for parsed in rows:
        entry_id = _mapping(db, source.id, "entry", parsed.external_id)
        entry = db.get(EventEntry, entry_id) if entry_id else None
        if entry is None:
            out.append(_row(parsed, "add"))
            continue
        changes = []
        if entry.team_name != parsed.data["team_name"]:
            changes.append("team_name")
        if entry.club_name != parsed.data["club_name"]:
            changes.append("club_name")
        if (entry.division.name if entry.division else None) != parsed.data["division"]:
            changes.append("division")
        out.append(
            _row(
                parsed,
                "change" if changes else "unchanged",
                changes,
                entry_id=str(entry.id),
            )
        )
    return out


def _stage_matches(db: Session, event: Event, source: Source, rows) -> list[dict]:
    out = []
    for parsed in rows:
        d = parsed.data
        errors: list[str] = []
        division = _division(db, event.id, d["division"]) if d["division"] else None
        if d["division"] and division is None:
            errors.append(f"unknown division '{d['division']}'; import entries first")
        venue = _venue(db, event.id, d["venue"]) if d["venue"] else None
        if d["venue"] and venue is None:
            errors.append(
                f"unknown venue '{d['venue']}'; add it in Event content first"
            )
        court = _court(db, venue.id, d["court"]) if venue and d["court"] else None
        slots = {}
        for slot in ("home", "away"):
            ext = d[f"{slot}_entry_id"]
            entry_id = _mapping(db, source.id, "entry", ext) if ext else None
            if ext and entry_id is None:
                errors.append(f"unknown {slot}_entry_id '{ext}'; import entries first")
            slots[slot] = str(entry_id) if entry_id else None

        if d.get("work_entry_id") and not _mapping(
            db, source.id, "entry", d["work_entry_id"]
        ):
            errors.append("Unknown work_entry_id; import entries first")
        existing = db.scalar(
            select(Match).where(
                Match.source_id == source.id, Match.external_id == parsed.external_id
            )
        )
        extra = {
            "division_id": str(division.id) if division else None,
            "venue_id": str(venue.id) if venue else None,
            "court_id": str(court.id) if court else None,
            "new_court": bool(venue and d["court"] and court is None),
            "home_canonical": slots["home"],
            "away_canonical": slots["away"],
        }
        if errors or existing is None:
            out.append(_row(parsed, "add", extra_errors=errors, **extra))
            continue
        incoming_time = _dt(d.get("source_updated_at"))
        if (
            incoming_time
            and existing.source_updated_at
            and incoming_time < existing.source_updated_at
        ):
            out.append(
                _row(
                    parsed,
                    "error",
                    extra_errors=["Older source payload; current match preserved"],
                    **extra,
                )
            )
            continue
        after = _match_state({**d, **extra}, court_id=court.id if court else None)
        changes = changed_fields(current_state(existing), after)
        if existing.work_entry_id != (
            _mapping(db, source.id, "entry", d["work_entry_id"])
            if d.get("work_entry_id")
            else None
        ):
            changes.append("work_team")
        if d.get("court_area") and court and court.area_label != d["court_area"]:
            changes.append("court_area")
        if extra["new_court"]:
            changes.append("court_id")
        out.append(
            _row(
                parsed,
                "change" if changes else "unchanged",
                sorted(set(changes)),
                match_id=str(existing.id),
                **extra,
            )
        )
    return out


def _match_state(data: dict, court_id: uuid.UUID | None) -> MatchState:
    def slot(name: str) -> Slot:
        canonical = data.get(f"{name}_canonical")
        return Slot(
            uuid.UUID(canonical) if canonical else None, data.get(f"{name}_placeholder")
        )

    return MatchState(
        division_id=uuid.UUID(data["division_id"]) if data.get("division_id") else None,
        court_id=court_id,
        round_label=data.get("round"),
        scheduled_start=_dt(data.get("scheduled_start")),
        estimated_start=_dt(data.get("estimated_start")),
        status=data["status"],
        home=slot("home"),
        away=slot("away"),
        sets=[tuple(s) for s in data.get("sets", [])],
        source_revision=data.get("source_revision"),
        source_updated_at=_dt(data.get("source_updated_at")),
    )


def _latest_roster(
    db: Session, entry_id: uuid.UUID, published_only: bool = True
) -> RosterPublication | None:
    stmt = select(RosterPublication).where(RosterPublication.entry_id == entry_id)
    if published_only:
        stmt = stmt.where(RosterPublication.state == "published")
    return db.scalar(stmt.order_by(RosterPublication.version.desc()).limit(1))


def _stage_rosters(
    db: Session, event: Event, source: Source, rows, options=None
) -> list[dict]:
    groups: dict[str, list] = {}
    for parsed in rows:
        groups.setdefault(parsed.external_id, []).append(parsed)
    out = []
    for external_id, members in groups.items():
        errors = [f"row {p.row}: {e}" for p in members for e in p.errors]
        jerseys = [p.data["jersey"] for p in members if p.data["jersey"] is not None]
        if len(jerseys) != len(set(jerseys)):
            errors.append("jersey numbers repeat within the team")
        mapped = (options or {}).get("team_mapping", {}).get(external_id)
        entry_id = (
            uuid.UUID(mapped)
            if mapped
            else (
                _mapping(db, source.id, "entry", external_id) if external_id else None
            )
        )
        if entry_id and not db.scalar(
            select(EventEntry.id).where(
                EventEntry.id == entry_id, EventEntry.event_id == event.id
            )
        ):
            entry_id = None
        if external_id and entry_id is None:
            errors.append(
                f"unknown external_entry_id '{external_id}'; import entries first"
            )
        players = sorted(
            (
                {
                    k: p.data[k]
                    for k in ("jersey", "display_name", "position", "photo_url")
                }
                for p in members
                if not p.errors
            ),
            key=lambda p: (p["jersey"] is None, p["jersey"]),
        )
        team_photo = next(
            (p.data["team_photo_url"] for p in members if p.data.get("team_photo_url")),
            None,
        )
        withheld = sum(1 for p in members if p.data.get("photo_withheld"))
        row = {
            "row": members[0].row,
            "external_id": external_id,
            "action": "error" if errors else "add",
            "changes": [],
            "errors": errors,
            "data": {
                "entry_id": str(entry_id) if entry_id else None,
                "players": players,
                "team_photo_url": team_photo,
                "photos_withheld": withheld,
            },
        }
        if not errors:
            current = _latest_roster(db, entry_id)
            if current:
                same = (
                    current.public_players == players
                    and current.team_photo_url == team_photo
                )
                row["action"] = "unchanged" if same else "change"
                row["changes"] = [] if same else ["players"]
        out.append(row)
    return out


def commit_import(
    db: Session, batch_id: uuid.UUID, actor_id: uuid.UUID | None, request_id: str | None
) -> ImportBatch:
    batch = db.scalar(
        select(ImportBatch).where(ImportBatch.id == batch_id).with_for_update()
    )
    if batch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Import not found")
    if batch.state == "committed":
        return batch  # Retrying a commit is safe.
    if batch.state != "staged":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Import is {batch.state}")
    if batch.errors or any(r["action"] == "error" for r in batch.rows):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Fix the errors and upload again before committing",
        )

    source = db.scalar(
        select(Source).where(Source.id == batch.source_id).with_for_update()
    )
    if source.generation != batch.expected_source_generation:
        batch.state = "rejected"
        batch.summary = {
            **batch.summary,
            "rejected_reason": "source changed since preview",
        }
        db.commit()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "The source changed since this preview. Upload the file again.",
        )
    event = db.get(Event, batch.event_id)

    changes = {
        "entries": _commit_entries,
        "matches": _commit_matches,
        "rosters": _commit_rosters,
        "assignments": commit_assignments,
    }[batch.kind](db, event, source, batch, actor_id)

    now = utcnow()
    source.config = {**source.config, "last_sync_success": False}
    source.generation += 1
    source.last_import_at = now
    source.last_successful_check_at = now
    upstream = [
        r["data"].get("source_updated_at")
        for r in batch.rows
        if r["data"].get("source_updated_at")
    ]
    if upstream:
        source.upstream_updated_at = max(datetime.fromisoformat(u) for u in upstream)
    event.revision += 1
    batch.state = "committed"
    batch.committed_at = now
    batch.summary = {**batch.summary, "change_events": changes}
    db.add(
        AuditEntry(
            actor_user_id=actor_id,
            action=f"import.{batch.kind}.commit",
            event_id=event.id,
            target_type="import_batch",
            target_id=str(batch.id),
            old_revision=batch.expected_source_generation,
            new_revision=source.generation,
            request_id=request_id,
            summary={
                k: batch.summary.get(k)
                for k in ("add", "change", "unchanged", "change_events")
            },
        )
    )
    db.commit()
    return batch


def _commit_entries(
    db: Session, event: Event, source: Source, batch: ImportBatch, actor_id
) -> int:
    # Synthetic demo events derive ids from the external ids, so a rebuilt demo keeps the
    # team and division ids that devices already follow.
    namespace = batch.options.get("id_namespace")
    stable = (lambda key: uuid.uuid5(uuid.UUID(namespace), key)) if namespace else None
    for row in batch.rows:
        if row["action"] == "unchanged":
            continue
        d = row["data"]
        division = _division(db, event.id, d["division"])
        if division is None:
            division = Division(
                event_id=event.id, name=d["division"], code=d.get("division_code")
            )
            if stable:
                division.id = stable(f"division:{d['division']}")
            db.add(division)
            db.flush()
        if row["action"] == "add":
            entry = EventEntry(
                id=stable(f"entry:{row['external_id']}") if stable else uuid.uuid4(),
                event_id=event.id,
                team_name=d["team_name"],
                club_name=d["club_name"],
                division_id=division.id,
            )
            db.add(entry)
            db.flush()
            db.add(
                ExternalMapping(
                    source_id=source.id,
                    entity_type="entry",
                    external_id=row["external_id"],
                    canonical_id=entry.id,
                )
            )
            continue
        entry = db.get(EventEntry, uuid.UUID(d["entry_id"]))
        entry.team_name = d["team_name"]
        entry.club_name = d["club_name"]
        entry.division_id = division.id
    return 0


def _commit_matches(
    db: Session, event: Event, source: Source, batch: ImportBatch, actor_id
) -> int:
    emitted = 0
    for row in batch.rows:
        if row["action"] == "unchanged":
            continue
        d = row["data"]
        court_id = uuid.UUID(d["court_id"]) if d.get("court_id") else None
        if d.get("new_court"):
            venue_id = uuid.UUID(d["venue_id"])
            court = _court(db, venue_id, d["court"])
            if court is None:
                court = Court(venue_id=venue_id, label=d["court"])
                db.add(court)
                db.flush()
            court_id = court.id
        state = _match_state(d, court_id)
        if court_id and d.get("court_area"):
            db.get(Court, court_id).area_label = d["court_area"]
        if row["action"] == "add":
            match = Match(
                event_id=event.id, source_id=source.id, external_id=row["external_id"]
            )
            db.add(match)
            db.flush()
            apply_match_state(db, match, state, is_new=True)
        else:
            match = db.get(Match, uuid.UUID(d["match_id"]))
            emitted += len(apply_match_state(db, match, state, simulated=event.is_demo))
        work_id = (
            _mapping(db, source.id, "entry", d["work_entry_id"])
            if d.get("work_entry_id")
            else None
        )
        if match.work_entry_id != work_id:
            match.work_entry_id = work_id
            if row["action"] != "add":
                from app.models import ChangeEvent

                match.revision += 1
                db.add(
                    ChangeEvent(
                        event_id=event.id,
                        entity_type="match",
                        entity_id=match.id,
                        entity_revision=match.revision,
                        event_type="work_assigned",
                        entry_ids=[str(work_id)] if work_id else [],
                        diff={"work_entry_id": str(work_id) if work_id else None},
                        simulated=event.is_demo,
                    )
                )
                emitted += 1
    return emitted


def _commit_rosters(
    db: Session, event: Event, source: Source, batch: ImportBatch, actor_id
) -> int:
    review_ref = batch.options.get("consent_review_ref")
    for row in batch.rows:
        if row["action"] == "unchanged":
            continue
        d = row["data"]
        entry_id = uuid.UUID(d["entry_id"])
        latest_version = db.scalar(
            select(func.max(RosterPublication.version)).where(
                RosterPublication.entry_id == entry_id
            )
        )
        if review_ref:
            for old in db.scalars(
                select(RosterPublication).where(
                    RosterPublication.entry_id == entry_id,
                    RosterPublication.state == "published",
                )
            ):
                old.state = "superseded"
        db.add(
            RosterPublication(
                entry_id=entry_id,
                version=(latest_version or 0) + 1,
                # Without a recorded consent review the roster stays a draft and isn't public.
                state="published"
                if review_ref and not batch.options.get("require_review")
                else "draft",
                public_players=d["players"],
                team_photo_url=d.get("team_photo_url"),
                consent_review_ref=review_ref,
                review={
                    "source": source.name,
                    "import_batch": str(batch.id),
                    "photos_withheld": d.get("photos_withheld", 0),
                    "state": "pending",
                    "required": batch.options.get("require_review", False),
                },
                reviewed_by=actor_id if review_ref else None,
                published_at=utcnow() if review_ref else None,
            )
        )
    return 0
