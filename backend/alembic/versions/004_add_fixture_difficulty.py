"""Add home and away difficulty ratings to fixtures."""

from alembic import op
import sqlalchemy as sa

revision = "004_add_fixture_difficulty"
down_revision = "003_live_gameweek_schema"
branch_labels = None
depends_on = None

_columns = ("team_h_difficulty", "team_a_difficulty")


def upgrade() -> None:
    for name in _columns:
        op.add_column("fixtures", sa.Column(name, sa.Integer(), nullable=True))
        op.create_check_constraint(f"ck_fixtures_{name}", "fixtures", f"{name} BETWEEN 1 AND 5")


def downgrade() -> None:
    for name in reversed(_columns):
        op.drop_constraint(f"ck_fixtures_{name}", "fixtures", type_="check")
        op.drop_column("fixtures", name)
