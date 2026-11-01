"""P1-NH04: list synced clubs and their strength metrics."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.team import Team
from app.schemas.team import TeamResponse


router = APIRouter(tags=["Teams"])


@router.get("", response_model=list[TeamResponse])
async def get_teams(session: AsyncSession = Depends(get_db)) -> list[TeamResponse]:
    result = await session.execute(select(Team).order_by(Team.id.asc()))
    return [TeamResponse.model_validate(team) for team in result.scalars().all()]
