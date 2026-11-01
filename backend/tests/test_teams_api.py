"""P1-NH04: HTTP and SQL tests using isolated in-memory SQLite."""

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.main import app
from app.models import Team


@pytest_asyncio.fixture
async def teams_api():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False)
    previous_overrides = app.dependency_overrides.copy()
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async def override_get_db():
            async with factory() as session:
                yield session

        app.dependency_overrides[get_db] = override_get_db
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            yield client, factory
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        await engine.dispose()


@pytest.mark.asyncio
async def test_returns_twenty_seeded_teams_with_all_strength_fields(teams_api):
    client, factory = teams_api
    expected = [
        {
            "id": team_id,
            "name": f"Club {team_id}",
            "short_name": f"T{team_id}",
            "strength": 4,
            "strength_attack_home": 1200 + team_id,
            "strength_attack_away": 1100 + team_id,
            "strength_defence_home": 1300 + team_id,
            "strength_defence_away": 1150 + team_id,
        }
        for team_id in range(1, 21)
    ]
    async with factory.begin() as session:
        session.add_all([Team(**row) for row in reversed(expected)])

    response = await client.get("/api/v1/teams")

    assert response.status_code == 200
    assert response.json() == expected
    assert response.headers["content-type"] == "application/json"


@pytest.mark.asyncio
async def test_empty_database_returns_empty_array(teams_api):
    client, _ = teams_api
    response = await client.get("/api/v1/teams")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_nullable_strength_metrics_are_serialized_as_null(teams_api):
    client, factory = teams_api
    async with factory.begin() as session:
        session.add(Team(id=1, name="Arsenal", short_name="ARS", strength=4))
    response = await client.get("/api/v1/teams")
    assert response.status_code == 200
    assert response.json() == [{
        "id": 1, "name": "Arsenal", "short_name": "ARS", "strength": 4,
        "strength_attack_home": None, "strength_attack_away": None,
        "strength_defence_home": None, "strength_defence_away": None,
    }]


@pytest.mark.asyncio
async def test_returns_only_stored_teams_without_padding(teams_api):
    client, factory = teams_api
    async with factory.begin() as session:
        session.add_all([
            Team(id=20, name="Club Twenty", short_name="T20", strength=3),
            Team(id=2, name="Club Two", short_name="T2", strength=5),
        ])
    response = await client.get("/api/v1/teams")
    assert response.status_code == 200
    assert [team["id"] for team in response.json()] == [2, 20]


@pytest.mark.asyncio
async def test_openapi_documents_array_response_and_team_fields(teams_api):
    client, _ = teams_api
    response = await client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    schema = spec["paths"]["/api/v1/teams"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
    assert schema["type"] == "array"
    assert schema["items"]["$ref"] == "#/components/schemas/TeamResponse"
    assert set(spec["components"]["schemas"]["TeamResponse"]["properties"]) == {
        "id", "name", "short_name", "strength", "strength_attack_home",
        "strength_attack_away", "strength_defence_home", "strength_defence_away",
    }
