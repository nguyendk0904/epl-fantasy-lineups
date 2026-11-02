import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.database import Base, get_db
from app.models.team import Team
from app.models.player import Player


TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.mark.asyncio
@pytest.mark.parametrize("parameter,value", [
    ("position", "INVALID"),
    ("position", "fwd"),
    ("position", ""),
    ("sort_by", "INVALID"),
    ("sort_by", "id"),
    ("sort_by", ""),
])
async def test_invalid_contract_values_return_422(test_session, parameter, value):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/players", params={parameter: value})
    assert response.status_code == 422
    assert any(error["loc"] == ["query", parameter] for error in response.json()["detail"])


@pytest.mark.asyncio
@pytest.mark.parametrize("position", ["GKP", "DEF", "MID", "FWD"])
async def test_all_contract_positions_are_accepted(test_session, position):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/players", params={"position": position})
    assert response.status_code == 200
    assert response.json()["total"] > 0
    assert all(item["element_type"] == position for item in response.json()["items"])


@pytest.mark.asyncio
@pytest.mark.parametrize("sort_by", ["total_points", "now_cost", "form", "expected_points_next"])
async def test_all_contract_sort_fields_are_accepted(test_session, sort_by):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/players", params={"sort_by": sort_by})
    assert response.status_code == 200
    values = [item[sort_by] for item in response.json()["items"]]
    assert values == sorted(values, reverse=True)


@pytest_asyncio.fixture
async def test_session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed test data
    async with session_factory() as session:
        async with session.begin():
            teams = [
                Team(id=1, name="Arsenal", short_name="ARS", strength=4),
                Team(id=2, name="Manchester City", short_name="MCI", strength=5),
                Team(id=3, name="Liverpool", short_name="LIV", strength=4),
            ]
            session.add_all(teams)

            players = [
                Player(
                    id=1,
                    first_name="David",
                    second_name="Raya",
                    web_name="Raya",
                    team_id=1,
                    element_type="GKP",
                    now_cost=5.5,
                    total_points=110,
                    form=5.2,
                    status="a",
                    expected_points_next=4.5,
                ),
                Player(
                    id=2,
                    first_name="William",
                    second_name="Saliba",
                    web_name="Saliba",
                    team_id=1,
                    element_type="DEF",
                    now_cost=6.0,
                    total_points=120,
                    form=6.0,
                    status="a",
                    expected_points_next=5.0,
                ),
                Player(
                    id=3,
                    first_name="Bukayo",
                    second_name="Saka",
                    web_name="Saka",
                    team_id=1,
                    element_type="MID",
                    now_cost=10.0,
                    total_points=160,
                    form=7.5,
                    status="a",
                    expected_points_next=7.8,
                ),
                Player(
                    id=4,
                    first_name="Erling",
                    second_name="Haaland",
                    web_name="Haaland",
                    team_id=2,
                    element_type="FWD",
                    now_cost=15.2,
                    total_points=210,
                    form=8.8,
                    status="a",
                    expected_points_next=8.5,
                ),
                Player(
                    id=5,
                    first_name="Kevin",
                    second_name="De Bruyne",
                    web_name="De Bruyne",
                    team_id=2,
                    element_type="MID",
                    now_cost=10.5,
                    total_points=140,
                    form=6.5,
                    status="a",
                    expected_points_next=6.0,
                ),
                Player(
                    id=6,
                    first_name="Mohamed",
                    second_name="Salah",
                    web_name="Salah",
                    team_id=3,
                    element_type="MID",
                    now_cost=12.5,
                    total_points=190,
                    form=8.2,
                    status="a",
                    expected_points_next=8.0,
                ),
                Player(
                    id=7,
                    first_name="Virgil",
                    second_name="van Dijk",
                    web_name="van Dijk",
                    team_id=3,
                    element_type="DEF",
                    now_cost=6.5,
                    total_points=130,
                    form=6.2,
                    status="a",
                    expected_points_next=5.5,
                ),
                Player(
                    id=8,
                    first_name="Kai",
                    second_name="Havertz",
                    web_name="Havertz",
                    team_id=1,
                    element_type="FWD",
                    now_cost=8.0,
                    total_points=135,
                    form=6.8,
                    status="a",
                    expected_points_next=6.2,
                ),
            ]
            session.add_all(players)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_get_all_players_default(test_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/players")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 8
        assert data["page"] == 1
        assert data["limit"] == 50
        assert len(data["items"]) == 8
        # Default sort is total_points desc -> Haaland (210) should be first
        assert data["items"][0]["web_name"] == "Haaland"
        assert data["items"][0]["total_points"] == 210


@pytest.mark.asyncio
async def test_filter_by_position(test_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/players?position=FWD")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        for item in data["items"]:
            assert item["element_type"] == "FWD"
        names = {item["web_name"] for item in data["items"]}
        assert names == {"Haaland", "Havertz"}


@pytest.mark.asyncio
async def test_filter_by_team_id(test_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/players?team_id=1")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 4
        for item in data["items"]:
            assert item["team_short_name"] == "ARS"


@pytest.mark.asyncio
async def test_filter_by_max_cost(test_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/players?max_cost=8.0")
        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["now_cost"] <= 8.0
        # Haaland (15.2), Salah (12.5), De Bruyne (10.5), Saka (10.0) must be excluded
        web_names = [p["web_name"] for p in data["items"]]
        assert "Haaland" not in web_names
        assert "Salah" not in web_names


@pytest.mark.asyncio
async def test_search_by_name(test_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Search exact Haaland
        response = await client.get("/api/v1/players?search=haaland")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["web_name"] == "Haaland"
        assert data["items"][0]["team_short_name"] == "MCI"

        # Search partial first_name "Mohamed"
        response = await client.get("/api/v1/players?search=mohamed")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["web_name"] == "Salah"


@pytest.mark.asyncio
async def test_sort_by_criteria(test_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Sort by now_cost desc
        response = await client.get("/api/v1/players?sort_by=now_cost&order=desc")
        assert response.status_code == 200
        data = response.json()
        costs = [item["now_cost"] for item in data["items"]]
        assert costs == sorted(costs, reverse=True)

        # Sort by total_points asc
        response = await client.get("/api/v1/players?sort_by=total_points&order=asc")
        assert response.status_code == 200
        data = response.json()
        points = [item["total_points"] for item in data["items"]]
        assert points == sorted(points)


@pytest.mark.asyncio
async def test_pagination(test_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Page 1, limit 3
        resp1 = await client.get("/api/v1/players?page=1&limit=3")
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert data1["total"] == 8
        assert data1["page"] == 1
        assert data1["limit"] == 3
        assert len(data1["items"]) == 3

        # Page 2, limit 3
        resp2 = await client.get("/api/v1/players?page=2&limit=3")
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["total"] == 8
        assert data2["page"] == 2
        assert data2["limit"] == 3
        assert len(data2["items"]) == 3

        # Ensure page 1 and page 2 items are disjoint
        ids1 = {p["id"] for p in data1["items"]}
        ids2 = {p["id"] for p in data2["items"]}
        assert ids1.isdisjoint(ids2)

