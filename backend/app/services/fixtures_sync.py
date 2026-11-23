"""Ingest the FPL fixture list after the teams have been synchronized."""

from collections.abc import Callable
from typing import Annotated

import httpx
from pydantic import AwareDatetime, BaseModel, Field, StrictBool
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Fixture
from app.services.fdr_service import FPL_FIXTURES_URL
from app.services.fpl_sync import FPLSyncError, _upsert

PositiveId = Annotated[int, Field(strict=True, gt=0)]
Difficulty = Annotated[int, Field(strict=True, ge=1, le=5)]
Score = Annotated[int, Field(strict=True, ge=0)]


class _FixtureData(BaseModel):
    id: PositiveId
    gameweek: Annotated[int, Field(alias="event", strict=True, ge=1, le=38)]
    team_h: PositiveId
    team_a: PositiveId
    kickoff_time: AwareDatetime | None = None
    team_h_score: Score | None = None
    team_a_score: Score | None = None
    team_h_difficulty: Difficulty | None = None
    team_a_difficulty: Difficulty | None = None
    finished: StrictBool


async def sync_fixtures(session_factory: Callable[[], AsyncSession], client: httpx.AsyncClient | None = None):
    """Validate scheduled fixtures, then upsert them in a single transaction."""
    if client is None:
        async with httpx.AsyncClient() as owned_client:
            return await sync_fixtures(session_factory, owned_client)
    try:
        response = await client.get(FPL_FIXTURES_URL, timeout=30.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise FPLSyncError("FPL fixtures request failed") from exc
    try:
        payload = response.json()
        if not isinstance(payload, list):
            raise ValueError("Expected a fixture list")
        rows = []
        seen = set()
        for raw in payload:
            if isinstance(raw, dict) and "event" in raw and raw["event"] is None:
                continue
            fixture = _FixtureData.model_validate(raw)
            if fixture.id in seen:
                raise ValueError("Duplicate fixture ID")
            seen.add(fixture.id)
            rows.append(fixture.model_dump())
    except ValueError as exc:
        raise FPLSyncError("Invalid FPL fixtures payload") from exc
    try:
        async with session_factory() as session:
            async with session.begin():
                await _upsert(session, Fixture.__table__, rows)
    except Exception as exc:
        raise FPLSyncError("Fixture sync failed; transaction rolled back") from exc
    return {"fixtures_processed": len(rows)}
