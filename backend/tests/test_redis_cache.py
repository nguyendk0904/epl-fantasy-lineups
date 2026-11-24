"""P4-Q02: unit tests for the Leaderboard & Fixtures Redis cache.

Runs fully offline - the app-wide service uses the in-process MemoryCache
backend by default (REDIS_CACHE_ENABLED=false), so no Redis server is needed.
The RedisClientCache class is exercised through a mocked asyncio client to prove
the SCAN-based invalidation contract without any network dependency.

Acceptance coverage:
* Cache hits answer in < 20 ms and never touch the database (factory/sql).
* New points invalidate the leaderboard automatically (score_completed_gameweek).
* Fixtures/leaderboard endpoints serve identical payloads on hit and miss.
"""

import asyncio
from datetime import datetime, timezone
from time import perf_counter
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.redis_cache import (
    CacheService,
    MemoryCache,
    RedisClientCache,
    cache_service,
    create_cache_service,
)
from app.main import app
from app.models import Fixture, PlayerGameweekStat, Team, UserGameweekLineup


def make_config(*, enabled=True, ttl=300.0, env="test", url="memory://"):
    return SimpleNamespace(
        ENVIRONMENT=env,
        REDIS_CACHE_ENABLED=enabled,
        REDIS_CACHE_URL=url,
        REDIS_CACHE_TTL_SECONDS=ttl,
    )


def make_service(enabled=True, ttl=300.0, env="test", url="memory://"):
    return create_cache_service(make_config(enabled=enabled, ttl=ttl, env=env, url=url))


class _AsyncIter:
    """Minimal async iterator, used to fake redis.asyncio.scan_iter."""

    def __init__(self, items):
        self._items = iter(items)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._items)
        except StopIteration:
            raise StopAsyncIteration


class _BrokenBackend:
    """A Redis backend that is completely unavailable (e.g. cluster down)."""

    async def get(self, key):
        raise ConnectionError("redis down")

    async def set(self, key, payload, ttl=None):
        raise ConnectionError("redis down")

    async def delete_matching(self, pattern):
        raise ConnectionError("redis down")


@pytest.fixture(autouse=True)
def isolated_cache():
    """Enable the app-wide in-memory cache and isolate it between tests.

    The production default is REDIS_CACHE_ENABLED=false (cache off), so endpoint
    and invalidation tests swap the shared singleton to a fresh MemoryCache for
    the duration of each test and restore the safe default afterwards.
    """
    previous_enabled = cache_service.enabled
    previous_backend = cache_service.backend
    cache_service.enabled = True
    cache_service.backend = MemoryCache(ttl_seconds=cache_service.ttl_seconds)
    yield
    cache_service.enabled = previous_enabled
    cache_service.backend = previous_backend


@pytest.mark.asyncio
async def test_memory_cache_set_get_and_ttl_expiry():
    cache = MemoryCache(ttl_seconds=0.05)
    key = "fpl:test:fixtures:gameweek=1"
    await cache.set(key, '{"ok": true}')
    assert await cache.get(key) == '{"ok": true}'
    await asyncio.sleep(0.08)
    assert await cache.get(key) is None


@pytest.mark.asyncio
async def test_memory_cache_delete_matching_respects_namespaced_pattern():
    cache = MemoryCache(ttl_seconds=300)
    await cache.set("fpl:test:leaderboard:gameweek=2:page=1", "a")
    await cache.set("fpl:test:leaderboard:gameweek=2:page=2", "b")
    await cache.set("fpl:test:fixtures:gameweek=2", "c")
    removed = await cache.delete_matching("fpl:test:leaderboard:*")
    assert removed == 2
    assert await cache.get("fpl:test:fixtures:gameweek=2") == "c"


@pytest.mark.asyncio
async def test_get_or_set_hit_is_under_20ms_and_skips_the_database():
    service = make_service()
    factory_calls = 0

    async def database_factory():
        nonlocal factory_calls
        factory_calls += 1
        return {"rows": [{"user_id": 1, "rank": 1}], "total": 1}

    key = service.build_key("leaderboard", gameweek=2, sort_by="overall", page=1, limit=100)
    first = await service.get_or_set(key, database_factory)
    assert first == {"rows": [{"user_id": 1, "rank": 1}], "total": 1}
    assert factory_calls == 1

    started = perf_counter()
    second = await service.get_or_set(key, database_factory)
    elapsed_ms = (perf_counter() - started) * 1000

    # Cache hit: no SQL/factory work, well inside the < 20 ms acceptance budget.
    assert factory_calls == 1
    assert second == first
    assert service.hits == 1 and service.misses == 1
    assert elapsed_ms < 20


@pytest.mark.asyncio
async def test_keys_are_namespaced_and_default_ttl_is_300_seconds():
    service = make_service(env="qa")
    assert service.namespace == "fpl:qa"
    assert service.ttl_seconds == 300
    key = service.build_key("fixtures", gameweek=2)
    assert key == "fpl:qa:fixtures:gameweek=2"
    leaderboard_key = service.build_key("leaderboard", gameweek=2, sort_by="overall", page=1, limit=100)
    assert "gameweek=2" in leaderboard_key and "sort_by=overall" in leaderboard_key
    # Stable ordering: keyword order must never change the key.
    assert leaderboard_key == service.build_key(
        "leaderboard", limit=100, page=1, sort_by="overall", gameweek=2,
    )


@pytest.mark.asyncio
async def test_json_roundtrip_serializes_datetimes_safely():
    service = make_service()
    payload = {"kickoff_time": datetime(2026, 8, 15, 15, tzinfo=timezone.utc), "finished": False}
    await service.set(service.build_key("fixtures", gameweek=2), payload)
    stored = await service.get(service.build_key("fixtures", gameweek=2))
    assert stored["finished"] is False
    assert stored["kickoff_time"] == "2026-08-15T15:00:00+00:00"


@pytest.mark.asyncio
async def test_disabled_cache_always_reads_the_database_and_never_writes():
    service = make_service(enabled=False)
    factory_calls = 0

    async def database_factory():
        nonlocal factory_calls
        factory_calls += 1
        return [{"id": 1}]

    key = service.build_key("fixtures", gameweek=2)
    assert await service.get_or_set(key, database_factory) == [{"id": 1}]
    assert await service.get_or_set(key, database_factory) == [{"id": 1}]
    assert factory_calls == 2
    assert service.hits == 0


@pytest.mark.asyncio
async def test_redis_outage_is_a_cache_miss_not_an_api_error():
    service = CacheService(_BrokenBackend(), namespace="fpl:test", ttl_seconds=300, enabled=True)
    factory_calls = 0

    async def database_factory():
        nonlocal factory_calls
        factory_calls += 1
        return [{"id": 1}]

    result = await service.get_or_set(service.build_key("fixtures", gameweek=2), database_factory)
    assert result == [{"id": 1}]
    assert factory_calls == 1
    assert service.misses == 1
    # Invalidation failures are also swallowed, never raised.
    assert await service.invalidate_leaderboard() == 0


@pytest.mark.asyncio
async def test_corrupt_cached_payload_is_treated_as_a_miss():
    service = make_service()
    key = service.build_key("fixtures", gameweek=2)
    await service.backend.set(key, "{not-json")
    assert await service.get(key) is None
    assert service.misses == 1


@pytest.mark.asyncio
async def test_redis_backend_invalidation_uses_scan_iter_never_keys():
    from unittest.mock import MagicMock

    backend = RedisClientCache("redis://cache.example:6379/0", 300)
    keys = [f"fpl:prod:leaderboard:gameweek=2:page={page}" for page in (1, 2, 3)]
    client = MagicMock()
    # scan_iter is an async iterator in redis.asyncio, not a coroutine.
    client.scan_iter.return_value = _AsyncIter(keys)
    client.delete = AsyncMock(side_effect=lambda key: 1)
    backend._client = client

    removed = await backend.delete_matching("fpl:prod:leaderboard:*")
    assert removed == 3
    client.scan_iter.assert_called_once_with(match="fpl:prod:leaderboard:*", count=100)
    client.keys.assert_not_called()


@pytest.mark.asyncio
async def test_redis_backend_get_errors_propagate_to_cache_service_as_miss():
    backend = RedisClientCache("redis://cache.example:6379/0", 300)
    client = AsyncMock()
    client.get = AsyncMock(side_effect=ConnectionError("down"))
    backend._client = client
    service = CacheService(backend, namespace="fpl:test", ttl_seconds=300, enabled=True)
    assert await service.get("fpl:test:fixtures:gameweek=2") is None
    assert service.misses == 1


@pytest.mark.asyncio
async def test_invalidate_leaderboard_clears_only_leaderboard_keys():
    service = make_service()
    leaderboard_1 = service.build_key("leaderboard", gameweek=2, sort_by="overall", page=1, limit=100)
    leaderboard_2 = service.build_key("leaderboard", gameweek=2, sort_by="gameweek", page=2, limit=50)
    fixtures = service.build_key("fixtures", gameweek=2)
    await service.set(leaderboard_1, [{"user_id": 1}])
    await service.set(leaderboard_2, [{"user_id": 3}])
    await service.set(fixtures, [{"id": 1}])

    removed = await service.invalidate_leaderboard()
    assert removed == 2
    assert await service.get(leaderboard_1) is None
    assert await service.get(leaderboard_2) is None
    assert await service.get(fixtures) == [{"id": 1}]


async def sqlite_factory(tmp_path, name):
    """Create a fresh SQLite DB over the app models (JSONB -> JSON for SQLite)."""
    from sqlalchemy import JSON as SAJSON
    from sqlalchemy import MetaData
    from sqlalchemy.dialects.postgresql import JSONB

    engine = create_async_engine("sqlite+aiosqlite:///" + (tmp_path / name).as_posix())
    metadata = MetaData()
    for table in Base.metadata.sorted_tables:
        copied = table.to_metadata(metadata)
        for column in copied.c:
            if isinstance(column.type, JSONB):
                column.type = SAJSON()
    async with engine.begin() as connection:
        await connection.run_sync(metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, factory


async def _past_deadline(gameweek, *, client=None):
    return datetime(2026, 1, 1, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_fixtures_endpoint_serves_cached_page_under_20ms(tmp_path, monkeypatch):
    engine, factory = await sqlite_factory(tmp_path, "fixtures.db")
    async with factory.begin() as db:
        db.add_all([
            Team(id=1, name="Arsenal", short_name="ARS"),
            Team(id=2, name="Chelsea", short_name="CHE"),
        ])
        db.add_all([
            Fixture(id=1, gameweek=2, team_h=1, team_a=2, finished=False,
                    kickoff_time=datetime(2026, 8, 15, 15, tzinfo=timezone.utc),
                    team_h_difficulty=2, team_a_difficulty=4),
            Fixture(id=2, gameweek=2, team_h=2, team_a=1, finished=True,
                    kickoff_time=datetime(2026, 8, 16, 15, tzinfo=timezone.utc),
                    team_h_difficulty=3, team_a_difficulty=3, team_h_score=1, team_a_score=0),
        ])

    async def override():
        async with factory() as db:
            yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, override)
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as api:
            first = await api.get("/api/v1/fixtures", params={"gameweek": 2})
            assert first.status_code == 200
            assert [item["id"] for item in first.json()] == [1, 2]
            started = perf_counter()
            second = await api.get("/api/v1/fixtures", params={"gameweek": 2})
            elapsed_ms = (perf_counter() - started) * 1000
            assert second.status_code == 200
            assert second.json() == first.json()
            assert elapsed_ms < 20
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_leaderboard_endpoint_serves_cached_page_under_20ms(tmp_path, monkeypatch):
    engine, factory = await sqlite_factory(tmp_path, "leaderboard.db")
    async with factory.begin() as db:
        db.add_all([
            UserGameweekLineup(user_id=1, gameweek=2, starting_player_ids=[1, 2, 3],
                               bench_player_ids=[], transfers_used=0, is_locked=True, gameweek_points=12),
            UserGameweekLineup(user_id=2, gameweek=2, starting_player_ids=[1, 2, 3],
                               bench_player_ids=[], transfers_used=0, is_locked=False, gameweek_points=8),
        ])

    async def override():
        async with factory() as db:
            yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, override)
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as api:
            first = await api.get("/api/v1/leaderboard", params={"gameweek": 2})
            assert first.status_code == 200
            assert [row["user_id"] for row in first.json()] == [1, 2]
            started = perf_counter()
            second = await api.get("/api/v1/leaderboard", params={"gameweek": 2})
            elapsed_ms = (perf_counter() - started) * 1000
            assert second.status_code == 200
            assert second.headers["x-total-count"] == "2"
            assert second.json() == first.json()
            assert elapsed_ms < 20
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_scoring_new_points_invalidates_leaderboard(tmp_path, monkeypatch):
    from app.services import gameweek_service as service

    service_cache = make_service()
    cache_key = service_cache.build_key("leaderboard", gameweek=2, sort_by="overall", page=1, limit=100)
    await service_cache.set(cache_key, [{"user_id": 1, "rank": 1}])
    assert await service_cache.get(cache_key) is not None

    monkeypatch.setattr(service, "cache_service", service_cache)
    monkeypatch.setattr(service, "get_gameweek_deadline", _past_deadline)

    engine, factory = await sqlite_factory(tmp_path, "scoring.db")
    async with factory.begin() as db:
        db.add(Fixture(id=1, gameweek=1, team_h=1, team_a=2, finished=True,
                       kickoff_time=datetime(2026, 8, 14, 15, tzinfo=timezone.utc),
                       team_h_difficulty=2, team_a_difficulty=4))
        db.add(PlayerGameweekStat(player_id=1, fixture_id=1, gameweek=1,
                                  minutes=90, total_points=5))
    try:
        # New points committed in score_completed_gameweek -> cache must be cleared.
        assert await service.score_completed_gameweek(1, session_factory=factory) == 0
    finally:
        await engine.dispose()
    assert await service_cache.get(cache_key) is None


@pytest.mark.asyncio
async def test_fixtures_sync_invalidates_fixtures_cache(tmp_path):
    from app.services.fixtures_sync import sync_fixtures

    cache_key = cache_service.build_key("fixtures", gameweek=2)
    await cache_service.set(cache_key, [{"id": 1}])
    assert await cache_service.get(cache_key) == [{"id": 1}]

    engine, factory = await sqlite_factory(tmp_path, "sync.db")
    client = AsyncMock()
    client.get.return_value = httpx.Response(
        200, json=[{
            "id": 1, "event": 2, "team_h": 1, "team_a": 2, "finished": False,
            "kickoff_time": "2026-08-15T15:00:00Z", "team_h_difficulty": 2, "team_a_difficulty": 4,
        }], request=httpx.Request("GET", "http://test"),
    )
    try:
        # Scores/flags changed -> fixtures endpoint must not serve stale rows.
        assert await sync_fixtures(factory, client) == {"fixtures_processed": 1}
    finally:
        await engine.dispose()
    assert await cache_service.get(cache_key) is None
