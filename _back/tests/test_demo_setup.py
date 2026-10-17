"""The one-command demo setup, checked through the public and staff API. AES is replayed, never called."""

from datetime import datetime

import pytest

from app.demo_setup import EVENT_A_SLUG, EVENT_B_SLUG, setup_demo
from tests.conftest import ADMIN
from tests.test_aes import recorded

DEMO_TIME = datetime.fromisoformat("2026-04-19T09:40:00-04:00")


@pytest.fixture
def demo_mode(monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "demo_mode", True)


def down(url: str) -> bytes:
    raise TimeoutError("timed out")


def event(client, slug: str) -> dict:
    return client.get(f"/v1/events/{slug}").json()


def test_setup_creates_both_events_at_demo_time(client, db, demo_mode):
    setup_demo(db, fetch=recorded())

    real = event(client, EVENT_A_SLUG)
    assert real["data"]["demo_time"] is True
    assert abs((datetime.fromisoformat(real["data"]["now"]) - DEMO_TIME).total_seconds()) < 60
    [aes] = real["sources"]
    assert aes["mode"] == "aes" and aes["name"] == "AES Event 2" and aes["freshness"] == "current"
    assert client.get(f"/v1/events/{EVENT_A_SLUG}/teams").json()["total"] == 46
    matches = client.get(f"/v1/events/{EVENT_A_SLUG}/matches", params={"status": "upcoming"}).json()["data"]
    assert matches and all(m["court"]["area"] and "demo" in m["court"]["area"] for m in matches)

    simulated = event(client, EVENT_B_SLUG)
    assert simulated["data"]["demo_time"] is True and "simulated" in simulated["data"]["title"].lower()
    [csv] = simulated["sources"]
    assert csv["freshness"] == "imported_snapshot" and "simulated" in csv["name"].lower()


def test_unreachable_aes_falls_back_to_recorded_responses_and_says_so(client, db, demo_mode):
    result = setup_demo(db, fetch=down)

    assert result.aes_live is False
    real = event(client, EVENT_A_SLUG)
    [aes] = real["sources"]
    assert aes["name"] == "AES Event 2 (recorded responses, not live)"
    assert aes["freshness"] == "imported_snapshot", "a replay is never shown as a live check"
    assert aes["upstream_updated_at"], "the recorded AES last-update time is kept"
    assert client.get(f"/v1/events/{EVENT_A_SLUG}/teams").json()["total"] == 46
    assert client.get(f"/v1/events/{EVENT_A_SLUG}/matches", params={"status": "upcoming"}).json()["data"]
    assert real["data"]["demo_time"] is True


def snapshot(client) -> dict:
    """What attendees see of both events, without ids that a rebuild regenerates."""
    state = {}
    for slug in (EVENT_A_SLUG, EVENT_B_SLUG):
        body = event(client, slug)
        matches = client.get(f"/v1/events/{slug}/matches", params={"limit": 200}).json()["data"]
        state[slug] = {
            "title": body["data"]["title"],
            "demo_time": body["data"]["demo_time"],
            "sources": [(s["name"], s["mode"], s["freshness"]) for s in body["sources"]],
            "teams": sorted(t["team_name"] for t in client.get(f"/v1/events/{slug}/teams", params={"limit": 100}).json()["data"]),
            "matches": sorted(
                (
                    m["round_label"] or "",
                    m["scheduled_start"] or "",
                    m["court"]["label"],
                    m["court"]["area"] or "",
                    m["status"],
                    m["home"]["team_name"] or m["home"]["placeholder"],
                    m["away"]["team_name"] or m["away"]["placeholder"],
                )
                for m in matches
            ),
            "changes": len(client.get(f"/v1/events/{slug}/changes").json()["data"]),
        }
    return state


def upload(client, event_id: str, filename: str) -> dict:
    from app.demo_setup import EVENT_B_FILES

    detail = client.get(f"/v1/admin/events/{event_id}", headers=ADMIN).json()["data"]
    staged = client.post(
        "/v1/admin/imports",
        data={"event_id": event_id, "source_id": detail["sources"][0]["id"], "kind": "matches"},
        files={"file": (filename, (EVENT_B_FILES / filename).read_bytes(), "text/csv")},
        headers=ADMIN,
    ).json()["data"]
    client.post(f"/v1/admin/imports/{staged['id']}/commit", headers=ADMIN)
    return staged


def test_running_twice_leaves_the_same_state_even_after_a_rehearsal(client, db, demo_mode):
    first = setup_demo(db, fetch=recorded())
    before = snapshot(client)

    upload(client, str(first.event_b.id), "step-5-playoff-filled.csv")
    assert snapshot(client) != before

    setup_demo(db, fetch=recorded())
    assert snapshot(client) == before


@pytest.fixture
def frozen_clock(monkeypatch):
    now = datetime.fromisoformat("2026-10-18T14:00:00+00:00")
    monkeypatch.setattr("app.modules.clock.real_now", lambda: now)


def team_id(client, name: str) -> str:
    [team] = client.get(f"/v1/events/{EVENT_B_SLUG}/teams", params={"q": name}).json()["data"]
    return team["id"]


def test_simulated_event_walks_through_the_demo_script(client, db, demo_mode, frozen_clock):
    setup = setup_demo(db, fetch=recorded())
    maya, sibling = team_id(client, "Lakeview Lightning 16U"), team_id(client, "Lakeview Lightning 14U")
    [division] = {m["division"]["id"] for m in client.get(f"/v1/events/{EVENT_B_SLUG}/matches", params={"entry_ids": maya}).json()["data"]}

    def my_day() -> dict:
        params = {"entry_ids": f"{maya},{sibling}", "division_ids": division}
        return client.get(f"/v1/events/{EVENT_B_SLUG}/my-day", params=params).json()["data"]

    # Step 2: next match on Court 53 in Hall C, a work duty later that morning, the division in its own section.
    day = my_day()
    following = day["matches"][day["next_match_id"]]
    assert (following["court"]["label"], following["court"]["area"]) == ("Court 53", "Hall C")
    assert following["scheduled_start"] == "2026-04-19T10:00:00-04:00"
    [duty] = [d for d in day["work_duties"] if d["entry_id"] == maya]
    assert day["matches"][duty["match_id"]]["scheduled_start"] == "2026-04-19T11:00:00-04:00"
    assert [s["division"]["name"] for s in day["division_sections"]] == ["16U Girls Division 1"]
    assert day["conflicts"] == []

    # Step 7: the roster is public but the unapproved photo is left out.
    players = client.get(f"/v1/entries/{maya}").json()["data"]["roster"]["players"]
    assert len(players) == 10 and all(p["photo_url"] is None for p in players)

    # Step 4: Hall C runs 20 minutes late; the 10:00 match is estimated at 10:20 and now overlaps the 11:00 one.
    venue = following["court"]["venue_id"]
    posted = client.post(f"/v1/admin/venues/{venue}/delay-notices", json={"area": "Hall C", "minutes": 20}, headers=ADMIN)
    assert posted.status_code == 201
    day = my_day()
    delayed = day["matches"][day["next_match_id"]]
    assert delayed["estimated_start"] == "2026-04-19T10:20:00-04:00" and delayed["estimated_start_by"] == "ova_staff"
    assert any(delayed["id"] in c["match_ids"] for c in day["conflicts"])

    # Step 5: the presenter imports the filled playoff slot; followers hear "Next match set".
    upload(client, str(setup.event_b.id), "step-5-playoff-filled.csv")
    changes = client.get(f"/v1/events/{EVENT_B_SLUG}/changes").json()["data"]
    [news] = [c for c in changes if c["event_type"] == "next_match_set"]
    assert maya in news["entry_ids"]
    assert news["diff"]["round"] == "Gold medal" and news["diff"]["court"].startswith("Court 12")
    assert news["diff"]["scheduled_start"] == "2026-04-19T14:00:00-04:00"
    assert any(m["round_label"] == "Gold medal" for m in my_day()["matches"].values())

    # Step 6: the updated file previews exactly one court change.
    staged = upload(client, str(setup.event_b.id), "step-6-court-change.csv")
    assert staged["summary"]["change"] == 1 and staged["summary"]["add"] == 0
    moved = [c for c in client.get(f"/v1/events/{EVENT_B_SLUG}/changes").json()["data"] if c["event_type"] == "court_changed"]
    assert len(moved) == 1 and moved[0]["diff"]["court"][0].startswith("Court 53")


def test_switching_the_aes_source_off_keeps_the_schedule_and_says_since_when(client, db, demo_mode):
    setup = setup_demo(db, fetch=recorded())
    [source] = client.get(f"/v1/admin/events/{setup.event_a.id}", headers=ADMIN).json()["data"]["sources"]
    client.patch(f"/v1/admin/sources/{source['id']}", json={"status": "unavailable"}, headers=ADMIN)

    [aes] = event(client, EVENT_A_SLUG)["sources"]
    assert aes["freshness"] == "unavailable" and aes["unavailable_since"]
    assert client.get(f"/v1/events/{EVENT_A_SLUG}/matches", params={"status": "upcoming"}).json()["data"]

    client.patch(f"/v1/admin/sources/{source['id']}", json={"status": "active"}, headers=ADMIN)
    [aes] = event(client, EVENT_A_SLUG)["sources"]
    assert aes["freshness"] == "current" and aes["unavailable_since"] is None


def test_offline_setup_skips_aes_and_labels_the_recorded_source(client, db, demo_mode):
    def never(url: str) -> bytes:
        raise AssertionError("offline setup called AES")

    result = setup_demo(db, fetch=never, offline=True)
    assert result.aes_live is False
    [aes] = event(client, EVENT_A_SLUG)["sources"]
    assert aes["name"] == "AES Event 2 (recorded responses, not live)" and aes["freshness"] == "imported_snapshot"


def test_the_command_prints_both_events(client, monkeypatch, capsys, demo_mode):
    from app import cli

    monkeypatch.setattr("sys.argv", ["app.cli", "demo-setup", "--offline"])
    cli.main()
    out = capsys.readouterr().out
    assert f"/events/{EVENT_A_SLUG}" in out and f"/events/{EVENT_B_SLUG}" in out and "recorded" in out
    assert event(client, EVENT_B_SLUG)["data"]["demo_time"] is True


def test_aes_event_replays_april_at_demo_time(client, db, demo_mode, frozen_clock):
    setup_demo(db, fetch=recorded())

    body = event(client, EVENT_A_SLUG)["data"]
    assert body["replay"] is True
    results = client.get(f"/v1/events/{EVENT_A_SLUG}/matches", params={"status": "results"}).json()["data"]
    assert results == [], "nothing had finished by 9:40 am"
    upcoming = client.get(f"/v1/events/{EVENT_A_SLUG}/matches", params={"status": "upcoming"}).json()["data"]
    assert upcoming and all(m["status"] == "scheduled" and m["sets"] == [] and m["sets_won"] is None for m in upcoming)

    # The simulated CSV event isn't a finished AES event, so its results stay as imported.
    assert event(client, EVENT_B_SLUG)["data"]["replay"] is False
    assert client.get(f"/v1/events/{EVENT_B_SLUG}/matches", params={"status": "results"}).json()["data"]


def aes_match(client, start: str) -> dict:
    matches = client.get(f"/v1/events/{EVENT_A_SLUG}/matches", params={"limit": 200}).json()["data"]
    return next(m for m in matches if m["scheduled_start"] == start)


def test_replayed_results_appear_once_the_match_would_have_ended(client, db, demo_mode, frozen_clock):
    setup = setup_demo(db, fetch=recorded())
    clock = f"/v1/admin/events/{setup.event_a.id}/demo-clock"
    client.put(clock, json={"demo_time": "2026-04-19T15:50:00-04:00"}, headers=ADMIN)

    # Started at 3:00 pm; with a 60-minute assumed length it hasn't finished at 3:50.
    playing = aes_match(client, "2026-04-19T15:00:00-04:00")
    assert playing["status"] == "scheduled" and playing["sets"] == [] and playing["sets_won"] is None
    assert playing["expected_to_start_soon"] is True
    detail = client.get(f"/v1/matches/{playing['id']}").json()["data"]
    assert detail["status"] == "scheduled" and detail["result_state"] == "none" and detail["sets"] == []

    client.post(f"{clock}/jump", json={"minutes": 15}, headers=ADMIN)
    finished = client.get(f"/v1/matches/{playing['id']}").json()["data"]
    assert finished["status"] == "completed" and finished["sets_won"] and finished["sets"]
    later = aes_match(client, "2026-04-19T16:10:00-04:00")
    assert later["status"] == "scheduled" and later["sets"] == []

    client.delete(clock, headers=ADMIN)
    assert event(client, EVENT_A_SLUG)["data"]["replay"] is False
    assert aes_match(client, "2026-04-19T16:10:00-04:00")["status"] == "completed"
    upcoming = client.get(f"/v1/events/{EVENT_A_SLUG}/matches", params={"status": "upcoming"}).json()["data"]
    assert upcoming == [], "with demo time off every stored result shows again"


def test_replayed_match_takes_a_delay_notice_and_is_the_next_match(client, db, demo_mode, frozen_clock):
    setup_demo(db, fetch=recorded())
    first = aes_match(client, "2026-04-19T15:00:00-04:00")
    team = first["home"]["entry_id"]

    day = client.get(f"/v1/events/{EVENT_A_SLUG}/my-day", params={"entry_ids": team}).json()["data"]
    assert day["next_match_id"] == first["id"] and day["completed_ids"] == []

    posted = client.post(f"/v1/admin/courts/{first['court']['id']}/delay-notices", json={"minutes": 20}, headers=ADMIN)
    assert posted.status_code == 201
    delayed = client.get(f"/v1/matches/{first['id']}").json()["data"]
    assert delayed["estimated_start"] == "2026-04-19T15:20:00-04:00" and delayed["estimated_start_by"] == "ova_staff"
    [news] = [c for c in client.get(f"/v1/events/{EVENT_A_SLUG}/changes").json()["data"] if c["event_type"] == "delay_posted"]
    assert team in news["entry_ids"], "followers of a team still to play on the court hear about the delay"


def test_nothing_is_replayed_outside_demo_mode(client, db):
    setup_demo(db, fetch=recorded())

    body = event(client, EVENT_A_SLUG)["data"]
    assert body["demo_time"] is False and body["replay"] is False
    assert client.get(f"/v1/events/{EVENT_A_SLUG}/matches", params={"status": "upcoming"}).json()["data"] == []
