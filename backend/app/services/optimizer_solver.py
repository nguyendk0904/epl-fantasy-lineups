"""PuLP model and solver for selecting an FPL squad."""

from dataclasses import dataclass
import json
import math
from pathlib import Path
from typing import Sequence

import pulp

POSITION_MAP = {
    1: "GKP",
    2: "DEF",
    3: "MID",
    4: "FWD",
}


@dataclass(frozen=True)
class PlayerCandidate:
    """Minimum player data the optimizer will need."""

    id: int
    team_id: int
    element_type: str  # GKP, DEF, MID, or FWD
    now_cost: float
    expected_points_next: float


@dataclass(frozen=True)
class OptimizationResult:
    """Illustrative result shape for a future solver implementation."""

    selected_player_ids: Sequence[int]
    total_cost: float
    total_expected_points: float


def load_players_from_json(path: str | Path) -> list[PlayerCandidate]:
    """Load FPL ``elements`` from a bootstrap-style JSON file into memory."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    elements = data.get("elements")
    if not isinstance(elements, list):
        raise ValueError("FPL JSON must contain an 'elements' list.")

    players = []
    for element in elements:
        try:
            position = POSITION_MAP[element["element_type"]]
        except KeyError as exc:
            raise ValueError(
                f"Unknown or missing element_type for player {element.get('id')}."
            ) from exc

        try:
            player = PlayerCandidate(
                id=int(element["id"]),
                team_id=int(element["team"]),
                element_type=position,
                now_cost=float(element["now_cost"]) / 10,
                expected_points_next=float(element["ep_next"]),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(
                f"Invalid required FPL data for player {element.get('id')}."
            ) from exc
        players.append(player)

    return players


def _build_optimizer_model(
    players: Sequence[PlayerCandidate],
    budget: float,
    locked_player_ids: Sequence[int] = (),
    excluded_player_ids: Sequence[int] = (),
) -> tuple[pulp.LpProblem, dict[int, pulp.LpVariable]]:
    """Build the P1-V02 binary ILP model without running a solver yet."""
    model = pulp.LpProblem("fpl_squad_optimizer", pulp.LpMaximize)
    add_variable = getattr(model, "add_variable", None)
    if add_variable is not None:
        # Newer PuLP versions attach variables directly to the problem this way.
        selected = {
            player.id: add_variable(
                f"select_player_{player.id}",
                lowBound=0,
                upBound=1,
                cat=pulp.LpBinary,
            )
            for player in players
        }
    else:
        # Keep compatibility with the minimum supported PuLP 2.8 API.
        selected = {
            player.id: pulp.LpVariable(
                f"select_player_{player.id}",
                lowBound=0,
                upBound=1,
                cat=pulp.LpBinary,
            )
            for player in players
        }

    # Maximize the sum of next-gameweek expected points.
    model += pulp.lpSum(
        player.expected_points_next * selected[player.id] for player in players
    ), "total_expected_points"

    # Squad composition: 2 GKP, 5 DEF, 5 MID, and 3 FWD.
    required_by_position = {"GKP": 2, "DEF": 5, "MID": 5, "FWD": 3}
    for position, required_count in required_by_position.items():
        model += (
            pulp.lpSum(
                selected[player.id]
                for player in players
                if player.element_type == position
            )
            == required_count,
            f"position_{position}",
        )

    # Explicit total makes the 15-player squad rule clear in the model.
    model += pulp.lpSum(selected.values()) == 15, "squad_size"

    # Locked players must be included in the selected squad.
    for player_id in sorted(set(locked_player_ids)):
        model += selected[player_id] == 1, f"locked_player_{player_id}"

    # Excluded players must not be selected in the squad.
    for player_id in sorted(set(excluded_player_ids)):
        model += selected[player_id] == 0, f"excluded_player_{player_id}"

    # Total player cost must fit the supplied budget.
    model += (
        pulp.lpSum(player.now_cost * selected[player.id] for player in players)
        <= budget,
        "budget_limit",
    )

    # At most three selected players may come from any one club.
    team_ids = {player.team_id for player in players}
    for team_id in team_ids:
        model += (
            pulp.lpSum(
                selected[player.id]
                for player in players
                if player.team_id == team_id
            )
            <= 3,
            f"team_limit_{team_id}",
        )

    return model, selected


def optimize_squad(
    players: Sequence[PlayerCandidate],
    budget: float = 100.0,
    locked_player_ids: Sequence[int] = (),
    excluded_player_ids: Sequence[int] = (),
) -> OptimizationResult:
    """Solve the squad model and return the selected players and their totals."""
    if not math.isfinite(budget) or budget < 0:
        raise ValueError("Budget must be a finite, non-negative number.")

    player_ids = [player.id for player in players]
    if len(player_ids) != len(set(player_ids)):
        raise ValueError("Player IDs must be unique.")

    available_ids = set(player_ids)
    unknown_locked_ids = set(locked_player_ids) - available_ids
    if unknown_locked_ids:
        raise ValueError(
            "Locked player IDs are not in the candidate list: "
            f"{sorted(unknown_locked_ids)}."
        )
    unknown_excluded_ids = set(excluded_player_ids) - available_ids
    if unknown_excluded_ids:
        raise ValueError(
            "Excluded player IDs are not in the candidate list: "
            f"{sorted(unknown_excluded_ids)}."
        )
    conflicting_ids = set(locked_player_ids) & set(excluded_player_ids)
    if conflicting_ids:
        raise ValueError(
            "A player cannot be both locked and excluded: "
            f"{sorted(conflicting_ids)}."
        )

    unknown_positions = {
        player.element_type
        for player in players
        if player.element_type not in {"GKP", "DEF", "MID", "FWD"}
    }
    if unknown_positions:
        raise ValueError(f"Unknown player positions: {sorted(unknown_positions)}")

    model, selected = _build_optimizer_model(
        players,
        budget,
        locked_player_ids,
        excluded_player_ids,
    )
    try:
        model.solve(pulp.COIN_CMD(msg=False))
    except pulp.PulpSolverError as exc:
        raise RuntimeError(
            "PuLP could not run CBC. Install a supported CBC solver and retry."
        ) from exc

    status = pulp.LpStatus.get(model.status, "Unknown")
    if status == "Infeasible":
        raise ValueError(
            f"No feasible 15-player squad found within the £{budget:.1f}m budget."
        )
    if status != "Optimal":
        raise RuntimeError(f"Optimizer did not find an optimal solution (status: {status}).")

    chosen_ids = tuple(
        player.id
        for player in players
        if selected[player.id].value() is not None
        and selected[player.id].value() > 0.5
    )
    chosen_id_set = set(chosen_ids)
    chosen_players = [player for player in players if player.id in chosen_id_set]

    return OptimizationResult(
        selected_player_ids=chosen_ids,
        total_cost=round(sum(player.now_cost for player in chosen_players), 1),
        total_expected_points=round(
            sum(player.expected_points_next for player in chosen_players), 1
        ),
    )
