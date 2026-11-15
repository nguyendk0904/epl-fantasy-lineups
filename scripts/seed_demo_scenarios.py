#!/usr/bin/env python3
"""Seed three reproducible lineup-comparison demos using reserved demo IDs.

Run from the repository root after applying database migrations:
    python scripts/seed_demo_scenarios.py --dry-run
    python scripts/seed_demo_scenarios.py

The write mode upserts the isolated demo players from ``seed_demo_data.py`` and
six shared-lineup snapshots. It never deletes rows and never touches FPL IDs.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections import Counter
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
for path in (REPO_ROOT, BACKEND_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from scripts.seed_demo_data import (  # noqa: E402
    DEMO_PLAYER_ID_BASE,
    build_demo_rows,
    seed_demo_data,
)

POSITIONS = {"GKP": 2, "DEF": 5, "MID": 5, "FWD": 3}
STARTING_COUNTS = {"GKP": 1, "DEF": 3, "MID": 4, "FWD": 3}
SCENARIO_NAMES = {
    "stars_vs_value": "Siêu sao xP vs Cân bằng giá trị",
    "attack_vs_defense": "Ưu tiên tấn công vs Ưu tiên phòng thủ",
    "budget_vs_premium": "Đội hình tiết kiệm vs Đội hình cao cấp",
}
SHARE_CODES = {
    "stars": "P3S001",
    "value": "P3S002",
    "attack": "P3S003",
    "defense": "P3S004",
    "budget": "P3S005",
    "premium": "P3S006",
}


def _rank(player: dict, style: str) -> tuple[float, float, int]:
    cost = float(player["now_cost"])
    xp = float(player["expected_points_next"])
    element_type = player["element_type"]
    if style in {"stars", "premium"}:
        score = xp
        tie_break = -cost
    elif style == "value":
        score = xp / cost
        tie_break = -cost
    elif style == "budget":
        score = -cost
        tie_break = xp
    elif style == "attack":
        # Spend on attackers and pick value options in defense.
        score = xp if element_type in {"MID", "FWD"} else -cost
        tie_break = xp
    elif style == "defense":
        # Spend on the goalkeeper and defenders, save in midfield/attack.
        score = xp if element_type in {"GKP", "DEF"} else -cost
        tie_break = xp
    else:
        raise ValueError(f"Unknown lineup style: {style}")
    return (-score, tie_break, int(player["id"]))


def _build_squad(players: list[dict], style: str) -> list[dict]:
    selected: list[dict] = []
    club_counts: Counter[int] = Counter()
    for position, required in POSITIONS.items():
        available = sorted(
            (player for player in players if player["element_type"] == position),
            key=lambda player: _rank(player, style),
        )
        for player in available:
            team_id = int(player["team_id"])
            if club_counts[team_id] >= 3:
                continue
            selected.append(player)
            club_counts[team_id] += 1
            if sum(p["element_type"] == position for p in selected) == required:
                break

    validate_squad(selected)
    return selected


def validate_squad(players: list[dict]) -> None:
    """Raise ValueError unless a demo squad obeys the shared FPL constraints."""
    if len(players) != 15 or len({int(player["id"]) for player in players}) != 15:
        raise ValueError("Each demo lineup must contain 15 distinct players.")
    if Counter(player["element_type"] for player in players) != Counter(POSITIONS):
        raise ValueError("Demo lineup must contain 2 GKP, 5 DEF, 5 MID and 3 FWD.")
    if max(Counter(int(p["team_id"]) for p in players).values()) > 3:
        raise ValueError("Demo lineup exceeds the three-player club limit.")
    if sum(float(player["now_cost"]) for player in players) > 100.0:
        raise ValueError("Demo lineup exceeds the £100m budget.")


def _snapshot(name: str, players: list[dict]) -> dict:
    starters: list[dict] = []
    for position, count in STARTING_COUNTS.items():
        starters.extend(
            sorted(
                (p for p in players if p["element_type"] == position),
                key=lambda p: (-float(p["expected_points_next"]), int(p["id"])),
            )[:count]
        )
    starting_ids = [int(player["id"]) for player in starters]
    bench = [player for player in players if int(player["id"]) not in set(starting_ids)]
    captain = max(starters, key=lambda p: (float(p["expected_points_next"]), -int(p["id"])))
    vice_captain = max(
        (p for p in starters if p["id"] != captain["id"]),
        key=lambda p: (float(p["expected_points_next"]), -int(p["id"])),
    )
    total_cost = sum((Decimal(str(player["now_cost"])) for player in players), Decimal(0))
    predicted_points = sum(
        (Decimal(str(player["expected_points_next"])) for player in starters), Decimal(0)
    ) + Decimal(str(captain["expected_points_next"]))
    serialized_players = [
        {
            "id": int(player["id"]),
            "web_name": player["web_name"],
            "team_id": int(player["team_id"]),
            "team_short_name": player["web_name"].split()[0],
            "element_type": player["element_type"],
            "now_cost": float(player["now_cost"]),
            "total_points": int(player["total_points"]),
            "form": float(player["form"]),
            "status": player["status"],
            "expected_points_next": float(player["expected_points_next"]),
        }
        for player in players
    ]
    formation = "3-4-3"
    return {
        "lineup_name": name,
        "total_cost": total_cost,
        "predicted_points": predicted_points,
        "starting_player_ids": starting_ids,
        "bench_player_ids": [int(player["id"]) for player in bench],
        "captain_id": int(captain["id"]),
        "vice_captain_id": int(vice_captain["id"]),
        "player_data": {
            "starting_player_ids": starting_ids,
            "bench_player_ids": [int(player["id"]) for player in bench],
            "formation": formation,
            "captain_id": int(captain["id"]),
            "vice_captain_id": int(vice_captain["id"]),
            "players": serialized_players,
        },
    }


def build_demo_scenarios() -> list[dict]:
    """Build three deterministic comparison scenarios from the reserved sample."""
    _, players = build_demo_rows()
    squads = {style: _build_squad(players, style) for style in SHARE_CODES}
    pairs = (
        ("stars_vs_value", "stars", "value"),
        ("attack_vs_defense", "attack", "defense"),
        ("budget_vs_premium", "budget", "premium"),
    )
    scenarios = []
    for scenario_id, side_a, side_b in pairs:
        squad_a, squad_b = squads[side_a], squads[side_b]
        snapshots = {
            "a": _snapshot(f"{SCENARIO_NAMES[scenario_id]} - A", squad_a),
            "b": _snapshot(f"{SCENARIO_NAMES[scenario_id]} - B", squad_b),
        }
        scenarios.append(
            {
                "id": scenario_id,
                "title": SCENARIO_NAMES[scenario_id],
                "share_codes": {"a": SHARE_CODES[side_a], "b": SHARE_CODES[side_b]},
                "comparison_request": {
                    "lineup_a_player_ids": snapshots["a"]["starting_player_ids"]
                    + snapshots["a"]["bench_player_ids"],
                    "lineup_b_player_ids": snapshots["b"]["starting_player_ids"]
                    + snapshots["b"]["bench_player_ids"],
                },
                "lineups": snapshots,
            }
        )
    return scenarios


def validate_scenarios(scenarios: list[dict]) -> None:
    if len(scenarios) != 3:
        raise ValueError("Exactly three demo scenarios are required.")
    for scenario in scenarios:
        request = scenario["comparison_request"]
        for side in ("a", "b"):
            ids = request[f"lineup_{side}_player_ids"]
            if len(ids) != 15 or len(set(ids)) != 15:
                raise ValueError(f"Scenario {scenario['id']} lineup {side.upper()} is invalid.")
        if not set(request["lineup_a_player_ids"]) & set(request["lineup_b_player_ids"]):
            # All comparisons should show a mix of common players and differentials.
            raise ValueError(f"Scenario {scenario['id']} should include common players.")


async def seed_scenario_snapshots(database_url: str, scenarios: list[dict]) -> None:
    from sqlalchemy.dialects.postgresql import insert
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.models.shared_lineup import SharedLineup

    engine = create_async_engine(database_url, echo=False)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session, session.begin():
            for scenario in scenarios:
                for side in ("a", "b"):
                    code = scenario["share_codes"][side]
                    snapshot = scenario["lineups"][side]
                    values = {
                        "id": uuid4(),
                        "share_code": code,
                        "lineup_name": snapshot["lineup_name"],
                        "total_cost": snapshot["total_cost"],
                        "predicted_points": snapshot["predicted_points"],
                        "player_data": snapshot["player_data"],
                    }
                    statement = insert(SharedLineup).values(**values)
                    statement = statement.on_conflict_do_update(
                        index_elements=[SharedLineup.share_code],
                        set_={key: value for key, value in values.items() if key != "id"},
                    )
                    await session.execute(statement)
        expected_codes = {
            code for scenario in scenarios for code in scenario["share_codes"].values()
        }
        async with factory() as session:
            result = await session.execute(
                select(SharedLineup.share_code).where(
                    SharedLineup.share_code.in_(expected_codes)
                )
            )
            stored_codes = set(result.scalars().all())
        missing_codes = expected_codes - stored_codes
        if missing_codes:
            raise RuntimeError(f"Demo snapshots missing after seed: {sorted(missing_codes)}")
    finally:
        await engine.dispose()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    from app.core.config import settings

    parser = argparse.ArgumentParser(description="Seed three safe FPL lineup comparison demos.")
    parser.add_argument("--database-url", default=settings.DATABASE_URL)
    parser.add_argument("--dry-run", action="store_true", help="Validate and print payloads without DB writes.")
    return parser.parse_args(argv)


async def run_seed(database_url: str, scenarios: list[dict]) -> int:
    if await seed_demo_data(database_url, clear=False) != 0:
        return 1
    await seed_scenario_snapshots(database_url, scenarios)
    print("[demo] Verified six shared lineup snapshots; seeded rows use reserved IDs 900001+.")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    scenarios = build_demo_scenarios()
    validate_scenarios(scenarios)
    if args.dry_run:
        print(json.dumps(scenarios, indent=2, ensure_ascii=True, default=str))
        print("[demo] Dry-run: scenario payloads valid; no database writes performed.")
        return 0
    return asyncio.run(run_seed(args.database_url, scenarios))


if __name__ == "__main__":
    raise SystemExit(main())
