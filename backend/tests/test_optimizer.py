from collections import Counter
from pathlib import Path
from types import SimpleNamespace

import pytest
import pulp
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1.endpoints.optimizer import router as optimizer_router
from app.core.database import get_db
from app.services.optimizer_solver import (
    PlayerCandidate,
    _build_optimizer_model,
    load_players_from_json,
    optimize_squad,
)

DATA_PATH = Path(__file__).with_name("mock_data.json")


@pytest.fixture(autouse=True)
def mock_fpl_fixtures(monkeypatch):
    import httpx

    fixtures = [
        {
            "event": 9,
            "finished": False,
            "team_h": team_id,
            "team_a": team_id + 1,
            "team_h_difficulty": 3,
            "team_a_difficulty": 3,
        }
        for team_id in range(1, 20, 2)
    ]

    class FixtureResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return fixtures

    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: FixtureResponse())
    return fixtures


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


@pytest.mark.parametrize(
    ("difficulty", "expected_total"),
    # Exact expectation = 13.0 (locked squad without team 1) + 3 x 1.0 x
    # FDR_MULTIPLIERS[difficulty]. Difficulty 2 gives 13.0 + 3 x 1.15 = 16.45;
    # the previous value (16.4) rounded that half step down by hand.
    [(1, 16.6), (2, 16.45), (3, 16.0), (4, 15.7), (5, 15.4)],
)
def test_solver_weights_xp_by_next_fixture_difficulty(
    monkeypatch, mock_fpl_fixtures, difficulty, expected_total
):
    import httpx

    players = _small_optimizer_pool()
    locked_ids = [player.id for player in players if player.id != 3]
    fixture = {
        "event": 9,
        "finished": False,
        "team_h": 1,
        "team_a": 2,
        "team_h_difficulty": difficulty,
        "team_a_difficulty": 3,
    }

    class FixtureResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return [fixture]

    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: FixtureResponse())

    result = optimize_squad(players, budget=15.0, locked_player_ids=locked_ids)

    # `total_expected_points` is rounded to 1 decimal by the solver, and 16.45
    # sits exactly on a .05 rounding boundary, so CBC's binary float sum may
    # legitimately report 16.4 or 16.5. Compare within one rounding step
    # (0.06 > 0.05) instead of using fragile exact equality.
    assert result.total_expected_points == pytest.approx(expected_total, abs=0.06)


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


def _optimizer_api_rows():
    positions = ["GKP"] * 2 + ["DEF"] * 5 + ["MID"] * 5 + ["FWD"] * 3
    points = [9, 3, 10, 9, 8, 7, 6, 10, 9, 8, 7, 6, 10, 9, 8]
    return [
        SimpleNamespace(
            id=index + 1,
            team_id=index + 1,
            element_type=position,
            now_cost=1.0,
            expected_points_next=point,
            web_name=f"Player {index + 1}",
        )
        for index, (position, point) in enumerate(zip(positions, points))
    ]


def _optimizer_api_app(rows=None):
    app = FastAPI()
    app.include_router(optimizer_router, prefix="/api/v1")
    player_rows = rows if rows is not None else _optimizer_api_rows()

    class FakeResult:
        def scalars(self):
            return self

        def all(self):
            return player_rows

    class FakeSession:
        async def execute(self, _query):
            return FakeResult()

    async def override_get_db():
        return FakeSession()

    app.dependency_overrides[get_db] = override_get_db
    return app


@pytest.mark.asyncio
async def test_optimizer_api_returns_optimal_xi_captain_and_bench():
    app = _optimizer_api_app()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/v1/optimizer/solve",
            json={"budget": 20, "target_formation": "3-4-3"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "optimal"
    assert len(data["starting_xi"]) == 11
    assert len(data["bench"]) == 4
    assert Counter(p["element_type"] for p in data["starting_xi"]) == {
        "GKP": 1,
        "DEF": 3,
        "MID": 4,
        "FWD": 3,
    }
    assert data["bench"][0]["element_type"] == "GKP"
    assert data["formation"] == "3-4-3"
    starter_ids = {p["id"] for p in data["starting_xi"]}
    assert data["captain_id"] in starter_ids
    assert data["vice_captain_id"] in starter_ids
    assert data["vice_captain_id"] != data["captain_id"]
    starting_points = sum(p["expected_points_next"] for p in data["starting_xi"])
    captain_points = next(
        p["expected_points_next"]
        for p in data["starting_xi"]
        if p["id"] == data["captain_id"]
    )
    assert data["total_expected_points"] == starting_points + captain_points


@pytest.mark.asyncio
async def test_optimizer_api_automatically_selects_a_valid_formation():
    app = _optimizer_api_app()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/v1/optimizer/solve", json={"budget": 20})

    data = response.json()
    assert response.status_code == 200
    assert data["status"] == "optimal"
    counts = Counter(p["element_type"] for p in data["starting_xi"])
    assert counts["GKP"] == 1
    assert 3 <= counts["DEF"] <= 5
    assert 2 <= counts["MID"] <= 5
    assert 1 <= counts["FWD"] <= 3
    assert data["formation"] == f"{counts['DEF']}-{counts['MID']}-{counts['FWD']}"


@pytest.mark.asyncio
async def test_optimizer_api_returns_infeasible_status_when_budget_is_too_low():
    app = _optimizer_api_app()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/v1/optimizer/solve", json={"budget": 1})

    assert response.status_code == 200
    assert response.json()["status"] == "infeasible"
    assert response.json()["starting_xi"] == []
    assert response.json()["bench"] == []


@pytest.mark.asyncio
async def test_optimizer_api_rejects_conflicting_locked_and_excluded_players():
    app = _optimizer_api_app()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/v1/optimizer/solve",
            json={"budget": 20, "locked_player_ids": [1], "excluded_player_ids": [1]},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_optimizer_api_applies_locked_and_excluded_ids_to_squad_solver():
    rows = _optimizer_api_rows()
    rows.append(
        SimpleNamespace(
            id=16,
            team_id=16,
            element_type="GKP",
            now_cost=1.0,
            expected_points_next=20.0,
            web_name="Extra goalkeeper",
        )
    )
    app = _optimizer_api_app(rows)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/v1/optimizer/solve",
            json={
                "budget": 20,
                "locked_player_ids": [2],
                "excluded_player_ids": [16],
            },
        )

    data = response.json()
    squad_ids = {p["id"] for p in data["starting_xi"] + data["bench"]}
    assert response.status_code == 200
    assert data["status"] == "optimal"
    assert 2 in squad_ids
    assert 16 not in squad_ids
