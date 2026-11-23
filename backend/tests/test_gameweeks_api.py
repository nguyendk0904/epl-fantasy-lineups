"""P4-NH04: real local transactions, ranking, auth/deadlines and opt-in PG locks.

GAMEWEEK_TEST_DATABASE_URL must use postgresql+asyncpg and a DB ending _test.
The optional PostgreSQL checks migrate/drop only their own random schema.
"""

import base64
import copy
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
from unittest.mock import AsyncMock
from uuid import uuid4

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
import httpx
from pydantic import SecretStr, ValidationError
import pytest
import pytest_asyncio
from sqlalchemy import JSON, MetaData, event, func, select, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1.endpoints import gameweeks as endpoint
from app.core import gameweek_auth as auth
from app.core.config import Settings, settings
from app.core.database import Base, get_db
from app.main import app
from app.models import Fixture, Player, PlayerGameweekStat, Team, UserGameweekLineup
from app.services import gameweek_service as service


NOW = datetime(2026, 11, 23, 12, tzinfo=timezone.utc)
FUTURE = NOW + timedelta(days=1)
STARTERS = [1, 3, 4, 5, 8, 9, 10, 11, 13, 14, 15]
BENCH = [2, 6, 7, 12]
FAKE_SECRET = "unit-test-only-secret-do-not-deploy-" * 2


@pytest.fixture(autouse=True)
def demo_config(monkeypatch):
    monkeypatch.setattr(settings, "GAMEWEEK_DEMO_AUTH_ENABLED", True)
    monkeypatch.setattr(settings, "GAMEWEEK_DEMO_TOKEN_SECRET", SecretStr(FAKE_SECRET))
    monkeypatch.setattr(service, "utc_now", lambda: NOW)


@pytest.fixture
def payload():
    return {"gameweek": 2, "starting_player_ids": STARTERS.copy(), "bench_player_ids": BENCH.copy(),
            "formation": "3-4-3", "captain_id": 8, "vice_captain_id": 9}


def swapped(payload, replacements):
    result = copy.deepcopy(payload)
    for key in ("starting_player_ids", "bench_player_ids"):
        result[key] = [replacements.get(i, i) for i in result[key]]
    for key in ("captain_id", "vice_captain_id"):
        result[key] = replacements.get(result[key], result[key])
    return result


def stored_lineup(user_id, gameweek, *, points=0, used=0, locked=False):
    return UserGameweekLineup(user_id=user_id, gameweek=gameweek,
                             starting_player_ids=STARTERS.copy(), bench_player_ids=BENCH.copy(),
                             captain_id=8, vice_captain_id=9, transfers_used=used,
                             is_locked=locked, gameweek_points=points)


async def seed(factory):
    async with factory.begin() as db:
        db.add_all([Team(id=i, name=f"Club {i}", short_name=f"C{i}") for i in range(1, 6)])
        await db.flush()
        positions = ["GKP"] * 2 + ["DEF"] * 5 + ["MID"] * 5 + ["FWD"] * 3
        players = [Player(id=i, web_name=f"P{i}", team_id=(i - 1) % 5 + 1, element_type=position, now_cost=5)
                   for i, position in enumerate(positions, 1)]
        originals = {p.id: p for p in players}
        for new, old in {16: 3, 17: 4, 18: 5, 19: 6, 20: 7, 21: 8, 22: 9, 23: 10,
                         24: 11, 25: 12, 26: 1, 27: 2, 28: 13, 29: 14, 30: 15}.items():
            players.append(Player(id=new, web_name=f"P{new}", team_id=originals[old].team_id,
                                  element_type=originals[old].element_type, now_cost=5))
        db.add_all(players)


@pytest_asyncio.fixture
async def sessions(tmp_path):
    # Multiple DB connections exercise database serialization, not an asyncio lock.
    engine = create_async_engine("sqlite+aiosqlite:///" + (tmp_path / "gameweeks.db").as_posix(),
                                 connect_args={"timeout": 15})

    @event.listens_for(engine.sync_engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    metadata = MetaData()
    for table in Base.metadata.sorted_tables:
        copied = table.to_metadata(metadata)
        for column in copied.c:
            if isinstance(column.type, JSONB):
                column.type = JSON()
    try:
        async with engine.begin() as conn:
            await conn.run_sync(metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        await seed(factory)
        yield factory
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def api(sessions, monkeypatch):
    async def override():
        async with sessions() as db:
            yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, override)
    monkeypatch.setattr(endpoint, "get_gameweek_deadline", AsyncMock(return_value=FUTURE))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test",
                                 headers={"Authorization": "Bearer " + auth.issue_demo_token(1)}) as client:
        yield client


@pytest.mark.asyncio
async def test_initial_squad_is_free_retry_and_bench_reorder_do_not_consume_transfers(api, payload):
    first = await api.post("/api/v1/transfers/confirm", json=payload)
    assert first.status_code == 200
    data = first.json()
    assert (data["user_id"], data["total_cost"], data["transfers_used"], data["remaining_transfers"]) == (1, 75, 0, 3)
    assert data["deadline"] == FUTURE.isoformat().replace("+00:00", "Z")
    payload["bench_player_ids"].reverse()
    payload["captain_id"], payload["vice_captain_id"] = 9, 8
    repeated = await api.post("/api/v1/transfers/confirm", json=payload)
    assert repeated.status_code == 200
    assert repeated.json()["lineup_id"] == data["lineup_id"]
    assert repeated.json()["transfers_count"] == repeated.json()["transfers_used"] == 0


@pytest.mark.asyncio
async def test_three_cumulative_changes_allowed_fourth_rejected_and_rollback_preserves_state(api, sessions, payload):
    assert (await api.post("/api/v1/transfers/confirm", json=payload)).status_code == 200
    changed = payload
    for used, replacement in enumerate(({3: 16}, {4: 17}, {5: 18}), 1):
        changed = swapped(changed, replacement)
        response = await api.post("/api/v1/transfers/confirm", json=changed)
        assert response.status_code == 200
        assert response.json()["transfers_used"] == used
    rejected = await api.post("/api/v1/transfers/confirm", json=swapped(changed, {6: 19}))
    assert rejected.status_code == 400
    assert (await api.post("/api/v1/transfers/confirm", json=changed)).json()["transfers_used"] == 3
    async with sessions() as db:
        row = await db.scalar(select(UserGameweekLineup))
        assert row.transfers_used == 3 and 6 in row.bench_player_ids and 19 not in row.bench_player_ids


@pytest.mark.asyncio
async def test_new_week_uses_previous_squad_baseline_but_resets_allowance(api, sessions, payload):
    async with sessions.begin() as db:
        db.add(stored_lineup(1, 1, points=30, used=3, locked=True))
    payload = swapped(payload, {3: 16})
    result = await api.post("/api/v1/transfers/confirm", json=payload)
    assert result.status_code == 200
    assert result.json()["transfers_used"] == 1
    payload["gameweek"] = 3
    result = await api.post("/api/v1/transfers/confirm", json=payload)
    assert result.status_code == 200
    assert result.json()["transfers_used"] == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("invalid", ["duplicate", "captain", "unknown_player", "budget", "club", "formation",
                                     "composition", "forged_user", "forged_count", "forged_deadline", "forged_cost"])
async def test_validation_and_client_values_cannot_bypass_rules(api, sessions, payload, invalid):
    if invalid == "duplicate":
        payload["bench_player_ids"][0] = 1
    elif invalid == "captain":
        payload["captain_id"] = 2
    elif invalid == "unknown_player":
        payload["bench_player_ids"][0] = 999
    elif invalid == "formation":
        payload["formation"] = "4-4-2"
    elif invalid.startswith("forged_"):
        payload[{"forged_user": "user_id", "forged_count": "transfers_used", "forged_deadline": "deadline",
                 "forged_cost": "total_cost"}[invalid]] = 0
    else:
        async with sessions.begin() as db:
            if invalid == "budget":
                for player in (await db.scalars(select(Player))).all():
                    player.now_cost = 10
            elif invalid == "club":
                (await db.get(Player, 1)).team_id = 2
            else:
                (await db.get(Player, 1)).element_type = "DEF"
    response = await api.post("/api/v1/transfers/confirm", json=payload)
    assert response.status_code == (422 if invalid in {"duplicate", "captain"} or invalid.startswith("forged_")
                                    else 404 if invalid == "unknown_player" else 400)
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(UserGameweekLineup)) == 0


@pytest.mark.asyncio
async def test_locked_or_expired_lineup_rejected(api, sessions, payload, monkeypatch):
    async with sessions.begin() as db:
        db.add(stored_lineup(1, 2, locked=True))
    assert (await api.post("/api/v1/transfers/confirm", json=payload)).status_code == 400
    monkeypatch.setattr(endpoint, "get_gameweek_deadline", AsyncMock(return_value=NOW))
    assert (await api.post("/api/v1/transfers/confirm", json=payload)).status_code == 400


@pytest.mark.asyncio
async def test_deadline_crossed_before_commit_rolls_back_insert(api, sessions, payload, monkeypatch):
    times = iter([NOW, NOW, FUTURE])
    monkeypatch.setattr(service, "utc_now", lambda: next(times))
    assert (await api.post("/api/v1/transfers/confirm", json=payload)).status_code == 400
    async with sessions() as db:
        assert await db.scalar(select(func.count()).select_from(UserGameweekLineup)) == 0


@pytest.mark.asyncio
async def test_deadline_failure_writes_nothing(api, payload, monkeypatch):
    from fastapi import HTTPException

    monkeypatch.setattr(endpoint, "get_gameweek_deadline", AsyncMock(side_effect=HTTPException(503, "FPL unavailable")))
    assert (await api.post("/api/v1/transfers/confirm", json=payload)).status_code == 503


@pytest.mark.asyncio
async def test_tokens_expiry_signature_and_cross_user_isolation(api, sessions, payload, monkeypatch):
    assert (await api.post("/api/v1/transfers/confirm", json=payload, headers={"Authorization": ""})).status_code == 401
    assert (await api.post("/api/v1/transfers/confirm", json=payload, headers={"Authorization": "Bearer broken"})).status_code == 401
    token = auth.issue_demo_token(1)
    tampered = ("x" if token[0] != "x" else "y") + token[1:]
    assert (await api.post("/api/v1/transfers/confirm", json=payload,
                           headers={"Authorization": "Bearer " + tampered})).status_code == 401
    token2 = auth.issue_demo_token(2)
    response = await api.post("/api/v1/transfers/confirm", json=payload, headers={"Authorization": "Bearer " + token2})
    assert response.status_code == 200 and response.json()["user_id"] == 2
    async with sessions() as db:
        assert (await db.scalar(select(UserGameweekLineup))).user_id == 2
    monkeypatch.setattr(auth.time, "time", lambda: 0)
    expired = auth.issue_demo_token(1, hours=1)
    monkeypatch.setattr(auth.time, "time", lambda: 3600)
    assert (await api.post("/api/v1/transfers/confirm", json=payload,
                           headers={"Authorization": "Bearer " + expired})).status_code == 401


@pytest.mark.asyncio
async def test_demo_writes_disabled_by_default_and_public_ranking_still_available(api, payload, monkeypatch):
    monkeypatch.setattr(settings, "GAMEWEEK_DEMO_AUTH_ENABLED", False)
    assert (await api.post("/api/v1/transfers/confirm", json=payload)).status_code == 503
    assert (await api.get("/api/v1/leaderboard?gameweek=2", headers={"Authorization": ""})).status_code == 200


def test_demo_secret_settings_fail_safely_and_repr_hides_key():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, GAMEWEEK_DEMO_AUTH_ENABLED=True, GAMEWEEK_DEMO_TOKEN_SECRET=None)
    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None, GAMEWEEK_DEMO_TOKEN_SECRET="weak")
    assert "weak" not in str(error.value)
    config = Settings(_env_file=None, GAMEWEEK_DEMO_TOKEN_SECRET=FAKE_SECRET)
    assert FAKE_SECRET not in repr(config)
    from app.core.logging_config import JsonLogFormatter

    assert FAKE_SECRET not in JsonLogFormatter(config).redact(FAKE_SECRET)


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["http", "json", "missing", "duplicate", "naive", "boolean_id"])
async def test_authoritative_deadline_never_uses_client_clock_or_bad_fpl_metadata(failure):
    payload = {"events": [{"id": 2, "deadline_time": FUTURE.isoformat()}]}
    if failure == "missing":
        payload["events"] = []
    elif failure == "duplicate":
        payload["events"] *= 2
    elif failure == "naive":
        payload["events"][0]["deadline_time"] = "2026-11-24T12:00:00"
    elif failure == "boolean_id":
        payload["events"][0]["id"] = True

    def respond(_request):
        return httpx.Response(503) if failure == "http" else httpx.Response(200, content=b"invalid") if failure == "json" else httpx.Response(200, json=payload)

    from fastapi import HTTPException

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        with pytest.raises(HTTPException) as caught:
            await service.get_gameweek_deadline(2, client=client)
    assert caught.value.status_code == 503


@pytest.mark.asyncio
async def test_authoritative_deadline_normalizes_timezone():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _r: httpx.Response(
        200, json={"events": [{"id": 2, "deadline_time": "2026-11-24T19:00:00+07:00"}]},
    ))) as client:
        assert await service.get_gameweek_deadline(2, client=client) == FUTURE


@pytest.mark.asyncio
async def test_leaderboard_real_points_ties_previous_ranks_sort_and_pagination(api, sessions):
    async with sessions.begin() as db:
        db.add_all([stored_lineup(1, 1, points=10), stored_lineup(1, 2, points=5),
                    stored_lineup(2, 1, points=8), stored_lineup(2, 2, points=7),
                    stored_lineup(3, 2, points=2), stored_lineup(1, 3, points=999)])
    response = await api.get("/api/v1/leaderboard?gameweek=2&limit=2")
    assert response.status_code == 200
    rows = response.json()
    assert [(r["user_id"], r["rank"], r["previous_rank"], r["total_points"]) for r in rows] == [(1, 1, 1, 15), (2, 1, 2, 15)]
    assert rows[0]["manager_name"] == "Player #1" and rows[0]["team_name"] == "Squad #1"
    assert rows[0]["captain_name"] == "P8" and rows[0]["formation"] == "3-4-3"
    assert rows[0]["favorite_club"] == ""
    assert response.headers["x-total-count"] == "3" and response.headers["x-total-pages"] == "2"
    page2 = (await api.get("/api/v1/leaderboard?gameweek=2&limit=2&page=2")).json()
    assert (page2[0]["user_id"], page2[0]["rank"], page2[0]["previous_rank"]) == (3, 3, 0)
    weekly = (await api.get("/api/v1/leaderboard?gameweek=2&sort_by=gameweek")).json()
    assert [r["user_id"] for r in weekly] == [2, 1, 3]
    assert (await api.get("/api/v1/leaderboard?gameweek=2&page=99")).json() == []


@pytest.mark.asyncio
@pytest.mark.parametrize("query", ["", "?gameweek=0", "?gameweek=39", "?gameweek=2&sort_by=x",
                                  "?gameweek=2&limit=101", "?gameweek=2&page=0"])
async def test_leaderboard_validates_query(api, query):
    assert (await api.get("/api/v1/leaderboard" + query)).status_code == 422


@pytest.mark.asyncio
async def test_leaderboard_cors_exposes_pagination_headers(api):
    response = await api.get("/api/v1/leaderboard?gameweek=2", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200 and response.json() == []
    assert "X-Total-Count" in response.headers["access-control-expose-headers"]


@pytest.mark.asyncio
async def test_scoring_reuses_v_engine_and_is_idempotent(api, sessions, monkeypatch):
    async with sessions.begin() as db:
        db.add(stored_lineup(1, 2))
        db.add(Fixture(id=1, gameweek=2, team_h=1, team_a=2, finished=True))
        await db.flush()
        db.add_all([PlayerGameweekStat(player_id=i, fixture_id=1, gameweek=2, minutes=90, total_points=2)
                    for i in range(1, 16)])
    monkeypatch.setattr(service, "get_gameweek_deadline", AsyncMock(return_value=NOW - timedelta(days=1)))
    assert await service.score_completed_gameweek(2, sessions) == 1
    assert await service.score_completed_gameweek(2, sessions) == 1
    result = (await api.get("/api/v1/leaderboard?gameweek=2")).json()[0]
    assert result["total_points"] == result["gameweek_points"] == 24
    async with sessions() as db:
        assert (await db.scalar(select(UserGameweekLineup))).is_locked


@pytest.mark.asyncio
async def test_scoring_refuses_unfinished_or_missing_stats(sessions, monkeypatch):
    from fastapi import HTTPException

    monkeypatch.setattr(service, "get_gameweek_deadline", AsyncMock(return_value=NOW - timedelta(days=1)))
    async with sessions.begin() as db:
        db.add(Fixture(id=1, gameweek=2, team_h=1, team_a=2, finished=False))
    with pytest.raises(HTTPException):
        await service.score_completed_gameweek(2, sessions)
    async with sessions.begin() as db:
        (await db.get(Fixture, 1)).finished = True
    with pytest.raises(HTTPException):
        await service.score_completed_gameweek(2, sessions)


@pytest_asyncio.fixture(params=["sqlite", "postgres"])
async def concurrent_sessions(request, sessions):
    if request.param == "sqlite":
        yield sessions
        return
    url = os.environ.get("GAMEWEEK_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set isolated GAMEWEEK_TEST_DATABASE_URL for real PostgreSQL locking")
    parsed = make_url(url)
    if parsed.drivername != "postgresql+asyncpg" or not (parsed.database or "").endswith("_test"):
        pytest.fail("Gameweek integration requires postgresql+asyncpg and database ending _test")
    schema = "gameweeks_" + uuid4().hex
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
async def test_concurrent_transfers_cannot_exceed_three(concurrent_sessions, payload):
    import asyncio
    from fastapi import HTTPException
    from app.schemas.gameweek import ConfirmTransfersRequest

    factory = concurrent_sessions
    async with factory.begin() as db:
        db.add(stored_lineup(1, 2, used=2))

    async def change(replacement):
        async with factory() as db:
            try:
                return await service.confirm_transfers(db, 1, ConfirmTransfersRequest(**swapped(payload, replacement)), FUTURE)
            except HTTPException as exc:
                return exc.status_code

    outcomes = await asyncio.gather(change({3: 16}), change({4: 17}))
    assert sum(isinstance(outcome, int) and outcome == 400 for outcome in outcomes) == 1
    async with factory() as db:
        assert (await db.scalar(select(UserGameweekLineup))).transfers_used == 3


@pytest.mark.asyncio
async def test_concurrent_initial_submit_creates_one_row(concurrent_sessions, payload):
    import asyncio
    from app.schemas.gameweek import ConfirmTransfersRequest

    async def submit():
        async with concurrent_sessions() as db:
            return await service.confirm_transfers(db, 1, ConfirmTransfersRequest(**payload), FUTURE)

    outcomes = await asyncio.gather(submit(), submit())
    assert outcomes[0].lineup_id == outcomes[1].lineup_id
    async with concurrent_sessions() as db:
        assert await db.scalar(select(func.count()).select_from(UserGameweekLineup)) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("baseline", [{"invalid": 1}, None])
async def test_invalid_stored_baseline_is_not_overwritten(api, sessions, payload, baseline):
    async with sessions.begin() as db:
        row = stored_lineup(1, 2)
        row.starting_player_ids = baseline
        db.add(row)
    response = await api.post("/api/v1/transfers/confirm", json=payload)
    assert response.status_code == 503
    async with sessions() as db:
        assert (await db.scalar(select(UserGameweekLineup))).starting_player_ids == baseline
    ranking = await api.get("/api/v1/leaderboard?gameweek=2")
    assert ranking.status_code == 200 and ranking.json()[0]["formation"] == ""


@pytest.mark.asyncio
@pytest.mark.parametrize("claim,value", [("aud", "other-api"), ("sub", True), ("sub", 0), ("exp", True), ("v", 2)])
async def test_signed_but_invalid_token_claims_are_rejected(api, payload, claim, value):
    token = auth.issue_demo_token(1)
    encoded = token.split(".")[0]
    data = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
    data[claim] = value
    encoded = base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")
    altered = encoded + "." + auth._signature(encoded, FAKE_SECRET.encode())
    response = await api.post("/api/v1/transfers/confirm", json=payload, headers={"Authorization": "Bearer " + altered})
    assert response.status_code == 401
