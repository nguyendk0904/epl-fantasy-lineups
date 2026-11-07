import httpx
import pytest

from app.services.fdr_service import (
    FPL_FIXTURES_URL,
    get_next_gameweek_fdr_multipliers,
)


class FixtureResponse:
    def __init__(self, fixtures):
        self.fixtures = fixtures

    def raise_for_status(self):
        pass

    def json(self):
        return self.fixtures


def test_service_fetches_fdr_for_next_unfinished_gameweek(monkeypatch):
    fixtures = [
        {
            "event": 3,
            "finished": True,
            "team_h": 1,
            "team_a": 2,
            "team_h_difficulty": 1,
            "team_a_difficulty": 5,
        },
        {
            "event": 4,
            "finished": False,
            "team_h": 1,
            "team_a": 2,
            "team_h_difficulty": 2,
            "team_a_difficulty": 4,
        },
        {
            "event": 5,
            "finished": False,
            "team_h": 1,
            "team_a": 3,
            "team_h_difficulty": 5,
            "team_a_difficulty": 1,
        },
    ]
    calls = []

    def fake_get(url, timeout):
        calls.append((url, timeout))
        return FixtureResponse(fixtures)

    monkeypatch.setattr(httpx, "get", fake_get)

    multipliers = get_next_gameweek_fdr_multipliers()

    assert calls == [(FPL_FIXTURES_URL, 10.0)]
    assert multipliers == {1: 1.15, 2: 0.90}


@pytest.mark.parametrize(
    ("difficulty", "expected_multiplier"),
    [(1, 1.20), (2, 1.15), (3, 1.00), (4, 0.90), (5, 0.80)],
)
def test_service_maps_each_fdr_value(monkeypatch, difficulty, expected_multiplier):
    fixture = {
        "event": 7,
        "finished": False,
        "team_h": 10,
        "team_a": 11,
        "team_h_difficulty": difficulty,
        "team_a_difficulty": 3,
    }
    monkeypatch.setattr(
        httpx,
        "get",
        lambda *args, **kwargs: FixtureResponse([fixture]),
    )

    multipliers = get_next_gameweek_fdr_multipliers()

    assert multipliers[10] == expected_multiplier
    assert multipliers[11] == 1.0


def test_service_averages_multiplier_for_double_gameweek(monkeypatch):
    fixtures = [
        {
            "event": 8,
            "finished": False,
            "team_h": 10,
            "team_a": 11,
            "team_h_difficulty": 2,
            "team_a_difficulty": 3,
        },
        {
            "event": 8,
            "finished": False,
            "team_h": 12,
            "team_a": 10,
            "team_h_difficulty": 3,
            "team_a_difficulty": 5,
        },
    ]
    monkeypatch.setattr(
        httpx,
        "get",
        lambda *args, **kwargs: FixtureResponse(fixtures),
    )

    multipliers = get_next_gameweek_fdr_multipliers()

    assert multipliers[10] == pytest.approx((1.15 + 0.80) / 2)


def test_service_raises_runtime_error_when_fpl_api_fails(monkeypatch):
    def fail_request(*args, **kwargs):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(httpx, "get", fail_request)

    with pytest.raises(RuntimeError, match="Could not fetch FPL fixtures"):
        get_next_gameweek_fdr_multipliers()


def test_service_raises_runtime_error_for_invalid_fdr(monkeypatch):
    fixture = {
        "event": 9,
        "finished": False,
        "team_h": 10,
        "team_a": 11,
        "team_h_difficulty": 6,
        "team_a_difficulty": 3,
    }
    monkeypatch.setattr(
        httpx,
        "get",
        lambda *args, **kwargs: FixtureResponse([fixture]),
    )

    with pytest.raises(RuntimeError, match="invalid team or FDR"):
        get_next_gameweek_fdr_multipliers()
