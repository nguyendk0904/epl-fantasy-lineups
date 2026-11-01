#!/usr/bin/env python3
"""P1-Q03 - deterministic demo dataset for local integration testing.

Inserts a small, self-contained Premier-League-like dataset (6 clubs /
36 players) so the whole stack can be exercised without calling the real
FPL API: Backend -> PostgreSQL -> PuLP solver -> REST response.

Every row uses a reserved ID range so real FPL data synced by
``app/services/fpl_sync.py`` is never touched:

    teams   : 9001 - 9006    (FPL uses 1 - 20)
    players : 900001 - 900036 (FPL element ids)

The script is idempotent (upsert on primary key) and safe to re-run.

Usage (from the repo root, with backend requirements installed):
    python scripts/seed_demo_data.py
    python scripts/seed_demo_data.py --clear          # wipe demo rows only
    python scripts/seed_demo_data.py --dry-run        # print plan, no writes
    python scripts/seed_demo_data.py --database-url postgresql+asyncpg://...

Inside the local docker stack (one-off container, no host deps needed):
    docker run --rm --network fpl-local_fpl-network \
        -v "$PWD/backend:/app" -v "$PWD/scripts:/scripts" -w /app \
        fpl-local-backend python /scripts/seed_demo_data.py \
        --database-url postgresql+asyncpg://postgres:postgres@postgres:5432/fantasy_fpl

Exit codes: 0 = success, 1 = database error, 2 = bad arguments.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

# Make "app.*" importable when the script is executed as a plain file.
# Works from the repo root, from backend/ as cwd, or inside a container where
# the backend source is mounted at the current working directory.
_BACKEND_CANDIDATES = (
    Path(__file__).resolve().parents[1] / "backend",
    Path.cwd(),
    Path.cwd() / "backend",
)
for _candidate in _BACKEND_CANDIDATES:
    if (_candidate / "app" / "main.py").is_file():
        if str(_candidate) not in sys.path:
            sys.path.insert(0, str(_candidate))
        break
else:
    print(
        "[seed] Cannot locate the backend 'app' package. Run this script from the "
        "repository root or mount backend/ at the current working directory.",
        file=sys.stderr,
    )
    raise SystemExit(2)

from sqlalchemy import delete, func, select  # noqa: E402
from sqlalchemy.dialects.postgresql import insert as pg_insert  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.models import Player, Team  # noqa: E402

DEMO_TEAM_ID_BASE = 9000
DEMO_PLAYER_ID_BASE = 900_000

# (club name, short name, strength) - short_name is VARCHAR(5) per SSOT.
DEMO_CLUBS: tuple[tuple[str, str, int], ...] = (
    ("Demo United", "DMO", 4),
    ("Demo City", "DMC", 5),
    ("Demo Rovers", "DMR", 3),
    ("Demo Athletic", "DMA", 3),
    ("Demo Wanderers", "DMW", 2),
    ("Demo Town", "DMT", 2),
)

# FPL squad composition (2 GKP / 5 DEF / 5 MID / 3 FWD) is reachable from
# this blueprint: 6 GKP, 12 DEF, 12 MID, 6 FWD across 6 different clubs.
# The cheapest legal squad costs ~£77.5m, comfortably inside the £100m cap.
POSITION_BLUEPRINT: dict[str, dict[str, str | int]] = {
    "GKP": {
        "slots": 1,
        "cost_base": "4.0",
        "cost_club_step": "0.2",
        "cost_slot_step": "0.0",
        "xp_base": "3.0",
        "xp_club_step": "0.05",
        "xp_slot_step": "0.0",
    },
    "DEF": {
        "slots": 2,
        "cost_base": "4.0",
        "cost_club_step": "0.2",
        "cost_slot_step": "0.5",
        "xp_base": "3.5",
        "xp_club_step": "0.05",
        "xp_slot_step": "0.4",
    },
    "MID": {
        "slots": 2,
        "cost_base": "6.0",
        "cost_club_step": "0.3",
        "cost_slot_step": "0.5",
        "xp_base": "5.0",
        "xp_club_step": "0.1",
        "xp_slot_step": "0.5",
    },
    "FWD": {
        "slots": 1,
        "cost_base": "6.5",
        "cost_club_step": "0.4",
        "cost_slot_step": "0.0",
        "xp_base": "5.5",
        "xp_club_step": "0.1",
        "xp_slot_step": "0.0",
    },
}


def _one_decimal(value: Decimal) -> Decimal:
    """Round to the NUMERIC(x, 1) precision used by the players table."""
    return value.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def build_demo_rows() -> tuple[list[dict], list[dict]]:
    """Return (team rows, player rows) with fully deterministic values."""
    teams: list[dict] = []
    players: list[dict] = []
    player_id = DEMO_PLAYER_ID_BASE

    for club_index, (name, short_name, strength) in enumerate(DEMO_CLUBS):
        team_id = DEMO_TEAM_ID_BASE + club_index + 1
        teams.append(
            {
                "id": team_id,
                "name": name,
                "short_name": short_name,
                "strength": strength,
                "strength_attack_home": min(5, strength + 1),
                "strength_attack_away": max(1, strength - 1),
                "strength_defence_home": max(1, strength - 1),
                "strength_defence_away": min(5, strength + 1),
            }
        )

        for position, blueprint in POSITION_BLUEPRINT.items():
            for slot in range(1, int(blueprint["slots"]) + 1):
                player_id += 1
                cost = _one_decimal(
                    Decimal(str(blueprint["cost_base"]))
                    + Decimal(str(blueprint["cost_club_step"])) * club_index
                    + Decimal(str(blueprint["cost_slot_step"])) * (slot - 1)
                )
                xp = _one_decimal(
                    Decimal(str(blueprint["xp_base"]))
                    + Decimal(str(blueprint["xp_club_step"])) * club_index
                    + Decimal(str(blueprint["xp_slot_step"])) * (slot - 1)
                )
                players.append(
                    {
                        "id": player_id,
                        "first_name": "Demo",
                        "second_name": f"{short_name} {position}{slot}",
                        "web_name": f"{short_name} {position}{slot}",
                        "team_id": team_id,
                        "element_type": position,
                        "now_cost": cost,
                        "status": "a",
                        "news": None,
                        "total_points": int(xp * 15),
                        "form": xp,
                        "selected_by_percent": _one_decimal(
                            Decimal("5.0") + Decimal(club_index)
                        ),
                        "expected_goals": Decimal("0.10"),
                        "expected_assists": Decimal("0.10"),
                        "ict_index": xp,
                        "expected_points_next": xp,
                    }
                )

    return teams, players


def _summarize(teams: list[dict], players: list[dict]) -> str:
    counts = {position: 0 for position in POSITION_BLUEPRINT}
    for player in players:
        counts[player["element_type"]] += 1
    team_ids = [team["id"] for team in teams]
    player_ids = [player["id"] for player in players]
    composition = " / ".join(
        f"{position} {counts[position]}" for position in POSITION_BLUEPRINT
    )
    return (
        f"teams={len(teams)} (ids {min(team_ids)}-{max(team_ids)}), "
        f"players={len(players)} (ids {min(player_ids)}-{max(player_ids)}), "
        f"{composition}"
    )


async def _upsert(session, table, rows: list[dict]) -> None:
    """Chunked upsert on the primary key (same pattern as fpl_sync)."""
    for offset in range(0, len(rows), 500):
        statement = pg_insert(table).values(rows[offset : offset + 500])
        statement = statement.on_conflict_do_update(
            index_elements=[table.c.id],
            set_={key: statement.excluded[key] for key in rows[0] if key != "id"},
        )
        await session.execute(statement)


async def _count_demo_rows(session) -> dict[str, object]:
    teams_total = await session.scalar(
        select(func.count(Team.id)).where(Team.id > DEMO_TEAM_ID_BASE)
    )
    player_rows = await session.execute(
        select(Player.element_type, func.count(Player.id))
        .where(Player.id >= DEMO_PLAYER_ID_BASE)
        .group_by(Player.element_type)
    )
    by_position = {position: count for position, count in player_rows.all()}
    return {
        "teams": int(teams_total or 0),
        "players": sum(by_position.values()),
        "by_position": by_position,
    }


async def seed_demo_data(database_url: str, *, clear: bool) -> int:
    teams, players = build_demo_rows()
    engine = create_async_engine(database_url, echo=False, future=True)
    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            async with session.begin():
                if clear:
                    await session.execute(
                        delete(Player).where(Player.id >= DEMO_PLAYER_ID_BASE)
                    )
                    await session.execute(delete(Team).where(Team.id > DEMO_TEAM_ID_BASE))
                # Teams first: players.team_id is a foreign key.
                await _upsert(session, Team.__table__, teams)
                await _upsert(session, Player.__table__, players)

        async with session_factory() as session:
            stored = await _count_demo_rows(session)
    except SQLAlchemyError as exc:
        print(f"[seed] Database error: {exc.__class__.__name__}: {exc}", file=sys.stderr)
        print(
            "[seed] Is PostgreSQL running and migrated (alembic upgrade head)? "
            "docker compose -f infra/docker-compose.yml up -d postgres",
            file=sys.stderr,
        )
        return 1
    except OSError as exc:
        print(f"[seed] Cannot reach the database: {exc}", file=sys.stderr)
        return 1
    finally:
        await engine.dispose()

    if clear:
        print("[seed] Demo rows cleared before reseeding.")
    print(f"[seed] Seeded {_summarize(teams, players)}")
    print(
        "[seed] Verified in database: "
        f"teams={stored['teams']}, players={stored['players']}, "
        f"composition={stored['by_position']}"
    )
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="seed_demo_data.py",
        description="Seed the local PostgreSQL database with demo FPL data (P1-Q03).",
    )
    parser.add_argument(
        "--database-url",
        default=settings.DATABASE_URL,
        help=(
            "SQLAlchemy async URL (default: DATABASE_URL env var or the backend "
            f"default {settings.DATABASE_URL})."
        ),
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Delete the demo rows (reserved ID ranges only) before re-seeding.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be written without touching the database.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    teams, players = build_demo_rows()
    if args.dry_run:
        print(f"[seed] (dry-run) {_summarize(teams, players)}")
        return 0
    return asyncio.run(seed_demo_data(args.database_url, clear=args.clear))


if __name__ == "__main__":
    raise SystemExit(main())
