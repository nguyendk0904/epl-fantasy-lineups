from sqlalchemy import Numeric

from app.models import Base, Player, Team


def test_models_register_expected_tables():
    assert set(Base.metadata.tables) == {"teams", "players"}


def test_team_primary_key_and_required_names():
    columns = Team.__table__.columns
    assert columns["id"].primary_key
    assert not columns["name"].nullable
    assert not columns["short_name"].nullable


def test_player_team_foreign_key_and_fpl_required_fields():
    columns = Player.__table__.columns
    foreign_keys = list(columns["team_id"].foreign_keys)
    assert len(foreign_keys) == 1
    assert foreign_keys[0].target_fullname == "teams.id"
    assert not columns["web_name"].nullable
    assert not columns["element_type"].nullable
    assert not columns["now_cost"].nullable


def test_player_indexes_cover_position_cost_and_points():
    indexes = {index.name: tuple(column.name for column in index.columns)
               for index in Player.__table__.indexes}
    assert indexes == {
        "ix_players_element_type": ("element_type",),
        "ix_players_now_cost": ("now_cost",),
        "ix_players_total_points": ("total_points",),
    }


def test_numeric_columns_match_ssot_precision():
    columns = Player.__table__.columns
    assert isinstance(columns["now_cost"].type, Numeric)
    assert (columns["now_cost"].type.precision, columns["now_cost"].type.scale) == (4, 1)
    assert (columns["expected_goals"].type.precision,
            columns["expected_goals"].type.scale) == (5, 2)
