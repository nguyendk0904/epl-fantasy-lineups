from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.core.redis_cache import cache_service
from app.models import DreamTeam, Fixture, Player, PlayerGameweekStat, Team
from app.schemas.fixture import (
    DreamTeamMVP, DreamTeamPlayer, DreamTeamResponse, FixtureItem, FixtureTeamInfo,
)

router = APIRouter(tags=["Fixtures"])


@router.get("/fixtures", response_model=list[FixtureItem])
async def list_fixtures(gameweek: int = Query(..., ge=1, le=38), db: AsyncSession = Depends(get_db)):
    # P4-Q02: cache the serialized fixture list for REDIS_CACHE_TTL_SECONDS so
    # thousands of concurrent requests never hammer RDS. The loader runs only on
    # a cache miss; sync_fixtures() invalidates the namespace after each update.
    return await cache_service.get_or_set(
        cache_service.build_key("fixtures", gameweek=gameweek),
        lambda: _load_fixture_items(db, gameweek),
    )


async def _load_fixture_items(db: AsyncSession, gameweek: int) -> list[dict]:
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
    return [item.model_dump(mode="json") for item in items]


def _incomplete_dream_team() -> HTTPException:
    return HTTPException(status_code=503, detail="Dream Team data is incomplete or inconsistent; sync the gameweek first")


@router.get(
    "/dream-team/{gw}", response_model=DreamTeamResponse, tags=["Dream Team"],
    responses={404: {"description": "Dream Team not synchronized yet"},
               503: {"description": "Incomplete gameweek data or database unavailable"}},
)
async def get_dream_team(gw: int = Path(..., ge=1, le=38), db: AsyncSession = Depends(get_db)):
    """Read NH02's snapshot and aggregate its players' per-fixture stats.

    No FPL request, database writes, captain multiplier or synthetic fallback.
    Keep official snapshot ordering; tied MVPs use its first highest scorer.
    Team/name/position come from current player metadata. team_code is omitted
    because the current schema does not store FPL kit codes.
    """
    try:
        snapshot = await db.scalar(select(DreamTeam).where(DreamTeam.gameweek == gw))
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Dream Team not found for this gameweek")
        player_ids = snapshot.top_player_ids
        if (
            not isinstance(player_ids, list) or len(player_ids) != 11
            or any(type(player_id) is not int or player_id <= 0 for player_id in player_ids)
            or len(set(player_ids)) != 11
        ):
            raise _incomplete_dream_team()
        metadata = (await db.execute(
            select(Player.id, Player.web_name, Player.element_type, Player.team_id,
                   Team.short_name.label("team_short_name"))
            .outerjoin(Team, Player.team_id == Team.id)
            .where(Player.id.in_(player_ids))
        )).all()
        stats = (await db.execute(
            select(
                PlayerGameweekStat.player_id,
                func.sum(PlayerGameweekStat.total_points).label("points"),
                func.sum(PlayerGameweekStat.goals).label("goals"),
                func.sum(PlayerGameweekStat.assists).label("assists"),
                func.sum(PlayerGameweekStat.clean_sheets).label("clean_sheets"),
                func.sum(PlayerGameweekStat.bonus_points).label("bonus"),
            )
            .where(PlayerGameweekStat.gameweek == gw, PlayerGameweekStat.player_id.in_(player_ids))
            .group_by(PlayerGameweekStat.player_id)
        )).all()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Dream Team database unavailable") from exc

    players_by_id = {row.id: row for row in metadata}
    stats_by_id = {row.player_id: row for row in stats}
    if set(players_by_id) != set(player_ids) or set(stats_by_id) != set(player_ids):
        raise _incomplete_dream_team()
    ordered = [players_by_id[player_id] for player_id in player_ids]
    if any(row.team_id is None or row.team_short_name is None for row in ordered):
        raise _incomplete_dream_team()
    counts = {position: sum(row.element_type == position for row in ordered)
              for position in ("GKP", "DEF", "MID", "FWD")}
    if not (
        counts["GKP"] == 1 and 3 <= counts["DEF"] <= 5
        and 2 <= counts["MID"] <= 5 and 1 <= counts["FWD"] <= 3
        and sum(counts.values()) == 11
    ):
        raise _incomplete_dream_team()
    total = sum(row.points for row in stats)
    if total != snapshot.total_points:
        raise _incomplete_dream_team()
    mvp_id = max(player_ids, key=lambda player_id: stats_by_id[player_id].points)
    mvp_player = players_by_id[mvp_id]
    mvp_stats = stats_by_id[mvp_id]
    return DreamTeamResponse(
        gameweek=gw,
        formation=f'{counts["DEF"]}-{counts["MID"]}-{counts["FWD"]}',
        total_points=total,
        mvp=DreamTeamMVP(id=mvp_id, name=mvp_player.web_name, points=mvp_stats.points,
                         team=mvp_player.team_short_name),
        players=[DreamTeamPlayer(
            id=row.id, web_name=row.web_name, team_short_name=row.team_short_name,
            team_id=row.team_id, element_type=row.element_type,
            points=stats_by_id[row.id].points, goals=stats_by_id[row.id].goals,
            assists=stats_by_id[row.id].assists, clean_sheet=stats_by_id[row.id].clean_sheets > 0,
            bonus=stats_by_id[row.id].bonus, isMvp=row.id == mvp_id,
        ) for row in ordered],
    )
