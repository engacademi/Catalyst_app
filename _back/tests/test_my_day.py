import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.modules.my_day import build_my_day

T0 = datetime(2027, 4, 8, 13, 0, tzinfo=timezone.utc)
VENUE_A, VENUE_B = uuid.uuid4(), uuid.uuid4()


def match(start, home, away, status="scheduled", venue=VENUE_A):
    return SimpleNamespace(
        id=uuid.uuid4(),
        external_id=str(start),
        status=status,
        scheduled_start=start,
        estimated_start=None,
        court=SimpleNamespace(venue_id=venue),
        participants=[SimpleNamespace(entry_id=home), SimpleNamespace(entry_id=away)],
    )


def test_overlap_across_venues_is_one_conflict_group():
    a, b, other = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    first = match(T0, a, other)
    second = match(T0 + timedelta(minutes=30), b, other, venue=VENUE_B)
    later = match(T0 + timedelta(hours=3), a, other)
    result = build_my_day([first, second, later], {a, b}, assumed_minutes=75)
    assert result["conflicts"] == [{"match_ids": [str(first.id), str(second.id)], "different_venues": True}]
    assert result["next_match_id"] == str(first.id)
    assert result["next_by_entry"] == {str(a): str(first.id), str(b): str(second.id)}


def test_match_between_two_followed_teams_appears_once():
    a, b = uuid.uuid4(), uuid.uuid4()
    shared = match(T0, a, b)
    # The query returns the row once per followed participant.
    result = build_my_day([shared, shared], {a, b}, assumed_minutes=75)
    assert result["upcoming_ids"] == [str(shared.id)]
    assert result["conflicts"] == []


def test_unscheduled_and_finished_matches_are_kept_apart():
    a = uuid.uuid4()
    tbd = match(None, a, None)
    done = match(T0 - timedelta(hours=2), a, None, status="completed")
    cancelled = match(T0, a, None, status="cancelled")
    result = build_my_day([tbd, done, cancelled], {a}, assumed_minutes=75)
    assert result["awaiting_schedule_ids"] == [str(tbd.id)]
    assert result["completed_ids"] == [str(done.id)]
    assert result["next_match_id"] is None
