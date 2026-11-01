from collections import Counter
from pathlib import Path

import pytest
import pulp

from app.services.optimizer_solver import (
    PlayerCandidate,
    _build_optimizer_model,
    load_players_from_json,
    optimize_squad,
)

DATA_PATH = Path(__file__).with_name("mock_data.json")


def _small_optimizer_pool():
    return [
        PlayerCandidate(1, 1, "GKP", 1.0, 1.0),
        PlayerCandidate(2, 2, "GKP", 1.0, 2.0),
        PlayerCandidate(3, 6, "GKP", 1.0, 10.0),
        PlayerCandidate(4, 1, "DEF", 1.0, 1.0),
        PlayerCandidate(5, 2, "DEF", 1.0, 1.0),
        PlayerCandidate(6, 3, "DEF", 1.0, 1.0),
        PlayerCandidate(7, 3, "DEF", 1.0, 1.0),
        PlayerCandidate(8, 4, "DEF", 1.0, 1.0),
        PlayerCandidate(9, 1, "MID", 1.0, 1.0),
        PlayerCandidate(10, 2, "MID", 1.0, 1.0),
        PlayerCandidate(11, 3, "MID", 1.0, 1.0),
        PlayerCandidate(12, 4, "MID", 1.0, 1.0),
        PlayerCandidate(13, 5, "MID", 1.0, 1.0),
        PlayerCandidate(14, 4, "FWD", 1.0, 1.0),
        PlayerCandidate(15, 5, "FWD", 1.0, 1.0),
        PlayerCandidate(16, 5, "FWD", 1.0, 1.0),
    ]


def test_load_fpl_mock_data_and_map_first_player():
    players = load_players_from_json(DATA_PATH)

    assert len(players) == 669
    assert players[0] == PlayerCandidate(
        id=1,
        team_id=1,
        element_type="GKP",
        now_cost=6.2,
        expected_points_next=6.3,
    )


def test_load_fpl_mock_data_maps_all_position_codes():
    players = load_players_from_json(DATA_PATH)

    assert Counter(player.element_type for player in players) == {
        "GKP": 74,
        "DEF": 217,
        "MID": 299,
        "FWD": 79,
    }


def test_model_creates_binary_variable_for_each_mock_player():
    players = load_players_from_json(DATA_PATH)

    model, selected = _build_optimizer_model(players, budget=100.0)

    assert len(selected) == len(players)
    assert len(model.variables()) == len(players)
    assert all(
        variable.cat == pulp.LpInteger
        and variable.lowBound == 0
        and variable.upBound == 1
        for variable in selected.values()
    )


def test_model_maximizes_expected_points():
    players = load_players_from_json(DATA_PATH)

    model, selected = _build_optimizer_model(players, budget=100.0)

    assert model.sense == pulp.LpMaximize
    assert model.objective[selected[players[0].id]] == players[0].expected_points_next


def test_model_has_squad_budget_position_and_team_constraints():
    players = load_players_from_json(DATA_PATH)

    model, _ = _build_optimizer_model(players, budget=100.0)
    expected_constraints = {
        "squad_size",
        "budget_limit",
        "position_GKP",
        "position_DEF",
        "position_MID",
        "position_FWD",
        *(f"team_limit_{team_id}" for team_id in {p.team_id for p in players}),
    }

    assert all(
        model.get_constraint_by_name(name) is not None
        for name in expected_constraints
    )


def test_candidate_shape():
    candidates = [
        PlayerCandidate(
            id=1,
            team_id=10,
            element_type="FWD",
            now_cost=8.5,
            expected_points_next=6.2,
        )
    ]
    assert candidates[0].element_type == "FWD"
    assert candidates[0].now_cost == 8.5


def test_solver_returns_valid_squad_from_fpl_mock_data():
    players = load_players_from_json(DATA_PATH)

    result = optimize_squad(players, budget=100.0)
    chosen_players = [
        player for player in players if player.id in result.selected_player_ids
    ]

    assert len(result.selected_player_ids) == 15
    assert len(set(result.selected_player_ids)) == 15
    assert Counter(player.element_type for player in chosen_players) == {
        "GKP": 2,
        "DEF": 5,
        "MID": 5,
        "FWD": 3,
    }
    assert max(Counter(player.team_id for player in chosen_players).values()) <= 3
    assert result.total_cost <= 100.0
    assert result.total_cost == round(sum(p.now_cost for p in chosen_players), 1)
    assert result.total_expected_points == round(
        sum(p.expected_points_next for p in chosen_players), 1
    )


def test_solver_selects_highest_scoring_feasible_squad():
    players = _small_optimizer_pool()

    result = optimize_squad(players, budget=15.0)

    assert len(result.selected_player_ids) == 15
    assert 3 in result.selected_player_ids
    assert result.total_expected_points == 25.0


def test_solver_includes_locked_player_even_if_not_highest_scoring():
    players = _small_optimizer_pool()

    result = optimize_squad(players, budget=15.0, locked_player_ids=[1])

    assert 1 in result.selected_player_ids
    assert 3 in result.selected_player_ids
    assert 2 not in result.selected_player_ids
    assert result.total_expected_points == 24.0


def test_solver_excludes_player_even_if_highest_scoring():
    players = _small_optimizer_pool()

    result = optimize_squad(players, budget=15.0, excluded_player_ids=[3])

    assert 3 not in result.selected_player_ids
    assert 2 in result.selected_player_ids
    assert result.total_expected_points == 16.0


def test_solver_rejects_locked_id_not_in_candidate_list():
    players = load_players_from_json(DATA_PATH)

    with pytest.raises(ValueError, match="Locked player IDs are not in the candidate list"):
        optimize_squad(players, budget=100.0, locked_player_ids=[999_999])


def test_solver_rejects_excluded_id_not_in_candidate_list():
    players = load_players_from_json(DATA_PATH)

    with pytest.raises(ValueError, match="Excluded player IDs are not in the candidate list"):
        optimize_squad(players, budget=100.0, excluded_player_ids=[999_999])


def test_solver_rejects_player_that_is_both_locked_and_excluded():
    players = load_players_from_json(DATA_PATH)

    with pytest.raises(ValueError, match="cannot be both locked and excluded"):
        optimize_squad(
            players,
            budget=100.0,
            locked_player_ids=[1],
            excluded_player_ids=[1],
        )


def test_solver_reports_infeasible_locked_players():
    players = _small_optimizer_pool()
    players.append(PlayerCandidate(17, 1, "FWD", 1.0, 1.0))

    with pytest.raises(ValueError, match="No feasible 15-player squad"):
        optimize_squad(
            players,
            budget=100.0,
            locked_player_ids=[1, 4, 9, 17],
        )


def test_solver_reports_infeasible_budget():
    players = load_players_from_json(DATA_PATH)

    with pytest.raises(ValueError, match="No feasible 15-player squad"):
        optimize_squad(players, budget=0.1)


def test_solver_rejects_duplicate_player_ids():
    player = PlayerCandidate(
        id=1,
        team_id=1,
        element_type="GKP",
        now_cost=5.0,
        expected_points_next=4.0,
    )

    with pytest.raises(ValueError, match="Player IDs must be unique"):
        optimize_squad([player, player], budget=100.0)


def test_solver_reports_infeasible_position_pool():
    players = [player for player in load_players_from_json(DATA_PATH)
               if player.element_type != "FWD"]

    with pytest.raises(ValueError, match="No feasible 15-player squad"):
        optimize_squad(players, budget=100.0)
