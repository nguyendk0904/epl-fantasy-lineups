"""Fetch upcoming FPL fixtures and expose team-specific FDR multipliers."""

import logging
from threading import Lock
from time import monotonic

import httpx

FPL_FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/"
FDR_MULTIPLIERS = {1: 1.20, 2: 1.15, 3: 1.00, 4: 0.90, 5: 0.80}
FDR_CACHE_TTL_SECONDS = 900
logger = logging.getLogger(__name__)
_cache_lock = Lock()
_cached_multipliers: dict[int, float] | None = None
_cache_expires_at = 0.0


def clear_fdr_cache() -> None:
    """Invalidate cached FDR data under the same lock used for refreshes."""
    global _cached_multipliers, _cache_expires_at
    with _cache_lock:
        _cached_multipliers = None
        _cache_expires_at = 0.0


def get_next_gameweek_fdr_multipliers() -> dict[int, float]:
    """Return cached FDR, falling back to stale data or neutral weights on error."""
    global _cached_multipliers, _cache_expires_at
    # Serialize refreshes so concurrent solves share a single successful fetch.
    with _cache_lock:
        if _cached_multipliers is not None and monotonic() < _cache_expires_at:
            return _cached_multipliers.copy()
        try:
            multipliers = _fetch_fdr_multipliers()
        except Exception as exc:
            logger.warning(
                "FDR refresh failed; using %s: %s",
                "stale cache" if _cached_multipliers is not None else "neutral weights",
                exc,
            )
            return _cached_multipliers.copy() if _cached_multipliers is not None else {}
        _cached_multipliers = multipliers
        _cache_expires_at = monotonic() + FDR_CACHE_TTL_SECONDS
        return multipliers.copy()


def _fetch_fdr_multipliers() -> dict[int, float]:
    """Return each team's average FDR multiplier for the next unplayed GW.

    For a double gameweek, the team's multiplier is the mean of its per-fixture
    multipliers. Teams without a fixture in that gameweek are omitted.
    """
    try:
        response = httpx.get(FPL_FIXTURES_URL, timeout=10.0)
        response.raise_for_status()
        fixtures = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise RuntimeError("Could not fetch FPL fixtures for FDR weighting.") from exc

    if not isinstance(fixtures, list):
        raise RuntimeError("FPL fixtures response must be a JSON list.")

    upcoming_events = []
    for fixture in fixtures:
        if not isinstance(fixture, dict) or fixture.get("finished") is not False:
            continue
        event = fixture.get("event")
        if event is not None:
            try:
                upcoming_events.append(int(event))
            except (TypeError, ValueError) as exc:
                raise RuntimeError("FPL fixture contains an invalid gameweek.") from exc

    if not upcoming_events:
        return {}

    next_event = min(upcoming_events)
    team_multipliers: dict[int, list[float]] = {}
    for fixture in fixtures:
        if not isinstance(fixture, dict) or fixture.get("finished") is not False:
            continue
        try:
            event = fixture.get("event")
            if event is None or int(event) != next_event:
                continue
            home_team = int(fixture["team_h"])
            away_team = int(fixture["team_a"])
            home_fdr = int(fixture["team_h_difficulty"])
            away_fdr = int(fixture["team_a_difficulty"])
            team_multipliers.setdefault(home_team, []).append(
                FDR_MULTIPLIERS[home_fdr]
            )
            team_multipliers.setdefault(away_team, []).append(
                FDR_MULTIPLIERS[away_fdr]
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise RuntimeError("FPL fixture contains invalid team or FDR data.") from exc

    return {
        team_id: sum(multipliers) / len(multipliers)
        for team_id, multipliers in team_multipliers.items()
    }
