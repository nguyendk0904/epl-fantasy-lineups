"""P2-NH01: isolated config tests and opt-in read-only RDS connectivity test.

From backend/: python -m pytest tests/test_rds_connection.py -q
Live check: configure all four RDS_* fields, then set RUN_RDS_CONNECTION_TEST=1.
Live check performs SELECT 1 only; it does not migrate or change any data.
"""

import os
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.core import database
from app.core.config import Settings


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch):
    # Config tests never load developer secrets or a developer .env file.
    # Keep live-test credentials in the process environment for the opt-in test.
    if os.environ.get("RUN_RDS_CONNECTION_TEST") == "1":
        return
    for key in Settings.model_fields:
        monkeypatch.delenv(key, raising=False)


def local_settings(**overrides):
    values = dict(
        _env_file=None, ENVIRONMENT="development",
        DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/fantasy_fpl",
        RDS_HOSTNAME=None, RDS_DB_NAME=None, RDS_USERNAME=None, RDS_PASSWORD=None,
        RDS_PORT=5432, DB_CONNECT_TIMEOUT=10,
    )
    values.update(overrides)
    return Settings(**values)


def cloud_settings(**overrides):
    values = dict(
        RDS_HOSTNAME="example.rds.amazonaws.com", RDS_DB_NAME="fantasy_fpl",
        RDS_USERNAME="fpl_admin", RDS_PASSWORD="fake-password",
    )
    values.update(overrides)
    return local_settings(**values)


def test_development_without_rds_keeps_local_url():
    config = local_settings()
    assert make_url(config.DATABASE_URL).host == "localhost"


def test_custom_database_url_is_preserved_without_rds():
    url = "postgresql+asyncpg://dev:fake@postgres:5432/custom"
    assert local_settings(DATABASE_URL=url).DATABASE_URL == url


def test_rds_fields_override_local_url_with_tls_and_custom_port():
    config = cloud_settings(RDS_PORT=5433)
    url = make_url(config.DATABASE_URL)
    assert url.drivername == "postgresql+asyncpg"
    assert url.host == "example.rds.amazonaws.com"
    assert url.port == 5433
    assert url.database == "fantasy_fpl"
    assert url.username == "fpl_admin"
    assert url.query["ssl"] == "require"


def test_special_characters_in_credentials_round_trip_without_corruption():
    password = "fake@:/?#%+ test"
    username = "user@name"
    url = make_url(cloud_settings(RDS_PASSWORD=password, RDS_USERNAME=username).DATABASE_URL)
    assert url.password == password
    assert url.username == username


@pytest.mark.parametrize("field", ["RDS_HOSTNAME", "RDS_DB_NAME", "RDS_USERNAME", "RDS_PASSWORD"])
@pytest.mark.parametrize("missing", [None, ""])
def test_incomplete_credentials_fail_instead_of_falling_back(field, missing):
    with pytest.raises(ValidationError, match="four non-empty"):
        cloud_settings(**{field: missing})


@pytest.mark.parametrize("host", ["https://db.example.com", "db.example.com:5432", " db.example.com"])
def test_host_must_not_include_scheme_port_or_whitespace(host):
    with pytest.raises(ValidationError, match="hostname"):
        cloud_settings(RDS_HOSTNAME=host)


@pytest.mark.parametrize("port", [0, 65536])
def test_invalid_port_rejected(port):
    with pytest.raises(ValidationError):
        cloud_settings(RDS_PORT=port)


@pytest.mark.parametrize("timeout", [0, -1, float("inf")])
def test_invalid_connection_timeout_rejected(timeout):
    with pytest.raises(ValidationError):
        cloud_settings(DB_CONNECT_TIMEOUT=timeout)


def test_production_without_remote_config_fails():
    with pytest.raises(ValidationError, match="remote database"):
        local_settings(ENVIRONMENT="production")


def test_production_accepts_complete_rds_config():
    assert make_url(cloud_settings(ENVIRONMENT="production").DATABASE_URL).query["ssl"] == "require"


def test_production_accepts_existing_remote_url_convention_with_tls():
    url = "postgresql+asyncpg://user:fake@db.example.com:5432/fpl?ssl=require"
    assert local_settings(ENVIRONMENT="production", DATABASE_URL=url).DATABASE_URL == url


def test_production_remote_url_without_tls_fails():
    with pytest.raises(ValidationError, match="TLS"):
        local_settings(ENVIRONMENT="production", DATABASE_URL="postgresql+asyncpg://user:fake@db.example.com/fpl")


def test_settings_repr_and_validation_error_do_not_expose_password():
    password = "fake-private-password"
    assert password not in repr(cloud_settings(RDS_PASSWORD=password))
    with pytest.raises(ValidationError) as caught:
        cloud_settings(RDS_PASSWORD=password, RDS_PORT=0)
    assert password not in str(caught.value)


def test_rds_environment_fields_are_loaded(monkeypatch):
    for key, value in {
        "RDS_HOSTNAME": "env.rds.amazonaws.com", "RDS_DB_NAME": "env_db",
        "RDS_USERNAME": "env_user", "RDS_PASSWORD": "fake-env-password", "RDS_PORT": "5433",
        "ENVIRONMENT": "development",
    }.items():
        monkeypatch.setenv(key, value)
    config = Settings(_env_file=None)
    url = make_url(config.DATABASE_URL)
    assert (url.host, url.database, url.username, url.port) == ("env.rds.amazonaws.com", "env_db", "env_user", 5433)
    assert url.password == "fake-env-password"


def test_engine_receives_selected_url_and_bounded_timeout(monkeypatch):
    factory = MagicMock()
    monkeypatch.setattr(database, "create_async_engine", factory)
    config = cloud_settings(DB_CONNECT_TIMEOUT=7)
    assert database.create_database_engine(config) is factory.return_value
    factory.assert_called_once_with(config.DATABASE_URL, echo=False, future=True, connect_args={"timeout": 7.0})


@pytest.mark.asyncio
async def test_connection_failure_propagates_without_creating_local_engine(monkeypatch):
    factory = MagicMock()
    factory.return_value.connect.return_value.__aenter__ = AsyncMock(side_effect=OSError("unreachable"))
    monkeypatch.setattr(database, "create_async_engine", factory)
    config = cloud_settings()
    engine = database.create_database_engine(config)
    with pytest.raises(OSError, match="unreachable"):
        async with engine.connect():
            pass
    factory.assert_called_once()
    assert factory.call_args.args[0] == config.DATABASE_URL


@pytest.mark.asyncio
async def test_live_rds_select_one():
    if os.environ.get("RUN_RDS_CONNECTION_TEST") != "1":
        pytest.skip("Set RUN_RDS_CONNECTION_TEST=1 with RDS credentials for read-only live check")
    config = Settings(_env_file=None)
    if not all((config.RDS_HOSTNAME, config.RDS_DB_NAME, config.RDS_USERNAME, config.RDS_PASSWORD)):
        pytest.fail("Live RDS check requires all four RDS credential fields")
    engine = database.create_database_engine(config)
    try:
        async with engine.connect() as connection:
            assert await connection.scalar(text("SELECT 1")) == 1
    finally:
        await engine.dispose()
