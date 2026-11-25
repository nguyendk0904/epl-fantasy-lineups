from pydantic import BaseModel, ConfigDict


class PlayerItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    web_name: str
    team_short_name: str | None = None
    element_type: str
    now_cost: float
    total_points: int
    form: float
    status: str | None = "a"
    news: str | None = None
    chance_of_playing_next_round: int | None = None
    expected_points_next: float | None = None


class PlayerListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: list[PlayerItemResponse]

