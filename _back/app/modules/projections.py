"""Public projections. Each function lists the fields it exposes; ORM rows are never dumped whole."""

from datetime import datetime, timedelta, timezone
from typing import Any

from app.models import (
    Announcement,
    ChangeEvent,
    Court,
    DelayNotice,
    Division,
    Event,
    EventEntry,
    GuideItem,
    Match,
    PartnerCard,
    RosterPublication,
    Source,
    Venue,
)
from app.modules.clock import demo_time_on, event_now
from app.modules.delays import estimated_start, expected_soon

SNAPSHOT_MODES = {"manual_import", "demo_fixture"}


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def source_freshness(source: Source, now: datetime | None = None) -> str:
    """current | stale | unavailable | imported_snapshot | no_data | unknown.

    A CSV snapshot is never "current": polling the page faster can't make it newer.
    """
    now = now or datetime.now(timezone.utc)
    if source.status == "unavailable":
        return "unavailable"
    if source.mode in SNAPSHOT_MODES:
        return "imported_snapshot" if source.last_import_at else "no_data"
    if not source.last_successful_check_at:
        return "unknown"
    limit = timedelta(minutes=2 * source.expected_check_interval_minutes)
    return "stale" if now - source.last_successful_check_at > limit else "current"


def source_public(source: Source) -> dict[str, Any]:
    return {
        "id": str(source.id),
        "name": source.name,
        "mode": source.mode,
        "status": source.status,
        "official_url": source.official_url,
        "last_checked_at": iso(source.last_successful_check_at),
        "last_import_at": iso(source.last_import_at),
        "upstream_updated_at": iso(source.upstream_updated_at),
        "unavailable_since": iso(source.unavailable_since),
        "freshness": source_freshness(source),
    }


def division_public(division: Division | None) -> dict[str, Any] | None:
    if division is None:
        return None
    return {"id": str(division.id), "name": division.name, "code": division.code}


def court_public(court: Court | None) -> dict[str, Any] | None:
    if court is None:
        return None
    return {
        "id": str(court.id),
        "label": court.label,
        "area": court.area,
        "venue_id": str(court.venue_id),
        "venue_name": court.venue.name,
    }


def venue_public(venue: Venue) -> dict[str, Any]:
    return {
        "id": str(venue.id),
        "name": venue.name,
        "address": venue.address,
        "accessible_entrance": venue.accessible_entrance,
        "directions": venue.directions,
        "map_url": venue.map_url,
        "courts": [{"id": str(c.id), "label": c.label, "area": c.area} for c in venue.courts],
    }


def event_public(event: Event) -> dict[str, Any]:
    return {
        "id": str(event.id),
        "slug": event.slug,
        "title": event.title,
        "kind": event.kind,
        "timezone": event.timezone,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat(),
        "status": event.status,
        "is_demo": event.is_demo,
        "revision": event.revision,
        # Screens use this instead of the device clock; demo_time says it isn't the real time.
        "now": iso(event_now(event)),
        "demo_time": demo_time_on(event),
    }


def entry_public(entry: EventEntry) -> dict[str, Any]:
    return {
        "id": str(entry.id),
        "team_name": entry.team_name,
        "club_name": entry.club_name,
        "division": division_public(entry.division),
    }


def participant_public(match: Match, slot: str) -> dict[str, Any]:
    for p in match.participants:
        if p.slot == slot:
            return {
                "entry_id": str(p.entry_id) if p.entry_id else None,
                "team_name": p.entry.team_name if p.entry else None,
                "club_name": p.entry.club_name if p.entry else None,
                "placeholder": p.placeholder_label,
            }
    return {"entry_id": None, "team_name": None, "club_name": None, "placeholder": "TBD"}


def sets_won(match: Match) -> dict[str, int] | None:
    scored = [s for s in match.sets if s.home_score is not None and s.away_score is not None]
    if not scored:
        return None
    home = sum(1 for s in scored if s.home_score > s.away_score)
    away = sum(1 for s in scored if s.away_score > s.home_score)
    return {"home": home, "away": away}


def delay_notice_public(notice: DelayNotice) -> dict[str, Any]:
    return {
        "id": str(notice.id),
        "court_id": str(notice.court_id),
        "minutes": notice.minutes,
        "posted_by": "OVA staff",
        "posted_at": iso(notice.posted_at),
        "expires_at": iso(notice.expires_at),
        "cleared_at": iso(notice.cleared_at),
    }


def match_public(
    match: Match,
    event: Event,
    latest_change: ChangeEvent | None = None,
    notice: DelayNotice | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """notice is the court's active delay notice when the match hasn't started (delays.notice_for).

    now is the event clock; without it a match is never reported as expected to start soon.
    """
    estimate, estimate_by = estimated_start(match, notice)
    return {
        "id": str(match.id),
        "revision": match.revision,
        "status": match.status,
        "result_state": match.result_state,
        "round_label": match.round_label,
        "division": division_public(match.division),
        "scheduled_start": iso(match.scheduled_start),
        # The source's own estimate when it publishes one, otherwise official start plus the delay.
        "estimated_start": iso(estimate),
        "estimated_start_by": estimate_by,
        "delay_notice": delay_notice_public(notice) if notice else None,
        # Its start has passed but the source hasn't marked it started: never shown as in progress.
        "expected_to_start_soon": bool(now) and expected_soon(match, notice, now),
        "timezone": event.timezone,
        "court": court_public(match.court),
        "home": participant_public(match, "home"),
        "away": participant_public(match, "away"),
        # Missing scores stay null; nothing is defaulted to 0.
        "sets": [
            {"set_number": s.set_number, "home": s.home_score, "away": s.away_score} for s in match.sets
        ],
        "sets_won": sets_won(match),
        "work_entry": (
            {"entry_id": str(match.work_entry.id), "team_name": match.work_entry.team_name}
            if match.work_entry
            else None
        ),
        "source": {
            "id": str(match.source.id),
            "name": match.source.name,
            "mode": match.source.mode,
            "observed_at": iso(match.observed_at),
            "source_updated_at": iso(match.source_updated_at),
            "freshness": source_freshness(match.source),
        },
        "latest_change": change_public(latest_change) if latest_change else None,
    }


def change_public(change: ChangeEvent) -> dict[str, Any]:
    return {
        "id": change.id,
        "entity_type": change.entity_type,
        "entity_id": str(change.entity_id),
        "entity_revision": change.entity_revision,
        "event_type": change.event_type,
        "diff": change.diff,
        "entry_ids": change.entry_ids,
        "simulated": change.simulated,
        "occurred_at": iso(change.occurred_at),
    }


def announcement_public(a: Announcement) -> dict[str, Any]:
    return {
        "id": str(a.id),
        "category": a.category,
        "title": a.title,
        "body": a.body,
        "entry_id": str(a.entry_id) if a.entry_id else None,
        "division_id": str(a.division_id) if a.division_id else None,
        "publish_at": iso(a.publish_at),
        "expire_at": iso(a.expire_at),
        "revision": a.revision,
    }


def announcement_admin(a: Announcement) -> dict[str, Any]:
    return {**announcement_public(a), "state": a.state, "updated_at": iso(a.updated_at)}


def guide_item_public(item: GuideItem) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "venue_id": str(item.venue_id) if item.venue_id else None,
        "kind": item.kind,
        "title": item.title,
        "body": item.body,
        "link_url": item.link_url,
        "sort": item.sort,
        "revision": item.revision,
    }


def partner_public(card: PartnerCard) -> dict[str, Any]:
    return {
        "id": str(card.id),
        "kind": card.kind,
        "name": card.name,
        "body": card.body,
        "link_url": card.link_url,
        "logo_url": card.logo_url,
        "booth_location": card.booth_location,
        "seller_note": card.seller_note,
        "sort": card.sort,
        "active": card.active,
        "revision": card.revision,
    }


def roster_public(roster: RosterPublication | None) -> dict[str, Any] | None:
    if roster is None or roster.state != "published":
        return None
    return {
        "version": roster.version,
        "published_at": iso(roster.published_at),
        "team_photo_url": roster.team_photo_url,
        "players": [
            {
                "jersey": p.get("jersey"),
                "display_name": p.get("display_name"),
                "position": p.get("position"),
                "photo_url": p.get("photo_url"),
            }
            for p in roster.public_players
        ],
    }
