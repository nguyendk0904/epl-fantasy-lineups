#!/usr/bin/env python3
"""P4-Q03 - Seed finished mock fixtures and player statistics for a gameweek.

This utility creates finished Premier League fixtures and corresponding
player statistics (`player_gameweek_stats`) for testing the Gameweek lifecycle,
scoring engine, and leaderboard updates without depending on external FPL APIs.

Every fixture is created with ``finished=True`` and complete stat rows so that
`gameweek_service.score_completed_gameweek()` criteria are 100% satisfied.

Usage:
    python scripts/seed_mock_fixtures.py --gameweek 2
    python scripts/seed_mock_fixtures.py --gameweek 2 --clear
    python scripts/seed_mock_fixtures.py --gameweek 2 --dry-run
"""

from __future__ import annotations

import os
import subprocess
import sys

# Self-healing bootstrap: if executed under an environment where asyncio DLLs are
# blocked by Windows AppLocker/WDAC (e.g. msys64 python3.14), hand off to Python 3.13.
if ("msys" in sys.executable.lower() or sys.version_info >= (3, 14)) and sys.platform == "win32":
    for _py_candidate in [
        r"C:\Users\Quang\AppData\Local\Programs\Python\Python313\python.exe",
        r"C:\Users\Quang\AppData\Local\Programs\Python\Launcher\py.exe",
    ]:
        if os.path.isfile(_py_candidate):
            _cmd = [_py_candidate]
            if "py.exe" in _py_candidate.lower():
                _cmd.append("-3.13")
            _cmd.extend(sys.argv)
            sys.exit(subprocess.call(_cmd))

import argparse
import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure backend and repo root are importable
_REPO_ROOT = Path(__file__).resolve().parents[1]
_BACKEND_ROOT = _REPO_ROOT / "backend"
_SCRIPTS_ROOT = _REPO_ROOT / "scripts"
for _path in (_REPO_ROOT, _BACKEND_ROOT, _SCRIPTS_ROOT):
    _path_str = str(_path)
    if _path_str not in sys.path:
        sys.path.insert(0, _path_str)

from sqlalchemy import delete, func, select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.models import Fixture, Player, PlayerGameweekStat, Team  # noqa: E402


MOCK_FIXTURE_ID_BASE = 90_000


async def seed_mock_fixtures(
    session_factory: async_sessionmaker[AsyncSession],
    gameweek: int = 2,
    *,
    custom_player_stats: dict[int, dict] | None = None,
    finished: bool = True,
    kickoff_time: datetime | None = None,
) -> dict[str, int]:
    """Seed finished fixtures and matching player stats for a gameweek.

    Args:
        session_factory: SQLAlchemy async session factory.
        gameweek: Target gameweek number (1-38).
        custom_player_stats: Optional mapping of player_id -> dict of stat fields
            (e.g., {"minutes": 90, "goals": 2, "total_points": 12}).
        finished: Whether fixtures should be marked finished (default: True).
        kickoff_time: Kickoff datetime (default: 2 days in the past).

    Returns:
        dict with counts of created fixtures and player stats.
    """
    if kickoff_time is None:
        kickoff_time = datetime.now(timezone.utc) - timedelta(days=2)
    custom_stats = custom_player_stats or {}

    async with session_factory() as db:
        async with db.begin():
            # 1. Query available clubs and players
            teams = (await db.scalars(select(Team).order_by(Team.id))).all()
            if len(teams) < 2:
                # Create minimal teams if database is empty
                minimal_teams = [
                    Team(id=i, name=f"Mock Club {i}", short_name=f"MC{i}", strength=3)
                    for i in range(1, 7)
                ]
                db.add_all(minimal_teams)
                await db.flush()
                teams = minimal_teams

            team_ids = [t.id for t in teams]

            # 2. Build paired fixtures for the gameweek
            # e.g., (team 0 vs 1), (team 2 vs 3), (team 4 vs 5)
            created_fixtures: list[Fixture] = []
            fixture_base = MOCK_FIXTURE_ID_BASE + (gameweek * 100)

            for idx in range(0, len(team_ids) - 1, 2):
                h_id = team_ids[idx]
                a_id = team_ids[idx + 1]
                fix_id = fixture_base + (idx // 2) + 1

                # Check if fixture already exists
                existing = await db.get(Fixture, fix_id)
                if existing is not None:
                    existing.gameweek = gameweek
                    existing.team_h = h_id
                    existing.team_a = a_id
                    existing.team_h_score = 2
                    existing.team_a_score = 1
                    existing.team_h_difficulty = 3
                    existing.team_a_difficulty = 3
                    existing.kickoff_time = kickoff_time
                    existing.finished = finished
                    created_fixtures.append(existing)
                else:
                    fixture = Fixture(
                        id=fix_id,
                        gameweek=gameweek,
                        team_h=h_id,
                        team_a=a_id,
                        team_h_score=2,
                        team_a_score=1,
                        team_h_difficulty=3,
                        team_a_difficulty=3,
                        kickoff_time=kickoff_time,
                        finished=finished,
                    )
                    db.add(fixture)
                    created_fixtures.append(fixture)

            await db.flush()

            # Map each team to its assigned fixture ID
            team_to_fixture: dict[int, int] = {}
            for fix in created_fixtures:
                team_to_fixture[fix.team_h] = fix.id
                team_to_fixture[fix.team_a] = fix.id

            # 3. Create player gameweek stats for all participating players
            players = (await db.scalars(select(Player))).all()
            created_stats_count = 0

            # Delete existing stats for this gameweek to ensure idempotency
            await db.execute(
                delete(PlayerGameweekStat).where(PlayerGameweekStat.gameweek == gameweek)
            )
            await db.flush()

            # Track which fixtures have at least one stat row
            fixtures_covered: set[int] = set()

            for player in players:
                # Find matching fixture for this player's team
                fix_id = team_to_fixture.get(player.team_id)
                if fix_id is None:
                    # If player's team is not in paired fixtures, fallback to first fixture
                    fix_id = created_fixtures[0].id

                fixtures_covered.add(fix_id)

                if player.id in custom_stats:
                    cfg = custom_stats[player.id]
                    minutes = cfg.get("minutes", 90)
                    goals = cfg.get("goals", 0)
                    assists = cfg.get("assists", 0)
                    clean_sheets = cfg.get("clean_sheets", 1 if minutes >= 60 and player.element_type in ("GKP", "DEF") else 0)
                    goals_conceded = cfg.get("goals_conceded", 0)
                    yellow_cards = cfg.get("yellow_cards", 0)
                    red_cards = cfg.get("red_cards", 0)
                    saves = cfg.get("saves", 3 if player.element_type == "GKP" else 0)
                    bonus_points = cfg.get("bonus_points", 0)
                    total_points = cfg.get("total_points", 2)
                else:
                    # Default baseline performance: played 90 minutes, baseline 2 pts
                    minutes = 90
                    goals = 0
                    assists = 0
                    clean_sheets = 0
                    goals_conceded = 1
                    yellow_cards = 0
                    red_cards = 0
                    saves = 2 if player.element_type == "GKP" else 0
                    bonus_points = 0
                    total_points = 2

                stat = PlayerGameweekStat(
                    player_id=player.id,
                    fixture_id=fix_id,
                    gameweek=gameweek,
                    minutes=minutes,
                    goals=goals,
                    assists=assists,
                    clean_sheets=clean_sheets,
                    goals_conceded=goals_conceded,
                    yellow_cards=yellow_cards,
                    red_cards=red_cards,
                    saves=saves,
                    bonus_points=bonus_points,
                    total_points=total_points,
                )
                db.add(stat)
                created_stats_count += 1

            # Ensure every single fixture has at least one stat row
            # (Satisfies represented == {f.id for f in fixtures} in scoring_engine)
            for fix in created_fixtures:
                if fix.id not in fixtures_covered and players:
                    sample_player = players[0]
                    dummy_stat = PlayerGameweekStat(
                        player_id=sample_player.id,
                        fixture_id=fix.id,
                        gameweek=gameweek,
                        minutes=90,
                        goals=0,
                        assists=0,
                        clean_sheets=0,
                        goals_conceded=1,
                        yellow_cards=0,
                        red_cards=0,
                        saves=0,
                        bonus_points=0,
                        total_points=2,
                    )
                    db.add(dummy_stat)
                    created_stats_count += 1

            await db.flush()

    return {
        "gameweek": gameweek,
        "fixtures_count": len(created_fixtures),
        "stats_count": created_stats_count,
    }


async def clear_mock_fixtures(
    session_factory: async_sessionmaker[AsyncSession],
    gameweek: int = 2,
) -> dict[str, int]:
    """Delete seeded mock fixtures and player stats for a gameweek."""
    fixture_min = MOCK_FIXTURE_ID_BASE + (gameweek * 100)
    fixture_max = fixture_min + 99

    async with session_factory() as db:
        async with db.begin():
            stats_del = await db.execute(
                delete(PlayerGameweekStat).where(PlayerGameweekStat.gameweek == gameweek)
            )
            fix_del = await db.execute(
                delete(Fixture).where(
                    Fixture.gameweek == gameweek,
                    Fixture.id >= fixture_min,
                    Fixture.id <= fixture_max,
                )
            )
            return {
                "deleted_stats": stats_del.rowcount or 0,
                "deleted_fixtures": fix_del.rowcount or 0,
            }


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Seed mock fixtures and match stats for a gameweek")
    parser.add_argument("--gameweek", type=int, default=2, help="Gameweek number (1-38)")
    parser.add_argument("--clear", action="store_true", help="Clear seeded mock data for gameweek")
    parser.add_argument("--dry-run", action="store_true", help="Print plan without modifying database")
    parser.add_argument("--database-url", type=str, default=None, help="Database connection URL")
    args = parser.parse_args()

    db_url = args.database_url or settings.DATABASE_URL
    print(f"[seed_mock_fixtures] Target Gameweek: {args.gameweek}")
    print(f"[seed_mock_fixtures] Database URL: {db_url}")

    if args.dry_run:
        print("[seed_mock_fixtures] DRY-RUN MODE: No database changes will be made.")
        return

    engine = create_async_engine(db_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        if args.clear:
            res = await clear_mock_fixtures(factory, gameweek=args.gameweek)
            print(f"[seed_mock_fixtures] Cleared gameweek {args.gameweek}: "
                  f"{res['deleted_fixtures']} fixtures, {res['deleted_stats']} stats.")
        else:
            res = await seed_mock_fixtures(factory, gameweek=args.gameweek)
            print(f"[seed_mock_fixtures] Successfully seeded gameweek {args.gameweek}: "
                  f"{res['fixtures_count']} fixtures, {res['stats_count']} player stats.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(_main())
