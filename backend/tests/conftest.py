"""P3-NH03 fixtures, activated only by tests requesting e2e_api/e2e_remote_client.

Default: in-memory SQLite, test-only JSON variant, real CBC and ASGI app.
PostgreSQL: E2E_TEST_DATABASE_URL=postgresql+asyncpg://.../<name>_test
creates/drops a unique schema and applies committed Alembic upgrade functions.
It NEVER imports alembic/env.py or uses settings.DATABASE_URL for test storage.
Remote opt-in: E2E_REMOTE_BASE_URL plus E2E_ALLOW_REMOTE_WRITES=1. Only use an
isolated test deployment: the remote API has no delete-snapshot endpoint.
"""

from decimal import Decimal
from itertools import count
import os
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit
from uuid import uuid4

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
import httpx
import pulp
import pytest
import pytest_asyncio
from sqlalchemy import JSON, MetaData, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.main import app
from app.core.config import settings
from app.models import Player, Team


_clients = count(1)


@pytest.fixture
def e2e_solver(monkeypatch):
    """Expose a real CBC binary to COIN_CMD, never replace the solver."""
    if not pulp.COIN_CMD(msg=False).available():
        bundled = pulp.PULP_CBC_CMD(msg=False)
        if bundled.available():
            monkeypatch.setenv("PATH", str(Path(bundled.path).parent) + os.pathsep + os.environ.get("PATH", ""))
    if not pulp.COIN_CMD(msg=False).available():
        pytest.fail("E2E requires real CBC: install declared pulp[cbc] dependencies or add cbc to PATH")


def _migrate_isolated_schema(connection):
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "alembic"))
    script = ScriptDirectory.from_config(config)
    with Operations.context(MigrationContext.configure(connection)):
        for revision in reversed(list(script.walk_revisions())):
            revision.module.upgrade()


@pytest_asyncio.fixture
async def e2e_api(monkeypatch, e2e_solver):
    url = os.environ.get("E2E_TEST_DATABASE_URL")
    if url:
        parsed = make_url(url)
        if parsed.drivername != "postgresql+asyncpg" or not (parsed.database or "").endswith("_test"):
            pytest.fail("E2E database must use postgresql+asyncpg and a name ending in _test")
    engine = create_async_engine(url or "sqlite+aiosqlite:///:memory:")
    schema = "e2e_" + uuid4().hex if url else None
    schema_created = False
    previous_overrides = app.dependency_overrides.copy()

    # External FPL HTTP is the only mocked business dependency. Solver, SQL
    # queries, validation, middleware, snapshots and routing remain real.
    def fpl_fixtures(request_url, **kwargs):
        assert request_url == "https://fantasy.premierleague.com/api/fixtures/"
        return httpx.Response(200, json=[{
            "event": 1, "finished": False, "team_h": team, "team_a": team + 1,
            "team_h_difficulty": 3, "team_a_difficulty": 3,
        } for team in range(1, 9, 2)], request=httpx.Request("GET", request_url))

    monkeypatch.setattr(httpx, "get", fpl_fixtures)
    monkeypatch.setattr(settings, "FPL_SYNC_ENABLED", False)
    monkeypatch.setattr(settings, "CLOUDWATCH_LOGGING_ENABLED", False)

    try:
        if schema:
            async with engine.begin() as connection:
                await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
                schema_created = True
            isolated = engine.execution_options(schema_translate_map={None: schema})
            async with isolated.begin() as connection:
                await connection.run_sync(_migrate_isolated_schema)
        else:
            isolated = engine
            metadata = MetaData()
            for table in Base.metadata.sorted_tables:
                table.to_metadata(metadata)
            metadata.tables["shared_lineups"].c.player_data.type = JSON()
            async with isolated.begin() as connection:
                await connection.run_sync(metadata.create_all)

        factory = async_sessionmaker(isolated, expire_on_commit=False)
        positions = ["GKP"] * 3 + ["DEF"] * 7 + ["MID"] * 7 + ["FWD"] * 5
        async with factory.begin() as session:
            session.add_all([Team(id=i, name=f"Team {i}", short_name=f"T{i}", strength=3) for i in range(1, 9)])
            await session.flush()
            session.add_all([
                Player(
                    id=i, first_name=f"First{i:02}", second_name=f"Last{i:02}",
                    web_name=f"Player {i:02}", team_id=(i - 1) % 8 + 1,
                    element_type=position, now_cost=Decimal("4.0") + Decimal(i % 3) / 10,
                    total_points=100 + i, form=Decimal("4.0"), status="a",
                    expected_points_next=Decimal("3.0") + Decimal(i % 7) / 10,
                ) for i, position in enumerate(positions, 1)
            ])

        async def override_get_db():
            async with factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        # Each test gets a new client identity, preserving real rate limiting
        # without spending another test's quota or resetting app-global storage.
        address = (f"198.18.0.{next(_clients)}", 12345)
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app, client=address), base_url="http://test",
            ) as client:
                yield SimpleNamespace(client=client, sessions=factory, backend="postgresql" if schema else "sqlite")
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        try:
            if schema_created:
                async with engine.begin() as connection:
                    await connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        finally:
            await engine.dispose()


@pytest_asyncio.fixture
async def e2e_remote_client():
    url = os.environ.get("E2E_REMOTE_BASE_URL")
    if not url:
        pytest.skip("No E2E_REMOTE_BASE_URL; deployed acceptance is opt-in")
    if os.environ.get("E2E_ALLOW_REMOTE_WRITES") != "1":
        pytest.fail("Remote suite creates snapshots; confirm isolated test deployment with E2E_ALLOW_REMOTE_WRITES=1")
    parsed = urlsplit(url)
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        pytest.fail("Remote base URL must not contain credentials, query or fragment")
    if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}):
        pytest.fail("Remote acceptance requires HTTPS (HTTP allowed only for loopback)")
    async with httpx.AsyncClient(base_url=url.rstrip("/") + "/", timeout=60.0, follow_redirects=True) as client:
        yield client
