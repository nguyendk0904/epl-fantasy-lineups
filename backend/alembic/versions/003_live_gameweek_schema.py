"""Add fixture and gameweek operation tables.

Revision ID: 003_live_gameweek_schema
Revises: 002_add_shared_lineups
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "003_live_gameweek_schema"
down_revision = "002_add_shared_lineups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fixtures",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("team_h", sa.Integer(), nullable=False),
        sa.Column("team_a", sa.Integer(), nullable=False),
        sa.Column("team_h_score", sa.Integer()),
        sa.Column("team_a_score", sa.Integer()),
        sa.Column("kickoff_time", sa.DateTime(timezone=True)),
        sa.Column("finished", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.ForeignKeyConstraint(["team_h"], ["teams.id"]),
        sa.ForeignKeyConstraint(["team_a"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fixtures_gameweek", "fixtures", ["gameweek"])

    op.create_table(
        "player_gameweek_stats",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("player_id", sa.Integer(), nullable=False),
        sa.Column("fixture_id", sa.Integer(), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("minutes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("goals", sa.Integer(), server_default="0", nullable=False),
        sa.Column("assists", sa.Integer(), server_default="0", nullable=False),
        sa.Column("clean_sheets", sa.Integer(), server_default="0", nullable=False),
        sa.Column("goals_conceded", sa.Integer(), server_default="0", nullable=False),
        sa.Column("yellow_cards", sa.Integer(), server_default="0", nullable=False),
        sa.Column("red_cards", sa.Integer(), server_default="0", nullable=False),
        sa.Column("saves", sa.Integer(), server_default="0", nullable=False),
        sa.Column("bonus_points", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_points", sa.Integer(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["fixture_id"], ["fixtures.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("player_id", "fixture_id", name="uq_player_fixture_stat"),
    )
    op.create_index(
        "ix_player_gameweek_stats_gameweek", "player_gameweek_stats", ["gameweek"]
    )
    op.create_index(
        "ix_player_gameweek_stats_player_id", "player_gameweek_stats", ["player_id"]
    )

    op.create_table(
        "user_gameweek_lineups",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("starting_player_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("bench_player_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("captain_id", sa.Integer()),
        sa.Column("vice_captain_id", sa.Integer()),
        sa.Column("transfers_used", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_locked", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("gameweek_points", sa.Integer(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(["captain_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["vice_captain_id"], ["players.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "gameweek", name="uq_user_gameweek_lineup"),
        sa.CheckConstraint(
            "transfers_used BETWEEN 0 AND 3", name="ck_lineup_transfers_used"
        ),
    )
    op.create_index(
        "ix_user_gameweek_lineups_gameweek", "user_gameweek_lineups", ["gameweek"]
    )

    op.create_table(
        "dream_teams",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("gameweek", sa.Integer(), nullable=False),
        sa.Column("top_player_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("total_points", sa.Integer(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("gameweek", name="uq_dream_team_gameweek"),
    )
    op.create_index("ix_dream_teams_gameweek", "dream_teams", ["gameweek"])


def downgrade() -> None:
    op.drop_index("ix_dream_teams_gameweek", table_name="dream_teams")
    op.drop_table("dream_teams")
    op.drop_index(
        "ix_user_gameweek_lineups_gameweek", table_name="user_gameweek_lineups"
    )
    op.drop_table("user_gameweek_lineups")
    op.drop_index(
        "ix_player_gameweek_stats_player_id", table_name="player_gameweek_stats"
    )
    op.drop_index(
        "ix_player_gameweek_stats_gameweek", table_name="player_gameweek_stats"
    )
    op.drop_table("player_gameweek_stats")
    op.drop_index("ix_fixtures_gameweek", table_name="fixtures")
    op.drop_table("fixtures")
