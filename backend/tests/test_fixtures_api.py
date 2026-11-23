from datetime import datetime, timezone

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.main import app
from app.models import Fixture, Team
from app.services.fdr_service import FPL_FIXTURES_URL


@pytest_asyncio.fixture
async def sessions():
    engine = create_async_engine("sqlite+aiosqlite://")
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA foreign_keys=ON"))
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=[Team.__table__, Fixture.__table__]))
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
