import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.modules.my_day import build_my_day

T0 = datetime(2027, 4, 8, 13, 0, tzinfo=timezone.utc)
EARLY = T0 - timedelta(days=1)
VENUE_A, VENUE_B = uuid.uuid4(), uuid.uuid4()


def match(start, home, away, status="scheduled", venue=VENUE_A, work=None, court=None, estimate=None):
    return SimpleNamespace(
        id=uuid.uuid4(),
        external_id=str(start),
        status=status,
        scheduled_start=start,
        estimated_start=estimate,
        court_id=court,
        court=SimpleNamespace(venue_id=venue),
        sets=[],
        work_entry_id=work,
        participants=[SimpleNamespace(entry_id=home), SimpleNamespace(entry_id=away)],
    )


def test_overlap_across_venues_is_one_conflict_group():
    a, b, other = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    first = match(T0, a, other)
    second = match(T0 + timedelta(minutes=30), b, other, venue=VENUE_B)
    later = match(T0 + timedelta(hours=3), a, other)
    result = build_my_day([first, second, later], {a, b}, assumed_minutes=75, now=EARLY)
    assert result["conflicts"] == [{"match_ids": [str(first.id), str(second.id)], "different_venues": True}]
    assert result["next_match_id"] == str(first.id)
    assert result["next_by_entry"] == {str(a): str(first.id), str(b): str(second.id)}


def test_match_between_two_followed_teams_appears_once():
    a, b = uuid.uuid4(), uuid.uuid4()
    shared = match(T0, a, b)
    # The query returns the row once per followed participant.
    result = build_my_day([shared, shared], {a, b}, assumed_minutes=75, now=EARLY)
    assert result["upcoming_ids"] == [str(shared.id)]
    assert result["conflicts"] == []


def test_unscheduled_and_finished_matches_are_kept_apart():
    a = uuid.uuid4()
    tbd = match(None, a, None)
    done = match(T0 - timedelta(hours=2), a, None, status="completed")
    cancelled = match(T0, a, None, status="cancelled")
    result = build_my_day([tbd, done, cancelled], {a}, assumed_minutes=75, now=EARLY)
    assert result["awaiting_schedule_ids"] == [str(tbd.id)]
    assert result["completed_ids"] == [str(done.id)]
    assert result["next_match_id"] is None


def test_work_duty_is_its_own_item_not_a_team_match():
    a, x, y = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    own = match(T0 + timedelta(hours=1), a, x)
    duty = match(T0, x, y, work=a)
    result = build_my_day([own, duty], {a}, assumed_minutes=75, now=EARLY)
    assert result["work_duties"] == [{"match_id": str(duty.id), "entry_id": str(a)}]
    assert result["upcoming_ids"] == [str(own.id)]
    assert result["next_match_id"] == str(own.id)
    assert result["conflicts"] == []


def test_no_work_duty_when_source_assigns_none():
    a, x = uuid.uuid4(), uuid.uuid4()
    result = build_my_day([match(T0, a, x)], {a}, assumed_minutes=75, now=EARLY)
    assert result["work_duties"] == []


def test_next_match_is_the_first_not_yet_finished_by_the_event_clock():
    a, other = uuid.uuid4(), uuid.uuid4()
    morning = match(T0, a, other)
    late_start = match(T0 + timedelta(minutes=90), a, other)
    afternoon = match(T0 + timedelta(hours=4), a, other)
    # 9:40-style clock: the first match has had its assumed hour; the 90-minute one hasn't started.
    result = build_my_day([morning, late_start, afternoon], {a}, assumed_minutes=60, now=T0 + timedelta(minutes=70))
    assert result["next_match_id"] == str(late_start.id)
    assert result["next_by_entry"] == {str(a): str(late_start.id)}
    # A match already under way stays the next match until its assumed length has passed.
    result = build_my_day([morning, late_start, afternoon], {a}, assumed_minutes=60, now=T0 + timedelta(minutes=100))
    assert result["next_match_id"] == str(late_start.id)


def running_late(court, minutes):
    """The active delay notices the API passes in, keyed by court."""
    return {court: SimpleNamespace(court_id=court, minutes=minutes)}


def test_my_day_orders_by_the_staff_estimate_when_a_court_runs_late():
    a, other, court_7 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    delayed = match(T0, a, other, court=court_7)
    on_time = match(T0 + timedelta(minutes=10), a, other)
    result = build_my_day(
        [delayed, on_time], {a}, assumed_minutes=60, now=EARLY, notices=running_late(court_7, 30)
    )
    # Official 13:00 runs ~13:30, so the 13:10 match comes first.
    assert result["upcoming_ids"] == [str(on_time.id), str(delayed.id)]
    assert result["next_match_id"] == str(on_time.id)


def test_a_delay_can_make_two_followed_matches_overlap():
    a, b, other, court_7 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    first = match(T0, a, other, court=court_7)
    second = match(T0 + timedelta(minutes=90), b, other)
    on_time = build_my_day([first, second], {a, b}, assumed_minutes=60, now=EARLY)
    assert on_time["conflicts"] == []

    # Running ~45 min late, the first match is expected to end at 14:45, after the second's 14:30 start.
    late = build_my_day([first, second], {a, b}, assumed_minutes=60, now=EARLY, notices=running_late(court_7, 45))
    assert late["conflicts"] == [{"match_ids": [str(first.id), str(second.id)], "different_venues": False}]


def test_a_source_estimate_beats_the_staff_estimate_for_ordering():
    a, other, court_7 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    sourced = match(T0, a, other, court=court_7, estimate=T0 + timedelta(minutes=5))
    later = match(T0 + timedelta(minutes=20), a, other)
    result = build_my_day([sourced, later], {a}, assumed_minutes=60, now=EARLY, notices=running_late(court_7, 40))
    assert result["upcoming_ids"] == [str(sourced.id), str(later.id)]


def test_a_late_match_the_source_has_not_started_is_expected_to_start_soon():
    a, other, court_7 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    late = match(T0, a, other)
    under_way = match(T0, other, a, status="in_progress", venue=VENUE_B)
    scored = match(T0 - timedelta(minutes=5), a, other)
    scored.sets = [SimpleNamespace(home_score=12, away_score=9)]
    delayed = match(T0, a, other, court=court_7)
    later = match(T0 + timedelta(hours=2), a, other)
    result = build_my_day(
        [late, under_way, scored, delayed, later], {a},
        assumed_minutes=60, now=T0 + timedelta(minutes=10), notices=running_late(court_7, 20),
    )
    # Official 13:00 has passed for both, but the delayed one is estimated at ~13:20.
    assert result["expected_soon_ids"] == [str(late.id)]
    assert result["next_match_id"] == str(scored.id)

    estimate_passed = build_my_day(
        [delayed], {a}, assumed_minutes=60, now=T0 + timedelta(minutes=25), notices=running_late(court_7, 20)
    )
    assert estimate_passed["expected_soon_ids"] == [str(delayed.id)]
    assert estimate_passed["next_match_id"] == str(delayed.id)
