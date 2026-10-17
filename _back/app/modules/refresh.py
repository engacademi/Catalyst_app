"""Refresh a live source: read it, then stage a batch for the usual preview and commit.

A failed read is a failed check. The last committed projection stays, the source shows as
unavailable from the first failure, and the next good read makes it active again.
"""

import hashlib
import json
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.adapters.aes_adapter import AesEvent, Fetch, http_fetch
from app.adapters.base import SourceUnavailable
from app.models import Event, ImportBatch, Source, utcnow
from app.modules.imports import stage_parsed

__all__ = ["SourceUnavailable", "refresh_source"]

LIVE_MODES = {"aes"}


def refresh_source(
    db: Session,
    *,
    event: Event,
    source: Source,
    kind: str,
    fetch: Fetch = http_fetch,
    actor_id: uuid.UUID | None,
) -> ImportBatch:
    if source.mode not in LIVE_MODES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Only live sources can be refreshed; upload a file instead")
    if not source.external_key:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Add the AES event key to this source first")

    reader = AesEvent(source.external_key, fetch, event.timezone)
    try:
        upstream = reader.updated_at()
        parsed = reader.parse(kind)
    except SourceUnavailable as exc:
        if source.unavailable_since is None:
            source.unavailable_since = utcnow()
        source.status = "unavailable"
        source.last_check_error = str(exc)[:500]
        db.commit()
        raise

    source.last_successful_check_at = utcnow()
    if source.unavailable_since is not None:
        source.status = "active"
        source.unavailable_since = None
        source.last_check_error = None
    rows = [{"external_id": r.external_id, "data": r.data} for r in parsed.rows]
    return stage_parsed(
        db,
        event=event,
        source=source,
        kind=kind,
        parsed=parsed,
        filename=f"AES refresh ({kind})",
        file_hash=hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest(),
        options={"upstream_updated_at": upstream.isoformat()},
        actor_id=actor_id,
        summary={"found": _found(kind, parsed)},
    )


def _found(kind: str, parsed) -> dict[str, int]:
    data = [r.data for r in parsed.rows]
    if kind == "matches":
        return {"matches": len(data), "courts": len({d["court_external_id"] for d in data if d.get("court_external_id")})}
    return {
        "divisions": len({d["division_external_id"] for d in data}),
        "clubs": len({d["club_external_id"] for d in data if d.get("club_external_id")}),
        "teams": len(data),
    }
