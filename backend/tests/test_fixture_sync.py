"""P4-NH01: HTTP validation, real SQL transactions and optional PostgreSQL.

FIXTURE_SYNC_TEST_DATABASE_URL must point to a PostgreSQL database ending _test.
PostgreSQL tests migrate and drop only their own random schema. No live FPL call.
"""

from datetime import datetime, timezone
from io import StringIO
import os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
import httpx
import pytest
import pytest_asyncio
from sqlalchemy import event, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import Base, Fixture, Player, Team
from app.services import fixture_sync, fixtures_sync, fpl_sync


@pytest.fixture
def bootstrap():
    return {
        "teams": [{"id": i, "name": f"Team {i}", "short_name": f"T{i}"}
                  for i in range(1, 21)],
        "elements": [
            {"id": i, "team": i, "web_name": f"Player {i}", "element_type": i,
             "now_cost": 50, "status": "d", "news": "Knock",
             "chance_of_playing_next_round": 25}
            for i in range(1, 5)
        ],
    }


@pytest.fixture
def fixtures():
    return [
        {"id": i, "event": (i - 1) // 10 + 1,
         "team_h": (i - 1) % 20 + 1, "team_a": i % 20 + 1,
         "kickoff_time": "2026-11-23T15:00:00Z", "finished": False,
         "team_h_score": None, "team_a_score": None,
         "team_h_difficulty": 2, "team_a_difficulty": 4}
        for i in range(1, 381)
    ]


def client_for(bootstrap, fixtures, *, failure=None, endpoint="fixtures"):
    def respond(request):
        is_fixtures = request.url.path.rstrip("/").endswith("/fixtures")
        if is_fixtures == (endpoint == "fixtures"):
            if failure == "timeout":
                raise httpx.ReadTimeout("private details must not be logged")
            if failure == "http":
                return httpx.Response(503)
            if failure == "json":
                return httpx.Response(200, content=b"not-json")
        return httpx.Response(200, json=fixtures if is_fixtures else bootstrap)
    return httpx.AsyncClient(transport=httpx.MockTransport(respond))


async def sync(factory, client):
    return await fixture_sync.sync_fixtures_and_injuries(
        factory, client=client, bootstrap_url="https://fpl.test/bootstrap",
        fixtures_url="https://fpl.test/fixtures",
    )


def scripts():
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "alembic"))
    return ScriptDirectory.from_config(config)


@pytest_asyncio.fixture
async def sql_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    @event.listens_for(engine.sync_engine, "connect")
    def enforce_foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    try:
        async with engine.begin() as conn:
            await conn.run_sync(lambda c: Base.metadata.create_all(
                c, tables=[Team.__table__, Player.__table__, Fixture.__table__],
            ))
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        await engine.dispose()


@pytest_asyncio.fixture(params=["sqlite", "postgres"])
async def roundtrip_factory(request, sql_factory):
    if request.param == "sqlite":
        yield sql_factory
        return
    url = os.environ.get("FIXTURE_SYNC_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set isolated FIXTURE_SYNC_TEST_DATABASE_URL for PostgreSQL verification")
    parsed = make_url(url)
    if parsed.drivername != "postgresql+asyncpg" or not (parsed.database or "").endswith("_test"):
        pytest.fail("Fixture sync requires postgresql+asyncpg and database ending in _test")
    schema = "fixture_sync_" + uuid4().hex
    engine = create_async_engine(url)
    try:
        async with engine.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        isolated = engine.execution_options(schema_translate_map={None: schema})
        async with isolated.begin() as conn:
            await conn.execute(text(f'SET LOCAL search_path TO "{schema}"'))

            def migrate(connection):
                with Operations.context(MigrationContext.configure(connection)):
                    for revision in reversed(list(scripts().walk_revisions())):
                        revision.module.upgrade()

            await conn.run_sync(migrate)
        yield async_sessionmaker(isolated, expire_on_commit=False)
    finally:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        finally:
            await engine.dispose()


@pytest.mark.asyncio
async def test_full_season_and_injury_refresh_are_idempotent(bootstrap, fixtures, roundtrip_factory):
    factory = roundtrip_factory
    async with client_for(bootstrap, fixtures) as client:
        result = await sync(factory, client)
        assert not client.is_closed
    assert result == {"teams_processed": 20, "players_processed": 4,
                      "fixtures_processed": 380, "fixtures_unassigned": 0}
    async with factory() as session:
        player = await session.get(Player, 1)
        assert (player.status, player.news, player.chance_of_playing_next_round) == ("d", "Knock", 25)
    bootstrap["elements"][0].update(status="a", news="", chance_of_playing_next_round=None)
    fixtures[0].update(finished=True, team_h_score=2, team_a_score=1,
                       kickoff_time="2026-11-24T16:00:00+00:00")
    async with client_for(bootstrap, fixtures) as client:
        await sync(factory, client)
        await sync(factory, client)
    async with factory() as session:
        assert await session.scalar(select(func.count()).select_from(Team)) == 20
        assert await session.scalar(select(func.count()).select_from(Player)) == 4
        assert await session.scalar(select(func.count()).select_from(Fixture)) == 380
        player = await session.get(Player, 1)
        assert (player.status, player.news, player.chance_of_playing_next_round) == ("a", "", None)
        fixture = await session.get(Fixture, 1)
        assert (fixture.finished, fixture.team_h_score, fixture.team_a_score) == (True, 2, 1)
        assert fixture.kickoff_time.replace(tzinfo=timezone.utc) == datetime(2026, 11, 24, 16, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_fixture_write_failure_rolls_back_all_tables(bootstrap, fixtures, roundtrip_factory, monkeypatch):
    original = fixture_sync._upsert

    async def fail_fk(session, table, rows):
        if table.name == "fixtures":
            rows = [dict(row, team_h=9999) for row in rows]
        await original(session, table, rows)

    monkeypatch.setattr(fixture_sync, "_upsert", fail_fk)
    clear = MagicMock()
    monkeypatch.setattr(fixture_sync.optimizer_response_cache, "clear", clear)
    async with client_for(bootstrap, fixtures) as client:
        with pytest.raises(fpl_sync.FPLSyncError, match="transaction rolled back"):
            await sync(roundtrip_factory, client)
    clear.assert_not_called()
    async with roundtrip_factory() as session:
        for model in (Team, Player, Fixture):
            assert await session.scalar(select(func.count()).select_from(model)) == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("status,chance", [("d", 25), ("i", 0), ("s", 0), ("a", 100), ("a", None)])
async def test_injury_status_and_percentage(bootstrap, fixtures, sql_factory, status, chance):
    bootstrap["elements"][0].update(status=status, chance_of_playing_next_round=chance)
    async with client_for(bootstrap, fixtures[:1]) as client:
        await sync(sql_factory, client)
    async with sql_factory() as session:
        player = await session.get(Player, 1)
        assert (player.status, player.chance_of_playing_next_round) == (status, chance)


@pytest.mark.parametrize("chance", [-1, 101, True, 25.5, "25"])
def test_invalid_percentage_rejected(bootstrap, chance):
    bootstrap["elements"][0]["chance_of_playing_next_round"] = chance
    with pytest.raises(ValueError):
        fpl_sync._parse_payload(bootstrap)


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid", ["object", "empty", "duplicate", "team", "same_team", "event",
                                     "boolean_event", "naive_time", "score", "difficulty", "finished"])
async def test_invalid_fixtures_never_open_database(bootstrap, fixtures, invalid):
    payload = fixtures[:1]
    if invalid == "object":
        payload = {}
    elif invalid == "empty":
        payload = []
    elif invalid == "duplicate":
        payload *= 2
    else:
        key, value = {"team": ("team_h", 9999), "same_team": ("team_h", 2),
                      "event": ("event", 39), "boolean_event": ("event", True),
                      "naive_time": ("kickoff_time", "2026-11-23T15:00:00"),
                      "score": ("team_h_score", -1), "difficulty": ("team_h_difficulty", 6),
                      "finished": ("finished", "false")}[invalid]
        payload[0][key] = value
    factory = MagicMock()
    async with client_for(bootstrap, payload) as client:
        with pytest.raises(fpl_sync.FPLSyncError, match="Invalid FPL"):
            await sync(factory, client)
    factory.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", ["bootstrap", "fixtures"])
@pytest.mark.parametrize("failure", ["http", "timeout", "json"])
async def test_fetch_or_json_error_never_opens_database(bootstrap, fixtures, endpoint, failure):
    factory = MagicMock()
    async with client_for(bootstrap, fixtures, failure=failure, endpoint=endpoint) as client:
        with pytest.raises(fpl_sync.FPLSyncError):
            await sync(factory, client)
    factory.assert_not_called()


@pytest.mark.asyncio
async def test_unassigned_fixture_preserves_stored_row_and_reports_count(bootstrap, fixtures, sql_factory):
    async with client_for(bootstrap, fixtures[:1]) as client:
        await sync(sql_factory, client)
    fixtures[0]["event"] = None
    async with client_for(bootstrap, fixtures[:1]) as client:
        result = await sync(sql_factory, client)
    assert result["fixtures_processed"] == 0
    assert result["fixtures_unassigned"] == 1
    async with sql_factory() as session:
        assert (await session.get(Fixture, 1)).gameweek == 1


@pytest.mark.asyncio
async def test_invalid_bootstrap_never_opens_database(bootstrap, fixtures):
    bootstrap["elements"][0]["chance_of_playing_next_round"] = 101
    factory = MagicMock()
    async with client_for(bootstrap, fixtures) as client:
        with pytest.raises(fpl_sync.FPLSyncError, match="Invalid FPL"):
            await sync(factory, client)
    factory.assert_not_called()


@pytest.mark.asyncio
async def test_caches_clear_only_after_successful_commit(bootstrap, fixtures, sql_factory, monkeypatch):
    clear_optimizer, clear_fdr = MagicMock(), MagicMock()
    monkeypatch.setattr(fixture_sync.optimizer_response_cache, "clear", clear_optimizer)
    monkeypatch.setattr(fixture_sync, "clear_fdr_cache", clear_fdr)
    async with client_for(bootstrap, fixtures[:1]) as client:
        await sync(sql_factory, client)
    clear_optimizer.assert_called_once_with()
    clear_fdr.assert_called_once_with()


@pytest.mark.asyncio
async def test_existing_fixture_sync_reuses_parser(bootstrap, fixtures, sql_factory):
    async with client_for(bootstrap, fixtures[:1]) as client:
        await sync(sql_factory, client)
        result = await fixtures_sync.sync_fixtures(sql_factory, client)
    assert result == {"fixtures_processed": 1}


def test_migration_adds_percentage_and_reverses_cleanly():
    revision = scripts().get_revision("005_add_player_availability")
    assert revision.down_revision == "004_add_fixture_difficulty"
    assert scripts().get_current_head() == revision.revision
    output = StringIO()
    context = MigrationContext.configure(dialect_name="postgresql", opts={"as_sql": True, "output_buffer": output})
    with Operations.context(context):
        revision.module.upgrade()
        revision.module.downgrade()
    ddl = output.getvalue()
    assert "ADD COLUMN chance_of_playing_next_round INTEGER" in ddl
    assert "CHECK (chance_of_playing_next_round BETWEEN 0 AND 100)" in ddl
    assert "DROP CONSTRAINT ck_players_chance_of_playing_next_round" in ddl
    assert "DROP COLUMN chance_of_playing_next_round" in ddl


@pytest.mark.asyncio
async def test_percentage_database_constraint_is_enforced(bootstrap, fixtures, sql_factory):
    async with client_for(bootstrap, fixtures[:1]) as client:
        await sync(sql_factory, client)
    from sqlalchemy.exc import IntegrityError

    async with sql_factory() as session:
        with pytest.raises(IntegrityError):
            async with session.begin():
                await session.execute(text("UPDATE players SET chance_of_playing_next_round=101 WHERE id=1"))


@pytest.mark.asyncio
async def test_cli_failure_disposes_engine_without_raw_exception(monkeypatch, caplog):
    from unittest.mock import AsyncMock

    monkeypatch.setattr(fixture_sync, "sync_fixtures_and_injuries", AsyncMock(
        side_effect=fpl_sync.FPLSyncError("safe failure"),
    ))
    dispose = AsyncMock()
    monkeypatch.setattr(fixture_sync, "engine", SimpleNamespace(dispose=dispose))
    with pytest.raises(SystemExit) as caught:
        await fixture_sync._main()
    assert caught.value.code == 1
    dispose.assert_awaited_once()
    assert "safe failure" in caplog.text
