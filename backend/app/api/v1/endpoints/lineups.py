from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.player import Player
from app.schemas.lineup import (
    DifferentialPlayer,
    HeadToHeadDelta,
    LineupComparisonRequest,
    LineupComparisonResponse,
    LineupMetrics,
)


router = APIRouter(tags=["Lineups"])


def _clamp_rating(value: float) -> int:
    return max(40, min(99, round(value)))


def _calculate_metrics(players: Sequence[Player]) -> LineupMetrics:
    total_cost = round(sum(float(player.now_cost) for player in players), 1)
    expected_points = [
        float(player.expected_points_next)
        if player.expected_points_next is not None
        else float(player.total_points) / 20
        for player in players
    ]
    total_xp = round(sum(expected_points), 1)

    attacking_players = [
        player for player in players if player.element_type in {"FWD", "MID"}
    ]
    defending_players = [
        player for player in players if player.element_type in {"GKP", "DEF"}
    ]
    attack_points = sum(player.total_points for player in attacking_players)
    defense_points = sum(player.total_points for player in defending_players)

    attack_rating = _clamp_rating(
        attack_points / max(1, len(attacking_players) * 150) * 100
    )
    defense_rating = _clamp_rating(
        defense_points / max(1, len(defending_players) * 110) * 100
    )
    average_form = sum(
        float(player.form) if player.form is not None else 5.0 for player in players
    ) / max(1, len(players))
    form_rating = _clamp_rating(average_form / 9 * 100)
    value_rating = _clamp_rating(total_xp / max(1, total_cost) * 120)

    return LineupMetrics(
        total_cost=total_cost,
        total_xp=total_xp,
        attack_rating=attack_rating,
        defense_rating=defense_rating,
        form_rating=form_rating,
        value_rating=value_rating,
    )


@router.post("/lineups/compare", response_model=LineupComparisonResponse)
async def compare_lineups(
    request: LineupComparisonRequest,
    db: AsyncSession = Depends(get_db),
) -> LineupComparisonResponse:
    lineup_a_ids = request.lineup_a_player_ids
    lineup_b_ids = request.lineup_b_player_ids
    requested_ids = set(lineup_a_ids) | set(lineup_b_ids)

    result = await db.execute(select(Player).where(Player.id.in_(requested_ids)))
    players_by_id = {player.id: player for player in result.scalars().all()}
    missing_ids = sorted(requested_ids - players_by_id.keys())
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Players not found: {missing_ids}",
        )

    lineup_a = [players_by_id[player_id] for player_id in lineup_a_ids]
    lineup_b = [players_by_id[player_id] for player_id in lineup_b_ids]
    metrics_a = _calculate_metrics(lineup_a)
    metrics_b = _calculate_metrics(lineup_b)

    lineup_a_id_set = set(lineup_a_ids)
    lineup_b_id_set = set(lineup_b_ids)
    differential_players = [
        DifferentialPlayer(
            id=player.id,
            web_name=player.web_name,
            element_type=player.element_type,
            now_cost=float(player.now_cost),
        )
        for player in lineup_b
        if player.id not in lineup_a_id_set
    ]

    return LineupComparisonResponse(
        lineup_a=metrics_a,
        lineup_b=metrics_b,
        head_to_head_delta=HeadToHeadDelta(
            cost_diff=round(metrics_a.total_cost - metrics_b.total_cost, 1),
            xp_diff=round(metrics_a.total_xp - metrics_b.total_xp, 1),
            common_players_count=len(lineup_a_id_set & lineup_b_id_set),
            differential_players=differential_players,
        ),
    )
