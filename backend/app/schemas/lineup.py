from pydantic import BaseModel, Field, model_validator


class LineupComparisonRequest(BaseModel):
    lineup_a_player_ids: list[int] = Field(min_length=15, max_length=15)
    lineup_b_player_ids: list[int] = Field(min_length=15, max_length=15)

    @model_validator(mode="after")
    def validate_unique_player_ids(self) -> "LineupComparisonRequest":
        for field_name, player_ids in (
            ("lineup_a_player_ids", self.lineup_a_player_ids),
            ("lineup_b_player_ids", self.lineup_b_player_ids),
        ):
            if len(player_ids) != len(set(player_ids)):
                raise ValueError(f"{field_name} must not contain duplicate IDs.")
            if any(player_id <= 0 for player_id in player_ids):
                raise ValueError(f"{field_name} must contain positive player IDs.")
        return self


class LineupMetrics(BaseModel):
    total_cost: float
    total_xp: float
    attack_rating: int
    defense_rating: int
    form_rating: int
    value_rating: int


class DifferentialPlayer(BaseModel):
    id: int
    web_name: str
    element_type: str
    now_cost: float


class HeadToHeadDelta(BaseModel):
    cost_diff: float
    xp_diff: float
    common_players_count: int
    differential_players: list[DifferentialPlayer]


class LineupComparisonResponse(BaseModel):
    lineup_a: LineupMetrics
    lineup_b: LineupMetrics
    head_to_head_delta: HeadToHeadDelta
