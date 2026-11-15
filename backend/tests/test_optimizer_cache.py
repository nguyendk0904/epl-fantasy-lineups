import time

import pytest

from app.api.v1.endpoints import optimizer as optimizer_endpoint
from app.schemas.optimizer import OptimizedPlayer, OptimizerRequest, OptimizerResponse
from app.services.optimizer_cache import (
    OptimizerResponseCache,
    build_optimizer_cache_key,
)


def _request(**overrides):
    values = {
        "budget": 100.0,
        "target_formation": "4-4-2",
        "locked_player_ids": [9, 3],
        "excluded_player_ids": [18, 12],
    }
    values.update(overrides)
    return OptimizerRequest(**values)


def _response(name="Salah"):
    return OptimizerResponse(
        status="optimal",
        total_cost=99.5,
        total_expected_points=75.2,
        starting_xi=[
            OptimizedPlayer(
                id=1,
                web_name=name,
                element_type="MID",
                team_id=1,
                now_cost=13.0,
                expected_points_next=8.2,
            )
        ],
        captain_id=1,
        vice_captain_id=2,
        formation="4-4-2",
    )


def test_cache_key_ignores_order_of_locked_and_excluded_ids():
    first = build_optimizer_cache_key(_request())
    reordered = build_optimizer_cache_key(
        _request(locked_player_ids=[3, 9], excluded_player_ids=[12, 18])
    )

    assert first == reordered


@pytest.mark.parametrize(
    "changes",
    [
        {"budget": 99.9},
        {"target_formation": "3-4-3"},
        {"locked_player_ids": [3]},
        {"excluded_player_ids": [12]},
    ],
)
def test_cache_key_changes_when_optimization_input_changes(changes):
    assert build_optimizer_cache_key(_request()) != build_optimizer_cache_key(
        _request(**changes)
    )


def test_cache_miss_returns_none():
    cache = OptimizerResponseCache()

    assert cache.get(build_optimizer_cache_key(_request())) is None


def test_cache_returns_independent_copy_and_stores_independent_copy():
    cache = OptimizerResponseCache()
    key = build_optimizer_cache_key(_request())
    response = _response()
    cache.put(key, response)
    response.starting_xi[0].web_name = "Changed after put"

    first = cache.get(key)
    assert first is not None
    assert first.starting_xi[0].web_name == "Salah"
    first.starting_xi[0].web_name = "Changed after get"
    assert cache.get(key).starting_xi[0].web_name == "Salah"


def test_cache_evicts_least_recently_used_entry():
    cache = OptimizerResponseCache(max_entries=2)
    key_a = build_optimizer_cache_key(_request(budget=100))
    key_b = build_optimizer_cache_key(_request(budget=101))
    key_c = build_optimizer_cache_key(_request(budget=102))
    cache.put(key_a, _response("A"))
    cache.put(key_b, _response("B"))
    cache.get(key_a)  # A becomes most recently used.
    cache.put(key_c, _response("C"))

    assert cache.get(key_a).starting_xi[0].web_name == "A"
    assert cache.get(key_b) is None
    assert cache.get(key_c).starting_xi[0].web_name == "C"


def test_cache_rejects_non_positive_capacity():
    with pytest.raises(ValueError, match="positive integer"):
        OptimizerResponseCache(max_entries=0)


@pytest.mark.asyncio
async def test_cached_optimizer_request_skips_database_and_returns_under_5ms(monkeypatch):
    cache = OptimizerResponseCache()
    monkeypatch.setattr(optimizer_endpoint, "optimizer_response_cache", cache)
    request = _request()
    key = build_optimizer_cache_key(request)
    expected = _response()
    cache.put(key, expected)

    class DatabaseMustNotBeUsed:
        async def execute(self, _statement):
            pytest.fail("cache hit should return before querying the database")

    timings = []
    for _ in range(100):
        started = time.perf_counter()
        actual = await optimizer_endpoint.solve_optimizer(request, DatabaseMustNotBeUsed())
        timings.append((time.perf_counter() - started) * 1000)
        assert actual == expected

    p95_ms = sorted(timings)[int(len(timings) * 0.95) - 1]
    assert p95_ms < 5.0
