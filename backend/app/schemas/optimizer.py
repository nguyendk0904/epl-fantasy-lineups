from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Formation = Literal[
    "3-4-3",
    "3-5-2",
    "4-3-3",
    "4-4-2",
    "4-5-1",
    "5-3-2",
    "5-4-1",
    "5-2-3",
]


class OptimizerRequest(BaseModel):
    budget: float = Field(gt=0, allow_inf_nan=False)
    locked_player_ids: list[int] = Field(default_factory=list)
    excluded_player_ids: list[int] = Field(default_factory=list)
    target_formation: Formation | None = None

    @model_validator(mode="after")
    def validate_player_id_lists(self) -> "OptimizerRequest":
        if len(self.locked_player_ids) != len(set(self.locked_player_ids)):
            raise ValueError("locked_player_ids must not contain duplicates.")
        if len(self.excluded_player_ids) != len(set(self.excluded_player_ids)):
            raise ValueError("excluded_player_ids must not contain duplicates.")
        conflicts = set(self.locked_player_ids) & set(self.excluded_player_ids)
        if conflicts:
            raise ValueError(
                "A player cannot be both locked and excluded: "
                f"{sorted(conflicts)}."
            )
        return self


class OptimizedPlayer(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    web_name: str
    element_type: str
    team_id: int | None
    now_cost: float
    expected_points_next: float


class OptimizerResponse(BaseModel):
    status: Literal["optimal", "infeasible"]
    total_cost: float | None = None
    total_expected_points: float | None = None
    starting_xi: list[OptimizedPlayer] = Field(default_factory=list)
    bench: list[OptimizedPlayer] = Field(default_factory=list)
    captain_id: int | None = None
    vice_captain_id: int | None = None
    formation: str | None = None
    message: str | None = None
