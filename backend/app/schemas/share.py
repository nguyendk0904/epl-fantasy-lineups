"""P2-NH02: snapshot contract for the public, read-only share API.

Clients send IDs, formation, and C/V; prices and player details come from DB.
predicted_points uses stored xP for the starting XI plus the captain bonus;
missing xP contributes zero (no new prediction formula is introduced).
"""

from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


PlayerID = Annotated[int, Field(strict=True, gt=0)]
Formation = Literal["3-4-3", "3-5-2", "4-3-3", "4-4-2", "4-5-1", "5-3-2", "5-4-1", "5-2-3"]
Position = Literal["GKP", "DEF", "MID", "FWD"]


class ShareLineupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    lineup_name: str = Field(min_length=1, max_length=100)
    starting_player_ids: list[PlayerID] = Field(min_length=11, max_length=11)
    bench_player_ids: list[PlayerID] = Field(min_length=4, max_length=4)
    formation: Formation
    captain_id: PlayerID
    vice_captain_id: PlayerID

    @model_validator(mode="after")
    def validate_squad_ids(self) -> "ShareLineupRequest":
        ids = self.starting_player_ids + self.bench_player_ids
        if len(set(ids)) != 15:
            raise ValueError("The squad must contain 15 distinct player IDs")
        if self.captain_id == self.vice_captain_id:
            raise ValueError("Captain and vice-captain must be different")
        if not {self.captain_id, self.vice_captain_id}.issubset(self.starting_player_ids):
            raise ValueError("Captain and vice-captain must be in the starting XI")
        return self


class SharedPlayer(BaseModel):
    id: int
    web_name: str
    team_id: int
    team_short_name: str
    element_type: Position
    now_cost: float
    total_points: int
    form: float | None
    status: str | None
    expected_points_next: float | None


class SharedPlayerData(BaseModel):
    starting_player_ids: list[int]
    bench_player_ids: list[int]
    formation: Formation
    captain_id: int
    vice_captain_id: int
    players: list[SharedPlayer]


class SharedLineupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    share_code: str
    lineup_name: str
    total_cost: float
    predicted_points: float
    player_data: SharedPlayerData
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def utc_timestamp(cls, value: datetime) -> datetime:
        # PostgreSQL TIMESTAMPTZ is aware; SQLite test storage drops tzinfo.
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
