"""P4-NH04: public ranking and opt-in, token-bound demo transfers."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.gameweek_auth import get_demo_user_id
from app.schemas.gameweek import ConfirmTransfersRequest, ConfirmTransfersResponse, LeaderboardEntry
from app.services.gameweek_service import confirm_transfers, get_gameweek_deadline, read_leaderboard


router = APIRouter(tags=["Gameweeks"])


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(
    response: Response,
    gameweek: int = Query(..., ge=1, le=38),
    sort_by: Literal["overall", "gameweek"] = "overall",
    page: int = Query(1, ge=1), limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    try:
        entries, total = await read_leaderboard(db, gameweek, sort_by, page, limit)
    except SQLAlchemyError as exc:
        raise HTTPException(503, detail="Leaderboard database unavailable") from exc
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Page"] = str(page)
    response.headers["X-Limit"] = str(limit)
    response.headers["X-Total-Pages"] = str((total + limit - 1) // limit)
    return entries


@router.post("/transfers/confirm", response_model=ConfirmTransfersResponse)
async def confirm(
    request: ConfirmTransfersRequest,
    user_id: int = Depends(get_demo_user_id),
    db: AsyncSession = Depends(get_db),
):
    deadline = await get_gameweek_deadline(request.gameweek)
    try:
        return await confirm_transfers(db, user_id, request, deadline)
    except SQLAlchemyError as exc:
        raise HTTPException(503, detail="Could not store transfers; transaction rolled back") from exc
