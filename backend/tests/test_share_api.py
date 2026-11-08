"""P2-NH02 SQL/HTTP tests.

SQLite uses a test-only JSON column on a copied table; production JSONB and
models stay unchanged. Optional PostgreSQL roundtrip: set SHARE_TEST_DATABASE_URL
to an isolated postgresql+asyncpg database ending in _test. The test creates
and drops only its own random schema. Never point this at the shared app DB.
"""

from contextlib import asynccontextmanager
import copy
from decimal import Decimal
import os
import re
from uuid import uuid4

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import JSON, MetaData, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1.endpoints import lineup_share
from app.core.database import Base, get_db
from app.main import app
from app.models import Player, SharedLineup, Team


PAYLOAD = {
    "lineup_name": "NH snapshot", "formation": "4-3-3",
    "starting_player_ids": [1, 3, 4, 5, 6, 8, 9, 10, 13, 14, 15],
    "bench_player_ids": [2, 7, 11, 12], "captain_id": 13, "vice_captain_id": 8,
}


@asynccontextmanager
async def api_context(engine, *, sqlite=False):
    factory = async_sessionmaker(engine, expire_on_commit=False)
    previous = app.dependency_overrides.copy()
    try:
        async with engine.begin() as connection:
            if sqlite:
                metadata = MetaData()
                for table in Base.metadata.sorted_tables:
                    table.to_metadata(metadata)
                metadata.tables["shared_lineups"].c.player_data.type = JSON()
                await connection.run_sync(metadata.create_all)
            else:
                await connection.run_sync(Base.metadata.create_all)
        async with factory.begin() as session:
            session.add_all([Team(id=i, name=f"Team {i}", short_name=f"T{i}") for i in range(1, 6)])
            await session.flush()
            positions = ["GKP"] * 2 + ["DEF"] * 5 + ["MID"] * 5 + ["FWD"] * 3
            session.add_all([
                Player(id=i, web_name=f"Player {i}", team_id=(i - 1) % 5 + 1,
                       element_type=position, now_cost=Decimal("5.0"), total_points=100,
                       form=Decimal("4.0"), expected_points_next=Decimal("3.0"), status="a")
                for i, position in enumerate(positions, 1)
            ])

        async def override_db():
            async with factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_db
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            yield client, factory
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


@pytest_asyncio.fixture
async def share_api():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        async with api_context(engine, sqlite=True) as context:
            yield context
    finally:
        await engine.dispose()


async def assert_roundtrip(client):
    response = await client.post("/api/v1/lineups/share", json=PAYLOAD)
    assert response.status_code == 201, response.text
    data = response.json()
    assert re.fullmatch(r"[A-Za-z0-9]{6}", data["share_code"])
    assert data["lineup_name"] == PAYLOAD["lineup_name"]
    assert data["total_cost"] == 75.0
    assert data["predicted_points"] == 36.0  # 11 xP values + captain bonus.
    assert data["player_data"]["starting_player_ids"] == PAYLOAD["starting_player_ids"]
    assert data["player_data"]["bench_player_ids"] == PAYLOAD["bench_player_ids"]
    assert data["player_data"]["formation"] == "4-3-3"
    assert data["player_data"]["captain_id"] == 13
    assert data["player_data"]["vice_captain_id"] == 8
    assert len(data["player_data"]["players"]) == 15
    fetched = await client.get(f'/api/v1/lineups/share/{data["share_code"]}')
    assert fetched.status_code == 200
    assert fetched.json() == data
    return data


@pytest.mark.asyncio
async def test_post_then_get_restores_entire_snapshot(share_api):
    await assert_roundtrip(share_api[0])


@pytest.mark.asyncio
async def test_snapshot_survives_changes_to_source_players(share_api):
    client, factory = share_api
    data = await assert_roundtrip(client)
    async with factory.begin() as session:
        player = await session.get(Player, 13)
        player.web_name = "Changed name"
        player.now_cost = Decimal("9.9")
        player.expected_points_next = Decimal("9.0")
    response = await client.get(f'/api/v1/lineups/share/{data["share_code"]}')
    assert response.json() == data


@pytest.mark.asyncio
async def test_unknown_share_code_returns_404(share_api):
    response = await share_api[0].get("/api/v1/lineups/share/Abc123")
    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("code", ["abc", "abcdefg", "abc-12"])
async def test_malformed_share_code_returns_422(share_api, code):
    assert (await share_api[0].get(f"/api/v1/lineups/share/{code}")).status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("change", [
    {"lineup_name": "   "}, {"lineup_name": "x" * 101},
    {"starting_player_ids": [1]}, {"bench_player_ids": [1, 7, 11, 12]},
    {"captain_id": 2}, {"vice_captain_id": 13}, {"captain_id": True},
    {"formation": "2-5-3"}, {"total_cost": 1},
])
async def test_invalid_request_is_rejected_without_writes(share_api, change):
    client, factory = share_api
    response = await client.post("/api/v1/lineups/share", json={**PAYLOAD, **change})
    assert response.status_code == 422
    async with factory() as session:
        assert await session.scalar(select(func.count()).select_from(SharedLineup)) == 0


@pytest.mark.asyncio
async def test_unknown_player_returns_404_without_snapshot(share_api):
    payload = copy.deepcopy(PAYLOAD)
    payload["bench_player_ids"][0] = 999
    response = await share_api[0].post("/api/v1/lineups/share", json=payload)
    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("violation", ["budget", "club", "composition", "formation"])
async def test_fpl_rules_are_enforced(share_api, violation):
    client, factory = share_api
    payload = copy.deepcopy(PAYLOAD)
    async with factory.begin() as session:
        if violation == "budget":
            for player in (await session.scalars(select(Player))).all():
                player.now_cost = Decimal("7.0")
        elif violation == "club":
            (await session.get(Player, 2)).team_id = 1
        elif violation == "composition":
            (await session.get(Player, 2)).element_type = "DEF"
        else:
            payload["formation"] = "3-4-3"
    response = await client.post("/api/v1/lineups/share", json=payload)
    assert response.status_code == 400
    async with factory() as session:
        assert await session.scalar(select(func.count()).select_from(SharedLineup)) == 0


@pytest.mark.asyncio
async def test_missing_xp_uses_zero_without_inventing_predictions(share_api):
    client, factory = share_api
    async with factory.begin() as session:
        (await session.get(Player, 13)).expected_points_next = None
    response = await client.post("/api/v1/lineups/share", json=PAYLOAD)
    assert response.status_code == 201
    assert response.json()["predicted_points"] == 30.0


@pytest.mark.asyncio
async def test_code_collision_retries_and_keeps_existing_snapshot(share_api, monkeypatch):
    client, factory = share_api
    codes = iter(["AAAAAA", "AAAAAA", "BBBBBB"])
    monkeypatch.setattr(lineup_share, "generate_share_code", lambda: next(codes))
    first = await client.post("/api/v1/lineups/share", json=PAYLOAD)
    second = await client.post("/api/v1/lineups/share", json={**PAYLOAD, "lineup_name": "Second"})
    assert first.status_code == second.status_code == 201
    assert first.json()["share_code"] == "AAAAAA"
    assert second.json()["share_code"] == "BBBBBB"
    assert (await client.get("/api/v1/lineups/share/AAAAAA")).json()["lineup_name"] == "NH snapshot"
    async with factory() as session:
        assert await session.scalar(select(func.count()).select_from(SharedLineup)) == 2


@pytest.mark.asyncio
async def test_collision_exhaustion_returns_503_without_overwriting(share_api, monkeypatch):
    client, factory = share_api
    monkeypatch.setattr(lineup_share, "generate_share_code", lambda: "AAAAAA")
    assert (await client.post("/api/v1/lineups/share", json=PAYLOAD)).status_code == 201
    response = await client.post("/api/v1/lineups/share", json=PAYLOAD)
    assert response.status_code == 503
    async with factory() as session:
        assert await session.scalar(select(func.count()).select_from(SharedLineup)) == 1


@pytest.mark.parametrize("constraint,expected", [
    ("uq_shared_lineups_share_code", True),
    ("shared_lineups_share_code_key", True),
    ("pk_shared_lineups", False),
])
def test_postgres_collision_detection_only_retries_share_code(constraint, expected):
    cause = Exception("unique violation")
    cause.constraint_name = constraint
    original = Exception("adapted asyncpg error")
    original.sqlstate = "23505"
    original.__cause__ = cause
    error = IntegrityError("INSERT", {}, original)
    assert lineup_share._share_code_conflict(error) is expected


@pytest.mark.asyncio
async def test_postgres_snapshot_roundtrip_and_collision(monkeypatch):
    url = os.environ.get("SHARE_TEST_DATABASE_URL")
    if not url:
        pytest.skip("No isolated SHARE_TEST_DATABASE_URL configured")
    parsed = make_url(url)
    if parsed.drivername != "postgresql+asyncpg" or not (parsed.database or "").endswith("_test"):
        pytest.fail("Share integration requires postgresql+asyncpg and database ending in _test")
    engine = create_async_engine(url)
    schema = "share_test_" + uuid4().hex
    try:
        async with engine.begin() as connection:
            await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        isolated = engine.execution_options(schema_translate_map={None: schema})
        async with api_context(isolated) as (client, _):
            await assert_roundtrip(client)
            codes = iter(["AAAAAA", "AAAAAA", "BBBBBB"])
            monkeypatch.setattr(lineup_share, "generate_share_code", lambda: next(codes))
            first = await client.post("/api/v1/lineups/share", json=PAYLOAD)
            second = await client.post("/api/v1/lineups/share", json=PAYLOAD)
            assert first.status_code == second.status_code == 201
            assert second.json()["share_code"] == "BBBBBB"
    finally:
        try:
            async with engine.begin() as connection:
                await connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        finally:
            await engine.dispose()
