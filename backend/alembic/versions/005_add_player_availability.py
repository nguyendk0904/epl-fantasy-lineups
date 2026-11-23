"""P4-NH01: persist the FPL next-round availability percentage.

Schema addition authorized by NH for this task. Unknown remains SQL NULL.
"""

from alembic import op
import sqlalchemy as sa


revision = "005_add_player_availability"
down_revision = "004_add_fixture_difficulty"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("players", sa.Column("chance_of_playing_next_round", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_players_chance_of_playing_next_round",
        "players",
        "chance_of_playing_next_round BETWEEN 0 AND 100",
    )


def downgrade() -> None:
    op.drop_constraint("ck_players_chance_of_playing_next_round", "players", type_="check")
    op.drop_column("players", "chance_of_playing_next_round")
