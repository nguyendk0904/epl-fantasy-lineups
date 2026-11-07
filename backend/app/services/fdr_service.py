"""Fetch upcoming FPL fixtures and expose team-specific FDR multipliers."""

import httpx

FPL_FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/"
FDR_MULTIPLIERS = {1: 1.20, 2: 1.15, 3: 1.00, 4: 0.90, 5: 0.80}


def get_next_gameweek_fdr_multipliers() -> dict[int, float]:
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
