from sqlalchemy.dialects import postgresql

from app.models import (
    DreamTeam,
    Fixture,
    PlayerGameweekStat,
    UserGameweekLineup,
)


def test_all_four_gameweek_tables_are_registered():
    expected = {
        "fixtures",
        "player_gameweek_stats",
        "user_gameweek_lineups",
        "dream_teams",
    }
    assert expected.issubset(Fixture.metadata.tables)


def test_fixture_has_team_foreign_keys_and_gameweek_index():
    assert {fk.target_fullname for fk in Fixture.__table__.foreign_keys} == {
        "teams.id"
    }
    assert any(
        index.name == "ix_fixtures_gameweek" for index in Fixture.__table__.indexes
    )


def test_player_stats_have_player_fixture_foreign_keys_and_indexes():
    targets = {fk.target_fullname for fk in PlayerGameweekStat.__table__.foreign_keys}
    assert targets == {"players.id", "fixtures.id"}
    index_names = {index.name for index in PlayerGameweekStat.__table__.indexes}
    assert "ix_player_gameweek_stats_gameweek" in index_names
    assert "ix_player_gameweek_stats_player_id" in index_names


def test_player_fixture_stat_pair_is_unique():
    constraints = [
        constraint
        for constraint in PlayerGameweekStat.__table__.constraints
        if constraint.name == "uq_player_fixture_stat"
    ]
    assert len(constraints) == 1
    assert {column.name for column in constraints[0].columns} == {
        "player_id",
        "fixture_id",
    }


def test_user_lineup_jsonb_and_transfer_limit_constraint():
    assert isinstance(
        UserGameweekLineup.__table__.c.starting_player_ids.type, postgresql.JSONB
    )
    assert isinstance(
        UserGameweekLineup.__table__.c.bench_player_ids.type, postgresql.JSONB
    )
    checks = {constraint.name for constraint in UserGameweekLineup.__table__.constraints}
    assert "ck_lineup_transfers_used" in checks
    assert "uq_user_gameweek_lineup" in checks


def test_dream_team_is_unique_per_gameweek_and_stores_jsonb_players():
    assert isinstance(DreamTeam.__table__.c.top_player_ids.type, postgresql.JSONB)
    constraints = {constraint.name for constraint in DreamTeam.__table__.constraints}
    assert "uq_dream_team_gameweek" in constraints
    assert any(index.name == "ix_dream_teams_gameweek" for index in DreamTeam.__table__.indexes)
