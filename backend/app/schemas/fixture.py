from datetime import datetime

from pydantic import BaseModel, ConfigDict


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
