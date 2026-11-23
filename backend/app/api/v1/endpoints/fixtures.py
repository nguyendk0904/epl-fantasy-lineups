from datetime import timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.models import Fixture
from app.schemas.fixture import FixtureItem, FixtureTeamInfo

router = APIRouter(tags=["Fixtures"])


@router.get("/fixtures", response_model=list[FixtureItem])
async def list_fixtures(gameweek: int = Query(..., ge=1, le=38), db: AsyncSession = Depends(get_db)):
    query = (
        select(Fixture)
        .options(joinedload(Fixture.home_team), joinedload(Fixture.away_team))
        .where(Fixture.gameweek == gameweek, Fixture.kickoff_time.is_not(None),
               Fixture.team_h_difficulty.is_not(None), Fixture.team_a_difficulty.is_not(None))
        .order_by(Fixture.kickoff_time, Fixture.id)
    )
    items = []
    for row in await db.scalars(query):
        kickoff = row.kickoff_time
        # SQLite returns naive timestamps; FPL kickoff times are UTC.
        kickoff = kickoff.astimezone(timezone.utc) if kickoff.tzinfo else kickoff.replace(tzinfo=timezone.utc)
        items.append(FixtureItem(
            id=row.id, gameweek=row.gameweek, kickoff_time=kickoff, kickoff_date=kickoff.strftime("%d/%m/%Y"),
            home_team=FixtureTeamInfo.model_validate(row.home_team),
            away_team=FixtureTeamInfo.model_validate(row.away_team),
            team_h_score=row.team_h_score, team_a_score=row.team_a_score,
            team_h_difficulty=row.team_h_difficulty, team_a_difficulty=row.team_a_difficulty,
            finished=row.finished,
        ))
    return items
