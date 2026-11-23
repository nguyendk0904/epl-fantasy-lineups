"""P4-NH04 contracts; identity/deadline/prices/counters never come from the body."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.share import Formation, PlayerID, ShareLineupRequest


class ConfirmTransfersRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    gameweek: Annotated[int, Field(strict=True, ge=1, le=38)]
    starting_player_ids: list[PlayerID] = Field(min_length=11, max_length=11)
    bench_player_ids: list[PlayerID] = Field(min_length=4, max_length=4)
    formation: Formation
    captain_id: PlayerID
    vice_captain_id: PlayerID

    @model_validator(mode="after")
    def validate_squad(self) -> "ConfirmTransfersRequest":
        # Reuse the existing ID/C-V contract instead of weakening its validation.
        ShareLineupRequest.model_validate({"lineup_name": "Gameweek lineup", **self.model_dump(exclude={"gameweek"})})
        return self


class ConfirmTransfersResponse(BaseModel):
    lineup_id: int
    user_id: int
    gameweek: int
    starting_player_ids: list[int]
    bench_player_ids: list[int]
    captain_id: int
    vice_captain_id: int
    formation: Formation
    total_cost: float
    transfers_count: int
    transfers_used: int
    remaining_transfers: int
    deadline: datetime
    is_locked: bool


class LeaderboardEntry(BaseModel):
    user_id: int
    rank: int
    previous_rank: int  # 0 means no earlier entry, not a fabricated prior rank.
    manager_name: str   # Explicit ID-based demo labels; no user profiles exist.
    team_name: str
    gameweek_points: int
    total_points: int
    favorite_club: str  # Empty means not stored; never infer it from captain club.
    captain_name: str
    formation: str
