from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import DateTime, Numeric
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.models import Base, SharedLineup


def test_shared_lineup_is_registered_in_metadata():
    assert Base.metadata.tables["shared_lineups"] is SharedLineup.__table__


def test_id_is_uuid_primary_key_with_database_default():
    column = SharedLineup.__table__.columns["id"]
    assert isinstance(column.type, UUID)
    assert column.primary_key
    assert "gen_random_uuid()" in str(column.server_default.arg)


def test_share_code_is_required_and_unique():
    column = SharedLineup.__table__.columns["share_code"]
    assert column.type.length == 20
    assert not column.nullable
    assert any(constraint.columns.keys() == ["share_code"]
               for constraint in SharedLineup.__table__.constraints
               if constraint.__class__.__name__ == "UniqueConstraint")


def test_cost_and_predicted_points_numeric_precision_match_schema():
    columns = SharedLineup.__table__.columns
    assert isinstance(columns["total_cost"].type, Numeric)
    assert (columns["total_cost"].type.precision, columns["total_cost"].type.scale) == (4, 1)
    assert isinstance(columns["predicted_points"].type, Numeric)
    assert (columns["predicted_points"].type.precision,
            columns["predicted_points"].type.scale) == (5, 1)


def test_player_data_is_required_postgresql_jsonb():
    column = SharedLineup.__table__.columns["player_data"]
    assert isinstance(column.type, JSONB)
    assert not column.nullable


def test_created_at_is_timezone_aware_with_database_default():
    column = SharedLineup.__table__.columns["created_at"]
    assert isinstance(column.type, DateTime)
    assert column.type.timezone
    assert not column.nullable
    assert column.server_default is not None


def test_migration_follows_initial_schema_revision():
    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    revision = ScriptDirectory.from_config(config).get_revision("002_add_shared_lineups")
    assert revision is not None
    assert revision.down_revision == "001_initial_schema"
