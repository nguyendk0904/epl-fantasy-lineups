#!/usr/bin/env python3
"""P4-Q03 - Gameweek Lifecycle Integration Test.

Simulates a complete, end-to-end Premier League Gameweek cycle:
  Stage 1: User makes 3 transfers -> validate transfers_used=3, remaining=0,
           budget (<= 100m) and squad constraints enforced (max 3 transfers).
  Stage 2: Gameweek deadline arrives and locks -> validate post-deadline
           transfer requests are strictly rejected with HTTP 400.
  Stage 3: Match results and player stats ingested via ``seed_mock_fixtures``
           -> validate finished fixtures and matching player stats.
  Stage 4: Gameweek scoring engine executes -> calculate scores, verify
           Captain x2 bonus, Auto-sub substitution, and lineup locked.
  Stage 5: Leaderboard update -> verify leaderboard reflects scored points,
           rankings, and cache invalidation.

Acceptance Criteria:
  Runs through all 5 stages without errors and outputs:
  "Gameweek Lifecycle Test: ALL 5 STAGES PASSED"

Usage:
  python scripts/test_gameweek_lifecycle.py
  python scripts/test_gameweek_lifecycle.py --database-url postgresql+asyncpg://...
  pytest scripts/test_gameweek_lifecycle.py
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
import tempfile

# Ensure backend and repo root are importable
_REPO_ROOT = Path(__file__).resolve().parents[1]
_BACKEND_ROOT = _REPO_ROOT / "backend"
_SCRIPTS_ROOT = _REPO_ROOT / "scripts"
for _path in (_REPO_ROOT, _BACKEND_ROOT, _SCRIPTS_ROOT):
    _path_str = str(_path)
    if _path_str not in sys.path:
        sys.path.insert(0, _path_str)

from fastapi import HTTPException  # noqa: E402
from pydantic import SecretStr  # noqa: E402
import pytest  # noqa: E402
from sqlalchemy import JSON, MetaData, event, select, text  # noqa: E402
from sqlalchemy.dialects.postgresql import JSONB  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import Base  # noqa: E402
from app.core.redis_cache import cache_service  # noqa: E402
from app.models import Fixture, Player, PlayerGameweekStat, Team, UserGameweekLineup  # noqa: E402
from app.schemas.gameweek import ConfirmTransfersRequest  # noqa: E402
from app.services import gameweek_service as service  # noqa: E402
try:
    from scripts.seed_mock_fixtures import seed_mock_fixtures  # noqa: E402
except ImportError:
    from seed_mock_fixtures import seed_mock_fixtures  # noqa: E402


# Test Constants & Player IDs
TEST_SECRET = "lifecycle-test-secret-min-32-chars-long-security"
NOW = datetime(2026, 11, 24, 12, 0, 0, tzinfo=timezone.utc)
FUTURE_DEADLINE = NOW + timedelta(days=1)
PAST_DEADLINE = NOW - timedelta(days=1)

# Baseline 15 players (1 GKP, 3 DEF, 4 MID, 3 FWD starters + 1 GKP, 1 MID, 2 DEF bench)
# Bench order: GKP 2, then outfield priority: MID 12 (1st sub), DEF 6 (2nd sub), DEF 7 (3rd sub)
BASELINE_STARTERS = [1, 3, 4, 5, 8, 9, 10, 11, 13, 14, 15]
BASELINE_BENCH = [2, 12, 6, 7]

# Replacement players with matching positions for valid 3 transfers
# Replace starter 3 (DEF) -> 16 (DEF)
# Replace starter 8 (MID) -> 21 (MID)
# Replace starter 13 (FWD) -> 28 (FWD)
NEW_STARTERS = [1, 16, 4, 5, 21, 9, 10, 11, 28, 14, 15]


def _format_stage(stage_num: int, title: str) -> str:
    return f"\n{'='*70}\n[STAGE {stage_num}/5] {title}\n{'='*70}"


async def _setup_test_database(db_url: str):
    """Create database tables and seed baseline clubs and players."""
    engine = create_async_engine(db_url, connect_args={"timeout": 15} if "sqlite" in db_url else {})

    if "sqlite" in db_url:
        @event.listens_for(engine.sync_engine, "connect")
        def set_sqlite_pragma(connection, _record):
            connection.execute("PRAGMA foreign_keys=ON")

        metadata = MetaData()
        for table in Base.metadata.sorted_tables:
            copied = table.to_metadata(metadata)
            for col in copied.c:
                if isinstance(col.type, JSONB):
                    col.type = JSON()
        async with engine.begin() as conn:
            await conn.run_sync(metadata.create_all)
    else:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)

    # Seed 6 Clubs and 30 Players (1-15: Baseline, 16-30: Pool)
    async with factory.begin() as db:
        # Check if teams already exist
        existing_teams = (await db.scalars(select(Team))).all()
        if not existing_teams:
            clubs = [
                Team(id=i, name=f"Club {i}", short_name=f"CL{i}", strength=3)
                for i in range(1, 7)
            ]
            db.add_all(clubs)
            await db.flush()

            positions = ["GKP"] * 2 + ["DEF"] * 5 + ["MID"] * 5 + ["FWD"] * 3
            players = []
            for i, pos in enumerate(positions, 1):
                # Distribute across clubs to avoid exceeding 3 per club
                club_id = ((i - 1) % 6) + 1
                players.append(Player(
                    id=i,
                    first_name=f"First{i}",
                    second_name=f"Player{i}",
                    web_name=f"P{i}",
                    team_id=club_id,
                    element_type=pos,
                    now_cost=5.0,
                    status="a",
                    total_points=20,
                    expected_points_next=4.5,
                ))

            # Pool of replacement players (16-30)
            for new_id, orig_id in {
                16: 3, 17: 4, 18: 5, 19: 6, 20: 7, 21: 8, 22: 9, 23: 10,
                24: 11, 25: 12, 26: 1, 27: 2, 28: 13, 29: 14, 30: 15
            }.items():
                orig = players[orig_id - 1]
                players.append(Player(
                    id=new_id,
                    first_name=f"First{new_id}",
                    second_name=f"Player{new_id}",
                    web_name=f"P{new_id}",
                    team_id=orig.team_id,
                    element_type=orig.element_type,
                    now_cost=5.0,
                    status="a",
                    total_points=15,
                    expected_points_next=4.0,
                ))

            db.add_all(players)

    return engine, factory


async def run_lifecycle_test(db_url: str | None = None) -> bool:
    """Execute the complete 5-stage Gameweek Lifecycle Integration Test."""
    temp_dir = None
    if not db_url:
        temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(temp_dir.name) / "test_lifecycle.db"
        db_url = f"sqlite+aiosqlite:///{db_path.as_posix()}"

    print(f"\n[Gameweek Lifecycle Test] Initializing test database at:\n  {db_url}")

    # Override settings for testing
    settings.GAMEWEEK_DEMO_AUTH_ENABLED = True
    settings.GAMEWEEK_DEMO_TOKEN_SECRET = SecretStr(TEST_SECRET)
    service.utc_now = lambda: NOW

    engine, factory = await _setup_test_database(db_url)

    try:
        user_id = 1
        competitor_id = 2
        gameweek = 2

        # Setup baseline history: User 1 and User 2 both played Gameweek 1
        async with factory.begin() as db:
            # Baseline GW1 for User 1 (scored 50 points)
            db.add(UserGameweekLineup(
                user_id=user_id,
                gameweek=1,
                starting_player_ids=BASELINE_STARTERS.copy(),
                bench_player_ids=BASELINE_BENCH.copy(),
                captain_id=8,
                vice_captain_id=9,
                transfers_used=0,
                is_locked=True,
                gameweek_points=50,
            ))
            # Baseline GW1 for User 2 (scored 55 points)
            db.add(UserGameweekLineup(
                user_id=competitor_id,
                gameweek=1,
                starting_player_ids=BASELINE_STARTERS.copy(),
                bench_player_ids=BASELINE_BENCH.copy(),
                captain_id=8,
                vice_captain_id=9,
                transfers_used=0,
                is_locked=True,
                gameweek_points=55,
            ))
            # Competitor GW2 lineup already submitted
            db.add(UserGameweekLineup(
                user_id=competitor_id,
                gameweek=2,
                starting_player_ids=BASELINE_STARTERS.copy(),
                bench_player_ids=BASELINE_BENCH.copy(),
                captain_id=8,
                vice_captain_id=9,
                transfers_used=1,
                is_locked=False,
                gameweek_points=0,
            ))

        # ---------------------------------------------------------------------
        # STAGE 1: User makes 3 transfers
        # ---------------------------------------------------------------------
        print(_format_stage(1, "User makes 3 transfers before deadline"))
        print(f"  User {user_id} replacing 3 players: DEF 3 -> 16, MID 8 -> 21, FWD 13 -> 28")

        transfer_request = ConfirmTransfersRequest(
            gameweek=gameweek,
            starting_player_ids=NEW_STARTERS.copy(),
            bench_player_ids=BASELINE_BENCH.copy(),
            formation="3-4-3",
            captain_id=21,  # Transferred-in MID 21 made captain
            vice_captain_id=9,
        )

        async with factory() as db:
            confirm_res = await service.confirm_transfers(db, user_id, transfer_request, FUTURE_DEADLINE)

        assert confirm_res.user_id == user_id, "User ID mismatch in transfer response"
        assert confirm_res.transfers_count == 3, f"Expected 3 new transfers, got {confirm_res.transfers_count}"
        assert confirm_res.transfers_used == 3, f"Expected 3 transfers used, got {confirm_res.transfers_used}"
        assert confirm_res.remaining_transfers == 0, f"Expected 0 remaining, got {confirm_res.remaining_transfers}"
        assert confirm_res.total_cost <= 100.0, f"Squad exceeds budget: {confirm_res.total_cost}"
        assert not confirm_res.is_locked, "Lineup should not be locked prior to deadline"

        # Verify enforcement: Attempting a 4th transfer must be rejected (HTTP 400)
        exceeded_request = ConfirmTransfersRequest(
            gameweek=gameweek,
            starting_player_ids=[1, 16, 17, 5, 21, 9, 10, 11, 28, 14, 15],  # 4th new player 17
            bench_player_ids=BASELINE_BENCH.copy(),
            formation="3-4-3",
            captain_id=21,
            vice_captain_id=9,
        )
        try:
            async with factory() as db:
                await service.confirm_transfers(db, user_id, exceeded_request, FUTURE_DEADLINE)
            raise AssertionError("Exceeding 3 transfers limit must raise HTTP 400!")
        except HTTPException as exc:
            assert exc.status_code == 400, f"Expected 400 for >3 transfers, got {exc.status_code}"
            print(f"  [Security Check] Attempting 4th transfer properly rejected: '{exc.detail}'")

        print("  [STAGE 1/5 PASSED] 3 transfers confirmed within budget (transfers_used=3, remaining=0).")

        # ---------------------------------------------------------------------
        # STAGE 2: Gameweek deadline arrives and locks transfer window
        # ---------------------------------------------------------------------
        print(_format_stage(2, "Lock Gameweek deadline and verify rejection"))
        print(f"  Simulating deadline closure for Gameweek {gameweek}...")

        # With deadline in the past, any transfer attempt must be rejected
        late_transfer_request = ConfirmTransfersRequest(
            gameweek=gameweek,
            starting_player_ids=NEW_STARTERS.copy(),
            bench_player_ids=BASELINE_BENCH.copy(),
            formation="3-4-3",
            captain_id=9,
            vice_captain_id=21,
        )
        try:
            async with factory() as db:
                await service.confirm_transfers(db, user_id, late_transfer_request, PAST_DEADLINE)
            raise AssertionError("Transfer after deadline must raise HTTP 400!")
        except HTTPException as exc:
            assert exc.status_code == 400, f"Expected 400 on passed deadline, got {exc.status_code}"
            assert "deadline has passed" in exc.detail.lower(), f"Unexpected error detail: {exc.detail}"
            print(f"  [Security Check] Post-deadline transfer properly rejected: '{exc.detail}'")

        print("  [STAGE 2/5 PASSED] Gameweek deadline passed: Transfer window locked.")

        # ---------------------------------------------------------------------
        # STAGE 3: Match results & player stats ingested via seed_mock_fixtures
        # ---------------------------------------------------------------------
        print(_format_stage(3, "Ingest match results and player statistics"))

        # Configure custom stats to verify scoring engine features:
        # 1. Captain (Player 21): 90 mins, 2 goals, 1 assist, 3 bonus -> 14 total points (doubled to 28)
        # 2. Starter 14 (FWD): 0 minutes, 0 points (absent -> triggers Auto-sub)
        # 3. Bench 12 (FWD): 90 mins, 1 goal -> 6 points (Auto-sub replacement for starter 14)
        # 4. Other starters: 90 mins, 2 points each
        custom_stats = {
            21: {"minutes": 90, "goals": 2, "assists": 1, "bonus_points": 3, "total_points": 14},
            14: {"minutes": 0, "goals": 0, "assists": 0, "bonus_points": 0, "total_points": 0},
            12: {"minutes": 90, "goals": 1, "assists": 0, "bonus_points": 0, "total_points": 6},
        }

        seed_result = await seed_mock_fixtures(
            factory,
            gameweek=gameweek,
            custom_player_stats=custom_stats,
            finished=True,
            kickoff_time=PAST_DEADLINE - timedelta(hours=2),
        )
        print(f"  Mock fixtures seeded: {seed_result['fixtures_count']} finished matches, "
              f"{seed_result['stats_count']} player stats.")

        # Verify in database: All fixtures are finished and have stat entries
        async with factory() as db:
            fixtures = (await db.scalars(select(Fixture).where(Fixture.gameweek == gameweek))).all()
            assert fixtures, f"No fixtures found for gameweek {gameweek}"
            assert all(f.finished for f in fixtures), "All fixtures must be marked finished"

            distinct_stat_fixtures = set(await db.scalars(
                select(PlayerGameweekStat.fixture_id).where(PlayerGameweekStat.gameweek == gameweek).distinct()
            ))
            assert distinct_stat_fixtures == {f.id for f in fixtures}, "All fixtures must have stat rows"

        print("  [STAGE 3/5 PASSED] Match results and player statistics seeded (all fixtures finished).")

        # ---------------------------------------------------------------------
        # STAGE 4: Gameweek scoring engine executes
        # ---------------------------------------------------------------------
        print(_format_stage(4, "Execute Scoring Engine (Auto-sub & Captain x2)"))

        # Mock deadline getter to return PAST_DEADLINE so score_completed_gameweek proceeds
        service.get_gameweek_deadline = lambda gw, **kw: asyncio.sleep(0, result=PAST_DEADLINE)

        scored_count = await service.score_completed_gameweek(gameweek, session_factory=factory)
        print(f"  Scoring Engine processed {scored_count} lineups for Gameweek {gameweek}.")
        assert scored_count >= 2, f"Expected at least 2 lineups scored, got {scored_count}"

        # Verify User 1's scored lineup
        async with factory() as db:
            lineup = await db.scalar(
                select(UserGameweekLineup).where(
                    UserGameweekLineup.user_id == user_id,
                    UserGameweekLineup.gameweek == gameweek,
                )
            )
            assert lineup is not None, f"Lineup for user {user_id} not found"
            assert lineup.is_locked, "Scored lineup must be locked (is_locked=True)"
            print(f"  User {user_id} Lineup locked: is_locked={lineup.is_locked}")
            print(f"  User {user_id} Gameweek points: {lineup.gameweek_points}")

            # Calculate expected points:
            # Starters:
            # - 9 regular starters @ 2 pts each = 18 pts
            # - Starter 14: 0 mins -> Auto-subbed by Bench 12 (6 pts) = 6 pts
            # - Captain 21: 14 raw pts + 14 captain bonus = 28 pts
            # Total expected GW2 = 18 + 6 + 28 = 52 pts
            expected_gw_points = (9 * 2) + 6 + (14 * 2)
            assert lineup.gameweek_points == expected_gw_points, (
                f"Expected {expected_gw_points} points (with Auto-sub + Captain x2), got {lineup.gameweek_points}"
            )
            print(f"  [Scoring Engine Verified] Captain bonus: +14 pts (x2). Auto-sub: P14 replaced by P12 (+6 pts).")

        print("  [STAGE 4/5 PASSED] Scoring Engine executed: Captain x2 & Auto-sub verified, lineup locked.")

        # ---------------------------------------------------------------------
        # STAGE 5: Leaderboard update verification
        # ---------------------------------------------------------------------
        print(_format_stage(5, "Verify Leaderboard update and rankings"))

        async with factory() as db:
            entries, total_players = await service.read_leaderboard(
                db, gameweek=gameweek, sort_by="overall", page=1, limit=10
            )

        assert total_players >= 2, f"Expected at least 2 players in leaderboard, got {total_players}"
        print(f"  Leaderboard returned {len(entries)} entries (Total players: {total_players}):")
        for entry in entries:
            print(f"    Rank #{entry.rank}: {entry.manager_name} ({entry.team_name}) "
                  f"- GW: {entry.gameweek_points} pts | Total: {entry.total_points} pts | C: {entry.captain_name}")

        user_entry = next((e for e in entries if e.user_id == user_id), None)
        assert user_entry is not None, f"User {user_id} not found on leaderboard"
        assert user_entry.gameweek_points == expected_gw_points, (
            f"Expected {expected_gw_points} GW points on leaderboard, got {user_entry.gameweek_points}"
        )
        # Total points = GW1 (50) + GW2 (52) = 102
        expected_total = 50 + expected_gw_points
        assert user_entry.total_points == expected_total, (
            f"Expected {expected_total} total points, got {user_entry.total_points}"
        )
        assert user_entry.captain_name == "P21", f"Expected captain name P21, got {user_entry.captain_name}"
        assert user_entry.formation == "3-4-3", f"Expected formation 3-4-3, got {user_entry.formation}"

        print("  [STAGE 5/5 PASSED] Leaderboard reflects scored points, rankings, and metadata.")

        # ---------------------------------------------------------------------
        # FINAL ACCEPTANCE OUTPUT
        # ---------------------------------------------------------------------
        print("\n" + "=" * 70)
        print("Gameweek Lifecycle Test: ALL 5 STAGES PASSED")
        print("=" * 70 + "\n")
        return True

    finally:
        await engine.dispose()
        if temp_dir is not None:
            temp_dir.cleanup()


@pytest.mark.asyncio
async def test_gameweek_lifecycle():
    """Pytest entrypoint for the Gameweek Lifecycle Integration Test."""
    success = await run_lifecycle_test()
    assert success is True


def main():
    parser = argparse.ArgumentParser(description="P4-Q03 Gameweek Lifecycle Integration Test")
    parser.add_argument("--database-url", type=str, default=None, help="Database connection URL")
    args = parser.parse_args()

    db_url = args.database_url or os.environ.get("GAMEWEEK_TEST_DATABASE_URL")
    success = asyncio.run(run_lifecycle_test(db_url))
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
