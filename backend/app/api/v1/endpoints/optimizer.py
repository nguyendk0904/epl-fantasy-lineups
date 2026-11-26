from collections.abc import Sequence
from dataclasses import replace

from typing import get_args
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.database import get_db
from app.models.player import Player
from app.schemas.optimizer import (
    Formation,
    OptimizedPlayer,
    OptimizerRequest,
    OptimizerResponse,
)
from app.services.optimizer_solver import (
    PlayerCandidate,
    optimize_squad,
    OptimizerBusy,
)
from app.services.optimizer_cache import (
    build_optimizer_cache_key,
    optimizer_response_cache,
)


router = APIRouter(tags=["Optimizer"])

VALID_POSITIONS = {"GKP", "DEF", "MID", "FWD"}
POSITION_ORDER = {"GKP": 0, "DEF": 1, "MID": 2, "FWD": 3}


def _optimize_starting_xi(
    squad: Sequence[PlayerCandidate], target_formation: Formation | None
) -> tuple[set[int], int]:
    """Choose an optimal valid XI and captain from an already optimized squad."""
    # For fixed positional counts, the highest-xP players maximize both
    # the XI sum and its largest (captain) term. Only eight formations exist.
    ranked = sorted(squad, key=lambda p: (-p.expected_points_next, p.id))
    by_position = {pos: [p for p in ranked if p.element_type == pos] for pos in POSITION_ORDER}
    formations = (target_formation,) if target_formation else get_args(Formation)
    best_score = float("-inf")
    for formation in formations:
        counts = (1, *map(int, formation.split("-")))
        xi = [p for pos, count in zip(POSITION_ORDER, counts) for p in by_position[pos][:count]]
        if len(xi) != 11:
            continue
        captain = max(xi, key=lambda p: (p.expected_points_next, -p.id))
        score = sum(p.expected_points_next for p in xi) + captain.expected_points_next
        if score > best_score:
            best_score = score
            best = {p.id for p in xi}, captain.id
    if best_score == float("-inf"):
        raise ValueError("No feasible starting XI found for the selected squad.")
    return best


def _as_response_player(player: PlayerCandidate, row: Player) -> OptimizedPlayer:
    return OptimizedPlayer(
        id=player.id,
        web_name=row.web_name,
        element_type=player.element_type,
        team_id=player.team_id,
        now_cost=player.now_cost,
        expected_points_next=round(player.expected_points_next, 1),
    )


@router.post("/optimizer/solve", response_model=OptimizerResponse)
async def solve_optimizer(
    request: OptimizerRequest,
    db: AsyncSession = Depends(get_db),
) -> OptimizerResponse:
    cache_key = build_optimizer_cache_key(request)
    cached_response = optimizer_response_cache.get(cache_key)
    if cached_response is not None:
        return cached_response

    result = await db.execute(select(Player))
    player_rows = list(result.scalars().all())
    candidate_rows = [
        row
        for row in player_rows
        if row.element_type in VALID_POSITIONS and row.team_id is not None
    ]
    candidates = [
        PlayerCandidate(
            id=row.id,
            team_id=row.team_id,
            element_type=row.element_type,
            now_cost=float(row.now_cost),
            expected_points_next=float(row.expected_points_next or 0),
            status=row.status or "a",
        )
        for row in candidate_rows
    ]
    rows_by_id = {row.id: row for row in candidate_rows}

    try:
        squad_result = await run_in_threadpool(
            optimize_squad,
            candidates,
            budget=request.budget,
            locked_player_ids=request.locked_player_ids,
            excluded_player_ids=request.excluded_player_ids,
        )
    except ValueError as exc:
        if str(exc).startswith("No feasible 15-player squad"):
            return OptimizerResponse(status="infeasible", message=str(exc))
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OptimizerBusy as exc:
        raise HTTPException(status_code=503, detail=str(exc), headers={"Retry-After": "5"}) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    selected_ids = set(squad_result.selected_player_ids)
    selected_candidates = [
        replace(p, expected_points_next=squad_result.adjusted_expected_points.get(
            p.id, p.expected_points_next
        ))
        for p in candidates if p.id in selected_ids
    ]
    try:
        starting_ids, captain_id = _optimize_starting_xi(selected_candidates, request.target_formation)
    except ValueError as exc:
        return OptimizerResponse(status="infeasible", message=str(exc))

    starters = [p for p in selected_candidates if p.id in starting_ids]
    bench = [p for p in selected_candidates if p.id not in starting_ids]
    starters.sort(key=lambda p: (POSITION_ORDER[p.element_type], p.id))
    bench.sort(key=lambda p: (p.element_type != "GKP", -p.expected_points_next, p.id))
    vice_captain_id = max(
        (p for p in starters if p.id != captain_id),
        key=lambda p: (p.expected_points_next, -p.id),
    ).id
    formation = "-".join(
        str(sum(p.element_type == position for p in starters))
        for position in ("DEF", "MID", "FWD")
    )
    # Sum the displayed player values so the response total matches the UI.
    total_expected_points = sum(round(p.expected_points_next, 1) for p in starters)
    captain = next(p for p in starters if p.id == captain_id)

    response = OptimizerResponse(
        status="optimal",
        message=squad_result.message,
        total_cost=squad_result.total_cost,
        total_expected_points=round(total_expected_points + round(captain.expected_points_next, 1), 1),
        starting_xi=[_as_response_player(p, rows_by_id[p.id]) for p in starters],
        bench=[_as_response_player(p, rows_by_id[p.id]) for p in bench],
        captain_id=captain_id,
        vice_captain_id=vice_captain_id,
        formation=formation,
    )
    if squad_result.message is None:
        optimizer_response_cache.put(cache_key, response)
    return response
