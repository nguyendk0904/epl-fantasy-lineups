"""Transfer optimizer: suggest optimal transfers from a current squad."""

from dataclasses import dataclass
from typing import Mapping, Sequence

import pulp

from app.services.optimizer_solver import PlayerCandidate, solve_model_with_cbc


@dataclass(frozen=True)
class Transfer:
    out_player_id: int
    in_player_id: int
    cost_change: float
    points_change: float


@dataclass(frozen=True)
class TransferResult:
    transfers: Sequence[Transfer]
    new_squad: Sequence[PlayerCandidate]
    total_cost: float
    total_expected_points: float
    points_gain: float


def _player_by_id(players: Sequence[PlayerCandidate]) -> dict[int, PlayerCandidate]:
    return {p.id: p for p in players}


def optimize_transfers(
    current_squad: Sequence[PlayerCandidate],
    all_candidates: Sequence[PlayerCandidate],
    budget: float = 100.0,
    max_transfers: int = 3,
    xp_multipliers: Mapping[int, float] | None = None,
) -> TransferResult:
    current_ids = {p.id for p in current_squad}
    if len(current_squad) != 15:
        raise ValueError("Current squad must contain exactly 15 players.")
    if len(current_ids) != len(current_squad):
        raise ValueError("Current squad player IDs must be unique.")
    if max_transfers < 0:
        raise ValueError("max_transfers must be non-negative.")
    # Filter injured/unavailable candidates.
    candidates = [p for p in all_candidates if p.id not in current_ids and p.status == "a"]
    players_by_id = _player_by_id(list(current_squad) + list(candidates))
    multipliers = xp_multipliers or {}
    points = {p.id: p.expected_points_next * multipliers.get(p.team_id, 1.0)
              if p.status == "a" else 0.0 for p in players_by_id.values()}

    original_cost = sum(p.now_cost for p in current_squad)
    original_points = sum(points[p.id] for p in current_squad)
    bank = budget - original_cost

    model = pulp.LpProblem("fpl_transfer_optimizer", pulp.LpMaximize)

    out_vars = {}
    in_vars = {}
    for p in current_squad:
        out_vars[p.id] = pulp.LpVariable(f"out_{p.id}", cat=pulp.LpBinary)
    for p in candidates:
        in_vars[p.id] = pulp.LpVariable(f"in_{p.id}", cat=pulp.LpBinary)

    # Objective: maximize xP gain.
    model += (
        pulp.lpSum(points[pid] * in_vars[pid] for pid in in_vars)
        - pulp.lpSum(points[pid] * out_vars[pid] for pid in out_vars)
    ), "gain"

    # Transfer count constraints.
    total_out = pulp.lpSum(out_vars.values()) if out_vars else 0
    total_in = pulp.lpSum(in_vars.values()) if in_vars else 0
    model += total_out <= max_transfers, "max_transfers"
    model += total_in == total_out, "balance_count"

    # Budget: new squad cost <= budget.
    model += (
        pulp.lpSum(players_by_id[pid].now_cost * in_vars[pid] for pid in in_vars)
        - pulp.lpSum(players_by_id[pid].now_cost * out_vars[pid] for pid in out_vars)
        <= bank
    ), "budget"

    # Position balance: net transfers per position = 0.
    positions = {p.element_type for p in list(current_squad) + candidates}
    for pos in positions:
        out_pos = [pid for pid in out_vars if players_by_id[pid].element_type == pos]
        in_pos = [pid for pid in in_vars if players_by_id[pid].element_type == pos]
        model += (
            pulp.lpSum(in_vars[pid] for pid in in_pos)
            == pulp.lpSum(out_vars[pid] for pid in out_pos)
        ), f"position_balance_{pos}"

    # Team limit on resulting squad: <= 3 per club.
    team_ids = {p.team_id for p in list(current_squad) + candidates}
    for team_id in team_ids:
        original_count = sum(1 for p in current_squad if p.team_id == team_id)
        in_team = [pid for pid in in_vars if players_by_id[pid].team_id == team_id]
        out_team = [pid for pid in out_vars if players_by_id[pid].team_id == team_id]
        model += (
            original_count
            + pulp.lpSum(in_vars[pid] for pid in in_team)
            - pulp.lpSum(out_vars[pid] for pid in out_team)
            <= 3
        ), f"team_limit_{team_id}"

    try:
        solve_model_with_cbc(model)
    except pulp.PulpSolverError as exc:
        raise RuntimeError("PuLP could not run CBC.") from exc

    status = pulp.LpStatus.get(model.status, "Unknown")
    if status != "Optimal":
        if status == "Infeasible":
            # Return no transfers.
            return TransferResult(
                transfers=(),
                new_squad=list(current_squad),
                total_cost=round(original_cost, 1),
                total_expected_points=round(original_points, 1),
                points_gain=0.0,
            )
        raise RuntimeError(f"Optimizer did not find a solution (status: {status}).")

    out_selected = [pid for pid in out_vars if out_vars[pid].value() is not None and out_vars[pid].value() > 0.5]
    in_selected = [pid for pid in in_vars if in_vars[pid].value() is not None and in_vars[pid].value() > 0.5]

    # Pair transfers by position to keep counts; PuLP already balanced positions.
    # Build transfer list: match outs to ins greedily by position.
    transfers = []
    remaining_in = list(in_selected)
    for out_id in out_selected:
        out_p = players_by_id[out_id]
        # find an in player of same position not yet paired
        match_idx = None
        for i, in_id in enumerate(remaining_in):
            if players_by_id[in_id].element_type == out_p.element_type:
                match_idx = i
                break
        if match_idx is None:
            continue
        in_id = remaining_in.pop(match_idx)
        in_p = players_by_id[in_id]
        transfers.append(
            Transfer(
                out_player_id=out_id,
                in_player_id=in_id,
                cost_change=round(in_p.now_cost - out_p.now_cost, 1),
                points_change=round(points[in_id] - points[out_id], 1),
            )
        )

    new_squad_ids = set(current_ids) - set(out_selected) | set(in_selected)
    new_squad = [players_by_id[pid] for pid in new_squad_ids if pid in players_by_id]
    # Preserve 15 count
    total_cost = round(sum(p.now_cost for p in new_squad), 1)
    total_points = sum(points[p.id] for p in new_squad)
    points_gain = round(total_points - original_points, 1)

    return TransferResult(
        transfers=tuple(transfers),
        new_squad=new_squad,
        total_cost=total_cost,
        total_expected_points=round(total_points, 1),
        points_gain=points_gain,
    )
