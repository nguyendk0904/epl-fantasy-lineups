import asyncio
from unittest.mock import MagicMock

import pytest
from sqlalchemy.engine import URL
from sqlalchemy.ext.asyncio import create_async_engine

from app.core import database
from app.core.config import Settings
from app.core.pool_manager import (
    MAX_OVERFLOW,
    MAX_POOL_CONNECTIONS,
    POOL_RECYCLE,
    POOL_SIZE,
    POOL_TIMEOUT,
    get_pool_options,
)


def test_async_postgres_gets_expected_bounded_pool_options():
    assert get_pool_options(
        "postgresql+asyncpg://user:password@db.example.com:5432/fpl"
    ) == {
        "pool_size": 5,
        "max_overflow": 10,
        "pool_timeout": 30,
        "pool_recycle": 1800,
    }


def test_non_postgres_dialect_does_not_receive_postgres_pool_options():
    assert get_pool_options("sqlite+aiosqlite:///:memory:") == {}


def test_pool_connection_cap_is_fifteen_per_process():
    assert POOL_SIZE == 5
    assert MAX_OVERFLOW == 10
    assert MAX_POOL_CONNECTIONS == 15
    assert POOL_TIMEOUT == 30
    assert POOL_RECYCLE == 1800


def test_database_engine_uses_pool_options_and_connect_timeout(monkeypatch):
    engine_factory = MagicMock()
    monkeypatch.setattr(database, "create_async_engine", engine_factory)
    config = Settings(
        _env_file=None,
        ENVIRONMENT="development",
        DATABASE_URL="postgresql+asyncpg://user:password@db.example.com:5432/fpl",
        RDS_HOSTNAME=None,
        RDS_DB_NAME=None,
        RDS_USERNAME=None,
        RDS_PASSWORD=None,
        DB_CONNECT_TIMEOUT=7,
    )

    database.create_database_engine(config)

    engine_factory.assert_called_once_with(
        config.DATABASE_URL,
        echo=False,
        future=True,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
        connect_args={"timeout": 7.0},
    )


@pytest.mark.asyncio
async def test_twenty_concurrent_db_tasks_queue_five_and_all_complete(tmp_path):
    engine = create_async_engine(
        URL.create(
            "sqlite+aiosqlite",
            database=str(tmp_path / "pool-test.db"),
        ),
        pool_size=POOL_SIZE,
        max_overflow=MAX_OVERFLOW,
        pool_timeout=POOL_TIMEOUT,
        pool_recycle=POOL_RECYCLE,
    )
    all_started = asyncio.Event()
    first_fifteen_checked_out = asyncio.Event()
    release_connections = asyncio.Event()
    started = 0
    acquired = 0
    completed = 0
    max_checked_out = 0

    async def request_task():
        nonlocal started, acquired, completed, max_checked_out
        started += 1
        if started == 20:
            all_started.set()

        async with engine.connect():
            acquired += 1
            max_checked_out = max(max_checked_out, engine.pool.checkedout())
            if acquired == MAX_POOL_CONNECTIONS:
                first_fifteen_checked_out.set()
            await release_connections.wait()
            completed += 1

    tasks = [asyncio.create_task(request_task()) for _ in range(20)]
    try:
        await asyncio.wait_for(all_started.wait(), timeout=5)
        await asyncio.wait_for(first_fifteen_checked_out.wait(), timeout=5)
        await asyncio.sleep(0.05)

        assert started == 20
        assert acquired == MAX_POOL_CONNECTIONS
        assert completed == 0
        assert sum(not task.done() for task in tasks) == 20

        release_connections.set()
        await asyncio.wait_for(asyncio.gather(*tasks), timeout=5)

        assert completed == 20
        assert max_checked_out == MAX_POOL_CONNECTIONS
    finally:
        release_connections.set()
        await asyncio.gather(*tasks, return_exceptions=True)
        await engine.dispose()
