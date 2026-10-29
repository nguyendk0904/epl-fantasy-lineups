"""Create initial FPL teams and players tables.

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-10-29
"""

from alembic import op
import sqlalchemy as sa

revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("short_name", sa.String(length=5), nullable=False),
        sa.Column("strength", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("strength_attack_home", sa.Integer()),
        sa.Column("strength_attack_away", sa.Integer()),
        sa.Column("strength_defence_home", sa.Integer()),
        sa.Column("strength_defence_away", sa.Integer()),
    )

    op.create_table(
        "players",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("first_name", sa.String(length=100)),
        sa.Column("second_name", sa.String(length=100)),
        sa.Column("web_name", sa.String(length=100), nullable=False),
        sa.Column("team_id", sa.Integer(), sa.ForeignKey("teams.id")),
        sa.Column("element_type", sa.String(length=5), nullable=False),
        sa.Column("now_cost", sa.Numeric(precision=4, scale=1), nullable=False),
        sa.Column("status", sa.String(length=5), server_default="a"),
        sa.Column("news", sa.Text()),
        sa.Column("total_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "form",
            sa.Numeric(precision=4, scale=1),
            nullable=False,
            server_default="0.0",
        ),
        sa.Column("selected_by_percent", sa.Numeric(precision=4, scale=1)),
        sa.Column("expected_goals", sa.Numeric(precision=5, scale=2)),
        sa.Column("expected_assists", sa.Numeric(precision=5, scale=2)),
        sa.Column("ict_index", sa.Numeric(precision=5, scale=1)),
        sa.Column("expected_points_next", sa.Numeric(precision=4, scale=1)),
    )
    op.create_index("ix_players_element_type", "players", ["element_type"])
    op.create_index("ix_players_now_cost", "players", ["now_cost"])
    op.create_index("ix_players_total_points", "players", ["total_points"])


def downgrade() -> None:
    op.drop_index("ix_players_total_points", table_name="players")
    op.drop_index("ix_players_now_cost", table_name="players")
    op.drop_index("ix_players_element_type", table_name="players")
    op.drop_table("players")
    op.drop_table("teams")
