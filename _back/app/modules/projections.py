"""Public projections. Each function lists the fields it exposes; ORM rows are never dumped whole."""

from datetime import datetime, timedelta, timezone
from typing import Any

from app.models import (
    Announcement,
    ChangeEvent,
    Court,
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


def event_now(event):
    now = datetime.now(timezone.utc)
    clock = event.demo_clock if event.is_demo else {}
    if clock and clock.get("at") and clock.get("set_at"):
        return datetime.fromisoformat(clock["at"]) + (
            now - datetime.fromisoformat(clock["set_at"])
        )
    return now


def match_timing(match, event):
    now = event_now(event)
    upcoming = match.status in ("scheduled", "postponed")
    estimate = match.estimated_start if upcoming else None
    origin = "Competition source" if estimate else None
    notice = None
    delay = match.court.delay if match.court else {}
    if upcoming and delay and datetime.fromisoformat(delay["expires_at"]) > now:
        notice = delay
        newer_source = (
            match.source_updated_at
            and match.source_updated_at > datetime.fromisoformat(delay["posted_at"])
        )
        if (
            match.official_time_revised_at
            and match.official_time_revised_at
            > datetime.fromisoformat(delay["posted_at"])
        ):
            newer_source = True
        if (
            not estimate
            and not newer_source
            and match.scheduled_start
            and match.status in ("scheduled", "postponed")
        ):
            estimate = match.scheduled_start + timedelta(minutes=delay["minutes"])
            origin = "OVA staff"
    return {
        "estimated_start": iso(estimate),
        "estimate_source": origin,
        "delay_notice": notice,
        "expected_start_soon": bool(
            estimate and estimate < now and match.status == "scheduled"
        ),
    }


SNAPSHOT_MODES = {"manual_import", "demo_fixture"}


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def source_freshness(source: Source, now: datetime | None = None) -> str:
    """current | stale | paused | unavailable | imported_snapshot | no_data | unknown.

    A CSV snapshot is never "current": polling the page faster can't make it newer.
    A paused or failed live source reports so at once, not after the stale threshold.
    """
    now = now or datetime.now(timezone.utc)
    if source.status == "unavailable":
        return "unavailable"
    if source.status == "paused" and source.mode not in SNAPSHOT_MODES:
        return "paused"
    if source.mode in SNAPSHOT_MODES or not source.config.get("last_sync_success"):
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
        "last_attempt_at": iso(source.last_attempt_at),
        "last_error": source.last_error,
        "last_checked_at": iso(source.last_successful_check_at),
        "last_import_at": iso(source.last_import_at),
        "upstream_updated_at": iso(source.upstream_updated_at),
        "freshness": source_freshness(source),
        # The scheduler checks upstream at most once per interval, not on every page poll.
        "auto_sync": bool(source.config.get("auto_sync")),
        "check_interval_minutes": source.expected_check_interval_minutes,
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
        "label": court.label + (f" · {court.area_label}" if court.area_label else ""),
        "base_label": court.label,
        "area_label": court.area_label,
        "venue_id": str(court.venue_id),
        "venue_name": court.venue.name,
    }


def venue_public(venue: Venue) -> dict[str, Any]:
    return {
        "id": str(venue.id),
        "name": venue.name,
        "address": venue.address,
        "city": venue.city,
        "latitude": venue.latitude,
        "longitude": venue.longitude,
        "accessible_entrance": venue.accessible_entrance,
        "directions": venue.directions,
        "map_url": venue.map_url,
        "courts": [court_public(c) for c in venue.courts],
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
        "server_now": iso(datetime.now(timezone.utc))
        if event.is_demo and event.demo_clock
        else None,
        "demo_now": iso(event_now(event))
        if event.is_demo and event.demo_clock
        else None,
        "revision": event.revision,
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
    return {
        "entry_id": None,
        "team_name": None,
        "club_name": None,
        "placeholder": "TBD",
    }


def sets_won(match: Match) -> dict[str, int] | None:
    scored = [
        s for s in match.sets if s.home_score is not None and s.away_score is not None
    ]
    if not scored:
        return None
    home = sum(1 for s in scored if s.home_score > s.away_score)
    away = sum(1 for s in scored if s.away_score > s.home_score)
    return {"home": home, "away": away}


def match_public(
    match: Match, event: Event, latest_change: ChangeEvent | None = None
) -> dict[str, Any]:
    return {
        "id": str(match.id),
        "revision": match.revision,
        "source_match_id": match.external_id,
        "status": match.status,
        "result_state": match.result_state,
        "round_label": match.round_label,
        "division": division_public(match.division),
        "scheduled_start": iso(match.scheduled_start),
        **match_timing(match, event),
        "work_entry_id": str(match.work_entry_id) if match.work_entry_id else None,
        # The team the source assigns to referee and keep score for this match.
        "work_team": {
            "entry_id": str(match.work_entry.id),
            "team_name": match.work_entry.team_name,
        }
        if match.work_entry
        else None,
        "timezone": event.timezone,
        "court": court_public(match.court),
        "home": participant_public(match, "home"),
        "away": participant_public(match, "away"),
        # Missing scores stay null; nothing is defaulted to 0.
        "sets": [
            {"set_number": s.set_number, "home": s.home_score, "away": s.away_score}
            for s in match.sets
        ],
        "sets_won": sets_won(match),
        "source": {
            "id": str(match.source.id),
            "name": match.source.name,
            "mode": match.source.mode,
            "observed_at": iso(match.observed_at),
            # Unchanged checks don't touch the record, so show the source's own check time.
            "last_checked_at": iso(match.source.last_successful_check_at),
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
