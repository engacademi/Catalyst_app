"""AES connector through the stage and commit pipeline, fed recorded Event 2 responses."""

import json
import urllib.error
from datetime import date, datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.models import ChangeEvent, Court, Event, EventEntry, Match, Organization, Source, Venue
from app.modules.imports import commit_import
from app.modules.refresh import SourceUnavailable, refresh_source

FIXTURES = Path(__file__).parent / "fixtures" / "aes"
EVENT_KEY = "MjAyNl9PbnRhcmlvX0NoYW1waW9uc2hpcHNfX19FdmVudF8yX182djZHX19UTFNHX18xNVVCXw2"
BASE = f"https://results.advancedeventsystems.com/api/event/{EVENT_KEY}"


def recorded(overrides: dict | None = None):
    """Serve recorded AES responses by URL; overrides edit a path's parsed JSON first."""
    overrides = overrides or {}

    def fetch(url: str) -> bytes:
        assert url.startswith(BASE), url
        path = url[len(BASE) :].strip("/")
        body = (FIXTURES / f"{path.replace('/', '_') or 'event'}.json").read_bytes()
        if path in overrides:
            body = json.dumps(overrides[path](json.loads(body))).encode()
        return body

    return fetch


@pytest.fixture
def aes(db):
    org = Organization(name="OVA")
    db.add(org)
    db.flush()
    event = Event(organization_id=org.id, slug="ontario-2", title="Ontario Championships Event 2", start_date=date(2026, 4, 19), end_date=date(2026, 4, 21), status="published")
    db.add(event)
    db.flush()
    source = Source(event_id=event.id, name="AES", mode="aes", external_key=EVENT_KEY)
    db.add(source)
    db.commit()
    return event, source


def refresh(db, event, source, fetch=None):
    db.refresh(source)
    return refresh_source(db, event=event, source=source, kind="entries", fetch=fetch or recorded(), actor_id=None)


def teams(db, event) -> dict[str, tuple[str, str | None, str]]:
    rows = db.scalars(select(EventEntry).where(EventEntry.event_id == event.id))
    return {e.team_name: (e.division.name, e.club_name, e.division.code) for e in rows}


def test_refresh_previews_divisions_clubs_and_teams(db, aes):
    event, source = aes
    batch = refresh(db, event, source)
    assert batch.state == "staged" and batch.kind == "entries"
    assert batch.summary["add"] == 46 and batch.summary["error"] == 0
    assert batch.summary["found"] == {"divisions": 2, "clubs": 38, "teams": 46}
    assert teams(db, event) == {}, "nothing changes before commit"

    commit_import(db, batch.id, None, "test")
    found = teams(db, event)
    assert len(found) == 46
    assert found["Woodstock Warriors"] == ("TLS Girls Division 7", "Woodstock Warriors", "TLSG D7")
    assert found["Niagara Rapids Rise"] == ("TLS Girls Division 7", "Niagara Rapids Volleyball Club", "TLSG D7")


def test_identical_replay_changes_nothing(db, aes):
    event, source = aes
    first = refresh(db, event, source)
    commit_import(db, first.id, None, "test")
    before = teams(db, event)

    replay = refresh(db, event, source)
    assert replay.summary["unchanged"] == 46 and replay.summary["add"] == replay.summary["change"] == 0
    assert replay.summary["identical_to_batch"] == str(first.id)
    commit_import(db, replay.id, None, "test")
    assert teams(db, event) == before
    assert db.scalar(select(func.count()).select_from(ChangeEvent)) == 0


def rename(team_id: int, name: str):
    def edit(pools):
        for pool in pools:
            for team in pool["Teams"]:
                if team["TeamId"] == team_id:
                    team["TeamName"] = name
        return pools

    return edit


def test_aes_ids_identify_teams_and_divisions_not_names(db, aes):
    event, source = aes
    commit_import(db, refresh(db, event, source).id, None, "test")

    # AES renames a team and a division; the same ids keep the same entries.
    renamed = recorded({
        "division/-50019/pools/2026-04-19": rename(-53808, "Woodstock Warriors 14"),
        "": lambda e: {**e, "Divisions": [{**d, "Name": d["Name"] + " (Gold)"} if d["DivisionId"] == -50019 else d for d in e["Divisions"]]},
    })
    batch = refresh(db, event, source, renamed)
    assert batch.summary["add"] == 0
    changed = {r["data"]["team_name"]: r["changes"] for r in batch.rows if r["action"] == "change"}
    assert set(changed["Woodstock Warriors 14"]) == {"division", "team_name"}
    assert len(changed) == 20, "every team in the renamed division"
    commit_import(db, batch.id, None, "test")
    found = teams(db, event)
    assert len(found) == 46 and "Woodstock Warriors" not in found
    assert found["Woodstock Warriors 14"][0] == "TLS Girls Division 7 (Gold)"


def test_a_team_sharing_a_name_is_still_a_separate_team(db, aes):
    event, source = aes
    twin = recorded({"division/-50019/pools/2026-04-19": rename(-53785, "Woodstock Warriors")})
    batch = refresh(db, event, source, twin)
    assert batch.summary["add"] == 46
    commit_import(db, batch.id, None, "test")
    assert db.scalar(select(func.count()).where(EventEntry.team_name == "Woodstock Warriors")) == 2


def test_commit_records_aes_last_update_as_upstream_time(db, aes):
    event, source = aes
    commit_import(db, refresh(db, event, source).id, None, "test")
    db.refresh(source)
    assert source.upstream_updated_at == datetime(2026, 4, 28, 13, 43, 1, 963904, tzinfo=timezone.utc)
    assert source.last_successful_check_at is not None


def timeout(url: str) -> bytes:
    raise TimeoutError("timed out")


def http_error(url: str) -> bytes:
    raise urllib.error.HTTPError(url, 503, "Service Unavailable", {}, None)


def html_page(url: str) -> bytes:
    return b"<html><body>Maintenance</body></html>"


@pytest.mark.parametrize("broken", [timeout, http_error, html_page], ids=["timeout", "http-error", "non-json"])
def test_failed_check_keeps_last_good_data_and_marks_source_unavailable(db, aes, broken):
    event, source = aes
    commit_import(db, refresh(db, event, source).id, None, "test")
    before = teams(db, event)

    with pytest.raises(SourceUnavailable):
        refresh(db, event, source, broken)
    db.refresh(source)
    assert source.status == "unavailable" and source.unavailable_since is not None
    assert source.last_check_error
    assert teams(db, event) == before
    first_failure = source.unavailable_since

    with pytest.raises(SourceUnavailable):
        refresh(db, event, source, broken)
    db.refresh(source)
    assert source.unavailable_since == first_failure, "unavailable since the first failure"

    refresh(db, event, source)
    db.refresh(source)
    assert source.status == "active" and source.unavailable_since is None and source.last_check_error is None


# ---- matches (ticket #9) ----------------------------------------------------------


@pytest.fixture
def aes_teams(db, aes):
    event, source = aes
    db.add(Venue(event_id=event.id, name="Enercare Centre"))
    db.commit()
    commit_import(db, refresh(db, event, source).id, None, "test")
    return event, source


def refresh_matches(db, event, source, fetch=None):
    db.refresh(source)
    return refresh_source(db, event=event, source=source, kind="matches", fetch=fetch or recorded(), actor_id=None)


def match(db, source, aes_match_id: int) -> Match:
    return db.scalar(select(Match).where(Match.source_id == source.id, Match.external_id == str(aes_match_id)))


def test_refresh_previews_then_commits_pool_matches(db, aes_teams):
    event, source = aes_teams
    batch = refresh_matches(db, event, source)
    assert batch.state == "staged" and batch.kind == "matches"
    assert batch.summary["add"] == 148 and batch.summary["error"] == 0
    assert db.scalar(select(func.count()).select_from(Match)) == 0, "nothing changes before commit"

    commit_import(db, batch.id, None, "test")
    m3 = match(db, source, -52826)
    assert m3.round_label == "Pool A · Match 3"
    assert m3.division.name == "TLS Girls Division 7"
    teams_by_slot = {p.slot: p.entry.team_name for p in m3.participants}
    assert teams_by_slot == {"home": "Niagara Rapids Rise", "away": "YRV Ice"}
    assert m3.scheduled_start == datetime(2026, 4, 19, 19, 0, tzinfo=timezone.utc), "3:00 pm Toronto time"
    assert [(s.home_score, s.away_score) for s in m3.sets] == [(25, 13), (25, 14)]
    assert m3.status == "completed" and m3.work_entry_id is None
    assert (m3.court.label, m3.court.venue.name) == ("Court 29", "Enercare Centre")


def edit_match(match_id: int, **fields):
    def edit(sheet):
        for m in sheet["Matches"]:
            if m["MatchId"] == match_id:
                m.update(fields)
        return sheet

    return edit


def test_identical_match_replay_changes_nothing(db, aes_teams):
    event, source = aes_teams
    commit_import(db, refresh_matches(db, event, source).id, None, "test")
    replay = refresh_matches(db, event, source)
    assert replay.summary["unchanged"] == 148 and replay.summary["add"] == replay.summary["change"] == 0
    commit_import(db, replay.id, None, "test")
    assert db.scalar(select(func.count()).select_from(ChangeEvent)) == 0


def test_a_changed_court_creates_exactly_one_change_event(db, aes_teams):
    event, source = aes_teams
    commit_import(db, refresh_matches(db, event, source).id, None, "test")

    moved = recorded({"poolsheet/-52821": edit_match(-52826, Court={"CourtId": -52984, "Name": "Court 30"})})
    batch = refresh_matches(db, event, source, moved)
    assert batch.summary["change"] == 1 and batch.summary["unchanged"] == 147
    commit_import(db, batch.id, None, "test")
    changes = db.scalars(select(ChangeEvent)).all()
    assert [(c.event_type, c.diff["court"]) for c in changes] == [
        ("court_changed", ["Court 29 (Enercare Centre)", "Court 30 (Enercare Centre)"])
    ]
    assert match(db, source, -52826).court.label == "Court 30"

    commit_import(db, refresh_matches(db, event, source, moved).id, None, "test")
    assert db.scalar(select(func.count()).select_from(ChangeEvent)) == 1, "replaying the move adds nothing"


def test_matches_missing_from_a_partial_response_are_kept(db, aes_teams):
    event, source = aes_teams
    commit_import(db, refresh_matches(db, event, source).id, None, "test")
    partial = recorded({"poolsheet/-52821": lambda sheet: {**sheet, "Matches": sheet["Matches"][:1]}})
    batch = refresh_matches(db, event, source, partial)
    assert batch.summary["unchanged"] == 148 - 5
    commit_import(db, batch.id, None, "test")
    assert db.scalar(select(func.count()).select_from(Match)) == 148
    assert db.scalar(select(func.count()).select_from(ChangeEvent)) == 0


def test_aes_work_team_becomes_the_matches_work_entry(db, aes_teams):
    event, source = aes_teams
    work = recorded({"poolsheet/-52821": edit_match(-52826, WorkTeamId=-53808, WorkTeamText="Woodstock Warriors (11)")})
    commit_import(db, refresh_matches(db, event, source, work).id, None, "test")
    assert match(db, source, -52826).work_entry.team_name == "Woodstock Warriors"
    others = db.scalars(select(Match).where(Match.external_id != "-52826")).all()
    assert all(m.work_entry_id is None for m in others), "no work duty when AES assigns none"


def test_matches_need_teams_committed_first(db, aes):
    event, source = aes
    batch = refresh_matches(db, event, source)
    assert batch.summary["error"] == 148
    assert any("import entries first" in e for e in batch.rows[0]["errors"])


def test_aes_courts_go_under_the_events_venue_and_keep_their_ids(db, aes_teams):
    event, source = aes_teams
    commit_import(db, refresh_matches(db, event, source).id, None, "test")
    venues = db.scalars(select(Venue).where(Venue.event_id == event.id)).all()
    assert [v.name for v in venues] == ["Enercare Centre"]
    labels = {c.label for c in db.scalars(select(Court).where(Court.venue_id == venues[0].id))}
    assert {"Court 6", "Court 14", "Court 29", "Court 30", "Court 51", "Court 58"} <= labels
    assert all(label.startswith("Court ") for label in labels)

    # AES renames a court; its CourtId keeps it the same court, so nothing moves.
    renamed = recorded({"poolsheet/-52821": edit_match(-52826, Court={"CourtId": -52983, "Name": "Court 29A"})})
    batch = refresh_matches(db, event, source, renamed)
    assert batch.summary["change"] == 0


def test_without_a_venue_the_aes_location_becomes_the_venue(db, aes):
    event, source = aes
    commit_import(db, refresh(db, event, source).id, None, "test")
    commit_import(db, refresh_matches(db, event, source).id, None, "test")
    venues = db.scalars(select(Venue).where(Venue.event_id == event.id)).all()
    assert [v.name for v in venues] == ["Enercare Centre"]
    assert match(db, source, -52826).court.venue_id == venues[0].id
