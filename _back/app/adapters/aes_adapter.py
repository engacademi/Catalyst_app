"""Read-only AES adapter (ADR 0003).

These are the JSON paths the AES results site uses, not a documented API, so any timeout,
HTTP error, non-JSON reply or unexpected shape raises SourceUnavailable instead of guessing.
Re-displaying AES data outside the demo needs OVA's permission (Org Q-03).
"""

import http.client
import json
import urllib.request
from collections.abc import Callable
from datetime import datetime
from typing import Any
from urllib.parse import quote
from zoneinfo import ZoneInfo

from app.adapters.base import Capabilities, ParsedRow, ParseResult, SourceUnavailable

BASE_URL = "https://results.advancedeventsystems.com/api/event"
TIMEOUT_SECONDS = 15

Fetch = Callable[[str], bytes]


def http_fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "CourtsideConnected/1"})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return response.read()


def results_url(event_key: str) -> str:
    return f"https://results.advancedeventsystems.com/event/{quote(event_key, safe='')}"


class AesEvent:
    """One refresh's read of an AES event. Each path is fetched at most once per instance."""

    capabilities = Capabilities(
        name="AES results",
        version="1",
        kinds=("entries", "matches"),
        live=True,
        notes="Read-only copy of the AES results site. Staff refresh, preview and commit.",
    )

    def __init__(self, event_key: str, fetch: Fetch = http_fetch, timezone: str = "America/Toronto"):
        self._base = f"{BASE_URL}/{quote(event_key, safe='')}"
        self._fetch = fetch
        self._tz = ZoneInfo(timezone)
        self._cache: dict[str, Any] = {}

    def _get(self, path: str) -> Any:
        if path not in self._cache:
            url = f"{self._base}/{path}" if path else self._base
            try:
                body = self._fetch(url)
            except (OSError, http.client.HTTPException) as exc:
                raise SourceUnavailable(f"AES could not be reached ({exc.__class__.__name__})") from exc
            try:
                self._cache[path] = json.loads(body)
            except ValueError as exc:
                raise SourceUnavailable("AES replied with something other than JSON") from exc
        return self._cache[path]

    def updated_at(self) -> datetime:
        try:
            return datetime.fromisoformat(self._get("timestamp")["LastUpdatedTimestamp"])
        except (KeyError, TypeError, ValueError) as exc:
            raise SourceUnavailable("AES timestamp has an unexpected shape") from exc

    def pools(self) -> list[tuple[dict, str, dict]]:
        """(division, play day, pool) for every pool day of every division."""
        out = []
        for division in self._get("")["Divisions"]:
            division_id = division["DivisionId"]
            for day in self._get(f"division/{division_id}/playdays"):
                if not day.get("HasPools"):
                    continue
                date = day["DateTime"][:10]
                for pool in self._get(f"division/{division_id}/pools/{date}"):
                    out.append((division, date, pool))
        return out

    def parse(self, kind: str) -> ParseResult:
        try:
            return {"entries": self._entries, "matches": self._matches}[kind]()
        except (KeyError, TypeError, AttributeError, ValueError) as exc:
            raise SourceUnavailable("AES data has an unexpected shape") from exc

    def _entries(self) -> ParseResult:
        rows: dict[int, ParsedRow] = {}
        for division, _, pool in self.pools():
            for team in pool["Teams"]:
                if team["TeamId"] in rows:
                    continue
                club = team.get("Club") or {}
                rows[team["TeamId"]] = ParsedRow(
                    row=len(rows) + 1,
                    external_id=str(team["TeamId"]),
                    data={
                        "team_name": team["TeamName"],
                        "club_name": club.get("Name"),
                        "club_external_id": str(club["ClubId"]) if club.get("ClubId") is not None else None,
                        "division": division["Name"],
                        "division_code": division.get("CodeAlias"),
                        "division_external_id": str(division["DivisionId"]),
                    },
                )
        return ParseResult(rows=list(rows.values()), errors=[])

    def _matches(self) -> ParseResult:
        """Pool matches from each pool's poolsheet. AES times are local to the event."""
        rows: list[ParsedRow] = []
        location = (self._get("").get("Location") or "").split(" (")[0].strip() or None
        for division, _, pool in self.pools():
            sheet = self._get(f"poolsheet/{pool['PlayId']}")
            for m in sheet["Matches"]:
                sets = [
                    [s["FirstTeamScore"], s["SecondTeamScore"]]
                    for s in m.get("Sets") or []
                    if s.get("FirstTeamScore") is not None and s.get("SecondTeamScore") is not None
                ]
                if m.get("FirstTeamWon") or m.get("SecondTeamWon"):
                    status = "completed"
                else:
                    status = "in_progress" if sets else "scheduled"
                start = m.get("ScheduledStartDateTime")
                court = m.get("Court") or {}
                rows.append(
                    ParsedRow(
                        row=len(rows) + 1,
                        external_id=str(m["MatchId"]),
                        data={
                            "division": division["Name"],
                            "division_external_id": str(division["DivisionId"]),
                            "venue": None,
                            "aes_location": location,
                            "court": court.get("Name") or "",
                            "court_external_id": str(court["CourtId"]) if court.get("CourtId") is not None else None,
                            "round": " · ".join(x for x in (pool.get("FullName"), m.get("MatchFullName")) if x) or None,
                            "status": status,
                            "home_entry_id": _id(m.get("FirstTeamId")),
                            "away_entry_id": _id(m.get("SecondTeamId")),
                            "home_placeholder": None if m.get("FirstTeamId") is not None else m.get("FirstTeamName") or "To be decided",
                            "away_placeholder": None if m.get("SecondTeamId") is not None else m.get("SecondTeamName") or "To be decided",
                            "work_entry_id": _id(m.get("WorkTeamId")),
                            "source_revision": None,
                            "scheduled_start": datetime.fromisoformat(start).replace(tzinfo=self._tz).isoformat() if start else None,
                            "estimated_start": None,
                            "source_updated_at": None,
                            "sets": sets,
                        },
                    )
                )
        return ParseResult(rows=rows, errors=[])


def _id(value: Any) -> str | None:
    return str(value) if value is not None else None
