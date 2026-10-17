"""ICS snapshot export (RFC 5545). UIDs are stable per match; SEQUENCE carries the revision."""

from datetime import datetime, timedelta, timezone

from app.models import Event, Match

PRODID = "-//Courtside Connected//Event companion//EN"


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _fold(line: str) -> list[str]:
    # Lines longer than 75 octets continue on the next line with a leading space.
    out, current = [], ""
    for char in line:
        if len((current + char).encode()) > 75:
            out.append(current)
            current = " " + char
        else:
            current += char
    out.append(current)
    return out


def _stamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def build_ics(event: Event, matches: list[Match], *, uid_domain: str, assumed_minutes: int) -> str:
    now = datetime.now(timezone.utc)
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape(event.title)}",
    ]
    for match in matches:
        start = match.estimated_start or match.scheduled_start
        if start is None or match.status == "cancelled":
            continue
        names = []
        for p in match.participants:
            names.append(p.entry.team_name if p.entry else (p.placeholder_label or "TBD"))
        court = "Court to be confirmed"
        if match.court:
            place = f"{match.court.label} · {match.court.area}" if match.court.area else match.court.label
            court = f"{place}, {match.court.venue.name}"
        description = (
            f"Snapshot exported {now.strftime('%Y-%m-%d %H:%M')} UTC from {match.source.name}. "
            "Times can change: check the event companion for the current schedule. "
            f"End time assumes a {assumed_minutes}-minute match."
        )
        lines += [
            "BEGIN:VEVENT",
            f"UID:{match.id}@{uid_domain}",
            f"SEQUENCE:{match.revision}",
            f"DTSTAMP:{_stamp(now)}",
            f"DTSTART:{_stamp(start)}",
            f"DTEND:{_stamp(start + timedelta(minutes=assumed_minutes))}",
            f"SUMMARY:{_escape(' vs '.join(names))}",
            f"LOCATION:{_escape(court)}",
            f"DESCRIPTION:{_escape(description)}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(folded for line in lines for folded in _fold(line)) + "\r\n"
