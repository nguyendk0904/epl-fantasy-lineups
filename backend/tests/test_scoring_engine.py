from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models import UserGameweekLineup
from app.services.scoring_engine import (
    AutoSubstitution,
    PlayerPerformance,
    ScoringInputError,
    calculate_lineup_score,
    score_and_persist_gameweek_lineup,
)


STARTERS = (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)  # 3-4-3
BENCH = (12, 13, 14, 15)  # goalkeeper, then outfield priority
POSITIONS = {
    1: "GKP",
    2: "DEF",
    3: "DEF",
    4: "DEF",
    5: "MID",
    6: "MID",
    7: "MID",
    8: "MID",
    9: "FWD",
    10: "FWD",
    11: "FWD",
    12: "GKP",
    13: "DEF",
    14: "MID",
    15: "FWD",
}


def make_performances(*, points: int = 1, minutes: int = 90):
    return {
        player_id: PlayerPerformance(POSITIONS[player_id], minutes, points)
        for player_id in POSITIONS
    }


def score(performance, *, starters=STARTERS, bench=BENCH, captain=5, vice=6):
    return calculate_lineup_score(
        lineup_id=42,
        gameweek=7,
        starting_player_ids=starters,
        bench_player_ids=bench,
        captain_id=captain,
        vice_captain_id=vice,
        performances=performance,
    )


def test_scores_starting_xi_and_doubles_playing_captain():
    result = score(make_performances(points=2))

    assert result.raw_points == 22
    assert result.captain_bonus == 2
    assert result.total_points == 24
    assert result.doubled_player_id == 5
    assert result.substitutions == ()


def test_vice_captain_is_doubled_when_captain_did_not_play():
    performances = make_performances(points=2)
    performances[5] = PlayerPerformance("MID", minutes=0, total_points=0)

    result = score(performances)

    assert result.doubled_player_id == 6
    assert result.captain_bonus == 2
    assert result.total_points == 24


def test_no_captain_bonus_when_both_captain_and_vice_play_zero_minutes():
    performances = make_performances(points=2)
    performances[5] = PlayerPerformance("MID", minutes=0, total_points=0)
    performances[6] = PlayerPerformance("MID", minutes=0, total_points=0)

    result = score(performances)

    assert result.doubled_player_id is None
    assert result.captain_bonus == 0
    assert result.total_points == 22


def test_auto_substitutions_follow_bench_order_and_preserve_valid_formation():
    performances = make_performances(points=1)
    performances[2] = PlayerPerformance("DEF", minutes=0, total_points=0)
    performances[5] = PlayerPerformance("MID", minutes=0, total_points=0)
    performances[13] = PlayerPerformance("DEF", minutes=90, total_points=5)
    performances[14] = PlayerPerformance("MID", minutes=90, total_points=4)

    result = score(performances)

    assert result.starting_player_ids.count(13) == 1
    assert result.starting_player_ids.count(14) == 1
    assert {sub.incoming_player_id for sub in result.substitutions} == {13, 14}
    assert len(result.substitutions) == 2


def test_only_bench_goalkeeper_can_replace_missing_starting_goalkeeper():
    performances = make_performances(points=1)
    performances[1] = PlayerPerformance("GKP", minutes=0, total_points=0)
    performances[12] = PlayerPerformance("GKP", minutes=90, total_points=6)

    result = score(performances)

    assert result.starting_player_ids[0] == 12
    assert result.substitutions == (AutoSubstitution(1, 12),)


def test_skips_nonplaying_bench_and_cannot_replace_defender_with_midfielder():
    performances = make_performances(points=1)
    performances[2] = PlayerPerformance("DEF", minutes=0, total_points=0)
    performances[14] = PlayerPerformance("MID", minutes=90, total_points=4)
    performances[13] = PlayerPerformance("DEF", minutes=0, total_points=0)
    performances[15] = PlayerPerformance("FWD", minutes=90, total_points=3)

    result = score(performances)

    assert result.substitutions == ()
    assert 2 in result.starting_player_ids
    assert 14 not in result.starting_player_ids


@pytest.mark.asyncio
async def test_double_gameweek_stats_are_summed_and_persisted_on_lineup():
    lineup = UserGameweekLineup(
        id=42,
        gameweek=7,
        starting_player_ids=list(STARTERS),
        bench_player_ids=list(BENCH),
        captain_id=5,
        vice_captain_id=6,
        gameweek_points=0,
    )
    lineup_result = MagicMock()
    lineup_result.scalar_one_or_none.return_value = lineup
    player_result = MagicMock()
    player_result.all.return_value = [
        SimpleNamespace(id=player_id, element_type=position)
        for player_id, position in POSITIONS.items()
    ]
    stat_rows = [
        SimpleNamespace(player_id=player_id, minutes=90, total_points=1)
        for player_id in STARTERS
        if player_id != 5
    ]
    stat_rows.extend(
        [
            SimpleNamespace(player_id=5, minutes=90, total_points=3),
            SimpleNamespace(player_id=5, minutes=90, total_points=4),
        ]
    )
    stats_result = MagicMock()
    stats_result.all.return_value = stat_rows
    session = AsyncMock()
    session.execute.side_effect = [lineup_result, player_result, stats_result]

    result = await score_and_persist_gameweek_lineup(session, 42)

    assert result.raw_points == 17
    assert result.total_points == 24
    assert lineup.gameweek_points == 24
    session.flush.assert_awaited_once()


def test_invalid_lineup_is_rejected():
    with pytest.raises(ScoringInputError, match="15 distinct players"):
        score(make_performances(), starters=STARTERS[:-1], bench=BENCH)
