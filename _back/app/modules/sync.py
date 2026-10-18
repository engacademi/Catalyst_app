"""Central source polling, shared by staff Refresh and the application scheduler."""

import asyncio
import csv
import io
import logging
from datetime import timedelta

from sqlalchemy import select, text
from app.adapters.live import fetch_snapshot
from app.core.db import get_sessionmaker
from app.models import Source, Event, Venue, Division, GuideItem, utcnow
from app.modules.imports import stage_import, commit_import

log = logging.getLogger("courtside.sync")


def _csv(rows):
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=sorted({k for row in rows for k in row}))
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode()


def sync_source(source_id, actor_id=None):
    with get_sessionmaker()() as db:
        source = db.get(Source, source_id)
        if not source or source.status == "paused":
            return {"ok": False, "message": "Source is paused or missing"}
        # Session advisory lock survives the import pipeline's commits; every process shares it.
        lock_id = int(source.id.int % (2**63 - 1))
        connection = db.connection()
        # Use an independent connection so commits cannot return a locked connection to the pool.
        with connection.engine.connect() as lock:
            acquired = lock.scalar(
                text("select pg_try_advisory_lock(:id)"), {"id": lock_id}
            )
            if not acquired:
                return {"ok": False, "message": "Another refresh is already running"}
            try:
                source.last_attempt_at = utcnow()
                db.commit()
                try:
                    snapshot = fetch_snapshot(source.mode, source.config)
                    event = db.get(Event, source.event_id)
                    if snapshot.unchanged:
                        source.last_successful_check_at = utcnow()
                        source.status, source.last_error = "active", None
                        db.commit()
                        return {
                            "ok": True,
                            "unchanged": True,
                            "entries": 0,
                            "matches": 0,
                            "divisions": 0,
                        }
                    # Validate both collections before applying either one.
                    from app.adapters.csv_adapter import CsvAdapter

                    parser = CsvAdapter()
                    for kind, rows in [
                        ("entries", snapshot.entries),
                        ("matches", snapshot.matches),
                    ]:
                        if rows:
                            parsed = parser.parse(
                                kind, _csv(rows), timezone=event.timezone, strict=True
                            )
                            if parsed.errors or any(r.errors for r in parsed.rows):
                                raise ValueError(
                                    f"{kind} did not pass source validation"
                                )
                    for d in snapshot.divisions:
                        if not db.scalar(
                            select(Division.id).where(
                                Division.event_id == event.id,
                                Division.name == d["name"],
                            )
                        ):
                            db.add(
                                Division(
                                    event_id=event.id,
                                    name=d["name"],
                                    code=d.get("code"),
                                )
                            )
                    for name in {m["venue"] for m in snapshot.matches}:
                        if not db.scalar(
                            select(Venue.id).where(
                                Venue.event_id == event.id, Venue.name == name
                            )
                        ):
                            db.add(Venue(event_id=event.id, name=name))
                    # One transaction from here: metadata, entries, matches and source state
                    # land together, or a failure rolls back to the previous snapshot.
                    db.flush()
                    for kind, rows in [
                        ("entries", snapshot.entries),
                        ("matches", snapshot.matches),
                    ]:
                        if not rows:
                            continue
                        batch = stage_import(
                            db,
                            event=event,
                            source=source,
                            kind=kind,
                            filename=f"{source.mode}-feed.csv",
                            content=_csv(rows),
                            options={"strict": True},
                            actor_id=actor_id,
                            commit=False,
                        )
                        commit_import(
                            db, batch.id, actor_id, "source-sync", commit=False
                        )
                    for resource in snapshot.resources:
                        if not db.scalar(
                            select(GuideItem.id).where(
                                GuideItem.event_id == event.id,
                                GuideItem.link_url == resource["link_url"],
                            )
                        ):
                            db.add(
                                GuideItem(
                                    event_id=event.id,
                                    kind="officials",
                                    body="Published by the competition platform. Opens the official resource.",
                                    **resource,
                                )
                            )
                    source.config = {
                        **source.config,
                        "last_sync_success": True,
                        "last_timestamp": snapshot.timestamp,
                        "capabilities": {
                            "entries": bool(snapshot.entries),
                            "matches": bool(snapshot.matches),
                            "divisions": bool(snapshot.divisions),
                        },
                    }
                    source.status = "active"
                    source.last_error = None
                    source.last_successful_check_at = utcnow()
                    event.revision += 1
                    db.commit()
                    return {
                        "ok": True,
                        "entries": len(snapshot.entries),
                        "matches": len(snapshot.matches),
                        "divisions": len(snapshot.divisions),
                    }
                except Exception as exc:
                    db.rollback()
                    source = db.get(Source, source_id)
                    source.status = "unavailable"
                    # Never persist vendor payloads or signed URLs in errors.
                    source.last_error = (
                        str(exc)[:300]
                        if isinstance(exc, ValueError)
                        else f"{type(exc).__name__}: source request failed; last good data retained"
                    )
                    db.commit()
                    return {"ok": False, "message": source.last_error}
            finally:
                lock.execute(text("select pg_advisory_unlock(:id)"), {"id": lock_id})
                lock.commit()


async def poll_sources():
    while True:
        await asyncio.sleep(30)
        try:
            with get_sessionmaker()() as db:
                rows = db.scalars(
                    select(Source).where(
                        Source.mode.in_(["aes", "timu", "myteam"]), Source.status != "paused"
                    )
                ).all()
                ids = [
                    s.id
                    for s in rows
                    if s.config.get("auto_sync")
                    and s.config.get("authorized")
                    and (
                        not s.last_attempt_at
                        or utcnow() - s.last_attempt_at
                        > timedelta(minutes=s.expected_check_interval_minutes)
                    )
                ]
            for source_id in ids:
                await asyncio.to_thread(sync_source, source_id)
        except Exception:
            log.exception("Source scheduler failed; next tick will retry")
