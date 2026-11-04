from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, Numeric, String, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SharedLineup(Base):
    __tablename__ = "shared_lineups"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    share_code: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
    )
    lineup_name: Mapped[str] = mapped_column(String(100), nullable=False)
    total_cost: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)
    predicted_points: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False)
    player_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
