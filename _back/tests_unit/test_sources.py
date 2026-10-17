import json
import pytest
from app.adapters.aes import read_aes
from app.adapters.live import parse_timu, fetch_text
from app.adapters.csv_adapter import CsvAdapter
from app.modules.operations import map_registration


def test_aes_hierarchy_preserves_ids_scores_and_placeholders():
    payloads = {
        "": {"divisions": [{"id": 7, "name": "15U D1", "code": "15U"}]},
        "/timestamp": {"updated": "v2"},
        "/division/7/playdays": ["2026-04-19"],
        "/division/7/pools/2026-04-19": [{"playId": 9, "name": "Gold"}],
        "/poolsheet/9": {
            "teams": [{"id": 1, "name": "Example A"}, {"id": 2, "name": "Example B"}],
            "matches": [
                {
                    "id": 20,
                    "homeTeamId": 1,
                    "awayPlaceholder": "W7",
                    "scheduledStart": "2026-04-19T10:00:00-04:00",
                    "court": 53,
                    "venueName": "Enercare",
                    "sets": [{"home": 25, "away": 18}],
                    "workTeamId": 2,
                }
            ],
        },
    }
    root = "https://results.advancedeventsystems.com/api/event/key"
    calls = []

    def get(url):
        path = url.removeprefix(root)
        calls.append(path)
        return json.dumps(payloads[path])

    snap = read_aes({"event_key": "key"}, get=get)
    assert len(snap.entries) == 2 and snap.matches[0]["home_entry_id"] == "1"
    assert (
        snap.matches[0]["away_placeholder"] == "W7"
        and snap.matches[0]["work_entry_id"] == "2"
    )
    assert snap.matches[0]["set_scores"] == "25-18"
    calls.clear()
    assert read_aes(
        {
            "event_key": "key",
            "last_sync_success": True,
            "last_timestamp": {"updated": "v2"},
        },
        get=get,
    ).unchanged
    assert calls == ["", "/timestamp"]


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
