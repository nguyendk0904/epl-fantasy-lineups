from collections.abc import Sequence

import pulp
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.player import Player
from app.schemas.optimizer import (
    Formation,
    OptimizedPlayer,
    OptimizerRequest,
    OptimizerResponse,
)
from app.services.optimizer_solver import PlayerCandidate, optimize_squad


router = APIRouter(tags=["Optimizer"])

VALID_POSITIONS = {"GKP", "DEF", "MID", "FWD"}
POSITION_ORDER = {"GKP": 0, "DEF": 1, "MID": 2, "FWD": 3}


def _optimize_starting_xi(
    squad: Sequence[PlayerCandidate], target_formation: Formation | None
) -> tuple[set[int], int]:
    """Choose an optimal valid XI and captain from an already optimized squad."""
    model = pulp.LpProblem("fpl_starting_xi_optimizer", pulp.LpMaximize)
    add_variable = getattr(model, "add_variable", None)

    def binary_variable(name: str) -> pulp.LpVariable:
        if add_variable is not None:
            return add_variable(name, lowBound=0, upBound=1, cat=pulp.LpBinary)
        return pulp.LpVariable(name, lowBound=0, upBound=1, cat=pulp.LpBinary)

    starts = {
        player.id: binary_variable(f"start_{player.id}")
        for player in squad
    }
    captains = {
        player.id: binary_variable(f"captain_{player.id}")
        for player in squad
    }

    model += pulp.lpSum(
        player.expected_points_next * (starts[player.id] + captains[player.id])
        for player in squad
    )
    model += pulp.lpSum(starts.values()) == 11, "starting_xi_size"
    model += pulp.lpSum(
        starts[player.id] for player in squad if player.element_type == "GKP"
    ) == 1, "starting_goalkeeper"
    model += pulp.lpSum(captains.values()) == 1, "one_captain"
    for player in squad:
        model += captains[player.id] <= starts[player.id], f"captain_starts_{player.id}"

    if target_formation is not None:
        defenders, midfielders, forwards = map(int, target_formation.split("-"))
        formation_counts = {"DEF": defenders, "MID": midfielders, "FWD": forwards}
        for position, count in formation_counts.items():
            model += pulp.lpSum(
                starts[player.id]
                for player in squad
                if player.element_type == position
            ) == count, f"formation_{position}"
    else:
        for position, lower, upper in (
            ("DEF", 3, 5),
            ("MID", 2, 5),
            ("FWD", 1, 3),
        ):
            count = pulp.lpSum(
                starts[player.id]
                for player in squad
                if player.element_type == position
            )
            model += count >= lower, f"minimum_{position}"
            model += count <= upper, f"maximum_{position}"

    try:
        model.solve(pulp.COIN_CMD(msg=False))
    except pulp.PulpSolverError as exc:
        raise RuntimeError("PuLP could not run CBC for starting XI optimization.") from exc

    if pulp.LpStatus.get(model.status) != "Optimal":
        raise ValueError("No feasible starting XI found for the selected squad.")

    starting_ids = {
        player.id for player in squad if starts[player.id].value() > 0.5
    }
    captain_id = next(
        player.id for player in squad if captains[player.id].value() > 0.5
    )
    return starting_ids, captain_id


def _as_response_player(player: PlayerCandidate, row: Player) -> OptimizedPlayer:
    return OptimizedPlayer(
        id=player.id,
        web_name=row.web_name,
        element_type=player.element_type,
        team_id=player.team_id,
        now_cost=player.now_cost,
        expected_points_next=player.expected_points_next,
    )


@router.post("/optimizer/solve", response_model=OptimizerResponse)
async def solve_optimizer(
    request: OptimizerRequest,
    db: AsyncSession = Depends(get_db),
) -> OptimizerResponse:
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
        )
        for row in candidate_rows
    ]
    rows_by_id = {row.id: row for row in candidate_rows}

    try:
        squad_result = optimize_squad(
            candidates,
            budget=request.budget,
            locked_player_ids=request.locked_player_ids,
            excluded_player_ids=request.excluded_player_ids,
        )
    except ValueError as exc:
        if str(exc).startswith("No feasible 15-player squad"):
            return OptimizerResponse(status="infeasible", message=str(exc))
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    selected_ids = set(squad_result.selected_player_ids)
    selected_candidates = [p for p in candidates if p.id in selected_ids]
    try:
        starting_ids, captain_id = _optimize_starting_xi(
            selected_candidates, request.target_formation
        )
    except ValueError as exc:
        return OptimizerResponse(status="infeasible", message=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

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
    total_expected_points = sum(p.expected_points_next for p in starters)
    captain = next(p for p in starters if p.id == captain_id)

    return OptimizerResponse(
        status="optimal",
        total_cost=squad_result.total_cost,
        total_expected_points=round(total_expected_points + captain.expected_points_next, 1),
        starting_xi=[_as_response_player(p, rows_by_id[p.id]) for p in starters],
        bench=[_as_response_player(p, rows_by_id[p.id]) for p in bench],
        captain_id=captain_id,
        vice_captain_id=vice_captain_id,
        formation=formation,
    )
