"""AES connector through the stage and commit pipeline, fed recorded Event 2 responses."""

import json
import urllib.error
from datetime import date, datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import func, select

from app.models import ChangeEvent, Event, EventEntry, Organization, Source
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
