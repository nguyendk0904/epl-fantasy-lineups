from datetime import datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.optimizer import Formation


class FixtureTeamInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    short_name: str


class FixtureItem(BaseModel):
    id: int
    gameweek: int
    kickoff_time: datetime
    kickoff_date: str
    home_team: FixtureTeamInfo
    away_team: FixtureTeamInfo
    team_h_score: int | None
    team_a_score: int | None
    team_h_difficulty: int
    team_a_difficulty: int
    finished: bool


class DreamTeamPlayer(BaseModel):
    """P4-NH03: matches the existing frontend DreamTeamPlayer interface."""

    id: int
    web_name: str
    team_short_name: str
    team_id: int
    element_type: Literal["GKP", "DEF", "MID", "FWD"]
    points: int
    goals: int
    assists: int
    clean_sheet: bool
    bonus: int
    isMvp: bool


class DreamTeamMVP(BaseModel):
    id: int
    name: str
    points: int
    team: str


class DreamTeamResponse(BaseModel):
    gameweek: int = Field(ge=1, le=38)
    formation: Formation
    total_points: int
    mvp: DreamTeamMVP
    players: list[DreamTeamPlayer] = Field(min_length=11, max_length=11)
