from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    short_name: Mapped[str] = mapped_column(String(5), nullable=False)
    strength: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    strength_attack_home: Mapped[int | None] = mapped_column(Integer)
    strength_attack_away: Mapped[int | None] = mapped_column(Integer)
    strength_defence_home: Mapped[int | None] = mapped_column(Integer)
    strength_defence_away: Mapped[int | None] = mapped_column(Integer)

    players: Mapped[list["Player"]] = relationship(
        back_populates="team",
        cascade="all, delete-orphan",
    )
