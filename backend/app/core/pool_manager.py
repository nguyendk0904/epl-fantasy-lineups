from sqlalchemy.engine import make_url


POOL_SIZE = 5
MAX_OVERFLOW = 10
POOL_TIMEOUT = 30
POOL_RECYCLE = 1800
MAX_POOL_CONNECTIONS = POOL_SIZE + MAX_OVERFLOW


def get_pool_options(database_url: str) -> dict[str, int]:
    """Return bounded connection-pool options for the async PostgreSQL engine."""
    if make_url(database_url).drivername != "postgresql+asyncpg":
        return {}

    return {
        "pool_size": POOL_SIZE,
        "max_overflow": MAX_OVERFLOW,
        "pool_timeout": POOL_TIMEOUT,
        "pool_recycle": POOL_RECYCLE,
    }
