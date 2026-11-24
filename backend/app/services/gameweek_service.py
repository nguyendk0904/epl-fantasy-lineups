"""P4-NH04 rules, authoritative deadlines, ranking and explicit scoring handoff.

After NH01/NH02 finish a round: python -m app.services.gameweek_service --score-gameweek 1
No profile/account tables, migration, background scheduler or invented scores.
"""

import argparse
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
import asyncio
import logging

from fastapi import HTTPException
import httpx
from sqlalchemy import and_, case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.redis_cache import cache_service
from app.models import Fixture, Player, PlayerGameweekStat, Team, UserGameweekLineup
from app.schemas.gameweek import ConfirmTransfersRequest, ConfirmTransfersResponse, LeaderboardEntry
from app.services.scoring_engine import score_and_persist_gameweek_lineup


logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def get_gameweek_deadline(gameweek: int, *, client: httpx.AsyncClient | None = None) -> datetime:
    if client is None:
        async with httpx.AsyncClient() as owned:
            return await get_gameweek_deadline(gameweek, client=owned)
    try:
        response = await client.get(settings.FPL_BOOTSTRAP_URL, timeout=10.0)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict) or not isinstance(payload.get("events"), list):
            raise ValueError("Missing events")
        matches = [e for e in payload["events"] if isinstance(e, dict) and type(e.get("id")) is int and e["id"] == gameweek]
        if len(matches) != 1 or not isinstance(matches[0].get("deadline_time"), str):
            raise ValueError("Missing or ambiguous deadline")
        deadline = datetime.fromisoformat(matches[0]["deadline_time"].replace("Z", "+00:00"))
        if deadline.tzinfo is None or deadline.utcoffset() is None:
            raise ValueError("Timezone required")
        return deadline.astimezone(timezone.utc)
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise HTTPException(503, detail="Could not verify the FPL deadline; retry later") from exc


def _check_deadline(deadline: datetime) -> None:
    if deadline.tzinfo is None or deadline.utcoffset() is None:
        raise HTTPException(503, detail="Could not verify the FPL deadline; retry later")
    if utc_now() >= deadline:
        raise HTTPException(400, detail="The gameweek deadline has passed")


async def _lock_user(db: AsyncSession, user_id: int) -> None:
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        # Lock exists even before the user's first lineup. A SELECT FOR UPDATE
        # alone cannot serialize two inserts when no row exists yet.
        await db.execute(text("SELECT pg_advisory_xact_lock(:namespace, :user_id)"),
                         {"namespace": 1345605192, "user_id": user_id})
    elif dialect == "sqlite":
        # Integration tests use a file-backed SQLite DB for real concurrent calls.
        await db.execute(text("BEGIN IMMEDIATE"))
    else:
        raise HTTPException(503, detail="Unsupported transaction locking backend")


async def _validate_players(db: AsyncSession, request: ConfirmTransfersRequest) -> Decimal:
    ids = request.starting_player_ids + request.bench_player_ids
    result = await db.execute(select(Player.id, Player.element_type, Player.team_id, Player.now_cost,
                                     Team.id.label("synced_team"))
                              .outerjoin(Team, Player.team_id == Team.id).where(Player.id.in_(ids)))
    rows = {row.id: row for row in result.all()}
    if set(rows) != set(ids):
        raise HTTPException(404, detail="Some selected players do not exist")
    players = [rows[player_id] for player_id in ids]
    if any(row.synced_team is None for row in players):
        raise HTTPException(400, detail="All players must belong to a synced club")
    if Counter(row.element_type for row in players) != {"GKP": 2, "DEF": 5, "MID": 5, "FWD": 3}:
        raise HTTPException(400, detail="Squad must contain 2 GKP, 5 DEF, 5 MID, 3 FWD")
    if max(Counter(row.team_id for row in players).values()) > 3:
        raise HTTPException(400, detail="At most 3 players per club are allowed")
    defenders, midfielders, forwards = map(int, request.formation.split("-"))
    if Counter(row.element_type for row in players[:11]) != {"GKP": 1, "DEF": defenders, "MID": midfielders, "FWD": forwards}:
        raise HTTPException(400, detail="Starting XI does not match the formation")
    cost = sum((Decimal(str(row.now_cost)) for row in players), Decimal(0))
    if cost > Decimal("100.0"):
        raise HTTPException(400, detail="Squad exceeds the 100m budget")
    return cost


def _saved_squad(row: UserGameweekLineup) -> set[int]:
    if not isinstance(row.starting_player_ids, list) or not isinstance(row.bench_player_ids, list):
        raise HTTPException(503, detail="Stored baseline squad is invalid")
    ids = row.starting_player_ids + row.bench_player_ids
    if len(ids) != 15 or any(type(i) is not int or i <= 0 for i in ids) or len(set(ids)) != 15:
        raise HTTPException(503, detail="Stored baseline squad is invalid")
    return set(ids)


async def confirm_transfers(db: AsyncSession, user_id: int, request: ConfirmTransfersRequest,
                            deadline: datetime) -> ConfirmTransfersResponse:
    _check_deadline(deadline)
    async with db.begin():
        await _lock_user(db, user_id)
        _check_deadline(deadline)  # Recheck after waiting for another request.
        current = await db.scalar(select(UserGameweekLineup).where(
            UserGameweekLineup.user_id == user_id, UserGameweekLineup.gameweek == request.gameweek,
        ).with_for_update())
        if current is not None and current.is_locked:
            raise HTTPException(400, detail="The saved gameweek lineup is locked")
        baseline = current
        if baseline is None:
            baseline = await db.scalar(select(UserGameweekLineup).where(
                UserGameweekLineup.user_id == user_id, UserGameweekLineup.gameweek < request.gameweek,
            ).order_by(UserGameweekLineup.gameweek.desc()).limit(1))
        new_ids = set(request.starting_player_ids + request.bench_player_ids)
        count = len(new_ids - _saved_squad(baseline)) if baseline is not None else 0
        used = (current.transfers_used if current is not None else 0) + count
        if used > 3:
            raise HTTPException(400, detail="At most 3 transfers per gameweek are allowed")
        cost = await _validate_players(db, request)
        if current is None:
            current = UserGameweekLineup(user_id=user_id, gameweek=request.gameweek,
                                        transfers_used=0, is_locked=False, gameweek_points=0)
            db.add(current)
        current.starting_player_ids = list(request.starting_player_ids)
        current.bench_player_ids = list(request.bench_player_ids)
        current.captain_id = request.captain_id
        current.vice_captain_id = request.vice_captain_id
        current.transfers_used = used
        current.gameweek_points = 0
        await db.flush()
        _check_deadline(deadline)  # No price/client/network work after this check.
        response = ConfirmTransfersResponse(
            lineup_id=current.id, user_id=user_id, gameweek=request.gameweek,
            starting_player_ids=current.starting_player_ids, bench_player_ids=current.bench_player_ids,
            captain_id=current.captain_id, vice_captain_id=current.vice_captain_id,
            formation=request.formation, total_cost=float(cost), transfers_count=count,
            transfers_used=used, remaining_transfers=3 - used, deadline=deadline, is_locked=False,
        )
    # P4-Q02: confirming a lineup resets gameweek_points -> leaderboard changed.
    await cache_service.invalidate_leaderboard()
    return response


def _totals(gameweek: int, name: str):
    table = UserGameweekLineup
    return select(
        table.user_id, func.sum(table.gameweek_points).label("total_points"),
        func.sum(case((table.gameweek == gameweek, table.gameweek_points), else_=0)).label("gameweek_points"),
        func.max(table.gameweek).label("latest_gameweek"),
    ).where(table.gameweek <= gameweek).group_by(table.user_id).cte(name)


async def read_leaderboard(db: AsyncSession, gameweek: int, sort_by: str, page: int, limit: int):
    current = _totals(gameweek, "current_totals")
    previous = _totals(gameweek - 1, "previous_totals")
    order = "total_points" if sort_by == "overall" else "gameweek_points"
    ranked = select(current, func.rank().over(order_by=current.c[order].desc()).label("rank")).cte("current_rank")
    prior = select(previous.c.user_id,
                   func.rank().over(order_by=previous.c[order].desc()).label("previous_rank")).cte("previous_rank")
    total = await db.scalar(select(func.count()).select_from(current))
    records = (await db.execute(select(
        ranked, func.coalesce(prior.c.previous_rank, 0).label("previous_rank"),
        UserGameweekLineup.starting_player_ids,
        Player.web_name.label("captain_name"),
    ).join(UserGameweekLineup, and_(UserGameweekLineup.user_id == ranked.c.user_id,
                                  UserGameweekLineup.gameweek == ranked.c.latest_gameweek))
       .outerjoin(prior, prior.c.user_id == ranked.c.user_id)
       .outerjoin(Player, Player.id == UserGameweekLineup.captain_id)
       .order_by(ranked.c[order].desc(), ranked.c.user_id)
       .offset((page - 1) * limit).limit(limit))).all()
    starters_by_user = {
        row.user_id: row.starting_player_ids
        if isinstance(row.starting_player_ids, list)
        and all(type(i) is int and i > 0 for i in row.starting_player_ids) else []
        for row in records
    }
    ids = {i for starters in starters_by_user.values() for i in starters}
    positions = dict((await db.execute(select(Player.id, Player.element_type).where(Player.id.in_(ids)))).all()) if ids else {}
    entries = []
    for row in records:
        starters = starters_by_user[row.user_id]
        counts = Counter(positions.get(i) for i in starters)
        formation = ""
        if (len(starters) == 11 and len(set(starters)) == 11
                and counts["GKP"] == 1 and 3 <= counts["DEF"] <= 5
                and 2 <= counts["MID"] <= 5 and 1 <= counts["FWD"] <= 3):
            formation = f'{counts["DEF"]}-{counts["MID"]}-{counts["FWD"]}'
        entries.append(LeaderboardEntry(
            user_id=row.user_id, rank=row.rank, previous_rank=row.previous_rank,
            manager_name=f"Player #{row.user_id}", team_name=f"Squad #{row.user_id}",
            gameweek_points=row.gameweek_points, total_points=row.total_points,
            favorite_club="", captain_name=row.captain_name or "", formation=formation,
        ))
    return entries, total or 0


async def score_completed_gameweek(gameweek: int, session_factory=AsyncSessionLocal) -> int:
    deadline = await get_gameweek_deadline(gameweek)
    if utc_now() < deadline:
        raise HTTPException(400, detail="Gameweek has not closed")
    async with session_factory() as db:
        async with db.begin():
            fixtures = (await db.execute(select(Fixture.id, Fixture.finished).where(Fixture.gameweek == gameweek))).all()
            if not fixtures or not all(row.finished for row in fixtures):
                raise HTTPException(400, detail="Sync all finished fixtures before scoring")
            represented = set(await db.scalars(select(PlayerGameweekStat.fixture_id).where(
                PlayerGameweekStat.gameweek == gameweek,
            ).distinct()))
            if represented != {row.id for row in fixtures}:
                raise HTTPException(400, detail="Sync gameweek stats before scoring")
            lineups = (await db.scalars(select(UserGameweekLineup).where(
                UserGameweekLineup.gameweek == gameweek,
            ).order_by(UserGameweekLineup.user_id).with_for_update())).all()
            for lineup in lineups:
                await score_and_persist_gameweek_lineup(db, lineup.id)
                lineup.is_locked = True
    # P4-Q02: new points are persisted -> drop every cached leaderboard page so
    # the next request rebuilds from the just-committed scores.
    await cache_service.invalidate_leaderboard()
    return len(lineups)


async def _main(gameweek: int) -> None:
    try:
        count = await score_completed_gameweek(gameweek)
        logger.info("P4-NH04 scored gameweek %s: %s lineups", gameweek, count)
    except Exception as exc:
        logger.error("P4-NH04 scoring failed (%s); transaction rolled back", type(exc).__name__)
        raise SystemExit(1) from None
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="P4-NH04: score a completed and synced round")
    parser.add_argument("--score-gameweek", type=int, choices=range(1, 39), required=True)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_main(args.score_gameweek))
