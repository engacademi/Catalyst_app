"""Read-only AES hierarchy. Unsupported shapes fail visibly, preserving previous data."""

import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from urllib.parse import quote
from app.adapters.live import Snapshot, fetch_text


def pick(obj, *keys, default=None):
    if not isinstance(obj, dict):
        return default
    values = {re.sub("[^a-z0-9]", "", k.lower()): v for k, v in obj.items()}
    return next(
        (values[k.lower()] for k in keys if values.get(k.lower()) is not None), default
    )


def items(obj, *keys):
    if isinstance(obj, list):
        return obj
    value = pick(obj, *keys, "data", default=[])
    if isinstance(value, dict):
        return items(value, *keys)
    if not isinstance(value, list):
        raise ValueError("AES collection format changed")
    return value


def read_aes(config, get=fetch_text):
    key = str(config.get("event_key", ""))
    if not re.fullmatch("[A-Za-z0-9_=-]{1,300}", key):
        raise ValueError("Enter the AES event key from the official event URL")
    base = "https://results.advancedeventsystems.com/api/event/" + quote(key, safe="")

    def read(path=""):
        return json.loads(get(base + path))

    divisions = items(read(), "divisions", "eventdivisions")
    if not divisions:
        raise ValueError("AES division collection missing; previous data retained")
    out = Snapshot()
    out.timestamp = read("/timestamp")
    if (
        config.get("last_sync_success")
        and config.get("last_timestamp") == out.timestamp
    ):
        out.unchanged = True
        return out
    selected = {str(x) for x in config.get("division_ids", [])}
    jobs = []
    for d in divisions:
        did, name = pick(d, "id", "divisionid"), pick(d, "name", "divisionname")
        if did is None or not name:
            raise ValueError("AES division identity missing")
        if selected and str(did) not in selected:
            continue
        out.divisions.append(
            {
                "name": str(name),
                "code": pick(d, "code", "shortname"),
                "external_id": str(did),
            }
        )
        for day in items(
            read(f"/division/{quote(str(did), safe='')}/playdays"), "playdays", "dates"
        ):
            date = (
                pick(day, "date", "playdate", "playday")
                if isinstance(day, dict)
                else day
            )
            if not date:
                raise ValueError("AES playday missing")
            for pool in items(
                read(
                    f"/division/{quote(str(did), safe='')}/pools/{quote(str(date), safe='')}"
                ),
                "pools",
                "plays",
            ):
                pid = pick(pool, "playid", "id", "poolid")
                if pid is None:
                    raise ValueError("AES pool identity missing")
                jobs.append(
                    (
                        str(pid),
                        str(name),
                        str(date),
                        str(pick(pool, "name", "poolname", default="Pool / playoff")),
                    )
                )
    if len(jobs) > 2000:
        raise ValueError(
            "Select fewer AES divisions; one connection supports up to 2000 pools"
        )
    entries = {}

    def sheet(job):
        return job, read("/poolsheet/" + quote(job[0], safe=""))

    with ThreadPoolExecutor(max_workers=4) as executor:
        for (pid, division, date, round_name), data in executor.map(sheet, jobs):
            names = {}
            for t in items(data, "teams"):
                tid, name = (
                    pick(t, "id", "teamid", "entryid"),
                    pick(t, "name", "teamname"),
                )
                if tid is None or not name:
                    raise ValueError("AES team identity missing")
                names[str(tid)] = str(name)
                entries[str(tid)] = {
                    "external_entry_id": str(tid),
                    "team_name": str(name),
                    "division": division,
                    "club_name": pick(t, "clubname", default=""),
                }
            matches = items(data, "matches", "games")
            if pick(data, "matches", "games") is None:
                raise ValueError("AES poolsheet match collection missing")
            for m in matches:
                mid = pick(m, "id", "matchid", "gameid")
                if mid is None:
                    raise ValueError("AES match identity missing")
                court = pick(
                    m,
                    "court",
                    "courtname",
                    "courtnumber",
                    default="Court to be confirmed",
                )
                venue = pick(
                    m,
                    "venuename",
                    "facilityname",
                    default=pick(
                        data,
                        "venuename",
                        "facilityname",
                        default=config.get("venue")
                        or "Venue to be confirmed by organizer",
                    ),
                )
                if isinstance(court, dict):
                    venue = pick(court, "venuename", "facilityname", default=venue)
                    court = pick(
                        court,
                        "name",
                        "label",
                        "number",
                        default="Court to be confirmed",
                    )
                row = {
                    "external_match_id": str(mid),
                    "division": division,
                    "venue": str(venue),
                    "court": str(court),
                    "court_area": str(pick(m, "courtarea", "hall", default="")),
                    "round": str(pick(m, "roundname", "round", default=round_name)),
                    "scheduled_start": "",
                    "status": "scheduled",
                    "set_scores": "",
                }
                for side in ("home", "away"):
                    team = pick(
                        m, side, side + "team", "team1" if side == "home" else "team2"
                    )
                    tid = (
                        pick(team, "id", "teamid", "entryid")
                        if isinstance(team, dict)
                        else pick(m, side + "teamid", side + "id")
                    )
                    name = (
                        pick(team, "name", "teamname")
                        if isinstance(team, dict)
                        else names.get(str(tid))
                    )
                    if tid is not None and name:
                        entries[str(tid)] = {
                            "external_entry_id": str(tid),
                            "team_name": str(name),
                            "division": division,
                            "club_name": pick(team, "clubname", default=""),
                        }
                        row[side + "_entry_id"] = str(tid)
                    else:
                        row[side + "_entry_id"] = ""
                    row[side + "_placeholder"] = str(
                        pick(m, side + "placeholder", side + "seed", default="")
                        or (name if tid is None else "")
                        or "To be decided"
                    )
                start = pick(m, "scheduledstart", "startdatetime", "starttime", "time")
                if start:
                    start = str(start)
                    if re.fullmatch(r"\d{1,2}:\d\d(?::\d\d)?", start):
                        start = date[:10] + "T" + start
                    try:
                        datetime.fromisoformat(start)
                    except ValueError as exc:
                        raise ValueError("AES match start format changed") from exc
                    row["scheduled_start"] = start
                status = (
                    str(pick(m, "status", "matchstatus", default="scheduled"))
                    .lower()
                    .replace(" ", "_")
                )
                status = {
                    "final": "completed",
                    "finished": "completed",
                    "playing": "in_progress",
                    "pending": "scheduled",
                }.get(status, status)
                if status not in {
                    "scheduled",
                    "in_progress",
                    "completed",
                    "postponed",
                    "cancelled",
                }:
                    raise ValueError("AES match status requires mapping review")
                row["status"] = status
                scores = []
                for score in items(m, "sets", "setscores", "scores"):
                    h, a = (
                        pick(score, "home", "homescore", "team1score"),
                        pick(score, "away", "awayscore", "team2score"),
                    )
                    if h is not None and a is not None:
                        scores.append(f"{int(h)}-{int(a)}")
                row["set_scores"] = " ".join(scores)
                work = pick(m, "workteam", "refteam")
                wid = (
                    pick(work, "id", "teamid")
                    if isinstance(work, dict)
                    else pick(m, "workteamid", "refteamid")
                )
                if wid and str(wid) in entries:
                    row["work_entry_id"] = str(wid)
                out.matches.append(row)
    out.entries = list(entries.values())
    return out
