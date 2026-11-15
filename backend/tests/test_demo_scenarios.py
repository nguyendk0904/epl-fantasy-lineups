from collections import Counter
from pathlib import Path
import sys
from types import SimpleNamespace

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.api.v1.endpoints.lineups import _calculate_metrics
from scripts.seed_demo_scenarios import (
    SHARE_CODES,
    build_demo_scenarios,
    main,
    validate_scenarios,
)


def test_builds_three_valid_scenario_payloads_from_reserved_demo_ids():
    scenarios = build_demo_scenarios()
    validate_scenarios(scenarios)

    assert [scenario["id"] for scenario in scenarios] == [
        "stars_vs_value",
        "attack_vs_defense",
        "budget_vs_premium",
    ]
    for scenario in scenarios:
        for side in ("a", "b"):
            ids = scenario["comparison_request"][f"lineup_{side}_player_ids"]
            assert len(ids) == len(set(ids)) == 15
            assert min(ids) >= 900001


def test_scenario_generation_is_deterministic():
    assert build_demo_scenarios() == build_demo_scenarios()


def test_seed_snapshots_follow_shared_lineup_contract_and_fpl_limits():
    scenarios = build_demo_scenarios()
    all_codes = [
        code
        for scenario in scenarios
        for code in scenario["share_codes"].values()
    ]

    assert len(all_codes) == len(set(all_codes)) == len(SHARE_CODES)
    for scenario in scenarios:
        for lineup in scenario["lineups"].values():
            players = lineup["player_data"]["players"]
            starters = lineup["starting_player_ids"]
            bench = lineup["bench_player_ids"]
            assert len(players) == 15
            assert len(starters) == 11
            assert len(bench) == 4
            assert set(starters).isdisjoint(bench)
            assert lineup["captain_id"] in starters
            assert lineup["vice_captain_id"] in starters
            assert lineup["captain_id"] != lineup["vice_captain_id"]
            assert sum(player["now_cost"] for player in players) <= 100.0
            assert max(Counter(p["team_id"] for p in players).values()) <= 3


def test_scenarios_show_distinct_xp_and_attack_defense_tradeoffs():
    scenarios = build_demo_scenarios()
    by_id = {scenario["id"]: scenario for scenario in scenarios}

    def metrics(scenario_id, side):
        lineup = by_id[scenario_id]["lineups"][side]
        players_by_id = {
            player["id"]: player for player in lineup["player_data"]["players"]
        }
        return _calculate_metrics(
            [SimpleNamespace(**players_by_id[player_id]) for player_id in lineup["starting_player_ids"] + lineup["bench_player_ids"]]
        )

    stars = metrics("stars_vs_value", "a")
    value = metrics("stars_vs_value", "b")
    attack = metrics("attack_vs_defense", "a")
    defense = metrics("attack_vs_defense", "b")

    assert (stars.total_cost, stars.total_xp, stars.attack_rating, stars.defense_rating) == (
        94.2,
        73.0,
        57,
        52,
    )
    assert (value.total_cost, value.total_xp, value.attack_rating, value.defense_rating) == (
        90.0,
        70.3,
        57,
        48,
    )
    assert (attack.total_cost, attack.total_xp, attack.attack_rating, attack.defense_rating) == (
        91.2,
        71.1,
        58,
        47,
    )
    assert (defense.total_cost, defense.total_xp, defense.attack_rating, defense.defense_rating) == (
        88.8,
        70.3,
        54,
        52,
    )
    assert stars.total_xp > value.total_xp
    assert attack.attack_rating > defense.attack_rating
    assert defense.defense_rating > attack.defense_rating


def test_cli_dry_run_prints_scenarios_without_database_write(capsys):
    assert main(["--dry-run"]) == 0

    output = capsys.readouterr().out
    assert '"stars_vs_value"' in output
    assert '"attack_vs_defense"' in output
    assert '"budget_vs_premium"' in output
    assert "no database writes performed" in output
