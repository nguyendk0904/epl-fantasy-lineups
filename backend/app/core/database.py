from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.engine import make_url
from app.core.config import Settings, settings
from app.core.pool_manager import get_pool_options


class Base(DeclarativeBase):
    pass


def create_database_engine(config: Settings):
    """Construct lazily; failed RDS connections propagate without local fallback."""
    options = {"echo": False, "future": True}
    drivername = make_url(config.DATABASE_URL).drivername
    options.update(get_pool_options(config.DATABASE_URL))
    if drivername == "postgresql+asyncpg":
        options["connect_args"] = {"timeout": config.DB_CONNECT_TIMEOUT}
    return create_async_engine(config.DATABASE_URL, **options)


engine = create_database_engine(settings)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

