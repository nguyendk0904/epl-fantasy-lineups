from collections import Counter
from dataclasses import replace

import pulp
import pytest

from app.services import transfer_optimizer
from app.services.optimizer_solver import PlayerCandidate
from app.services.transfer_optimizer import optimize_transfers


@pytest.fixture
def squad():
    positions = ["GKP"] * 2 + ["DEF"] * 5 + ["MID"] * 5 + ["FWD"] * 3
    return [PlayerCandidate(i, i % 5 + 1, pos, 5.0, 5.0)
            for i, pos in enumerate(positions, 1)]


def test_injured_player_replaced(squad):
    squad[0] = replace(squad[0], status="i", expected_points_next=20)
    backup = replace(squad[1], id=16, team_id=6, expected_points_next=4)
    result = optimize_transfers(squad, squad + [backup], max_transfers=1)
    assert [(t.out_player_id, t.in_player_id) for t in result.transfers] == [(1, 16)]
    assert result.points_gain == result.transfers[0].points_change == 4


@pytest.mark.parametrize("status", [pulp.LpStatusNotSolved, pulp.LpStatusUndefined,
                                    pulp.LpStatusUnbounded, pulp.LpStatusInfeasible])
def test_solver_status(squad, monkeypatch, status):
    monkeypatch.setattr(transfer_optimizer, "solve_model_with_cbc",
                        lambda model: setattr(model, "status", status))
    if status == pulp.LpStatusInfeasible:
        result = optimize_transfers(squad, squad)
        assert result.new_squad == squad and not result.transfers
    else:
        with pytest.raises(RuntimeError, match=pulp.LpStatus[status]):
            optimize_transfers(squad, squad)


@pytest.mark.parametrize("invalid", ["size", "duplicate", "negative"])
def test_invalid_inputs(squad, invalid):
    current = squad[:-1] if invalid == "size" else squad.copy()
    if invalid == "duplicate":
        current[-1] = current[0]
    with pytest.raises(ValueError):
        optimize_transfers(current, squad, max_transfers=-1 if invalid == "negative" else 1)


def test_team_multipliers_change_best_transfer(squad):
    first = replace(squad[0], id=16, team_id=6, expected_points_next=10)
    second = replace(first, id=17, team_id=7, expected_points_next=9)
    candidates = squad + [first, second]
    assert optimize_transfers(squad, candidates, max_transfers=1).transfers[0].in_player_id == 16
    result = optimize_transfers(squad, candidates, max_transfers=1, xp_multipliers={6: 0.8, 7: 1.2})
    assert result.transfers[0].in_player_id == 17
    assert result.total_expected_points == 80.8
    assert result.points_gain == result.transfers[0].points_change == 5.8


def test_transfers_respect_limits(squad):
    squad[:2] = [replace(p, status="i") for p in squad[:2]]
    backups = [replace(squad[0], id=i, status="a", team_id=team, now_cost=cost,
                       expected_points_next=xp)
               for i, team, cost, xp in [(16, 6, 6, 30), (17, 1, 5, 25),
                                         (18, 6, 5, 12), (19, 7, 5, 10)]]
    result = optimize_transfers(squad, squad + backups, budget=75, max_transfers=1)
    assert len(result.transfers) == 1 and result.transfers[0].in_player_id == 18
    assert sum(p.now_cost for p in result.new_squad) <= 75
    assert max(Counter(p.team_id for p in result.new_squad).values()) <= 3
    assert Counter(p.element_type for p in result.new_squad) == Counter(p.element_type for p in squad)


def _make_player(pid, team, pos, cost, xp, status="a"):
    return PlayerCandidate(
        id=pid,
        team_id=team,
        element_type=pos,
        now_cost=cost,
        expected_points_next=xp,
        status=status,
    )


def test_transfer_optimizer_no_transfer_when_optimal():
    # Build a 15-player squad
    squad = []
    pid = 1
    for pos, count in [("GKP", 2), ("DEF", 5), ("MID", 5), ("FWD", 3)]:
        for _ in range(count):
            squad.append(_make_player(pid, pid % 5 + 1, pos, 5.0, 5.0, "a"))
            pid += 1
    allc = list(squad)
    result = optimize_transfers(squad, allc, budget=100.0, max_transfers=3)
    assert len(result.transfers) == 0
    assert len(result.new_squad) == 15


def test_transfer_optimizer_single_transfer():
    squad = []
    pid = 1
    for pos, count in [("GKP", 2), ("DEF", 5), ("MID", 5), ("FWD", 3)]:
        for _ in range(count):
            squad.append(_make_player(pid, pid % 5 + 1, pos, 5.0, 2.0, "a"))
            pid += 1
    # better candidate same position
    better = _make_player(100, 1, "MID", 5.0, 10.0, "a")
    allc = list(squad) + [better]
    result = optimize_transfers(squad, allc, budget=100.0, max_transfers=1)
    assert len(result.transfers) <= 1
    assert len(result.new_squad) == 15
