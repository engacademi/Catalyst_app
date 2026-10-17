"""Bounded, read-only vendor transports. HTML is parsed, never executed."""

import re
from dataclasses import dataclass, field
from urllib.parse import urlsplit, urljoin

import httpx
from bs4 import BeautifulSoup


@dataclass
class Snapshot:
    entries: list[dict] = field(default_factory=list)
    matches: list[dict] = field(default_factory=list)
    divisions: list[dict] = field(default_factory=list)
    resources: list[dict] = field(default_factory=list)
    timestamp: object = None
    unchanged: bool = False


def fetch_text(url: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname not in {
        "results.advancedeventsystems.com",
        "www.timu.ca",
    }:
        raise ValueError("Unsupported source host")
    with httpx.Client(
        timeout=20,
        follow_redirects=False,
        headers={"User-Agent": "CourtsideConnected/1.0"},
    ) as client:
        with client.stream("GET", url) as response:
            response.raise_for_status()
            chunks, size = [], 0
            for chunk in response.iter_bytes():
                size += len(chunk)
                if size > 5 * 1024 * 1024:
                    raise ValueError("Source response exceeds 5 MB")
                chunks.append(chunk)
    return b"".join(chunks).decode("utf-8-sig")


def parse_timu(html: str, config: dict) -> Snapshot:
    soup = BeautifulSoup(html, "html.parser")
    wrappers = soup.select("div.wrapper[id]")
    if not wrappers:
        raise ValueError("TIMU match cards not found; previous schedule retained")
    title = soup.find("meta", property="og:title")
    division = config.get("division") or (
        title.get("content") if title else "TIMU competition"
    )
    venue = config.get("venue") or "Venue to be confirmed by organizer"
    out, teams = Snapshot(), {}
    for card in wrappers:
        home, away = card.select_one(".home-box"), card.select_one(".away-box")
        if home is None or away is None:
            raise ValueError("TIMU match is missing a participant")
        label = card.find(string=re.compile(r"\([^)]*\s+vs\s+[^)]*\)"))
        if not label:
            raise ValueError("TIMU round label missing")
        label = str(label).strip()
        slots = re.search(r"\((.*?)\s+vs\s+(.*?)\)", label)
        round_name = label[: label.index("(")].strip()
        court = re.search(r"Court:\s*(\S+)", card.get_text(" ", strip=True))
        # Results publish the date, not a reliable match start time. Never invent one.
        row = {
            "external_match_id": str(card["id"]),
            "division": division,
            "venue": venue,
            "court": f"Court {court.group(1)}" if court else "Court to be confirmed",
            "round": round_name,
            "scheduled_start": "",
            "status": "scheduled",
            "set_scores": "",
        }
        scores = []
        for side, box, slot in [
            ("home", home, slots.group(1)),
            ("away", away, slots.group(2)),
        ]:
            name_node = box.select_one(".away")
            if name_node is None:
                raise ValueError("TIMU team name missing")
            name = name_node.get_text(" ", strip=True)
            # A full exact vendor name is its explicit published identity, scoped to this event.
            ext = name
            if name and not re.fullmatch(r"[WL]\d+|[ABC]\d+|TBD", name, re.I):
                teams[ext] = {
                    "external_entry_id": ext,
                    "team_name": name,
                    "division": division,
                }
                row[f"{side}_entry_id"] = ext
            else:
                row[f"{side}_entry_id"] = ""
            row[f"{side}_placeholder"] = slot
            values = [x.get_text(strip=True) for x in box.select(".set-block")][1:]
            scores.append([int(v) if v.isdigit() else None for v in values])
        pairs = [(h, a) for h, a in zip(*scores) if h is not None and a is not None]
        if pairs:
            row["set_scores"] = " ".join(f"{h}-{a}" for h, a in pairs)
            wins = [sum(h > a for h, a in pairs), sum(a > h for h, a in pairs)]
            row["status"] = "completed" if max(wins) >= 2 else "scheduled"
        out.matches.append(row)
    out.entries = list(teams.values())
    for var, name in [
        ("urlScoresheet4v4", "4v4 scoresheet"),
        ("urlScoresheet6v6", "6v6 scoresheet"),
        ("urlScoresheet2of3", "Best-of-three scoresheet"),
        ("urlHowToScore", "Scoring guide"),
    ]:
        found = re.search(rf"{var}\s*=\s*[\'\"]([^\'\"]+)", html)
        if (
            found
            and urlsplit(
                urljoin("https://www.timu.ca/scoreboards/", found.group(1))
            ).scheme
            == "https"
        ):
            out.resources.append(
                {
                    "title": name,
                    "link_url": urljoin(
                        "https://www.timu.ca/scoreboards/", found.group(1)
                    ),
                }
            )
    out.resources.append(
        {
            "title": "TIMU results submission steps",
            "link_url": "https://youtu.be/r8KlhpCRZ1Y",
        }
    )
    return out


def parse_aes(data: dict) -> Snapshot:
    """Read explicit AES event collections; fail closed on unsupported match schemas.

    Summary-only responses remain summary-only. A configured approved match feed can
    supply explicit entries/matches; no undocumented endpoint is guessed.
    """
    if not isinstance(data, dict):
        raise ValueError("AES event must be a JSON object")
    data = data.get("data", data)
    if not isinstance(data, dict) or not any(
        k in data for k in ("divisions", "Divisions", "matches", "Matches")
    ):
        raise ValueError("AES event schema not recognized")
    out = Snapshot()
    for d in data.get("divisions", data.get("Divisions", [])):
        name = d.get("name", d.get("Name"))
        if not name:
            raise ValueError("AES division name missing")
        out.divisions.append(
            {
                "name": name,
                "code": d.get("code", d.get("shortName")),
                "external_id": str(d.get("id", d.get("Id", name))),
            }
        )
    # Explicit interchange collections can also be supplied by an approved AES export feed.
    for row in data.get("entries", []):
        if not all(k in row for k in ("external_entry_id", "team_name", "division")):
            raise ValueError("AES entry schema requires an approved mapping")
        out.entries.append(row)
    for row in data.get("matches", data.get("Matches", [])):
        if not all(
            k in row
            for k in ("external_match_id", "division", "venue", "court", "status")
        ):
            raise ValueError(
                "AES match schema requires an approved mapping; previous data retained"
            )
        out.matches.append(row)
    return out


def fetch_snapshot(mode: str, config: dict) -> Snapshot:
    if not config.get("authorized"):
        raise ValueError("Confirm source access before connecting")
    if mode == "timu":
        tid = str(config.get("tournament_id", ""))
        if not tid.isdigit():
            raise ValueError("TIMU tournament id must contain digits")
        return parse_timu(
            fetch_text(f"https://www.timu.ca/scoreboards/results.php?tid={tid}"), config
        )
    if mode == "aes":
        from app.adapters.aes import read_aes

        return read_aes(config)
    raise ValueError("This source has no live connector")
