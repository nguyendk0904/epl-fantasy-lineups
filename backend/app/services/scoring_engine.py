"""Calculate and persist a user's FPL score for one gameweek."""

from collections import defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from itertools import combinations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Player, PlayerGameweekStat, UserGameweekLineup


@dataclass(frozen=True)
class PlayerPerformance:
    """Aggregated gameweek performance for one player."""

    element_type: str
    minutes: int = 0
    total_points: int = 0


@dataclass(frozen=True)
class AutoSubstitution:
    outgoing_player_id: int
    incoming_player_id: int


@dataclass(frozen=True)
class ScoringResult:
    lineup_id: int
    gameweek: int
    total_points: int
    raw_points: int
    captain_bonus: int
    doubled_player_id: int | None
    starting_player_ids: tuple[int, ...]
    substitutions: tuple[AutoSubstitution, ...]


class ScoringInputError(ValueError):
    """Raised when a saved lineup cannot be scored as a valid FPL team."""


def calculate_lineup_score(
    *,
    lineup_id: int,
    gameweek: int,
    starting_player_ids: Sequence[int],
    bench_player_ids: Sequence[int],
    captain_id: int | None,
    vice_captain_id: int | None,
    performances: Mapping[int, PlayerPerformance],
) -> ScoringResult:
    """Score an XI, applying valid auto-subs and the captain multiplier.

    The caller supplies a performance (including position) for each selected
    player; the database wrapper fills players without stat rows with zero
    minutes and points. Bench order is preserved for outfield substitution
    priority; the goalkeeper can only replace the starting goalkeeper.
    """
    starters = tuple(starting_player_ids)
    bench = tuple(bench_player_ids)
    full_squad = starters + bench

    if len(starters) != 11 or len(bench) != 4 or len(set(full_squad)) != 15:
        raise ScoringInputError("Lineup must contain 15 distinct players: 11 starters and 4 bench players")
    if captain_id is None or vice_captain_id is None:
        raise ScoringInputError("Captain and vice-captain must be selected")
    if captain_id == vice_captain_id or captain_id not in starters or vice_captain_id not in starters:
        raise ScoringInputError("Captain and vice-captain must be different starters")

    all_ids = set(full_squad)
    if all_ids - performances.keys():
        raise ScoringInputError("Position data is required for every player in the lineup")
    if any(performance.minutes < 0 for performance in performances.values()):
        raise ScoringInputError("Player minutes cannot be negative")

    position_by_id = {player_id: performances[player_id].element_type for player_id in full_squad}
    if any(position not in {"GKP", "DEF", "MID", "FWD"} for position in position_by_id.values()):
        raise ScoringInputError("Unsupported player position in lineup")
    if sum(position == "GKP" for position in (position_by_id[player_id] for player_id in starters)) != 1:
        raise ScoringInputError("Starting XI must contain exactly one goalkeeper")
    if sum(position_by_id[player_id] == "GKP" for player_id in bench) != 1:
        raise ScoringInputError("Bench must contain exactly one goalkeeper")
    if not _valid_formation(starters, position_by_id):
        raise ScoringInputError("Starting XI does not use a valid project formation")

    final_starters = list(starters)
    substitutions: list[AutoSubstitution] = []

    absent_goalkeepers = [
        player_id
        for player_id in starters
        if position_by_id[player_id] == "GKP" and performances[player_id].minutes == 0
    ]
    if absent_goalkeepers:
        bench_goalkeeper = next(player_id for player_id in bench if position_by_id[player_id] == "GKP")
        if performances[bench_goalkeeper].minutes > 0:
            outgoing = absent_goalkeepers[0]
            final_starters[final_starters.index(outgoing)] = bench_goalkeeper
            substitutions.append(AutoSubstitution(outgoing, bench_goalkeeper))

    absent_outfield = [
        player_id
        for player_id in starters
        if position_by_id[player_id] != "GKP" and performances[player_id].minutes == 0
    ]
    playing_bench_outfield = [
        player_id
        for player_id in bench
        if position_by_id[player_id] != "GKP" and performances[player_id].minutes > 0
    ]
    substitutions.extend(
        _choose_outfield_substitutions(
            starters=starters,
            absent_outfield=absent_outfield,
            bench_outfield=playing_bench_outfield,
            position_by_id=position_by_id,
        )
    )
    for substitution in substitutions:
        if substitution.outgoing_player_id in final_starters:
            final_starters[final_starters.index(substitution.outgoing_player_id)] = (
                substitution.incoming_player_id
            )

    raw_points = sum(performances[player_id].total_points for player_id in final_starters)
    if performances[captain_id].minutes > 0:
        doubled_player_id = captain_id
    elif performances[vice_captain_id].minutes > 0:
        doubled_player_id = vice_captain_id
    else:
        doubled_player_id = None
    captain_bonus = (
        performances[doubled_player_id].total_points if doubled_player_id is not None else 0
    )

    return ScoringResult(
        lineup_id=lineup_id,
        gameweek=gameweek,
        total_points=raw_points + captain_bonus,
        raw_points=raw_points,
        captain_bonus=captain_bonus,
        doubled_player_id=doubled_player_id,
        starting_player_ids=tuple(final_starters),
        substitutions=tuple(substitutions),
    )


def _valid_formation(
    player_ids: Sequence[int], position_by_id: Mapping[int, str]
) -> bool:
    counts = {
        position: sum(position_by_id[player_id] == position for player_id in player_ids)
        for position in ("GKP", "DEF", "MID", "FWD")
    }
    return (
        counts["GKP"] == 1
        and 3 <= counts["DEF"] <= 5
        and 2 <= counts["MID"] <= 5
        and 1 <= counts["FWD"] <= 3
        and len(player_ids) == 11
    )


def _choose_outfield_substitutions(
    *,
    starters: Sequence[int],
    absent_outfield: Sequence[int],
    bench_outfield: Sequence[int],
    position_by_id: Mapping[int, str],
) -> list[AutoSubstitution]:
    """Find the most substitutions possible while honoring bench priority."""
    best: list[AutoSubstitution] = []
    best_priority: tuple[int, ...] | None = None
    absent_order = tuple(absent_outfield)

    # Search the tiny (at most three-player) outfield bench. Prefer the largest
    # valid set of substitutions, then the earliest bench-priority sequence.
    for size in range(min(len(absent_order), len(bench_outfield)), 0, -1):
        for selected_indices in combinations(range(len(bench_outfield)), size):
            selected_players = [bench_outfield[index] for index in selected_indices]
            assignments: list[AutoSubstitution] = []

            def assign(index: int, remaining_absent: tuple[int, ...]) -> bool:
                if index == len(selected_players):
                    return True
                incoming = selected_players[index]
                for outgoing in remaining_absent:
                    proposed = [player_id for player_id in starters if player_id != outgoing]
                    proposed.append(incoming)
                    if not _valid_formation(proposed, position_by_id):
                        continue
                    assignments.append(AutoSubstitution(outgoing, incoming))
                    next_absent = tuple(player_id for player_id in remaining_absent if player_id != outgoing)
                    if assign(index + 1, next_absent):
                        return True
                    assignments.pop()
                return False

            if assign(0, absent_order):
                priority = tuple(selected_indices)
                if best_priority is None or priority < best_priority:
                    best = list(assignments)
                    best_priority = priority
        if best:
            break
    return best


async def score_and_persist_gameweek_lineup(
    session: AsyncSession, lineup_id: int
) -> ScoringResult:
    """Load one lineup and its gameweek stats, score it, and flush its points.

    The caller owns the session transaction and decides when to commit.
    Player points and minutes are summed across every fixture in the gameweek.
    """
    lineup_result = await session.execute(
        select(UserGameweekLineup).where(UserGameweekLineup.id == lineup_id)
    )
    lineup = lineup_result.scalar_one_or_none()
    if lineup is None:
        raise LookupError(f"Gameweek lineup {lineup_id} was not found")

    squad_ids = tuple(lineup.starting_player_ids) + tuple(lineup.bench_player_ids)
    player_result = await session.execute(
        select(Player.id, Player.element_type).where(Player.id.in_(squad_ids))
    )
    positions = {row.id: row.element_type for row in player_result.all()}
    missing_ids = set(squad_ids) - positions.keys()
    if missing_ids:
        raise ScoringInputError(f"Lineup contains unknown player IDs: {sorted(missing_ids)}")

    stats_result = await session.execute(
        select(
            PlayerGameweekStat.player_id,
            PlayerGameweekStat.minutes,
            PlayerGameweekStat.total_points,
        ).where(
            PlayerGameweekStat.gameweek == lineup.gameweek,
            PlayerGameweekStat.player_id.in_(squad_ids),
        )
    )
    aggregated: dict[int, list[int]] = defaultdict(lambda: [0, 0])
    for row in stats_result.all():
        aggregated[row.player_id][0] += row.minutes
        aggregated[row.player_id][1] += row.total_points

    performances = {
        player_id: PlayerPerformance(
            element_type=positions[player_id],
            minutes=aggregated[player_id][0],
            total_points=aggregated[player_id][1],
        )
        for player_id in squad_ids
    }
    result = calculate_lineup_score(
        lineup_id=lineup.id,
        gameweek=lineup.gameweek,
        starting_player_ids=lineup.starting_player_ids,
        bench_player_ids=lineup.bench_player_ids,
        captain_id=lineup.captain_id,
        vice_captain_id=lineup.vice_captain_id,
        performances=performances,
    )
    lineup.gameweek_points = result.total_points
    await session.flush()
    return result
