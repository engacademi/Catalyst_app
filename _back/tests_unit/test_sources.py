import json
from pathlib import Path

import pytest

from app.adapters.aes import read_aes, search_aes_championships
from app.adapters.csv_adapter import CsvAdapter
from app.adapters.live import fetch_text, parse_timu
from app.modules.operations import map_registration
from app.modules.sync import _csv

AES_KEY = "MjAyNl9PbnRhcmlvX0NoYW1waW9uc2hpcHNfX19FdmVudF8yX182djZHX19UTFNHX18xNVVCXw2"
RECORDED = Path(__file__).parent.parent / "sample_data" / "aes_event2"
SEARCH = (
    Path(__file__).parent.parent / "sample_data" / "aes_search" / "landing_events.json"
)


def recorded(calls=None):
    """Serve the recorded AES Event 2 responses by URL; tests never call AES live."""

    def get(url):
        path = url.split(AES_KEY, 1)[1].strip("/")
        if calls is not None:
            calls.append(path)
        return (RECORDED / f"{path.replace('/', '_') or 'event'}.json").read_text()

    return get


def test_aes_reads_recorded_event_teams_clubs_and_matches():
    snap = read_aes({"event_key": AES_KEY}, get=recorded())
    assert [(d["name"], d["code"]) for d in snap.divisions] == [
        ("15U Boys Division 2", "15UB D2"),
        ("TLS Girls Division 7", "TLSG D7"),
    ]
    assert len(snap.entries) == 46 and len(snap.matches) == 148
    assert len({e["club_name"] for e in snap.entries}) == 38
    rise = next(e for e in snap.entries if e["external_entry_id"] == "-53785")
    assert rise["team_name"] == "Niagara Rapids Rise"
    assert rise["club_name"] == "Niagara Rapids Volleyball Club"
    match = next(m for m in snap.matches if m["external_match_id"] == "-50085")
    assert match["home_entry_id"] == "-54264" and match["away_entry_id"] == "-54313"
    assert (match["venue"], match["court"]) == ("Enercare Centre", "Court 51")
    assert match["status"] == "completed" and match["set_scores"] == "25-11 25-10"
    for kind, rows in (("entries", snap.entries), ("matches", snap.matches)):
        parsed = CsvAdapter().parse(
            kind, _csv(rows), timezone="America/Toronto", strict=True
        )
        assert not parsed.errors and not any(r.errors for r in parsed.rows)
        if kind == "matches":
            row = next(r for r in parsed.rows if r.external_id == "-50085")
            assert row.data["scheduled_start"] == "2026-04-19T15:00:00-04:00"


def test_aes_unchanged_timestamp_skips_the_hierarchy():
    snap = read_aes({"event_key": AES_KEY}, get=recorded())
    calls = []
    config = {
        "event_key": AES_KEY,
        "last_sync_success": True,
        "last_timestamp": snap.timestamp,
    }
    assert read_aes(config, get=recorded(calls)).unchanged
    assert calls == ["", "timestamp"]


def test_aes_changed_schema_does_not_become_empty_schedule():
    with pytest.raises(ValueError, match="division"):
        read_aes(
            {"event_key": "key"}, get=lambda _: json.dumps({"error": "Unavailable"})
        )


def test_timu_results_contract():
    html = """<meta property="og:title" content="Example Cup"><div class="wrapper" id="1000"><div>Gold Medal (W7 vs W8)</div><div>Court: 3</div><div class="home-box"><div class="away">Example A</div><div class="set-block">2</div><div class="set-block">25</div><div class="set-block">25</div></div><div class="away-box"><div class="away">Example B</div><div class="set-block">0</div><div class="set-block">18</div><div class="set-block">20</div></div></div>"""
    result = parse_timu(html, {"venue": "School"})
    assert len(result.entries) == 2 and result.matches[0]["status"] == "completed"
    assert result.matches[0]["home_placeholder"] == "W7"
    assert result.matches[0]["scheduled_start"] == "", (
        "Never invent times from results HTML"
    )
    assert result.matches[0]["set_scores"] == "25-18 25-20"


def test_timu_error_page_rejected():
    with pytest.raises(ValueError):
        parse_timu("<html>Maintenance</html>", {})


def test_source_transport_rejects_arbitrary_hosts_before_network():
    with pytest.raises(ValueError):
        fetch_text("https://127.0.0.1/secrets")


def test_registration_mapping_preserves_only_selected_fields():
    body = b"Team,Number,Name,Contact\nREG1,8,Example A.,private@example.org\n"
    mapped = map_registration(
        body,
        {"external_entry_id": "Team", "jersey": "Number", "display_name": "Name"},
        {},
    )
    assert b"Contact" not in mapped and b"private@" not in mapped
    result = CsvAdapter().parse("rosters", mapped, timezone="America/Toronto")
    assert not result.errors and result.rows[0].data["jersey"] == 8


def changed_recording(transform):
    def get(url):
        payload = json.loads(recorded()(url))
        transform(url.split(AES_KEY, 1)[1], payload)
        return json.dumps(payload)

    return get


@pytest.mark.parametrize("flag", [None, "false"])
def test_aes_invalid_pool_flag_fails_instead_of_successful_empty_sync(flag):
    def transform(path, payload):
        if path.endswith("/playdays"):
            if flag is None:
                payload[0].pop("HasPools")
            else:
                payload[0]["HasPools"] = flag

    with pytest.raises(ValueError):
        read_aes({"event_key": AES_KEY}, get=changed_recording(transform))


@pytest.mark.parametrize("bad_matches", [None, {}, "unavailable"])
def test_aes_rejects_malformed_match_collections(bad_matches):
    def transform(path, payload):
        if path.startswith("/poolsheet/"):
            payload["Matches"] = bad_matches

    with pytest.raises(ValueError):
        read_aes({"event_key": AES_KEY}, get=changed_recording(transform))


def test_aes_rejects_missing_selected_division():
    with pytest.raises(ValueError, match="Selected AES division missing"):
        read_aes({"event_key": AES_KEY, "division_ids": ["missing"]}, get=recorded())


def test_aes_partial_scores_do_not_assert_live_status_and_work_teams_survive():
    def transform(path, payload):
        if path == "/poolsheet/-50024":
            match = payload["Matches"][0]
            match["FirstTeamWon"] = match["SecondTeamWon"] = False
            match["WorkTeamId"] = match["FirstTeamId"]

    snap = read_aes({"event_key": AES_KEY}, get=changed_recording(transform))
    match = next(m for m in snap.matches if m["work_entry_id"])
    assert match["status"] == "scheduled"
    assert match["set_scores"]
    assert match["work_entry_id"] == match["home_entry_id"]


def test_aes_search_finds_ontario_championships_with_results_keys():
    urls = []

    def get(url):
        urls.append(url)
        return SEARCH.read_text()

    found = search_aes_championships(get=get)
    assert urls[0].startswith(
        "https://www.advancedeventsystems.com/api/landing/events?"
    )
    names = [f["name"] for f in found]
    assert len(names) == 28
    assert "5th Annual OVA Championships" not in names  # OVA outside Ontario
    assert "Ontario Volleyball 2023 16U & 18U Fall Classic" not in names
    assert names[:4] == [
        "2026 Ontario Championships - Event 3 (6v6B, 16U, 18U)",
        "2026 Ontario Championships - Event 2 (6v6G, TLSG, 15UB)",
        "2026 Ontario Championships - Event 1 (TLSB, 15UG, 17UB/G)",
        "2026 Ontario Championships - 4v4 Boys and Girls",
    ]
    assert found[1]["eventSchedulerKey"] == AES_KEY
    assert found[2]["eventSchedulerKey"] == (
        "MjAyNl9PbnRhcmlvX0NoYW1waW9uc2hpcHNfX19FdmVudF8xX19UTFNCX18xNVVHX18xN1VCX0df0"
    )


TIMU = Path(__file__).parent.parent / "sample_data" / "timu"


def timu_recorded(url):
    """Serve the recorded TIMU pages by URL; tests never call TIMU live."""
    if url == "https://www.timu.ca/ova/index.php":
        return (TIMU / "index.html").read_text()
    page, tid = url.rsplit("/", 1)[1].split(".php?tid=")
    return (TIMU / f"{page}_{tid}.html").read_text()


def test_timu_lists_tournaments_dated_today_or_later():
    from datetime import date

    from app.adapters.timu import upcoming_tids

    html = timu_recorded("https://www.timu.ca/ova/index.php")
    assert upcoming_tids(html, date(2026, 10, 17)) == ["4190", "4191", "4196"]
    assert upcoming_tids(html, date(2026, 10, 18)) == ["4190", "4191"]


def test_timu_reads_teams_courts_venue_and_real_start_times():
    from app.adapters.timu import read_timu

    snap = read_timu({"tournament_id": "4190"}, get=timu_recorded)
    assert snap.divisions == [{"name": "15U Girls", "external_id": "4190"}]
    assert len(snap.entries) == 9 and len(snap.matches) == 21
    first = next(m for m in snap.matches if m["external_match_id"] == "1000")
    assert (first["home_entry_id"], first["away_entry_id"]) == (
        "Jr Gryphons Guardians",
        "Humana Embers",
    )
    assert (first["venue"], first["court"], first["round"]) == (
        "North London Optimist Community",
        "Court 1",
        "Pool A",
    )
    assert first["scheduled_start"] == "2026-10-24T08:45:00"
    second_wave = next(m for m in snap.matches if m["external_match_id"] == "1003")
    assert second_wave["scheduled_start"] == "", "A ** slot has no published time"
    gold = next(m for m in snap.matches if m["round"] == "Gold Medal")
    assert (gold["home_placeholder"], gold["away_placeholder"]) == ("W7", "W8")
    assert gold["home_entry_id"] == gold["away_entry_id"] == ""

    played = read_timu({"tournament_id": "4196"}, get=timu_recorded)
    final = next(m for m in played.matches if m["round"] == "Tier 1 - Gold")
    assert (final["court"], final["scheduled_start"]) == ("Court 1", "2026-10-17T15:15:00")
    assert final["home_entry_id"] == "REACH Ultra" and final["status"] == "completed"
    assert final["set_scores"] == "25-11 25-20"
    for kind, rows in (("entries", played.entries), ("matches", played.matches)):
        parsed = CsvAdapter().parse(
            kind, _csv(rows), timezone="America/Toronto", strict=True
        )
        assert not parsed.errors and not any(r.errors for r in parsed.rows)


def test_timu_pool_d_slot_stays_a_placeholder():
    html = timu_recorded("https://www.timu.ca/scoreboards/results.php?tid=4190")
    snap = parse_timu(html.replace(">B1<", ">D1<"), {"venue": "School"})
    match = next(m for m in snap.matches if m["home_placeholder"] == "B1")
    assert match["home_entry_id"] == "" and "D1" not in {
        e["team_name"] for e in snap.entries
    }


def test_paused_or_failed_live_source_reports_at_once():
    from datetime import datetime, timezone

    from app.models import Source
    from app.modules.projections import source_freshness

    now = datetime.now(timezone.utc)
    live = Source(
        mode="aes",
        status="active",
        config={"last_sync_success": True},
        expected_check_interval_minutes=15,
        last_successful_check_at=now,
    )
    assert source_freshness(live, now) == "current"
    live.status = "paused"
    assert source_freshness(live, now) == "paused"
    live.status = "unavailable"
    assert source_freshness(live, now) == "unavailable"
    snapshot = Source(mode="manual_import", status="paused", config={})
    snapshot.last_import_at = now
    assert source_freshness(snapshot, now) == "imported_snapshot"
