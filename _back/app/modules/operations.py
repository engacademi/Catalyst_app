"""Registration export mapping and private assignment import handlers."""

import csv
import io
import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from app.models import Assignment, ExternalMapping, User, RoleGrant, Match


def map_registration(content: bytes, columns: dict, teams: dict):
    try:
        reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
        missing = [
            header
            for header in columns.values()
            if header and header not in (reader.fieldnames or [])
        ]
        if missing:
            raise ValueError("Selected columns are missing: " + ", ".join(missing))
        rows = []
        for row in reader:
            normalized = {
                key: row.get(header, "") for key, header in columns.items() if header
            }
            if not normalized.get("external_entry_id"):
                raise ValueError("Every player needs a registration team id")
            rows.append(normalized)
        if not rows:
            raise ValueError("The export has no player rows")
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
        return buf.getvalue().encode()
    except (ValueError, UnicodeError, csv.Error) as exc:
        raise HTTPException(422, str(exc)) from exc


def stage_assignments(db, event, source, rows):
    from app.modules.imports import _row, _mapping

    out = []
    for parsed in rows:
        d, errors = parsed.data, []
        user = db.scalar(
            select(User).where(
                User.clerk_subject == d["subject"], User.disabled_at.is_(None)
            )
        )
        grant = (
            db.scalar(
                select(RoleGrant).where(
                    RoleGrant.user_id == user.id,
                    RoleGrant.event_id == event.id,
                    RoleGrant.role == "official",
                )
            )
            if user
            else None
        )
        from app.models import utcnow

        if not grant or (grant.expires_at and grant.expires_at <= utcnow()):
            errors.append(
                "Grant this Clerk subject an official role for the event first"
            )
        match = db.scalar(
            select(Match).where(
                Match.event_id == event.id,
                Match.source_id == source.id,
                Match.external_id == d["external_match_id"],
            )
        )
        if not match:
            errors.append("Unknown match id for this source")
        assignment_id = _mapping(db, source.id, "assignment", parsed.external_id)
        existing = db.get(Assignment, assignment_id) if assignment_id else None
        same = (
            existing
            and user
            and match
            and existing.person_user_id == user.id
            and existing.match_id == match.id
            and existing.role == d["role"]
            and existing.reporting_time == datetime.fromisoformat(d["reporting_time"])
        )
        out.append(
            _row(
                parsed,
                "unchanged" if same else "change" if existing else "add",
                extra_errors=errors,
                user_id=str(user.id) if user else None,
                match_id=str(match.id) if match else None,
                assignment_id=str(assignment_id) if assignment_id else None,
            )
        )
    return out


def commit_assignments(db, event, source, batch, actor_id):
    for row in batch.rows:
        if row["action"] == "unchanged":
            continue
        d = row["data"]
        assignment = (
            db.get(Assignment, uuid.UUID(d["assignment_id"]))
            if d.get("assignment_id")
            else None
        )
        if assignment is None:
            assignment = Assignment(
                event_id=event.id,
                source_id=source.id,
                person_user_id=uuid.UUID(d["user_id"]),
                role=d["role"],
            )
            db.add(assignment)
            db.flush()
            db.add(
                ExternalMapping(
                    source_id=source.id,
                    entity_type="assignment",
                    external_id=row["external_id"],
                    canonical_id=assignment.id,
                )
            )
        else:
            assignment.revision += 1
        assignment.person_user_id = uuid.UUID(d["user_id"])
        assignment.match_id = uuid.UUID(d["match_id"])
        assignment.court_id = db.get(Match, assignment.match_id).court_id
        assignment.reporting_time = datetime.fromisoformat(d["reporting_time"])
        assignment.role = d["role"]
    return 0
