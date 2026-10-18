from datetime import date
from pathlib import Path

from app.adapters.csv_adapter import CsvAdapter
from app.adapters.myteam import read_myteam, upcoming_events
from app.modules.sync import _csv

RECORDED = Path(__file__).parent.parent / "sample_data" / "myteam"
UPCOMING = "6ab53cb93d9fb205c13543ed"  # WBT - Downsview- 18U, 2027-04-18
PAST = "68c81e2942cb4dd7af7de77d"  # WBT - Downsview - 16U, 2025-11-16


def recorded(url):
    """Serve recorded MyTeam.click responses by URL; tests never call MyTeam.click live."""
    return (RECORDED / ("_".join(url.split("/")[-2:]) + ".json")).read_text()


def test_unpublished_event_has_divisions_and_teams_but_no_matches():
    snap = read_myteam({"event_id": UPCOMING}, get=recorded)
    assert [d["name"] for d in snap.divisions] == ["18U Girls", "18U Boys"]
    assert [(e["team_name"], e["division"]) for e in snap.entries] == [
        ("C.Buratto/G.Hallman", "18U Girls"),
        ("A.Pressey/M.Zariczniak", "18U Girls"),
    ]
    assert snap.matches == []


def test_published_event_has_matches_on_courts_without_invented_times():
    snap = read_myteam({"event_id": PAST}, get=recorded)
    assert len(snap.entries) == 8 and len(snap.matches) == 19
    match = next(m for m in snap.matches if m["external_match_id"] == "21")
    assert (match["division"], match["venue"], match["court"]) == (
        "16U Girls",
        "Downsview",
        "Court 1",
    )
    assert match["round"] == "Pool 1"
    assert match["home_entry_id"] == "68cd867d87f98ea3f1d6ca14"
    assert match["away_entry_id"] == "68d14719980cb05f1ce3c21b"
    assert match["work_entry_id"] == "68d1420f980cb05f1ce335e5"
    assert match["status"] == "completed" and match["set_scores"] == "21-14 21-5"
    final = next(m for m in snap.matches if m["external_match_id"] == "33")
    assert final["round"] == "Playoffs" and final["court"] == "Court 1"
    # MyTeam.click publishes no clock time for OVA beach matches; never invent one.
    assert {m["scheduled_start"] for m in snap.matches} == {""}
    for kind, rows in (("entries", snap.entries), ("matches", snap.matches)):
        parsed = CsvAdapter().parse(
            kind, _csv(rows), timezone="America/Toronto", strict=True
        )
        assert not parsed.errors and not any(r.errors for r in parsed.rows)


def test_upcoming_events_come_from_the_active_season_from_today_on():
    events = upcoming_events(date(2027, 4, 4), get=recorded)
    assert [(e["_id"], e["name"], e["date"][:10]) for e in events] == [
        ("6ab53c813d9fb205c135418f", "WBT - Downsview- 17U", "2027-04-04"),
        ("6ab53cb93d9fb205c13543ed", "WBT - Downsview- 18U", "2027-04-18"),
    ]
    assert len(upcoming_events(date(2026, 10, 17), get=recorded)) == 24
