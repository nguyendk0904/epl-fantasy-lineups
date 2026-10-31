"""P1-NH02: atomic FPL bootstrap sync.

Manual invocation (from backend/): python -m app.services.fpl_sync
The caller supplies a session factory; every run owns a fresh session/transaction.
No migrations, deletions, scheduler, or expected-points formula are applied here.
"""

import asyncio
from collections.abc import Callable
from decimal import Decimal
from typing import Annotated, Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.models import Player, Team


class FPLSyncError(RuntimeError):
    """Safe sync failure message; the original exception remains chained."""


Identifier = Annotated[int, Field(strict=True, gt=0)]
Name = Annotated[str, Field(min_length=1, max_length=100)]
Metric = Annotated[Decimal, Field(max_digits=4, decimal_places=1, allow_inf_nan=False)]
ExpectedMetric = Annotated[Decimal, Field(max_digits=5, decimal_places=2, allow_inf_nan=False)]
ICTMetric = Annotated[Decimal, Field(max_digits=5, decimal_places=1, allow_inf_nan=False)]


class _TeamData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: Identifier
    name: Name
    short_name: Annotated[str, Field(min_length=1, max_length=5)]
    strength: int = 3
    strength_attack_home: int | None = None
    strength_attack_away: int | None = None
    strength_defence_home: int | None = None
    strength_defence_away: int | None = None


class _PlayerData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: Identifier
    first_name: Annotated[str, Field(max_length=100)] | None = None
    second_name: Annotated[str, Field(max_length=100)] | None = None
    web_name: Name
    team: Identifier
    element_type: Literal[1, 2, 3, 4]
    now_cost: Annotated[int, Field(strict=True, gt=0, le=9999)]
    status: Annotated[str, Field(min_length=1, max_length=5)] = "a"
    news: str | None = None
    total_points: Annotated[int, Field(strict=True)] = 0
    form: Metric = Decimal("0.0")
    selected_by_percent: Metric | None = None
    expected_goals: ExpectedMetric | None = None
    expected_assists: ExpectedMetric | None = None
    ict_index: ICTMetric | None = None

    @field_validator("element_type", mode="before")
    @classmethod
    def require_integer_position(cls, value):
        if type(value) is not int:
            raise ValueError("element_type must be an integer position ID")
        return value


def _parse_payload(payload: object) -> tuple[list[dict], list[dict]]:
    if not isinstance(payload, dict):
        raise ValueError("Bootstrap must be an object")
    teams_raw, players_raw = payload.get("teams"), payload.get("elements")
    if not isinstance(teams_raw, list) or not teams_raw:
        raise ValueError("Bootstrap teams must be a non-empty list")
    if not isinstance(players_raw, list) or not players_raw:
        raise ValueError("Bootstrap elements must be a non-empty list")
    teams = [_TeamData.model_validate(row).model_dump() for row in teams_raw]
    players = []
    positions = {1: "GKP", 2: "DEF", 3: "MID", 4: "FWD"}
    team_ids = {row["id"] for row in teams}
    if len(team_ids) != len(teams):
        raise ValueError("Duplicate team IDs")
    for raw in players_raw:
        row = _PlayerData.model_validate(raw).model_dump()
        if row["team"] not in team_ids:
            raise ValueError("Player references a team missing from bootstrap")
        row["team_id"] = row.pop("team")
        row["element_type"] = positions[row["element_type"]]
        row["now_cost"] = Decimal(row["now_cost"]) / Decimal(10)
        # No agreed xP mapping yet. New rows use SQL NULL; existing xP is preserved.
        players.append(row)
    if len({row["id"] for row in players}) != len(players):
        raise ValueError("Duplicate player IDs")
    return teams, players


async def _upsert(session: AsyncSession, table, rows: list[dict]) -> None:
    # Chunking bounds statement parameters for larger bootstrap payloads.
    for offset in range(0, len(rows), 500):
        statement = insert(table).values(rows[offset:offset + 500])
        statement = statement.on_conflict_do_update(
            index_elements=[table.c.id],
            set_={key: statement.excluded[key] for key in rows[0] if key != "id"},
        )
        await session.execute(statement)


async def sync_fpl_data(
    session_factory: Callable[[], AsyncSession] = AsyncSessionLocal,
    *,
    client: httpx.AsyncClient | None = None,
    url: str | None = None,
) -> dict[str, int]:
    """Fetch, validate, then commit teams and players together.

    An injected HTTP client stays owned by its caller. No database session is
    opened until the entire response has passed validation. Counts describe
    processed records, rather than claiming how many were newly inserted.
    """
    if client is None:
        async with httpx.AsyncClient() as owned_client:
            return await sync_fpl_data(session_factory, client=owned_client, url=url)
    try:
        response = await client.get(url or settings.FPL_BOOTSTRAP_URL, timeout=30.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise FPLSyncError("FPL bootstrap request failed") from exc
    try:
        teams, players = _parse_payload(response.json())
    except (ValueError, TypeError) as exc:
        raise FPLSyncError("Invalid FPL bootstrap payload") from exc
    try:
        async with session_factory() as session:
            async with session.begin():
                await _upsert(session, Team.__table__, teams)
                await _upsert(session, Player.__table__, players)
    except Exception as exc:
        raise FPLSyncError("FPL database sync failed; transaction rolled back") from exc
    return {"teams_processed": len(teams), "players_processed": len(players)}


async def _main() -> None:
    try:
        result = await sync_fpl_data()
        print(f"P1-NH02: {result}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(_main())
