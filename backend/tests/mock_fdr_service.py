"""Deterministic FDR service replacement for optimizer tests and benchmarks."""

_TEAM_MULTIPLIERS = (1.20, 1.15, 1.00, 0.90, 0.80)
_MOCK_TEAM_FDR_MULTIPLIERS = {
    team_id: _TEAM_MULTIPLIERS[(team_id - 1) % len(_TEAM_MULTIPLIERS)]
    for team_id in range(1, 21)
}


def get_next_gameweek_fdr_multipliers() -> dict[int, float]:
    """Return fixed multipliers for the 20 EPL teams without network access."""
    return _MOCK_TEAM_FDR_MULTIPLIERS.copy()
