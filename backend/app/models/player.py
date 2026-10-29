from sqlalchemy import ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Player(Base):
    __tablename__ = "players"
    __table_args__ = (
        Index("ix_players_element_type", "element_type"),
        Index("ix_players_now_cost", "now_cost"),
        Index("ix_players_total_points", "total_points"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str | None] = mapped_column(String(100))
    second_name: Mapped[str | None] = mapped_column(String(100))
    web_name: Mapped[str] = mapped_column(String(100), nullable=False)

    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"))
    element_type: Mapped[str] = mapped_column(String(5), nullable=False)

    now_cost: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)
    status: Mapped[str | None] = mapped_column(String(5), default="a")
    news: Mapped[str | None] = mapped_column(Text)

    total_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    form: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False, default=0.0)
    selected_by_percent: Mapped[float | None] = mapped_column(Numeric(4, 1))

    expected_goals: Mapped[float | None] = mapped_column(Numeric(5, 2))
    expected_assists: Mapped[float | None] = mapped_column(Numeric(5, 2))
    ict_index: Mapped[float | None] = mapped_column(Numeric(5, 1))
    expected_points_next: Mapped[float | None] = mapped_column(Numeric(4, 1))

    team: Mapped["Team | None"] = relationship(back_populates="players")
