"""P1-NH02 tests. Integration requires FPL_SYNC_TEST_DATABASE_URL.

Only a PostgreSQL database whose name ends in _test is accepted. Tests create
and remove a unique schema inside that explicitly configured test database.
"""

import copy
import os
from contextlib import asynccontextmanager
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import Base, Player, Team
from app.services import fpl_sync


@pytest.fixture
def payload():
    return {
        "teams": [{"id": 1, "name": "Arsenal", "short_name": "ARS",
                   "strength": 4, "strength_attack_home": 1250}],
        "elements": [{"id": 10, "web_name": "Example", "team": 1,
                      "element_type": 4, "now_cost": 152, "form": "7.8",
                      "total_points": 180, "expected_goals": "10.25",
                      "expected_assists": None, "ict_index": "123.4"}],
    }


@pytest.mark.parametrize("strength", [None, 4])
def test_team_strength_defaults_only_for_null(payload, strength):
    payload["teams"][0]["strength"] = strength
    teams, _ = fpl_sync._parse_payload(payload)
    assert teams[0]["strength"] == (3 if strength is None else strength)


def test_missing_team_strength_keeps_default(payload):
    del payload["teams"][0]["strength"]
    teams, _ = fpl_sync._parse_payload(payload)
    assert teams[0]["strength"] == 3


def test_invalid_team_strength_is_rejected(payload):
    payload["teams"][0]["strength"] = "invalid"
    with pytest.raises(ValueError):
        fpl_sync._parse_payload(payload)


def client_for(payload=None, *, status=200, content=None, exception=None):
    def respond(request):
        if exception is not None:
            raise exception
        if content is not None:
            return httpx.Response(status, content=content)
        return httpx.Response(status, json=payload)
    return httpx.AsyncClient(transport=httpx.MockTransport(respond))


def fake_sessions():
    session = MagicMock()
    session.execute = AsyncMock()
    transaction = MagicMock()
    transaction.__aenter__ = AsyncMock()
    transaction.__aexit__ = AsyncMock(return_value=False)
    session.begin.return_value = transaction
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock(return_value=False)
    return MagicMock(return_value=session), session, transaction


@pytest.mark.parametrize("position,expected", [(1, "GKP"), (2, "DEF"), (3, "MID"), (4, "FWD")])
def test_mapping_price_positions_and_nullable_metrics(payload, position, expected):
    payload["elements"][0]["element_type"] = position
    teams, players = fpl_sync._parse_payload(payload)
    row = players[0]
    assert teams[0]["strength_attack_home"] == 1250
    assert row["team_id"] == 1
    assert row["now_cost"] == Decimal("15.2")
    assert row["element_type"] == expected
    assert row["form"] == Decimal("7.8")
    assert row["expected_goals"] == Decimal("10.25")
    assert row["expected_assists"] is None
    assert "expected_points_next" not in row


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid", ["position", "team", "missing_name", "duplicate_player",
                                    "duplicate_team", "empty", "numeric", "null_form",
                                    "boolean_position", "fractional_position", "overflow"])
async def test_invalid_payload_never_opens_database(payload, invalid):
    if invalid == "position":
        payload["elements"][0]["element_type"] = 9
    elif invalid == "team":
        payload["elements"][0]["team"] = 99
    elif invalid == "missing_name":
        del payload["elements"][0]["web_name"]
    elif invalid == "duplicate_player":
        payload["elements"] *= 2
    elif invalid == "duplicate_team":
        payload["teams"] *= 2
    elif invalid == "empty":
        payload["teams"] = []
    elif invalid == "numeric":
        payload["elements"][0]["expected_goals"] = "NaN"
    elif invalid == "boolean_position":
        payload["elements"][0]["element_type"] = True
    elif invalid == "fractional_position":
        payload["elements"][0]["element_type"] = 1.0
    elif invalid == "overflow":
        payload["elements"][0]["ict_index"] = "10000.0"
    else:
        payload["elements"][0]["form"] = None
    factory = MagicMock()
    async with client_for(payload) as client:
        with pytest.raises(fpl_sync.FPLSyncError, match="Invalid FPL bootstrap"):
            await fpl_sync.sync_fpl_data(factory, client=client)
    factory.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["http500", "timeout", "json"])
async def test_fetch_failures_never_open_database(failure):
    factory = MagicMock()
    kwargs = {"status": 500} if failure == "http500" else (
        {"exception": httpx.ReadTimeout("timeout")} if failure == "timeout" else
        {"content": b"not json"}
    )
    async with client_for(**kwargs) as client:
        with pytest.raises(fpl_sync.FPLSyncError):
            await fpl_sync.sync_fpl_data(factory, client=client)
    factory.assert_not_called()


@pytest.mark.asyncio
async def test_sync_uses_one_transaction_and_teams_first(payload):
    factory, session, transaction = fake_sessions()
    async with client_for(payload) as client:
        result = await fpl_sync.sync_fpl_data(factory, client=client)
        assert not client.is_closed
    assert result == {"teams_processed": 1, "players_processed": 1}
    factory.assert_called_once()
    session.begin.assert_called_once()
    statements = [call.args[0] for call in session.execute.await_args_list]
    assert [statement.table.name for statement in statements] == ["teams", "players"]
    assert all("ON CONFLICT (id) DO UPDATE" in str(statement) for statement in statements)
    transaction.__aexit__.assert_awaited_once_with(None, None, None)


@pytest.mark.asyncio
async def test_database_error_exits_transaction_with_exception(payload):
    factory, session, transaction = fake_sessions()
    session.execute.side_effect = [None, RuntimeError("write failed")]
    async with client_for(payload) as client:
        with pytest.raises(fpl_sync.FPLSyncError, match="rolled back"):
            await fpl_sync.sync_fpl_data(factory, client=client)
    assert transaction.__aexit__.await_args.args[0] is RuntimeError


@asynccontextmanager
async def integration_context():
    database_url = os.environ.get("FPL_SYNC_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("No explicitly configured FPL_SYNC_TEST_DATABASE_URL")
    parsed = make_url(database_url)
    if parsed.drivername != "postgresql+asyncpg" or not (parsed.database or "").endswith("_test"):
        pytest.fail("Integration requires postgresql+asyncpg and a database ending in _test")
    schema = "fpl_sync_" + uuid4().hex
    engine = create_async_engine(database_url)
    try:
        async with engine.begin() as connection:
            await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        isolated_engine = engine.execution_options(schema_translate_map={None: schema})
        async with isolated_engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        yield async_sessionmaker(isolated_engine, expire_on_commit=False)
    finally:
        try:
            async with engine.begin() as connection:
                await connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        finally:
            await engine.dispose()


@pytest.mark.asyncio
async def test_postgres_repeated_sync_updates_without_duplicates(payload):
    async with integration_context() as factory:
        async with client_for(payload) as client:
            await fpl_sync.sync_fpl_data(factory, client=client)
        async with factory() as session:
            player = await session.get(Player, 10)
            assert player.expected_points_next is None
            player.expected_points_next = Decimal("8.5")
            await session.commit()
        updated = copy.deepcopy(payload)
        updated["elements"][0].update(now_cost=153, total_points=190)
        updated["teams"][0]["strength"] = 5
        async with client_for(updated) as client:
            await fpl_sync.sync_fpl_data(factory, client=client)
            await fpl_sync.sync_fpl_data(factory, client=client)
        async with factory() as session:
            assert await session.scalar(select(func.count()).select_from(Player)) == 1
            assert await session.scalar(select(func.count()).select_from(Team)) == 1
            player = await session.get(Player, 10)
            assert player.now_cost == Decimal("15.3")
            assert player.total_points == 190
            assert player.expected_points_next == Decimal("8.5")
            assert (await session.get(Team, 1)).strength == 5


@pytest.mark.asyncio
async def test_postgres_player_failure_rolls_back_teams(payload, monkeypatch):
    async with integration_context() as factory:
        original = fpl_sync._upsert

        async def fail_player_constraint(session, table, rows):
            if table.name == "players":
                rows = [dict(row, web_name=None) for row in rows]
            await original(session, table, rows)

        monkeypatch.setattr(fpl_sync, "_upsert", fail_player_constraint)
        async with client_for(payload) as client:
            with pytest.raises(fpl_sync.FPLSyncError, match="rolled back"):
                await fpl_sync.sync_fpl_data(factory, client=client)
        async with factory() as session:
            assert await session.scalar(select(func.count()).select_from(Team)) == 0
            assert await session.scalar(select(func.count()).select_from(Player)) == 0
