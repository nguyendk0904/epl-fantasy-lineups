"""P3-NH03 API end-to-end suite (real app, SQL and CBC).

Local from backend/: python -m pytest tests/test_e2e_api_suite.py -q
Set E2E_TEST_DATABASE_URL for isolated PostgreSQL instead of SQLite.
Cloud test: set E2E_REMOTE_BASE_URL and E2E_ALLOW_REMOTE_WRITES=1, then run
`pytest tests/test_e2e_api_suite.py -k deployed -q`. Use an isolated deployment
with seeded FPL data; a successful run leaves one acceptance snapshot there.
Live CloudWatch delivery and continuous worker operation are separate checks.
"""

from collections import Counter
from decimal import Decimal
import re

import pytest
from sqlalchemy import func, select

from app.models import Player, SharedLineup


async def solve(client, **overrides):
    response = await client.post("/api/v1/optimizer/solve", json={
        "budget": 100, "target_formation": "4-3-3", **overrides,
    })
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "optimal", data
    return data


def squad_ids(optimized):
    return [player["id"] for player in optimized["starting_xi"] + optimized["bench"]]


def share_payload(optimized):
    return {
        "lineup_name": "P3-NH03 acceptance snapshot",
        "starting_player_ids": [player["id"] for player in optimized["starting_xi"]],
        "bench_player_ids": [player["id"] for player in optimized["bench"]],
        "formation": optimized["formation"],
        "captain_id": optimized["captain_id"], "vice_captain_id": optimized["vice_captain_id"],
    }


async def assert_api_journey(client):
    teams = await client.get("/api/v1/teams")
    assert teams.status_code == 200
    assert teams.json()
    market = await client.get("/api/v1/players", params={"limit": 100})
    assert market.status_code == 200
    assert market.json()["total"] >= 15
    optimized = await solve(client)
    ids = squad_ids(optimized)
    players = optimized["starting_xi"] + optimized["bench"]
    assert len(optimized["starting_xi"]) == 11
    assert len(optimized["bench"]) == 4
    assert len(set(ids)) == 15
    assert Counter(player["element_type"] for player in players) == {"GKP": 2, "DEF": 5, "MID": 5, "FWD": 3}
    assert max(Counter(player["team_id"] for player in players).values()) <= 3
    cost = sum((Decimal(str(player["now_cost"])) for player in players), Decimal(0))
    assert float(cost) == pytest.approx(optimized["total_cost"])
    assert cost <= 100
    comparison = await client.post("/api/v1/lineups/compare", json={
        "lineup_a_player_ids": ids, "lineup_b_player_ids": ids,
    })
    assert comparison.status_code == 200
    delta = comparison.json()["head_to_head_delta"]
    assert delta["cost_diff"] == 0
    assert delta["xp_diff"] == 0
    assert delta["common_players_count"] == 15
    shared = await client.post("/api/v1/lineups/share", json=share_payload(optimized))
    assert shared.status_code == 201, shared.text
    snapshot = shared.json()
    assert re.fullmatch(r"[A-Za-z0-9]{6}", snapshot["share_code"])
    assert snapshot["total_cost"] == pytest.approx(optimized["total_cost"])
    assert snapshot["predicted_points"] == pytest.approx(optimized["total_expected_points"])
    assert snapshot["player_data"]["captain_id"] == optimized["captain_id"]
    fetched = await client.get(f'/api/v1/lineups/share/{snapshot["share_code"]}')
    assert fetched.status_code == 200
    assert fetched.json() == snapshot
    missing = await client.get("/api/v1/lineups/share/XXXXXX")
    assert missing.status_code == 404
    invalid = await client.get("/api/v1/players?page=0")
    assert invalid.status_code == 422
    return snapshot


@pytest.mark.asyncio
async def test_full_api_journey_real_solver_and_persisted_snapshot(e2e_api):
    snapshot = await assert_api_journey(e2e_api.client)
    async with e2e_api.sessions() as session:
        stored = await session.scalar(select(SharedLineup).where(SharedLineup.share_code == snapshot["share_code"]))
        assert stored.player_data["captain_id"] == snapshot["player_data"]["captain_id"]
        assert stored.total_cost == Decimal(str(snapshot["total_cost"]))


@pytest.mark.asyncio
async def test_filter_sort_pagination_are_consistent_with_seeded_database(e2e_api):
    http = e2e_api.client
    response = await http.get("/api/v1/players?position=DEF&team_id=4&max_cost=4.2&sort_by=now_cost&order=asc")
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == 4
    searched = await http.get("/api/v1/players?search=First04")
    assert [player["id"] for player in searched.json()["items"]] == [4]
    first = (await http.get("/api/v1/players?limit=5&page=1")).json()
    second = (await http.get("/api/v1/players?limit=5&page=2")).json()
    assert first["total"] == second["total"] == 22
    assert len(first["items"]) == len(second["items"]) == 5
    assert not {player["id"] for player in first["items"]} & {player["id"] for player in second["items"]}
    assert (await http.get("/api/v1/players?page=99")).json()["items"] == []


@pytest.mark.asyncio
async def test_locked_and_excluded_players_and_comparison_differentials(e2e_api):
    one = await solve(e2e_api.client)
    excluded = one["starting_xi"][0]["id"]
    locked = one["starting_xi"][1]["id"]
    two = await solve(e2e_api.client, locked_player_ids=[locked], excluded_player_ids=[excluded])
    assert locked in squad_ids(two)
    assert excluded not in squad_ids(two)
    response = await e2e_api.client.post("/api/v1/lineups/compare", json={
        "lineup_a_player_ids": squad_ids(one), "lineup_b_player_ids": squad_ids(two),
    })
    assert response.status_code == 200
    delta = response.json()["head_to_head_delta"]
    assert delta["common_players_count"] == len(set(squad_ids(one)) & set(squad_ids(two)))
    assert {player["id"] for player in delta["differential_players"]} == set(squad_ids(two)) - set(squad_ids(one))


@pytest.mark.asyncio
async def test_infeasible_budget_returns_business_status(e2e_api):
    response = await e2e_api.client.post("/api/v1/optimizer/solve", json={"budget": 1})
    assert response.status_code == 200
    assert response.json()["status"] == "infeasible"


@pytest.mark.asyncio
@pytest.mark.parametrize("path", [
    "/api/v1/players?position=INVALID", "/api/v1/players?sort_by=INVALID",
    "/api/v1/players?page=0", "/api/v1/players?limit=101",
    "/api/v1/players?max_cost=-1",
])
async def test_players_validation_errors(e2e_api, path):
    assert (await e2e_api.client.get(path)).status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [
    {"budget": 0}, {"budget": 100, "target_formation": "2-5-3"},
    {"budget": 100, "locked_player_ids": [1], "excluded_player_ids": [1]},
    {"budget": 100, "locked_player_ids": [9999]},
])
async def test_optimizer_validation_errors(e2e_api, payload):
    assert (await e2e_api.client.post("/api/v1/optimizer/solve", json=payload)).status_code == 422


@pytest.mark.asyncio
async def test_comparison_unknown_players_and_invalid_squad(e2e_api):
    valid = squad_ids(await solve(e2e_api.client))
    unknown = valid[:-1] + [9999]
    response = await e2e_api.client.post("/api/v1/lineups/compare", json={
        "lineup_a_player_ids": valid, "lineup_b_player_ids": unknown,
    })
    assert response.status_code == 404
    response = await e2e_api.client.post("/api/v1/lineups/compare", json={
        "lineup_a_player_ids": valid, "lineup_b_player_ids": [1] * 15,
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_share_business_error_does_not_persist_snapshot(e2e_api):
    payload = share_payload(await solve(e2e_api.client))
    async with e2e_api.sessions.begin() as session:
        for player in (await session.scalars(select(Player))).all():
            player.now_cost = Decimal("10.0")
    response = await e2e_api.client.post("/api/v1/lineups/share", json=payload)
    assert response.status_code == 400
    async with e2e_api.sessions() as session:
        assert await session.scalar(select(func.count()).select_from(SharedLineup)) == 0


@pytest.mark.asyncio
async def test_share_validation_and_missing_player_errors(e2e_api):
    payload = share_payload(await solve(e2e_api.client))
    unknown = {**payload, "bench_player_ids": payload["bench_player_ids"][:-1] + [9999]}
    assert (await e2e_api.client.post("/api/v1/lineups/share", json=unknown)).status_code == 404
    invalid = {**payload, "vice_captain_id": payload["captain_id"]}
    assert (await e2e_api.client.post("/api/v1/lineups/share", json=invalid)).status_code == 422
    assert (await e2e_api.client.get("/api/v1/lineups/share/invalid-code")).status_code == 422


@pytest.mark.asyncio
async def test_snapshot_is_immutable_after_market_data_changes(e2e_api):
    optimized = await solve(e2e_api.client)
    created = await e2e_api.client.post("/api/v1/lineups/share", json=share_payload(optimized))
    assert created.status_code == 201
    snapshot = created.json()
    async with e2e_api.sessions.begin() as session:
        player = await session.get(Player, optimized["captain_id"])
        player.web_name = "Changed after share"
        player.now_cost = Decimal("15.0")
    fetched = await e2e_api.client.get(f'/api/v1/lineups/share/{snapshot["share_code"]}')
    assert fetched.json() == snapshot


@pytest.mark.asyncio
async def test_application_metadata_and_health_are_available(e2e_api):
    for path in ("/", "/health", "/api/v1/health", "/docs", "/redoc", "/api/v1/openapi.json"):
        assert (await e2e_api.client.get(path)).status_code == 200
    spec = (await e2e_api.client.get("/api/v1/openapi.json")).json()
    assert {"/api/v1/players", "/api/v1/teams", "/api/v1/optimizer/solve", "/api/v1/lineups/compare", "/api/v1/lineups/share", "/api/v1/lineups/share/{code}"}.issubset(spec["paths"])


@pytest.mark.asyncio
async def test_real_players_api_rate_limit_and_health_isolation(e2e_api):
    for _ in range(60):
        assert (await e2e_api.client.get("/api/v1/players")).status_code == 200
    response = await e2e_api.client.get("/api/v1/players")
    assert response.status_code == 429
    assert 1 <= int(response.headers["retry-after"]) <= 60
    assert (await e2e_api.client.get("/health")).status_code == 200


@pytest.mark.asyncio
async def test_deployed_api_journey_opt_in(e2e_remote_client):
    await assert_api_journey(e2e_remote_client)
