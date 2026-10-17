"""Read-only AES hierarchy. Unsupported shapes fail visibly, preserving previous data.

Reads the JSON paths the AES results site uses: event, division playdays, pools per day,
poolsheet per pool, timestamp. Pool play only; AES times are local to the event.
"""

import json
import re
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote
from app.adapters.live import Snapshot, fetch_text


def read_aes(config, get=fetch_text):
    key = str(config.get("event_key", ""))
    if not re.fullmatch("[A-Za-z0-9_=-]{1,300}", key):
        raise ValueError("Enter the AES event key from the official event URL")
    base = "https://results.advancedeventsystems.com/api/event/" + quote(key, safe="")

    def read(path=""):
        return json.loads(get(base + path))

    try:
        return _read(config, read)
    except (KeyError, TypeError, AttributeError) as exc:
        raise ValueError(
            "AES data has an unexpected shape; previous data retained"
        ) from exc


def _read(config, read):
    event = read()
    divisions = event.get("Divisions") if isinstance(event, dict) else None
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
    venue = (event.get("Location") or "").split(" (")[0].strip() or config.get(
        "venue", "Venue to be confirmed by organizer"
    )
    selected = {str(x) for x in config.get("division_ids", [])}
    entries, jobs = {}, []
    for d in divisions:
        did = str(d["DivisionId"])
        if selected and did not in selected:
            continue
        out.divisions.append(
            {"name": d["Name"], "code": d.get("CodeAlias"), "external_id": did}
        )
        for day in read(f"/division/{quote(did, safe='')}/playdays"):
            if not day.get("HasPools"):
                continue
            date = day["DateTime"][:10]
            for pool in read(f"/division/{quote(did, safe='')}/pools/{date}"):
                for t in pool["Teams"]:
                    club = t.get("Club") or {}
                    entries.setdefault(
                        str(t["TeamId"]),
                        {
                            "external_entry_id": str(t["TeamId"]),
                            "team_name": t["TeamName"],
                            "division": d["Name"],
                            "division_code": d.get("CodeAlias") or "",
                            "club_name": club.get("Name") or "",
                        },
                    )
                jobs.append((str(pool["PlayId"]), d["Name"], pool.get("FullName")))
    if len(jobs) > 2000:
        raise ValueError(
            "Select fewer AES divisions; one connection supports up to 2000 pools"
        )

    def sheet(job):
        return job, read("/poolsheet/" + quote(job[0], safe=""))

    with ThreadPoolExecutor(max_workers=4) as executor:
        for (_, division, pool_name), data in executor.map(sheet, jobs):
            for m in data["Matches"]:
                sets = [
                    f"{s['FirstTeamScore']}-{s['SecondTeamScore']}"
                    for s in m.get("Sets") or []
                    if s.get("FirstTeamScore") is not None
                    and s.get("SecondTeamScore") is not None
                ]
                if m.get("FirstTeamWon") or m.get("SecondTeamWon"):
                    status = "completed"
                else:
                    status = "in_progress" if sets else "scheduled"
                row = {
                    "external_match_id": str(m["MatchId"]),
                    "division": division,
                    "venue": venue,
                    "court": (m.get("Court") or {}).get("Name")
                    or "Court to be confirmed",
                    "round": " · ".join(
                        x for x in (pool_name, m.get("MatchFullName")) if x
                    ),
                    # Naive local time; the importer reads it in the event's timezone.
                    "scheduled_start": m.get("ScheduledStartDateTime") or "",
                    "status": status,
                    "set_scores": " ".join(sets),
                    "work_entry_id": "",
                }
                for side, prefix in (("home", "First"), ("away", "Second")):
                    tid = m.get(prefix + "TeamId")
                    row[side + "_entry_id"] = str(tid) if tid is not None else ""
                    row[side + "_placeholder"] = (
                        ""
                        if tid is not None
                        else m.get(prefix + "TeamName") or "To be decided"
                    )
                if str(m.get("WorkTeamId")) in entries:
                    row["work_entry_id"] = str(m["WorkTeamId"])
                out.matches.append(row)
    out.entries = list(entries.values())
    return out
