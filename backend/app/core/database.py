from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.engine import make_url
from app.core.config import Settings, settings


class Base(DeclarativeBase):
    pass


def create_database_engine(config: Settings):
    """Construct lazily; failed RDS connections propagate without local fallback."""
    options = {"echo": False, "future": True}
    if make_url(config.DATABASE_URL).drivername == "postgresql+asyncpg":
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

