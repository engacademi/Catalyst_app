"""Read-only AES hierarchy. Unsupported shapes fail visibly, preserving previous data.

Reads the JSON paths the AES results site uses: event, division playdays, pools per day,
poolsheet per pool, timestamp. Pool play only; AES times are local to the event.
"""

import json
import re
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote, urlencode

from app.adapters.live import Snapshot, fetch_text


def aes_event_url(event_key):
    key = str(event_key)
    if not re.fullmatch("[A-Za-z0-9_=-]{1,300}", key):
        raise ValueError("Enter the AES event key from the official event URL")
    return "https://results.advancedeventsystems.com/api/event/" + quote(key, safe="")


def search_aes_championships(get=fetch_text):
    """Ontario Championships events on AES, past and upcoming, newest first."""
    query = urlencode(
        {
            "$filter": "contains(name,'Ontario Championships')",
            "$top": 100,
            "$orderby": "startDate desc",
        }
    )
    data = json.loads(
        get("https://www.advancedeventsystems.com/api/landing/events?" + query)
    )
    # "OVA" in AES names often means Ohio, so match the full phrase only.
    return [
        e
        for e in collection(data["value"])
        if "ontario championships" in e["name"].lower() and e.get("eventSchedulerKey")
    ]


def collection(value):
    if not isinstance(value, list) or any(not isinstance(row, dict) for row in value):
        raise ValueError("AES collection format changed; previous data retained")
    return value


def read_aes(config, get=fetch_text):
    base = aes_event_url(config.get("event_key", ""))

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
    for d in collection(divisions):
        did = str(d["DivisionId"])
        if selected and did not in selected:
            continue
        out.divisions.append(
            {"name": d["Name"], "code": d.get("CodeAlias"), "external_id": did}
        )
        for day in collection(read(f"/division/{quote(did, safe='')}/playdays")):
            if not isinstance(day["HasPools"], bool):
                raise TypeError("AES pool flag format changed")
            if not day["HasPools"]:
                continue
            date = day["DateTime"][:10]
            for pool in collection(
                read(f"/division/{quote(did, safe='')}/pools/{date}")
            ):
                for t in collection(pool["Teams"]):
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
    if selected and selected != {d["external_id"] for d in out.divisions}:
        raise ValueError("Selected AES division missing; previous data retained")
    if len(jobs) > 2000:
        raise ValueError(
            "Select fewer AES divisions; one connection supports up to 2000 pools"
        )

    def sheet(job):
        return job, read("/poolsheet/" + quote(job[0], safe=""))

    with ThreadPoolExecutor(max_workers=4) as executor:
        for (_, division, pool_name), data in executor.map(sheet, jobs):
            for m in collection(data["Matches"]):
                # A side AES has not published stays pending ("?"); unplayed sets are dropped.
                sets = [
                    "-".join(
                        "?" if v is None else str(v)
                        for v in (s.get("FirstTeamScore"), s.get("SecondTeamScore"))
                    )
                    for s in m.get("Sets") or []
                    if s.get("FirstTeamScore") is not None
                    or s.get("SecondTeamScore") is not None
                ]
                if m.get("FirstTeamWon") or m.get("SecondTeamWon"):
                    status = "completed"
                else:
                    # Published set scores alone do not confirm a match is live.
                    status = "scheduled"
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
                    if tid is not None and str(tid) not in entries:
                        raise ValueError(
                            "AES match team missing; previous data retained"
                        )
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
