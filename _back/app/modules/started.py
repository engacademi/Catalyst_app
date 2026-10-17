"""Whether the source says a match has begun. Shared by delays and the demo replay."""

from app.models import Match

UNSTARTED_STATUSES = {"scheduled", "postponed"}


def has_started(match: Match) -> bool:
    """The source marked it in progress or completed, or it has set scores."""
    if match.status not in UNSTARTED_STATUSES:
        return True
    return any(s.home_score is not None or s.away_score is not None for s in match.sets)
