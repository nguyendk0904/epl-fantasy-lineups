from datetime import datetime, timezone

import os
from pathlib import Path
from unittest.mock import AsyncMock
from uuid import uuid4

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
import httpx
import pytest
import pytest_asyncio
from sqlalchemy import JSON, MetaData, delete, event, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.main import app
from app.models import DreamTeam, Fixture, Player, PlayerGameweekStat, Team
from app.services.fdr_service import FPL_FIXTURES_URL


@pytest_asyncio.fixture
async def sessions():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA foreign_keys=ON"))
        metadata = MetaData()
        for model in (Team, Fixture, Player, PlayerGameweekStat, DreamTeam):
            model.__table__.to_metadata(metadata)
        metadata.tables["dream_teams"].c.top_player_ids.type = JSON()
        await conn.run_sync(metadata.create_all)
    factory = async_sessionmaker(engine)
    async with factory.begin() as db:
        db.add_all([Team(id=1, name="Arsenal", short_name="ARS"), Team(id=2, name="Chelsea", short_name="CHE")])
    try:
        yield factory
    finally:
        await engine.dispose()


def row(fid, **changes):
    return dict(dict(id=fid, gameweek=2, team_h=1, team_a=2, finished=False,
                     kickoff_time=datetime(2026, 8, 15, 15, tzinfo=timezone.utc),
                     team_h_difficulty=2, team_a_difficulty=4), **changes)


@pytest.mark.asyncio
async def test_fixtures_contract_and_order(sessions, monkeypatch):
    async with sessions.begin() as db:
        db.add_all([Fixture(**values) for values in [
            row(3), row(2), row(8, kickoff_time=datetime(2026, 8, 14, tzinfo=timezone.utc)),
            row(4, gameweek=1), row(5, kickoff_time=None), row(6, team_h_difficulty=None),
            row(7, team_a_difficulty=None),
        ]])

    async def override():
        async with sessions() as db:
            yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, override)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as api:
        result = await api.get("/api/v1/fixtures", params={"gameweek": 2})
        assert result.status_code == 200
        data = result.json()
        assert [item["id"] for item in data] == [8, 2, 3]
        assert data[1] == {
            "id": 2, "gameweek": 2, "kickoff_time": "2026-08-15T15:00:00Z",
            "kickoff_date": "15/08/2026", "home_team": {"id": 1, "name": "Arsenal", "short_name": "ARS"},
            "away_team": {"id": 2, "name": "Chelsea", "short_name": "CHE"},
            "team_h_score": None, "team_a_score": None, "team_h_difficulty": 2,
            "team_a_difficulty": 4, "finished": False,
        }
        for gw in (0, 39):
            assert (await api.get("/api/v1/fixtures", params={"gameweek": gw})).status_code == 422
        assert (await api.get("/api/v1/fixtures?gameweek=38")).json() == []


def mock_fpl(payload):
    def respond(request):
        assert str(request.url) == FPL_FIXTURES_URL
        return httpx.Response(200, json=payload)
    return httpx.AsyncClient(transport=httpx.MockTransport(respond))


@pytest.mark.asyncio
async def test_sync_upserts_and_skips_unscheduled(sessions):
    from app.services.fixtures_sync import sync_fixtures

    fixture = dict(id=1, event=2, team_h=1, team_a=2, finished=False, kickoff_time=None,
                   team_h_difficulty=2, team_a_difficulty=4)
    async with mock_fpl([fixture, {"id": 2, "event": None}]) as client:
        await sync_fixtures(sessions, client)
        fixture.update(finished=True, team_h_score=2, team_a_score=0)
        await sync_fixtures(sessions, client)
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(Fixture)) == 1
        saved = await db.get(Fixture, 1)
        assert (saved.gameweek, saved.finished, saved.team_h_score, saved.team_a_score) == (2, True, 2, 0)


@pytest.mark.asyncio
async def test_bad_team_in_second_chunk_rolls_back_first(sessions):
    from app.services.fixtures_sync import sync_fixtures
    from app.services.fpl_sync import FPLSyncError

    payload = [dict(id=i, event=2, team_h=1, team_a=2, finished=False) for i in range(1, 502)]
    payload[-1]["team_a"] = 99
    async with mock_fpl(payload) as client:
        with pytest.raises(FPLSyncError, match="rolled back"):
            await sync_fixtures(sessions, client)
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(Fixture)) == 0


async def seed_dream_team(factory):
    async with factory.begin() as db:
        db.add_all([Player(id=i, web_name=f"Player {i}", team_id=1 if i % 2 else 2,
                           element_type="GKP" if i == 1 else "DEF" if i <= 4 else "MID" if i <= 8 else "FWD",
                           now_cost=5) for i in range(1, 12)])
        db.add(Player(id=12, web_name="Not in Dream Team", team_id=1, element_type="MID", now_cost=5))
        db.add_all([Fixture(**row(101, finished=True)), Fixture(**row(102, finished=True)),
                    Fixture(**row(201, gameweek=3, finished=True))])
        await db.flush()
        db.add_all([PlayerGameweekStat(player_id=i, fixture_id=101, gameweek=2,
                                      minutes=90, total_points=10 if i == 1 else 2,
                                      bonus_points=2 if i == 1 else 0,
                                      clean_sheets=1 if i == 1 else 0) for i in range(1, 12)])
        db.add_all([
            PlayerGameweekStat(player_id=1, fixture_id=102, gameweek=2, minutes=90,
                               total_points=3, goals=1, assists=1, bonus_points=1),
            PlayerGameweekStat(player_id=1, fixture_id=201, gameweek=3, minutes=90, total_points=100),
            PlayerGameweekStat(player_id=12, fixture_id=101, gameweek=2, minutes=90, total_points=999),
            DreamTeam(gameweek=2, top_player_ids=list(range(11, 0, -1)), total_points=33),
        ])


@pytest_asyncio.fixture
async def dream_sessions(sessions):
    await seed_dream_team(sessions)
    return sessions


@pytest_asyncio.fixture
async def api(sessions, monkeypatch):
    async def override():
        async with sessions() as db:
            yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, override)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture(params=["sqlite", "postgres"])
async def dream_roundtrip(request, dream_sessions):
    if request.param == "sqlite":
        yield dream_sessions
        return
    url = os.environ.get("FIXTURES_API_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set isolated FIXTURES_API_TEST_DATABASE_URL for PostgreSQL API verification")
    parsed = make_url(url)
    if parsed.drivername != "postgresql+asyncpg" or not (parsed.database or "").endswith("_test"):
        pytest.fail("Fixtures API verification requires postgresql+asyncpg and a database ending _test")
    schema = "fixtures_api_" + uuid4().hex
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
        factory = async_sessionmaker(isolated)
        async with factory.begin() as db:
            db.add_all([Team(id=1, name="Arsenal", short_name="ARS"), Team(id=2, name="Chelsea", short_name="CHE")])
        await seed_dream_team(factory)
        yield factory
    finally:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        finally:
            await engine.dispose()


@pytest.mark.asyncio
async def test_dream_team_contract_double_gameweek_and_snapshot_order(dream_roundtrip, monkeypatch):
    async def override():
        async with dream_roundtrip() as db:
            yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, override)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/dream-team/2")
    assert response.status_code == 200
    data = response.json()
    assert set(data) == {"gameweek", "formation", "total_points", "mvp", "players"}
    assert (data["gameweek"], data["formation"], data["total_points"]) == (2, "3-4-3", 33)
    assert [p["id"] for p in data["players"]] == list(range(11, 0, -1))
    assert data["mvp"] == {"id": 1, "name": "Player 1", "points": 13, "team": "ARS"}
    assert data["players"][-1] == {
        "id": 1, "web_name": "Player 1", "team_short_name": "ARS", "team_id": 1,
        "element_type": "GKP", "points": 13, "goals": 1, "assists": 1,
        "clean_sheet": True, "bonus": 3, "isMvp": True,
    }
    assert sum(p["points"] for p in data["players"]) == data["total_points"]
    assert sum(p["isMvp"] for p in data["players"]) == 1


@pytest.mark.asyncio
async def test_missing_dream_team_is_404_without_synthetic_fallback(api):
    response = await api.get("/api/v1/dream-team/2")
    assert response.status_code == 404
    assert response.json() == {"detail": "Dream Team not found for this gameweek"}


@pytest.mark.asyncio
@pytest.mark.parametrize("gw", [0, 39, -1, "abc", "1.5"])
async def test_dream_team_validates_gameweek(api, gw):
    assert (await api.get(f"/api/v1/dream-team/{gw}")).status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["", "?gameweek=0", "?gameweek=39", "?gameweek=abc", "?gameweek=2.5"])
async def test_fixtures_validates_required_gameweek_query(api, query):
    assert (await api.get("/api/v1/fixtures" + query)).status_code == 422


@pytest.mark.asyncio
async def test_fixtures_finished_score_and_empty_gameweek(sessions, api):
    async with sessions.begin() as db:
        db.add(Fixture(**row(1, finished=True, team_h_score=3, team_a_score=0)))
    data = (await api.get("/api/v1/fixtures?gameweek=2")).json()
    assert (data[0]["finished"], data[0]["team_h_score"], data[0]["team_a_score"]) == (True, 3, 0)
    assert (await api.get("/api/v1/fixtures?gameweek=38")).json() == []


@pytest.mark.asyncio
@pytest.mark.parametrize("formation", ["3-4-3", "3-5-2", "4-3-3", "4-4-2", "4-5-1", "5-2-3", "5-3-2", "5-4-1"])
async def test_dream_team_derives_formation_from_player_positions(dream_sessions, api, formation):
    defenders, midfielders, forwards = map(int, formation.split("-"))
    positions = ["GKP"] + ["DEF"] * defenders + ["MID"] * midfielders + ["FWD"] * forwards
    async with dream_sessions.begin() as db:
        for player_id, position in enumerate(positions, 1):
            (await db.get(Player, player_id)).element_type = position
    response = await api.get("/api/v1/dream-team/2")
    assert response.status_code == 200
    assert response.json()["formation"] == formation


@pytest.mark.asyncio
@pytest.mark.parametrize("broken", ["short", "duplicate", "bool_id", "unknown_player", "missing_stats",
                                    "team", "position", "formation", "total"])
async def test_incomplete_dream_data_returns_503(dream_sessions, api, broken):
    async with dream_sessions.begin() as db:
        dream = await db.scalar(select(DreamTeam))
        if broken == "short":
            dream.top_player_ids = list(range(1, 11))
        elif broken == "duplicate":
            dream.top_player_ids = [1] * 11
        elif broken == "bool_id":
            dream.top_player_ids = [True] + list(range(2, 12))
        elif broken == "unknown_player":
            dream.top_player_ids = [999] + list(range(2, 12))
        elif broken == "missing_stats":
            await db.execute(delete(PlayerGameweekStat).where(PlayerGameweekStat.player_id == 11))
        elif broken == "total":
            dream.total_points += 1
        else:
            player = await db.get(Player, 1)
            if broken == "team":
                player.team_id = None
            else:
                player.element_type = "OTHER" if broken == "position" else "DEF"
    response = await api.get("/api/v1/dream-team/2")
    assert response.status_code == 503
    assert response.json() == {"detail": "Dream Team data is incomplete or inconsistent; sync the gameweek first"}


@pytest.mark.asyncio
async def test_dream_team_tied_mvp_uses_snapshot_order(dream_sessions, api):
    async with dream_sessions.begin() as db:
        stat = await db.scalar(select(PlayerGameweekStat).where(PlayerGameweekStat.player_id == 2))
        stat.total_points = 13
        (await db.scalar(select(DreamTeam))).total_points = 44
    response = await api.get("/api/v1/dream-team/2")
    assert response.status_code == 200
    assert response.json()["mvp"]["id"] == 2


@pytest.mark.asyncio
async def test_dream_team_database_error_does_not_expose_details(api, monkeypatch):
    async def broken_db():
        db = AsyncMock()
        db.scalar.side_effect = SQLAlchemyError("postgresql://private:password@db")
        yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, broken_db)
    response = await api.get("/api/v1/dream-team/2")
    assert response.status_code == 503
    assert response.json() == {"detail": "Dream Team database unavailable"}
    assert "password" not in response.text


@pytest.mark.asyncio
async def test_dream_team_uses_three_read_only_queries_without_n_plus_one(dream_sessions, api):
    statements = []
    engine = dream_sessions.kw["bind"]

    def capture(_conn, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", capture)
    try:
        assert (await api.get("/api/v1/dream-team/2")).status_code == 200
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", capture)
    assert len(statements) == 3
    assert all(statement.lstrip().upper().startswith("SELECT") for statement in statements)


def test_gameweek_routes_and_response_models_are_registered_in_openapi():
    schema = app.openapi()
    assert "/api/v1/fixtures" in schema["paths"]
    endpoint = schema["paths"]["/api/v1/dream-team/{gw}"]["get"]
    assert {"200", "404", "422", "503"}.issubset(endpoint["responses"])
    parameter = next(p for p in endpoint["parameters"] if p["name"] == "gw")
    assert (parameter["schema"]["minimum"], parameter["schema"]["maximum"]) == (1, 38)
