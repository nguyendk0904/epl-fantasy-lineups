import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import Settings, settings
from app.core.database import Base, engine, get_db
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "environment" in data


@pytest.mark.asyncio
async def test_root_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "Welcome to Fantasy Football Lineup Optimizer API" in data["message"]
        assert data["docs_url"] == "/docs"


@pytest.mark.asyncio
async def test_api_v1_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(f"{settings.API_V1_STR}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == settings.VERSION


@pytest.mark.asyncio
async def test_cors_headers():
    transport = ASGITransport(app=app)
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    }
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options("/health", headers=headers)
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_settings_cors_parser():
    test_settings_list = Settings(CORS_ORIGINS=["http://test.com", "http://another.com"])
    assert test_settings_list.CORS_ORIGINS == ["http://test.com", "http://another.com"]

    test_settings_json = Settings(CORS_ORIGINS='["http://alpha.com", "http://beta.com"]')
    assert test_settings_json.CORS_ORIGINS == ["http://alpha.com", "http://beta.com"]

    test_settings_csv = Settings(CORS_ORIGINS="http://one.com, http://two.com")
    assert test_settings_csv.CORS_ORIGINS == ["http://one.com", "http://two.com"]


@pytest.mark.asyncio
async def test_database_components():
    assert Base is not None
    assert engine is not None
    
    # Test get_db generator yields an AsyncSession instance and closes cleanly
    db_gen = get_db()
    session = await anext(db_gen)
    assert isinstance(session, AsyncSession)
    await db_gen.aclose()

