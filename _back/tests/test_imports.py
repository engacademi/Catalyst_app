from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from app.models import (
    ChangeEvent,
    Event,
    Match,
    Organization,
    RosterPublication,
    Source,
    Venue,
)
from app.modules.imports import commit_import, stage_import

ENTRIES = b"""external_entry_id,team_name,club_name,division
T1,Lakeshore Thunder,Lakeshore VC,15U Boys D1
T2,Kingston Tide,Limestone VC,15U Boys D1
T3,Summit Strikers,Cedar VC,15U Boys D1
"""

MATCH_HEADER = "external_match_id,division,scheduled_start,venue,court,home_entry_id,away_entry_id,home_placeholder,away_placeholder,status,set_scores\n"


def matches_csv(*rows: str) -> bytes:
    return (MATCH_HEADER + "\n".join(rows) + "\n").encode()


@pytest.fixture
def setup(db):
    org = Organization(name="Test org")
    db.add(org)
    db.flush()
    event = Event(organization_id=org.id, slug="test", title="Test event", start_date=date(2027, 4, 8), end_date=date(2027, 4, 9), status="published")
    db.add(event)
    db.flush()
    db.add(Venue(event_id=event.id, name="Hall A"))
    source = Source(event_id=event.id, name="CSV", mode="manual_import")
    db.add(source)
    db.commit()
    return event, source


def run(db, event, source, kind, content, **options):
    db.refresh(source)
    batch = stage_import(db, event=event, source=source, kind=kind, filename="f.csv", content=content, options={"strict": True, **options}, actor_id=None)
    return batch


def commit(db, batch):
    return commit_import(db, batch.id, None, "test")


def changes(db) -> list[str]:
    return list(db.scalars(select(ChangeEvent.event_type).order_by(ChangeEvent.id)))


def test_identical_replay_changes_nothing(db, setup):
    event, source = setup
    first = run(db, event, source, "entries", ENTRIES)
    assert first.summary["add"] == 3
    commit(db, first)

    replay = run(db, event, source, "entries", ENTRIES)
    assert replay.summary["unchanged"] == 3
    assert replay.summary["identical_to_batch"] == str(first.id)
    commit(db, replay)
    assert changes(db) == []


def test_unknown_team_is_an_error_not_a_fuzzy_match(db, setup):
    event, source = setup
    commit(db, run(db, event, source, "entries", ENTRIES))
    batch = run(db, event, source, "matches", matches_csv("M1,15U Boys D1,2027-04-08T09:00,Hall A,Court 1,T1,LAKESHORE-THUNDER,,,scheduled,"))
    assert batch.rows[0]["action"] == "error"
    assert "unknown away_entry_id" in batch.rows[0]["errors"][0]
    with pytest.raises(HTTPException) as exc:
        commit(db, batch)
    assert exc.value.status_code == 422


def test_court_change_emits_one_change_and_partial_import_keeps_other_matches(db, setup):
    event, source = setup
    commit(db, run(db, event, source, "entries", ENTRIES))
    commit(
        db,
        run(
            db, event, source, "matches",
            matches_csv(
                "M1,15U Boys D1,2027-04-08T09:00,Hall A,Court 1,T1,T2,,,scheduled,",
                "M2,15U Boys D1,2027-04-08T10:00,Hall A,Court 2,T2,T3,,,scheduled,",
            ),
        ),
    )
    # Only M1 is in this file, and its court moved. M2 must not be cancelled.
    batch = run(db, event, source, "matches", matches_csv("M1,15U Boys D1,2027-04-08T09:00,Hall A,Court 3,T1,T2,,,scheduled,"))
    assert batch.rows[0]["action"] == "change"
    commit(db, batch)
    assert changes(db) == ["court_changed"]
    assert db.scalar(select(func.count()).select_from(Match).where(Match.status == "cancelled")) == 0

    replay = run(db, event, source, "matches", matches_csv("M1,15U Boys D1,2027-04-08T09:00,Hall A,Court 3,T1,T2,,,scheduled,"))
    commit(db, replay)
    assert changes(db) == ["court_changed"]


def test_result_and_placeholder_resolution(db, setup):
    event, source = setup
    commit(db, run(db, event, source, "entries", ENTRIES))
    commit(db, run(db, event, source, "matches", matches_csv("F1,15U Boys D1,,Hall A,Court 1,,,W1,W2,scheduled,")))
    match = db.scalar(select(Match))
    assert match.scheduled_start is None
    commit(db, run(db, event, source, "matches", matches_csv("F1,15U Boys D1,2027-04-09T10:00,Hall A,Court 1,T1,T3,,,completed,25-20 23-25 15-11")))
    assert set(changes(db)) == {"time_changed", "result_posted", "status_changed", "participants_resolved"}
    db.refresh(match)
    assert match.result_state == "final"
    assert [(s.home_score, s.away_score) for s in match.sets] == [(25, 20), (23, 25), (15, 11)]


def test_stale_preview_is_rejected(db, setup):
    event, source = setup
    stale = run(db, event, source, "entries", ENTRIES)
    commit(db, run(db, event, source, "entries", ENTRIES))
    with pytest.raises(HTTPException) as exc:
        commit(db, stale)
    assert exc.value.status_code == 409


def test_bad_rows_are_reported(db, setup):
    event, source = setup
    batch = run(db, event, source, "matches", matches_csv("M1,,tomorrow,Hall Z,Court 1,,,,,maybe,25-x"))
    errors = " ".join(batch.rows[0]["errors"])
    for expected in ("division is required", "not an ISO 8601", "status must be", "home_entry_id or home_placeholder", "set score"):
        assert expected in errors
    unknown = run(db, event, source, "entries", b"external_entry_id,team_name,division,birthdate\nT1,A,B,2010-01-01\n")
    assert "Unknown columns: birthdate" in unknown.errors[0]


def test_roster_withholds_unapproved_photos_and_needs_consent_review(db, setup):
    event, source = setup
    commit(db, run(db, event, source, "entries", ENTRIES))
    roster = b"""external_entry_id,jersey,display_name,photo_url,photo_approved
T1,1,Avery A.,https://example.org/a.jpg,yes
T1,2,Jordan B.,https://example.org/b.jpg,no
"""
    commit(db, run(db, event, source, "rosters", roster))
    draft = db.scalar(select(RosterPublication))
    assert draft.state == "draft"
    commit(db, run(db, event, source, "rosters", roster, consent_review_ref="REVIEW-1"))
    published = db.scalar(select(RosterPublication).where(RosterPublication.state == "published"))
    assert [p["photo_url"] for p in published.public_players] == ["https://example.org/a.jpg", None]
