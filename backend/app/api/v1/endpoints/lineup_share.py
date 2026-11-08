"""P2-NH02: create immutable public snapshots and retrieve by base62 code."""

from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
import secrets
import string
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Player, SharedLineup, Team
from app.schemas.share import ShareLineupRequest, SharedLineupResponse, SharedPlayer, SharedPlayerData


router = APIRouter(prefix="/lineups/share", tags=["Lineup Share"])
ALPHABET = string.ascii_letters + string.digits
MAX_CODE_ATTEMPTS = 5


def generate_share_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(6))


def _share_code_conflict(error: IntegrityError) -> bool:
    original = error.orig
    cause = getattr(original, "__cause__", None)
    constraint = getattr(original, "constraint_name", None) or getattr(cause, "constraint_name", None)
    sqlstate = getattr(original, "sqlstate", None) or getattr(original, "pgcode", None)
    if sqlstate == "23505":
        return constraint in {"uq_shared_lineups_share_code", "shared_lineups_share_code_key"}
    # SQLite equivalent used by the isolated SQL tests.
    return "UNIQUE constraint failed: shared_lineups.share_code" in str(original)


async def _build_snapshot(request: ShareLineupRequest, db: AsyncSession):
    ids = request.starting_player_ids + request.bench_player_ids
    result = await db.execute(
        select(Player, Team.short_name)
        .outerjoin(Team, Player.team_id == Team.id)
        .where(Player.id.in_(ids))
    )
    rows = {player.id: (player, short_name) for player, short_name in result.all()}
    missing = sorted(set(ids) - rows.keys())
    if missing:
        raise HTTPException(404, detail=f"Players not found: {missing}")
    players = [rows[player_id][0] for player_id in ids]
    if any(player.team_id is None or rows[player.id][1] is None for player in players):
        raise HTTPException(400, detail="All players must belong to a synced team")
    if Counter(player.element_type for player in players) != {"GKP": 2, "DEF": 5, "MID": 5, "FWD": 3}:
        raise HTTPException(400, detail="Squad must contain 2 GKP, 5 DEF, 5 MID, 3 FWD")
    if max(Counter(player.team_id for player in players).values()) > 3:
        raise HTTPException(400, detail="At most 3 players per club are allowed")
    defenders, midfielders, forwards = map(int, request.formation.split("-"))
    starters = players[:11]
    if Counter(player.element_type for player in starters) != {
        "GKP": 1, "DEF": defenders, "MID": midfielders, "FWD": forwards,
    }:
        raise HTTPException(400, detail="Starting XI does not match the formation")
    total_cost = sum((Decimal(str(player.now_cost)) for player in players), Decimal(0))
    if total_cost > Decimal("100.0"):
        raise HTTPException(400, detail="Squad exceeds the 100m budget")
    xp = {player.id: Decimal(str(player.expected_points_next or 0)) for player in starters}
    predicted_points = sum(xp.values(), Decimal(0)) + xp[request.captain_id]
    data = SharedPlayerData(
        **request.model_dump(exclude={"lineup_name"}),
        players=[SharedPlayer(
            id=player.id, web_name=player.web_name, team_id=player.team_id,
            team_short_name=rows[player.id][1], element_type=player.element_type,
            now_cost=float(player.now_cost), total_points=player.total_points,
            form=float(player.form) if player.form is not None else None,
            status=player.status,
            expected_points_next=float(player.expected_points_next) if player.expected_points_next is not None else None,
        ) for player in players],
    )
    return total_cost, predicted_points, data.model_dump(mode="json")


@router.post("", response_model=SharedLineupResponse, status_code=201)
async def share_lineup(request: ShareLineupRequest, db: AsyncSession = Depends(get_db)):
    total_cost, predicted_points, player_data = await _build_snapshot(request, db)
    for _ in range(MAX_CODE_ATTEMPTS):
        snapshot = SharedLineup(
            id=uuid4(), share_code=generate_share_code(), lineup_name=request.lineup_name,
            total_cost=total_cost, predicted_points=predicted_points,
            player_data=player_data, created_at=datetime.now(timezone.utc),
        )
        db.add(snapshot)
        try:
            await db.commit()
        except IntegrityError as error:
            await db.rollback()
            if _share_code_conflict(error):
                continue
            raise HTTPException(500, detail="Could not store shared lineup") from None
        return SharedLineupResponse.model_validate(snapshot)
    raise HTTPException(503, detail="Could not allocate a share code; please retry")


@router.get("/{code}", response_model=SharedLineupResponse)
async def get_shared_lineup(
    code: Annotated[str, Path(pattern=r"^[A-Za-z0-9]{6}$")],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SharedLineup).where(SharedLineup.share_code == code))
    snapshot = result.scalar_one_or_none()
    if snapshot is None:
        raise HTTPException(404, detail="Shared lineup not found")
    return SharedLineupResponse.model_validate(snapshot)
