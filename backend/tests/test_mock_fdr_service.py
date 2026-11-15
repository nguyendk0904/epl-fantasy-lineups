from mock_fdr_service import get_next_gameweek_fdr_multipliers


def test_mock_fdr_service_returns_a_multiplier_for_each_epl_team():
    multipliers = get_next_gameweek_fdr_multipliers()

    assert set(multipliers) == set(range(1, 21))
    assert set(multipliers.values()) == {1.20, 1.15, 1.00, 0.90, 0.80}


def test_mock_fdr_service_returns_independent_deterministic_mappings():
    first = get_next_gameweek_fdr_multipliers()
    first[1] = -1.0

    second = get_next_gameweek_fdr_multipliers()

    assert second[1] == 1.20
    assert second == get_next_gameweek_fdr_multipliers()
