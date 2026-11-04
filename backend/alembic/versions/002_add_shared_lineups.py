"""Add the shared lineups table.

Revision ID: 002_add_shared_lineups
Revises: 001_initial_schema
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "002_add_shared_lineups"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shared_lineups",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("share_code", sa.String(length=20), nullable=False),
        sa.Column("lineup_name", sa.String(length=100), nullable=False),
        sa.Column("total_cost", sa.Numeric(precision=4, scale=1), nullable=False),
        sa.Column(
            "predicted_points",
            sa.Numeric(precision=5, scale=1),
            nullable=False,
        ),
        sa.Column("player_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_shared_lineups"),
        sa.UniqueConstraint("share_code", name="uq_shared_lineups_share_code"),
    )


def downgrade() -> None:
    op.drop_table("shared_lineups")
