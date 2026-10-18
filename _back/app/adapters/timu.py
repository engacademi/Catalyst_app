"""Read-only TIMU (OVA scoreboards) HTML. Public pages only; HTML is parsed, never executed.

The OVA list gives tournament ids by date. Per tournament, schedule.php gives the venue and
the time grid, results.php gives each match card. Only the grid's clock times are used;
a "**" slot stays without a start.
"""

import re
from datetime import datetime

from bs4 import BeautifulSoup

from app.adapters.live import fetch_text, parse_timu

INDEX_URL = "https://www.timu.ca/ova/index.php"


def upcoming_tids(html, today):
    soup = BeautifulSoup(html, "html.parser")
    tids = []
    for option in soup.select("select#tournament option"):
        group = option.find_parent("optgroup")
        if not group or not option.get("value", "").isdigit():
            continue
        day = datetime.strptime(group["label"].strip("— "), "%A %B %d, %Y").date()
        if day >= today:
            tids.append(option["value"])
    return tids


def read_schedule(html):
    """Tournament details from schedule.php, and each grid slot's clock time if published."""
    soup = BeautifulSoup(html, "html.parser")
    info = {i["name"]: i.get("value", "") for i in soup.select("input[name]")}
    if not info.get("tdate") or not info.get("division"):
        raise ValueError("TIMU schedule details not found; previous schedule retained")
    times = {}
    for table in soup.select("div.divTable"):
        heading = table.find_previous_sibling("div", class_="thead")
        day = re.search(r"([A-Z][a-z]+) (\d{1,2})[a-z]{2} (\d{4})", heading.get_text())
        day = datetime.strptime(" ".join(day.groups()), "%B %d %Y").date()
        courts = []
        for row in table.select("div.divTableRow"):
            cells = [c.get_text(" ", strip=True) for c in row.select("div.divTableCell")]
            if cells[0] == "Time":
                courts = [re.search(r"Court\s+(\S+)", c).group(1) for c in cells[1:]]
                continue
            clock = cells[0].lower()
            when = (
                f"{day}T{datetime.strptime(clock, '%I:%M%p'):%H:%M}:00"
                if re.fullmatch(r"\d{1,2}:\d{2}[ap]m", clock)
                else None  # "**": not yet published
            )
            for court, cell in zip(courts, cells[1:]):
                key = (court, " ".join(re.sub(r"^\(\d+\)", "", cell).split()))
                # A slot listed twice with different times is ambiguous; publish neither.
                times[key] = when if times.get(key, when) == when else None
    return info, times


def read_timu(config, get=fetch_text):
    tid = str(config.get("tournament_id", ""))
    if not tid.isdigit():
        raise ValueError("TIMU tournament id must contain digits")
    info, times = read_schedule(
        get(f"https://www.timu.ca/scoreboards/schedule.php?tid={tid}")
    )
    division = f"{info['division']} {info.get('gender', '')}".strip()
    out = parse_timu(
        get(f"https://www.timu.ca/scoreboards/results.php?tid={tid}"),
        {
            **config,
            "division": division,
            "venue": info.get("venue_name") or config.get("venue"),
        },
        times,
    )
    out.divisions = [{"name": division, "external_id": tid}]
    return out
