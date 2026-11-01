from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.player import Player
from app.models.team import Team
from app.schemas.player import PlayerItemResponse, PlayerListResponse


router = APIRouter(tags=["Players"])

SORT_COLUMN_MAP = {
    "total_points": Player.total_points,
    "now_cost": Player.now_cost,
    "form": Player.form,
    "expected_points_next": Player.expected_points_next,
}


@router.get("", response_model=PlayerListResponse)
async def get_players(
    position: Optional[str] = Query(None, description="Position filter: GKP, DEF, MID, FWD"),
    team_id: Optional[int] = Query(None, description="Filter by team ID"),
    max_cost: Optional[float] = Query(None, ge=0.0, description="Filter by maximum price (£m)"),
    search: Optional[str] = Query(None, description="Search player by name"),
    sort_by: Optional[str] = Query("total_points", description="Sort by: total_points, now_cost, form, expected_points_next"),
    order: Optional[str] = Query("desc", pattern="^(asc|desc)$", description="Sort direction: asc or desc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_db),
) -> PlayerListResponse:
    """Get players list with filtering, searching, sorting and pagination."""
    # Base query for filtering
    conditions = []

    if position:
        conditions.append(Player.element_type == position.upper())

    if team_id is not None:
        conditions.append(Player.team_id == team_id)

    if max_cost is not None:
        conditions.append(Player.now_cost <= max_cost)

    if search:
        search_pattern = f"%{search.strip()}%"
        conditions.append(
            or_(
                Player.web_name.ilike(search_pattern),
                Player.first_name.ilike(search_pattern),
                Player.second_name.ilike(search_pattern),
            )
        )

    # 1. Total count query
    count_stmt = select(func.count(Player.id))
    if conditions:
        count_stmt = count_stmt.where(*conditions)
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    # 2. Sorting
    sort_col = SORT_COLUMN_MAP.get(sort_by, Player.total_points)
    order_func = asc if order == "asc" else desc

    # 3. Data query with join to get team short_name
    query = (
        select(Player, Team.short_name.label("team_short_name"))
        .outerjoin(Team, Player.team_id == Team.id)
    )
    if conditions:
        query = query.where(*conditions)

    # Secondary sort by player.id for deterministic pagination
    query = (
        query.order_by(order_func(sort_col).nulls_last(), Player.id.asc())
        .offset((page - 1) * limit)
        .limit(limit)
    )

    result = await session.execute(query)
    rows = result.all()

    items = [
        PlayerItemResponse(
            id=player.id,
            web_name=player.web_name,
            team_short_name=team_short_name,
            element_type=player.element_type,
            now_cost=float(player.now_cost),
            total_points=player.total_points,
            form=float(player.form),
            status=player.status,
            expected_points_next=(
                float(player.expected_points_next)
                if player.expected_points_next is not None
                else None
            ),
        )
        for player, team_short_name in rows
    ]

    return PlayerListResponse(
        total=total,
        page=page,
        limit=limit,
        items=items,
    )
