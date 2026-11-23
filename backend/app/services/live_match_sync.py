"""P4-NH02: ingest a gameweek's per-fixture stats and official Dream Team.

Run once from backend/: python -m app.services.live_match_sync --gameweek 1
Requires migrated tables and seeded players/fixtures (P4-V01/P4-NH01).
FPL live totals identify active players. Element history supplies full per-match
counts, since live explain omits non-scoring events. Lagging history aborts the
run rather than inventing or double-counting fixture stats. Scheduling: P4-Q01.
No schema, infrastructure or scoring-engine changes. Raw BPS is not persisted;
bonus is the awarded bonus_points column, not the Bonus Points System score.
"""

import argparse
import asyncio
from collections.abc import Callable
import logging
from typing import Annotated

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, engine
from app.models import DreamTeam, Fixture, Player, PlayerGameweekStat


logger = logging.getLogger(__name__)
API_BASE_URL = "https://fantasy.premierleague.com/api"
PositiveId = Annotated[int, Field(strict=True, gt=0, le=2147483647)]
Count = Annotated[int, Field(strict=True, ge=0, le=2147483647)]
Points = Annotated[int, Field(strict=True, ge=-2147483648, le=2147483647)]
STAT_COLUMNS = {
    "minutes": "minutes", "goals_scored": "goals", "assists": "assists",
    "clean_sheets": "clean_sheets", "goals_conceded": "goals_conceded",
    "yellow_cards": "yellow_cards", "red_cards": "red_cards", "saves": "saves",
    "bonus": "bonus_points", "total_points": "total_points",
}


class GameweekSyncError(RuntimeError):
    """Credential-safe operational error; underlying detail stays chained."""


class _Stats(BaseModel):
    minutes: Count
    total_points: Points
    goals_scored: Count = 0
    assists: Count = 0
    clean_sheets: Count = 0
    goals_conceded: Count = 0
    yellow_cards: Count = 0
    red_cards: Count = 0
    saves: Count = 0
    bonus: Count = 0


class _LivePlayer(BaseModel):
    id: PositiveId
    stats: _Stats


class _LivePayload(BaseModel):
    elements: Annotated[list[_LivePlayer], Field(min_length=1)]


class _HistoryRow(_Stats):
    fixture: PositiveId
    round: Annotated[int, Field(strict=True, ge=1, le=38)]
    element: PositiveId | None = None


class _HistoryPayload(BaseModel):
    history: list[_HistoryRow]


class _DreamPlayer(BaseModel):
    element: PositiveId
    points: Points
    position: Annotated[int, Field(strict=True, ge=1, le=11)]


class _DreamPayload(BaseModel):
    team: list[_DreamPlayer]


def _parse_dream(payload: object, gameweek: int) -> dict | None:
    players = _DreamPayload.model_validate(payload).team
    if not players:
        return None  # Not published yet; preserve any saved Dream Team.
    if len(players) != 11 or len({p.element for p in players}) != 11:
        raise ValueError("Dream Team must contain 11 distinct players")
    if {p.position for p in players} != set(range(1, 12)):
        raise ValueError("Dream Team positions must be unique")
    return {
        "gameweek": gameweek,
        "top_player_ids": [p.element for p in sorted(players, key=lambda p: p.position)],
        "total_points": sum(p.points for p in players),
    }


def _parse_history(payload: object, player: _LivePlayer, gameweek: int) -> list[dict]:
    history = _HistoryPayload.model_validate(payload).history
    selected = [row for row in history if row.round == gameweek]
    if len({row.fixture for row in selected}) != len(selected):
        raise ValueError("Duplicate fixture in player history")
    if any(row.element is not None and row.element != player.id for row in selected):
        raise ValueError("History belongs to a different player")
    for metric in STAT_COLUMNS:
        if sum(getattr(row, metric) for row in selected) != getattr(player.stats, metric):
            raise ValueError("History has not reconciled with live gameweek totals; retry later")
    return [
        {"player_id": player.id, "fixture_id": row.fixture, "gameweek": gameweek,
         **{column: getattr(row, metric) for metric, column in STAT_COLUMNS.items()}}
        for row in selected
    ]


async def _get_json(client: httpx.AsyncClient, url: str) -> object:
    response = await client.get(url, timeout=30.0)
    response.raise_for_status()
    return response.json()


async def _upsert_rows(session, table, rows: list[dict], conflict: list[str]) -> None:
    for offset in range(0, len(rows), 500):
        statement = insert(table).values(rows[offset:offset + 500])
        await session.execute(statement.on_conflict_do_update(
            index_elements=conflict,
            set_={key: statement.excluded[key] for key in rows[0] if key not in conflict},
        ))


async def sync_live_match_data(
    gameweek: int,
    session_factory: Callable[[], AsyncSession] = AsyncSessionLocal,
    *,
    client: httpx.AsyncClient | None = None,
    api_base_url: str = API_BASE_URL,
    history_concurrency: int = 4,
) -> dict[str, int]:
    """Fetch/validate first, then atomically refresh stats and optional Dream Team.

    A Dream Team 404 or empty team is an explicit pending state, not a failed stats
    sync. Other HTTP/JSON/validation errors abort without DB writes. Request
    concurrency is bounded; all in-flight history requests finish before leaving
    the caller's client. Missing DB prerequisites abort the whole transaction.
    Repeated calls replace values, never increment points. No lineup scoring is
    triggered here; V's scoring engine consumes these stats separately.
    """
    if type(gameweek) is not int or not 1 <= gameweek <= 38:
        raise ValueError("gameweek must be an integer from 1 to 38")
    if type(history_concurrency) is not int or not 1 <= history_concurrency <= 8:
        raise ValueError("history_concurrency must be an integer from 1 to 8")
    if client is None:
        async with httpx.AsyncClient() as owned_client:
            return await sync_live_match_data(
                gameweek, session_factory, client=owned_client, api_base_url=api_base_url,
                history_concurrency=history_concurrency,
            )
    base = api_base_url.rstrip("/")
    try:
        live_payload = await _get_json(client, f"{base}/event/{gameweek}/live/")
        dream_response = await client.get(f"{base}/dream-team/{gameweek}/", timeout=30.0)
        dream_available = dream_response.status_code != 404
        if not dream_available:
            dream_payload = None
        else:
            dream_response.raise_for_status()
            dream_payload = dream_response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise GameweekSyncError("FPL live/Dream Team request or JSON failed") from exc
    try:
        players = _LivePayload.model_validate(live_payload).elements
        if len({player.id for player in players}) != len(players):
            raise ValueError("Duplicate live player IDs")
        dream = _parse_dream(dream_payload, gameweek) if dream_available else None
    except (ValueError, TypeError) as exc:
        raise GameweekSyncError("Invalid FPL live/Dream Team payload") from exc

    semaphore = asyncio.Semaphore(history_concurrency)
    active = [p for p in players if any(p.stats.model_dump().values())]

    async def history_for(player):
        async with semaphore:
            payload = await _get_json(client, f"{base}/element-summary/{player.id}/")
            return _parse_history(payload, player, gameweek)

    # Gather every outcome so exceptions cannot leave tasks using a closed client.
    histories = await asyncio.gather(*(history_for(p) for p in active), return_exceptions=True)
    for outcome in histories:
        if isinstance(outcome, BaseException):
            raise GameweekSyncError("FPL per-fixture history failed or is inconsistent; retry later") from outcome
    rows = [row for history in histories for row in history]
    try:
        async with session_factory() as session:
            async with session.begin():
                required_players = {row["player_id"] for row in rows}
                if dream:
                    required_players.update(dream["top_player_ids"])
                known = set(await session.scalars(select(Player.id).where(Player.id.in_(required_players))))
                if known != required_players:
                    raise ValueError("Unknown players; run P4-NH01 first")
                fixture_ids = {row["fixture_id"] for row in rows}
                valid_fixtures = set(await session.scalars(select(Fixture.id).where(
                    Fixture.id.in_(fixture_ids), Fixture.gameweek == gameweek,
                )))
                if fixture_ids != valid_fixtures:
                    raise ValueError("Missing fixtures or gameweek mismatch; run P4-NH01 first")
                # Clear prior values for players in this authoritative response,
                # including corrections to zero/withdrawn appearances. Keep rows
                # and IDs intact so aggregates cannot retain stale prior points.
                player_ids = [player.id for player in players]
                for offset in range(0, len(player_ids), 500):
                    await session.execute(update(PlayerGameweekStat).where(
                        PlayerGameweekStat.gameweek == gameweek,
                        PlayerGameweekStat.player_id.in_(player_ids[offset:offset + 500]),
                    ).values(**{column: 0 for column in STAT_COLUMNS.values()}))
                await _upsert_rows(session, PlayerGameweekStat.__table__, rows, ["player_id", "fixture_id"])
                if dream:
                    await _upsert_rows(session, DreamTeam.__table__, [dream], ["gameweek"])
    except Exception as exc:
        raise GameweekSyncError("Gameweek sync failed; check players/fixtures/migrations; transaction rolled back") from exc
    result = {"gameweek": gameweek, "players_processed": len(players),
              "stats_processed": len(rows), "dream_teams_processed": int(dream is not None)}
    logger.info("P4-NH02 sync succeeded: %s", result)
    if dream is None:
        logger.info("P4-NH02 Dream Team unavailable for gameweek %s; saved snapshot retained", gameweek)
    return result


async def _main(gameweek: int) -> None:
    try:
        await sync_live_match_data(gameweek)
    except GameweekSyncError as exc:
        logger.error("P4-NH02: %s", exc)
        raise SystemExit(1) from None
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="P4-NH02: sync one FPL gameweek")
    parser.add_argument("--gameweek", required=True, type=int, choices=range(1, 39))
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_main(args.gameweek))
