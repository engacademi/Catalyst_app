"""Read-only MyTeam.click schedules for OVA beach events, from its public JSON."""

import json
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from app.adapters.live import Snapshot, fetch_text

BASE = "https://myteamclick.herokuapp.com/volley"
OVA = "65a6e79938b36f6431dd464f"


def myteam_url(path, record_id):
    if not re.fullmatch("[0-9a-f]{24}", str(record_id)):
        raise ValueError("Enter the MyTeam.click event id")
    return f"{BASE}/{path}/{record_id}"


def local_date(value):
    return (
        datetime.fromisoformat(value)
        .astimezone(ZoneInfo("America/Toronto"))
        .date()
    )


def upcoming_events(today, get=fetch_text):
    """Events of OVA's active season dated today or later, skipping cancelled ones."""
    seasons = json.loads(get(myteam_url("org/season/leagues", OVA)))["seasonList"]
    leagues = [
        league["_id"]
        for season in seasons
        if season["active"]
        for league in season["leagueList"]
        if league["visible"]
    ]
    if not leagues:
        raise ValueError("No active OVA season on MyTeam.click")
    return [
        event
        for league in leagues
        for event in json.loads(get(myteam_url("custom/ova/tournamentlist", league)))[
            "eventList"
        ]
        if not event["states"]["canceled"] and local_date(event["date"]) >= today
    ]


def read_myteam(config, get=fetch_text):
    data = json.loads(get(myteam_url("schedule", config.get("event_id", ""))))
    try:
        return _read(data["event"], config)
    except (KeyError, IndexError, TypeError, AttributeError) as exc:
        raise ValueError(
            "MyTeam.click data has an unexpected shape; previous data retained"
        ) from exc


def _read(event, config):
    out, rounds = Snapshot(), {}
    venue = next((loc["name"] for loc in event["locList"]), None) or config.get(
        "venue", "Venue to be confirmed by organizer"
    )
    for g in event["groups"]:
        for pool in g["poolPlay"]["poolList"]:
            rounds.update(
                (ref, (g["name"], f"Pool {pool['no']}")) for ref in pool["matchRefList"]
            )
        for tree in g["finals"]["treeList"]:
            rounds.update(
                (ref, (g["name"], "Playoffs")) for ref in tree["matchRefList"]
            )
        out.divisions.append({"name": g["name"], "code": None, "external_id": g["_id"]})
        for t in g["teams"]:
            if t["state"] == 2:  # Accepted; the published team count excludes the rest.
                out.entries.append(
                    {
                        "external_entry_id": t["_id"],
                        "team_name": t["name"],
                        "division": g["name"],
                    }
                )
    entries = {e["external_entry_id"] for e in out.entries}
    for m in event["matchList"]:
        if m["_id"] not in rounds:
            raise ValueError(
                "MyTeam.click match has no division; previous data retained"
            )
        division, round_name = rounds[m["_id"]]
        sides = m["teams"]
        row = {
            "external_match_id": str(m["_id"]),
            "division": division,
            "venue": venue,
            "court": f"Court {m['courtNo']}"
            if m.get("courtNo")
            else "Court to be confirmed",
            "round": round_name,
            # `time` is not a published clock time (OVA hides match times); never invent one.
            "scheduled_start": "",
            "status": "completed" if m.get("winner") in (0, 1) else "scheduled",
            "set_scores": " ".join(
                f"{h}-{a}"
                for h, a in zip(
                    sides[0].get("scores") or [], sides[1].get("scores") or []
                )
            ),
            "work_entry_id": m.get("arbitId") if m.get("arbitId") in entries else "",
        }
        for side, team in zip(("home", "away"), sides):
            tid = team.get("teamId")
            if tid is not None and tid not in entries:
                raise ValueError(
                    "MyTeam.click match team missing; previous data retained"
                )
            row[side + "_entry_id"] = tid or ""
            row[side + "_placeholder"] = "" if tid else "To be decided"
        out.matches.append(row)
    return out
