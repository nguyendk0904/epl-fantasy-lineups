from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1.endpoints.lineups import router as lineups_router
from app.core.database import get_db


def _mock_players():
    positions = ("GKP", "DEF", "MID", "FWD")
    return [
        SimpleNamespace(
            id=player_id,
            web_name=f"Player {player_id}",
            element_type=positions[(player_id - 1) % len(positions)],
            now_cost=player_id / 10,
            total_points=player_id * 10,
            form=player_id / 10,
            expected_points_next=player_id / 2,
        )
        for player_id in range(1, 31)
    ]


async def _compare(payload, players=None):
    app = FastAPI()
    app.include_router(lineups_router, prefix="/api/v1")
    player_rows = players if players is not None else _mock_players()

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
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        return await client.post("/api/v1/lineups/compare", json=payload)


def _payload(lineup_a, lineup_b):
    return {
        "lineup_a_player_ids": lineup_a,
        "lineup_b_player_ids": lineup_b,
    }


@pytest.mark.asyncio
async def test_compare_api_returns_all_lineup_b_differentials_for_disjoint_squads():
    response = await _compare(_payload(list(range(1, 16)), list(range(16, 31))))

    assert response.status_code == 200
    data = response.json()
    delta = data["head_to_head_delta"]
    assert delta["common_players_count"] == 0
    assert [player["id"] for player in delta["differential_players"]] == list(
        range(16, 31)
    )


@pytest.mark.asyncio
async def test_compare_api_returns_zero_deltas_for_identical_squads():
    lineup = list(range(1, 16))
    response = await _compare(_payload(lineup, lineup))

    assert response.status_code == 200
    data = response.json()
    assert data["lineup_a"] == data["lineup_b"]
    assert data["head_to_head_delta"] == {
        "cost_diff": 0.0,
        "xp_diff": 0.0,
        "common_players_count": 15,
        "differential_players": [],
    }


@pytest.mark.asyncio
async def test_compare_api_calculates_cost_and_expected_points_delta_as_a_minus_b():
    response = await _compare(_payload(list(range(1, 16)), list(range(16, 31))))

    assert response.status_code == 200
    data = response.json()
    assert data["lineup_a"]["total_cost"] == 12.0
    assert data["lineup_b"]["total_cost"] == 34.5
    assert data["lineup_a"]["total_xp"] == 60.0
    assert data["lineup_b"]["total_xp"] == 172.5
    assert data["head_to_head_delta"]["cost_diff"] == -22.5
    assert data["head_to_head_delta"]["xp_diff"] == -112.5
    assert set(data["lineup_a"]) == {
        "total_cost",
        "total_xp",
        "attack_rating",
        "defense_rating",
        "form_rating",
        "value_rating",
    }


@pytest.mark.asyncio
async def test_compare_api_rejects_lineup_with_duplicate_ids():
    lineup = list(range(1, 15)) + [14]
    response = await _compare(_payload(lineup, list(range(16, 31))))

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_compare_api_returns_not_found_for_unknown_player_ids():
    response = await _compare(_payload(list(range(1, 15)) + [999], list(range(16, 31))))

    assert response.status_code == 404
    assert "999" in response.json()["detail"]
