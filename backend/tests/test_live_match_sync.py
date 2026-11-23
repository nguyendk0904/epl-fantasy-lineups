"""P4-NH02: offline HTTP + SQL checks; optional isolated PostgreSQL roundtrips.

LIVE_MATCH_TEST_DATABASE_URL must use postgresql+asyncpg and a DB ending _test.
PostgreSQL tests migrate/drop only their own schema, never a shared app schema.
"""

import asyncio
import copy
import os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
import httpx
import pytest
import pytest_asyncio
from sqlalchemy import JSON, MetaData, event, func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.engine import make_url

from app.models import DreamTeam, Fixture, Player, PlayerGameweekStat, Team
from app.services import live_match_sync as service


def stats(**overrides):
    values = {key: 0 for key in service.STAT_COLUMNS}
    values.update(overrides)
    return values


@pytest.fixture
def payloads():
    performance = stats(minutes=90, total_points=6, clean_sheets=1, saves=1)
    live = {"elements": [{"id": i, "stats": performance.copy() if i == 1 else stats()}
                         for i in range(1, 12)]}
    # Official explain omits saves=1 because it earns zero points. History must
    # supply that count rather than deriving incomplete values from explain.
    live["elements"][0]["explain"] = [{"fixture": 1, "stats": [
        {"identifier": "minutes", "value": 90, "points": 2},
        {"identifier": "clean_sheets", "value": 1, "points": 4},
    ]}]
    return {
        "/api/event/1/live/": live,
        "/api/dream-team/1/": {"team": [
            {"element": i, "points": i + 1, "position": i} for i in range(11, 0, -1)
        ]},
        "/api/element-summary/1/": {"history": [
            {"element": 1, "fixture": 1, "round": 1, **performance, "bps": 24}
        ]},
    }


def client_for(payloads, *, errors=None, requests=None):
    errors = errors or {}

    def respond(request):
        path = request.url.path
        if requests is not None:
            requests.append(path)
        failure = errors.get(path)
        if failure == "timeout":
            raise httpx.ReadTimeout("credential-like error detail")
        if failure == "json":
            return httpx.Response(200, content=b"invalid-json")
        if type(failure) is int:
            return httpx.Response(failure)
        assert path in payloads, f"Unexpected request: {path}"
        return httpx.Response(200, json=payloads[path])
    return httpx.AsyncClient(transport=httpx.MockTransport(respond))


async def sync(factory, client, **kwargs):
    return await service.sync_live_match_data(1, factory, client=client, api_base_url="https://fpl.test/api", **kwargs)


async def seed(factory):
    async with factory() as session:
        async with session.begin():
            session.add_all([Team(id=1, name="Team A", short_name="A"), Team(id=2, name="Team B", short_name="B")])
            await session.flush()
            session.add_all([Player(id=i, web_name=f"Player {i}", team_id=1,
                                    element_type="GKP" if i == 1 else "DEF", now_cost=5)
                             for i in range(1, 12)])
            session.add_all([Fixture(id=i, gameweek=1 if i < 3 else 2, team_h=1, team_a=2, finished=True)
                             for i in range(1, 4)])


@pytest_asyncio.fixture
async def sql_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    @event.listens_for(engine.sync_engine, "connect")
    def enforce_foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    metadata = MetaData()
    for model in (Team, Player, Fixture, PlayerGameweekStat, DreamTeam):
        model.__table__.to_metadata(metadata)
    metadata.tables["dream_teams"].c.top_player_ids.type = JSON()
    try:
        async with engine.begin() as conn:
            await conn.run_sync(metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        await seed(factory)
        yield factory
    finally:
        await engine.dispose()


@pytest_asyncio.fixture(params=["sqlite", "postgres"])
async def roundtrip_factory(request, sql_factory):
    if request.param == "sqlite":
        yield sql_factory
        return
    url = os.environ.get("LIVE_MATCH_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set isolated LIVE_MATCH_TEST_DATABASE_URL for PostgreSQL verification")
    parsed = make_url(url)
    if parsed.drivername != "postgresql+asyncpg" or not (parsed.database or "").endswith("_test"):
        pytest.fail("Live match integration requires postgresql+asyncpg and a database ending _test")
    schema = "live_match_" + uuid4().hex
    engine = create_async_engine(url)
    try:
        async with engine.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        isolated = engine.execution_options(schema_translate_map={None: schema})
        async with isolated.begin() as conn:
            await conn.execute(text(f'SET LOCAL search_path TO "{schema}"'))

            def migrate(connection):
                backend = Path(__file__).resolve().parents[1]
                config = Config(str(backend / "alembic.ini"))
                config.set_main_option("script_location", str(backend / "alembic"))
                scripts = ScriptDirectory.from_config(config)
                with Operations.context(MigrationContext.configure(connection)):
                    for revision in reversed(list(scripts.walk_revisions())):
                        revision.module.upgrade()

            await conn.run_sync(migrate)
        factory = async_sessionmaker(isolated, expire_on_commit=False)
        await seed(factory)
        yield factory
    finally:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        finally:
            await engine.dispose()


@pytest.mark.asyncio
async def test_per_fixture_stats_and_dream_team_refresh_idempotently(payloads, roundtrip_factory):
    factory = roundtrip_factory
    async with client_for(payloads) as client:
        result = await sync(factory, client)
        assert not client.is_closed
    assert result == {"gameweek": 1, "players_processed": 11, "stats_processed": 1, "dream_teams_processed": 1}
    async with factory() as session:
        row = await session.scalar(select(PlayerGameweekStat))
        row_id = row.id
        assert (row.minutes, row.saves, row.bonus_points, row.total_points) == (90, 1, 0, 6)
        dream = await session.scalar(select(DreamTeam))
        dream_id = dream.id
        assert dream.top_player_ids == list(range(1, 12))
        assert dream.total_points == sum(range(2, 13))
    payloads["/api/event/1/live/"]["elements"][0]["stats"].update(bonus=3, total_points=9)
    payloads["/api/element-summary/1/"]["history"][0].update(bonus=3, total_points=9, bps=42)
    payloads["/api/dream-team/1/"]["team"][0]["points"] = 20
    async with client_for(payloads) as client:
        await sync(factory, client)
        await sync(factory, client)
    async with factory() as session:
        assert await session.scalar(select(func.count()).select_from(PlayerGameweekStat)) == 1
        assert await session.scalar(select(func.count()).select_from(DreamTeam)) == 1
        row = await session.scalar(select(PlayerGameweekStat))
        assert (row.id, row.total_points, row.bonus_points) == (row_id, 9, 3)
        assert (await session.scalar(select(DreamTeam))).id == dream_id


@pytest.mark.asyncio
async def test_dream_write_failure_rolls_back_stat_corrections(payloads, roundtrip_factory, monkeypatch):
    factory = roundtrip_factory
    async with client_for(payloads) as client:
        await sync(factory, client)
    original = service._upsert_rows

    async def fail_after_stats(session, table, rows, conflict):
        if table.name == "dream_teams":
            raise RuntimeError("credential-like DB detail")
        await original(session, table, rows, conflict)

    monkeypatch.setattr(service, "_upsert_rows", fail_after_stats)
    payloads["/api/event/1/live/"]["elements"][0]["stats"]["total_points"] = 7
    payloads["/api/element-summary/1/"]["history"][0]["total_points"] = 7
    async with client_for(payloads) as client:
        with pytest.raises(service.GameweekSyncError, match="transaction rolled back") as caught:
            await sync(factory, client)
    assert "credential-like" not in str(caught.value)
    async with factory() as session:
        assert (await session.scalar(select(PlayerGameweekStat))).total_points == 6
        assert (await session.scalar(select(DreamTeam))).total_points == sum(range(2, 13))


@pytest.mark.asyncio
async def test_double_gameweek_keeps_per_match_values_including_negative_points(payloads, sql_factory):
    second = stats(minutes=90, total_points=-1, goals_conceded=3, yellow_cards=1, saves=2)
    payloads["/api/element-summary/1/"]["history"].append({"element": 1, "fixture": 2, "round": 1, **second})
    live_stats = payloads["/api/event/1/live/"]["elements"][0]["stats"]
    for key, value in second.items():
        live_stats[key] += value
    async with client_for(payloads) as client:
        await sync(sql_factory, client)
    async with sql_factory() as session:
        rows = (await session.scalars(select(PlayerGameweekStat).order_by(PlayerGameweekStat.fixture_id))).all()
        assert [(r.fixture_id, r.total_points, r.saves) for r in rows] == [(1, 6, 1), (2, -1, 2)]
        assert sum(r.total_points for r in rows) == 5
        assert sum(r.minutes for r in rows) == 180


@pytest.mark.asyncio
async def test_zero_correction_clears_old_stats_and_preserves_other_gameweek(payloads, sql_factory):
    async with client_for(payloads) as client:
        await sync(sql_factory, client)
    async with sql_factory() as session:
        async with session.begin():
            session.add(PlayerGameweekStat(player_id=1, fixture_id=3, gameweek=2, minutes=90, total_points=8))
    payloads["/api/event/1/live/"]["elements"][0]["stats"] = stats()
    requests = []
    async with client_for(payloads, requests=requests) as client:
        await sync(sql_factory, client)
    assert not any("element-summary" in path for path in requests)
    async with sql_factory() as session:
        rows = (await session.scalars(select(PlayerGameweekStat).order_by(PlayerGameweekStat.gameweek))).all()
        assert [(row.gameweek, row.total_points, row.minutes) for row in rows] == [(1, 0, 0), (2, 8, 90)]


@pytest.mark.asyncio
@pytest.mark.parametrize("pending", ["404", "empty"])
async def test_unpublished_dream_team_does_not_block_stats_or_delete_saved_dream(payloads, sql_factory, pending):
    async with client_for(payloads) as client:
        await sync(sql_factory, client)
    errors = {"/api/dream-team/1/": 404} if pending == "404" else {}
    payloads["/api/dream-team/1/"]["team"] = []
    async with client_for(payloads, errors=errors) as client:
        result = await sync(sql_factory, client)
    assert result["stats_processed"] == 1
    assert result["dream_teams_processed"] == 0
    async with sql_factory() as session:
        assert await session.scalar(select(func.count()).select_from(DreamTeam)) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("gameweek", [0, 39, True, "1", 1.5])
async def test_invalid_gameweek_fails_before_http_or_sql(gameweek):
    factory = MagicMock()
    with pytest.raises(ValueError, match="gameweek"):
        await service.sync_live_match_data(gameweek, factory)
    factory.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid", ["empty_live", "duplicate_player", "bool_id", "fractional_minutes",
                                     "dream_null", "dream_short", "dream_duplicate", "dream_position",
                                     "history_duplicate", "history_player", "lagging_history"])
async def test_invalid_payload_or_history_never_opens_database(payloads, invalid):
    live = payloads["/api/event/1/live/"]["elements"]
    dream = payloads["/api/dream-team/1/"]["team"]
    history = payloads["/api/element-summary/1/"]["history"]
    if invalid == "empty_live":
        live.clear()
    elif invalid == "duplicate_player":
        live.append(copy.deepcopy(live[0]))
    elif invalid == "bool_id":
        live[0]["id"] = True
    elif invalid == "fractional_minutes":
        live[0]["stats"]["minutes"] = 90.5
    elif invalid == "dream_null":
        payloads["/api/dream-team/1/"] = None
    elif invalid == "dream_short":
        dream.pop()
    elif invalid == "dream_duplicate":
        dream[0]["element"] = dream[1]["element"]
    elif invalid == "dream_position":
        dream[0]["position"] = dream[1]["position"]
    elif invalid == "history_duplicate":
        history.append(copy.deepcopy(history[0]))
    elif invalid == "history_player":
        history[0]["element"] = 2
    else:
        history[0]["total_points"] = 5
    factory = MagicMock()
    async with client_for(payloads) as client:
        with pytest.raises(service.GameweekSyncError):
            await sync(factory, client)
    factory.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/event/1/live/", "/api/dream-team/1/", "/api/element-summary/1/"])
@pytest.mark.parametrize("failure", [503, "timeout", "json"])
async def test_fetch_errors_never_open_database(payloads, path, failure):
    factory = MagicMock()
    async with client_for(payloads, errors={path: failure}) as client:
        with pytest.raises(service.GameweekSyncError):
            await sync(factory, client)
    factory.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("missing", ["player", "fixture", "wrong_gameweek"])
async def test_missing_prerequisites_rollback_without_writes(payloads, sql_factory, missing):
    history = payloads["/api/element-summary/1/"]["history"][0]
    if missing == "player":
        payloads["/api/dream-team/1/"]["team"][0]["element"] = 999
    else:
        history["fixture"] = 999 if missing == "fixture" else 3
    async with client_for(payloads) as client:
        with pytest.raises(service.GameweekSyncError, match="transaction rolled back"):
            await sync(sql_factory, client)
    async with sql_factory() as session:
        assert await session.scalar(select(func.count()).select_from(PlayerGameweekStat)) == 0
        assert await session.scalar(select(func.count()).select_from(DreamTeam)) == 0


@pytest.mark.asyncio
async def test_history_requests_have_bounded_concurrency_and_finish_before_failure(payloads):
    live = payloads["/api/event/1/live/"]["elements"]
    live[1]["stats"] = copy.deepcopy(live[0]["stats"])
    payloads["/api/element-summary/2/"] = copy.deepcopy(payloads["/api/element-summary/1/"])
    payloads["/api/element-summary/2/"]["history"][0]["element"] = 2
    running = peak = finished = 0

    async def respond(request):
        nonlocal running, peak, finished
        path = request.url.path
        if "element-summary" in path:
            running += 1
            peak = max(peak, running)
            try:
                await asyncio.sleep(0)
                return httpx.Response(503 if path.endswith("/1/") else 200, json=payloads[path])
            finally:
                running -= 1
                finished += 1
        return httpx.Response(200, json=payloads[path])

    factory = MagicMock()
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(service.GameweekSyncError):
            await sync(factory, client, history_concurrency=1)
        assert running == 0 and finished == 2 and peak == 1
        assert not client.is_closed
    factory.assert_not_called()


@pytest.mark.asyncio
async def test_cli_failure_logs_safe_message_and_disposes_engine(monkeypatch, caplog):
    dispose = AsyncMock()
    monkeypatch.setattr(service, "engine", SimpleNamespace(dispose=dispose))
    monkeypatch.setattr(service, "sync_live_match_data", AsyncMock(side_effect=service.GameweekSyncError("safe failure")))
    with pytest.raises(SystemExit) as caught:
        await service._main(1)
    assert caught.value.code == 1
    assert "safe failure" in caplog.text
    dispose.assert_awaited_once()


@pytest.mark.asyncio
async def test_history_from_other_round_does_not_enter_current_gameweek(payloads, sql_factory):
    history = payloads["/api/element-summary/1/"]["history"]
    history.append({"element": 1, "fixture": 3, "round": 2, **stats(minutes=90, total_points=15)})
    async with client_for(payloads) as client:
        result = await sync(sql_factory, client)
    assert result["stats_processed"] == 1
    async with sql_factory() as session:
        assert await session.scalar(select(func.count()).select_from(PlayerGameweekStat)) == 1


@pytest.mark.asyncio
async def test_worker_closes_only_its_owned_http_client(payloads, sql_factory, monkeypatch):
    owned = client_for(payloads)
    monkeypatch.setattr(service.httpx, "AsyncClient", lambda: owned)
    result = await service.sync_live_match_data(1, sql_factory, api_base_url="https://fpl.test/api")
    assert owned.is_closed
    assert result["stats_processed"] == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [0, 9, True])
async def test_invalid_concurrency_is_rejected_without_network(limit):
    with pytest.raises(ValueError, match="history_concurrency"):
        await service.sync_live_match_data(1, history_concurrency=limit)
