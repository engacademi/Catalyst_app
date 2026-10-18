"""Parser for the app-owned CSV interchange schema (see _back/sample_data/README.md).

This is deliberately not a guess at any vendor's export: staff convert an approved export
into these columns, or a future vendor adapter emits the same normalized rows.
"""

import csv
import io
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from app.adapters.base import Capabilities, ParsedRow, ParseResult

COLUMNS: dict[str, tuple[set[str], set[str]]] = {
    "assignments": ({"external_assignment_id", "subject", "external_match_id", "role", "reporting_time"}, set()),
    "entries": ({"external_entry_id", "team_name", "division"}, {"club_name", "division_code"}),
    "matches": (
        {"external_match_id", "division", "venue", "court", "status"},
        {
            "external_event_id",
            "scheduled_start",
            "estimated_start",
            "home_entry_id",
            "away_entry_id",
            "home_placeholder",
            "away_placeholder",
            "round",
            "set_scores",
            "source_revision",
            "work_entry_id",
            "court_area",
            "source_updated_at",
        },
    ),
    "rosters": (
        {"external_entry_id", "jersey", "display_name"},
        {"position", "photo_url", "photo_approved", "team_photo_url", "team_photo_approved"},
    ),
}
ID_COLUMN = {"assignments": "external_assignment_id", "entries": "external_entry_id", "matches": "external_match_id", "rosters": "external_entry_id"}
STATUSES = {"scheduled", "in_progress", "completed", "cancelled", "postponed"}
MAX_CELL = 500
TRUE_VALUES = {"yes", "y", "true", "1"}
# "?" marks a side the source has not published yet; it is stored as null (pending).
SET_RE = re.compile(r"^(\d{1,2}|\?)-(\d{1,2}|\?)$")


def parse_time(value: str, tz: str) -> datetime:
    parsed = datetime.fromisoformat(value.strip())
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=ZoneInfo(tz))
    return parsed


def parse_sets(value: str) -> list[list[int | None]]:
    sets = []
    for token in re.split(r"[\s;,]+", value.strip()):
        if not token:
            continue
        match = SET_RE.match(token)
        if not match or token == "?-?":
            raise ValueError(f"set score '{token}' should look like 25-20 or 25-?")
        sets.append([None if g == "?" else int(g) for g in match.groups()])
    return sets


def _url(value: str, errors: list[str], column: str) -> str | None:
    if not value:
        return None
    if value.startswith("https://") or value.startswith("/"):
        return value
    errors.append(f"{column} must be an https:// URL or a site path")
    return None


class CsvAdapter:
    def capabilities(self) -> Capabilities:
        return Capabilities(
            name="CSV interchange",
            version="1",
            kinds=tuple(COLUMNS),
            live=False,
            notes="Staff upload approved exports. Shown to attendees as an imported snapshot, never as live.",
        )

    def parse(self, kind: str, content: bytes, *, timezone: str, strict: bool = True) -> ParseResult:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            return ParseResult(rows=[], errors=["File is not valid UTF-8"])
        reader = csv.DictReader(io.StringIO(text))
        header = {h.strip() for h in (reader.fieldnames or []) if h}
        required, optional = COLUMNS[kind]
        errors: list[str] = []
        warnings: list[str] = []
        missing = required - header
        if missing:
            errors.append(f"Missing required columns: {', '.join(sorted(missing))}")
        unknown = header - required - optional
        if unknown:
            (errors if strict else warnings).append(f"Unknown columns: {', '.join(sorted(unknown))}")
        if errors:
            return ParseResult(rows=[], errors=errors, warnings=warnings)

        rows: list[ParsedRow] = []
        seen: dict[str, int] = {}
        for number, raw in enumerate(reader, start=2):
            cells = {(k or "").strip(): (v or "").strip() for k, v in raw.items() if k}
            row_errors = [f"{k} is longer than {MAX_CELL} characters" for k, v in cells.items() if len(v) > MAX_CELL]
            external_id = cells.get(ID_COLUMN[kind], "")
            if not external_id:
                row_errors.append(f"{ID_COLUMN[kind]} is required")
            # Rosters have one row per player, so the entry id repeats by design.
            elif kind != "rosters":
                if external_id in seen:
                    row_errors.append(f"duplicate of row {seen[external_id]}")
                seen.setdefault(external_id, number)
            data = getattr(self, f"_{kind}")(cells, row_errors, timezone)
            rows.append(ParsedRow(row=number, external_id=external_id, data=data, errors=row_errors))
        return ParseResult(rows=rows, errors=errors, warnings=warnings)

    def _entries(self, cells: dict[str, str], errors: list[str], tz: str) -> dict:
        for column in ("team_name", "division"):
            if not cells.get(column):
                errors.append(f"{column} is required")
        return {
            "team_name": cells.get("team_name", ""),
            "club_name": cells.get("club_name") or None,
            "division": cells.get("division", ""),
            "work_entry_id": cells.get("work_entry_id") or None,
            "court_area": cells.get("court_area") or None,
            "division_code": cells.get("division_code") or None,
        }

    def _matches(self, cells: dict[str, str], errors: list[str], tz: str) -> dict:
        data: dict = {
            "division": cells.get("division", ""),
            "work_entry_id": cells.get("work_entry_id") or None,
            "court_area": cells.get("court_area") or None,
            "venue": cells.get("venue", ""),
            "court": cells.get("court", ""),
            "round": cells.get("round") or None,
            "status": cells.get("status", "").lower(),
            "home_entry_id": cells.get("home_entry_id") or None,
            "away_entry_id": cells.get("away_entry_id") or None,
            "home_placeholder": cells.get("home_placeholder") or None,
            "away_placeholder": cells.get("away_placeholder") or None,
            "source_revision": cells.get("source_revision") or None,
            "scheduled_start": None,
            "estimated_start": None,
            "source_updated_at": None,
            "sets": [],
        }
        for column in ("division", "venue", "court"):
            if not data[column]:
                errors.append(f"{column} is required")
        if data["status"] not in STATUSES:
            errors.append(f"status must be one of {', '.join(sorted(STATUSES))}")
        for slot in ("home", "away"):
            if not data[f"{slot}_entry_id"] and not data[f"{slot}_placeholder"]:
                errors.append(f"{slot}_entry_id or {slot}_placeholder is required")
        for column in ("scheduled_start", "estimated_start", "source_updated_at"):
            if cells.get(column):
                try:
                    data[column] = parse_time(cells[column], tz).isoformat()
                except ValueError:
                    errors.append(f"{column} '{cells[column]}' is not an ISO 8601 date-time")
        if cells.get("set_scores"):
            try:
                data["sets"] = parse_sets(cells["set_scores"])
            except ValueError as exc:
                errors.append(str(exc))
        return data

    def _assignments(self, cells, errors, tz):
        for key in ("subject", "external_match_id", "role", "reporting_time"):
            if not cells.get(key):
                errors.append(f"{key} is required")
        data = {k: cells.get(k, "") for k in ("subject", "external_match_id", "role", "reporting_time")}
        try:
            data["reporting_time"] = parse_time(data["reporting_time"], tz).isoformat()
        except ValueError:
            errors.append("reporting_time must be an ISO 8601 date-time")
        return data

    def _rosters(self, cells: dict[str, str], errors: list[str], tz: str) -> dict:
        jersey = cells.get("jersey", "")
        if not jersey.isdigit() or not 0 <= int(jersey) <= 99:
            errors.append("jersey must be a number from 0 to 99")
        if not cells.get("display_name"):
            errors.append("display_name is required")
        photo_approved = cells.get("photo_approved", "").lower() in TRUE_VALUES
        team_photo_approved = cells.get("team_photo_approved", "").lower() in TRUE_VALUES
        return {
            "jersey": int(jersey) if jersey.isdigit() else None,
            "display_name": cells.get("display_name", ""),
            "position": cells.get("position") or None,
            # Unapproved photos are dropped here, so they never reach the database.
            "photo_url": _url(cells.get("photo_url", ""), errors, "photo_url") if photo_approved else None,
            "photo_withheld": bool(cells.get("photo_url")) and not photo_approved,
            "team_photo_url": _url(cells.get("team_photo_url", ""), errors, "team_photo_url")
            if team_photo_approved
            else None,
            "team_photo_withheld": bool(cells.get("team_photo_url")) and not team_photo_approved,
        }


ADAPTERS = {"manual_import": CsvAdapter(), "demo_fixture": CsvAdapter()}
