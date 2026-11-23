from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.models import Base


def test_difficulty_revision_follows_gameweek_schema():
    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "alembic"))
    scripts = ScriptDirectory.from_config(config)
    revision = scripts.get_revision("004_add_fixture_difficulty")
    assert revision.down_revision == "003_live_gameweek_schema"


@pytest.mark.parametrize("name", ["team_h_difficulty", "team_a_difficulty"])
def test_fixture_difficulty_range(name):
    fixtures = Base.metadata.tables["fixtures"]
    column = fixtures.c[name]
    assert column.nullable and isinstance(column.type, sa.Integer)
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        Base.metadata.create_all(conn, tables=[Base.metadata.tables["teams"], fixtures])
        for value in (None, 1, 5):
            conn.execute(fixtures.insert().values(gameweek=1, team_h=1, team_a=2, **{name: value}))
        for value in (0, 6):
            with pytest.raises(sa.exc.IntegrityError, match="CHECK"):
                conn.execute(fixtures.insert().values(gameweek=1, team_h=1, team_a=2, **{name: value}))
