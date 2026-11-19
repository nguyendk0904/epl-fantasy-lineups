from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PlayerGameweekStat(Base):
    """A player's scoring statistics in one fixture."""

    __tablename__ = "player_gameweek_stats"
    __table_args__ = (
        Index("ix_player_gameweek_stats_gameweek", "gameweek"),
        Index("ix_player_gameweek_stats_player_id", "player_id"),
        UniqueConstraint("player_id", "fixture_id", name="uq_player_fixture_stat"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)
    fixture_id: Mapped[int] = mapped_column(ForeignKey("fixtures.id"), nullable=False)
    gameweek: Mapped[int] = mapped_column(Integer, nullable=False)
    minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    goals: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    assists: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clean_sheets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    goals_conceded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    yellow_cards: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    red_cards: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    saves: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bonus_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class UserGameweekLineup(Base):
    """A user's submitted lineup snapshot for a gameweek."""

    __tablename__ = "user_gameweek_lineups"
    __table_args__ = (
        Index("ix_user_gameweek_lineups_gameweek", "gameweek"),
        UniqueConstraint("user_id", "gameweek", name="uq_user_gameweek_lineup"),
        CheckConstraint("transfers_used BETWEEN 0 AND 3", name="ck_lineup_transfers_used"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # No users table exists yet, so user_id intentionally has no FK.
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    gameweek: Mapped[int] = mapped_column(Integer, nullable=False)
    starting_player_ids: Mapped[list[int]] = mapped_column(JSONB, nullable=False)
    bench_player_ids: Mapped[list[int]] = mapped_column(JSONB, nullable=False)
    captain_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"))
    vice_captain_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"))
    transfers_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_locked: Mapped[bool] = mapped_column(nullable=False, default=False)
    gameweek_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class DreamTeam(Base):
    """The official best-performing player selection for one gameweek."""

    __tablename__ = "dream_teams"
    __table_args__ = (
        Index("ix_dream_teams_gameweek", "gameweek"),
        UniqueConstraint("gameweek", name="uq_dream_team_gameweek"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    gameweek: Mapped[int] = mapped_column(Integer, nullable=False)
    top_player_ids: Mapped[list[int]] = mapped_column(JSONB, nullable=False)
    total_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
