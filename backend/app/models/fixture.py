from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Fixture(Base):
    """A Premier League fixture, identified by its FPL fixture ID."""

    __tablename__ = "fixtures"
    __table_args__ = (
        Index("ix_fixtures_gameweek", "gameweek"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    gameweek: Mapped[int] = mapped_column(Integer, nullable=False)
    team_h: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    team_a: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False)
    team_h_score: Mapped[int | None] = mapped_column(Integer)
    team_a_score: Mapped[int | None] = mapped_column(Integer)
    kickoff_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    home_team = relationship("Team", foreign_keys=[team_h])
    away_team = relationship("Team", foreign_keys=[team_a])
