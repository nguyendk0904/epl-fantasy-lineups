"""P2-NH01: choose an async PostgreSQL URL without network side effects.

Complete RDS_* credentials override DATABASE_URL. With no RDS_* credentials,
development keeps DATABASE_URL (local by default). Partial credentials fail
validation. Connection errors never trigger a switch to another database.
"""

from typing import TYPE_CHECKING

from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError

if TYPE_CHECKING:
    from app.core.config import Settings


def resolve_database_url(config: "Settings") -> str:
    values = (
        config.RDS_HOSTNAME,
        config.RDS_DB_NAME,
        config.RDS_USERNAME,
        config.RDS_PASSWORD.get_secret_value() if config.RDS_PASSWORD is not None else None,
    )
    configured = [value is not None for value in values]
    if any(configured):
        if not all(configured) or not all(values):
            raise ValueError("Provide all four non-empty RDS credential fields")
        host, database, username, password = values
        if host != host.strip() or any(char in host for char in "/:@?# "):
            raise ValueError("RDS_HOSTNAME must be a hostname, without scheme or port")
        url = URL.create(
            "postgresql+asyncpg",
            username=username,
            password=password,
            host=host,
            port=config.RDS_PORT,
            database=database,
            query={"ssl": "require"},
        )
    else:
        try:
            url = make_url(config.DATABASE_URL)
        except ArgumentError:
            raise ValueError("DATABASE_URL is not a valid SQLAlchemy URL") from None

    # Preserve DATABASE_URL compatibility for deployments using the existing
    # single-URL convention, while preventing default-local production startup.
    if config.ENVIRONMENT.lower() == "production":
        if url.drivername != "postgresql+asyncpg":
            raise ValueError("Production requires the postgresql+asyncpg driver")
        if not url.host or url.host.lower() in {"localhost", "127.0.0.1", "::1", "postgres"}:
            raise ValueError("Production requires an explicit remote database")
        if url.query.get("ssl") not in {"require", "verify-ca", "verify-full"}:
            raise ValueError("Production database connections require TLS")

    return url.render_as_string(hide_password=False)
