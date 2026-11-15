import pytest

from benchmark_optimizer import percentile, run_benchmark
from app.services.optimizer_solver import OptimizationResult


@pytest.mark.parametrize(
    ("percentile_value", "expected"),
    [(0, 1.0), (50, 2.0), (95, 4.0), (100, 4.0)],
)
def test_percentile_uses_nearest_rank(percentile_value, expected):
    assert percentile([4.0, 1.0, 3.0, 2.0], percentile_value) == expected


def test_percentile_rejects_empty_samples():
    with pytest.raises(ValueError, match="At least one sample"):
        percentile([], 95)


def test_percentile_rejects_out_of_range_value():
    with pytest.raises(ValueError, match="between 0 and 100"):
        percentile([1.0], 101)


def test_benchmark_uses_synchronized_calls_and_returns_counts(monkeypatch):
    call_count = 0

    def fake_optimizer(_players, budget):
        nonlocal call_count
        call_count += 1
        return OptimizationResult(
            selected_player_ids=tuple(range(1, 16)),
            total_cost=budget,
            total_expected_points=80.0,
        )

    monkeypatch.setattr("benchmark_optimizer.optimize_squad", fake_optimizer)

    summary = run_benchmark(
        players=[],
        concurrency=3,
        request_count=7,
        warmup_count=0,
    )

    assert summary.requested == 7
    assert summary.completed == 7
    assert summary.failed == 0
    assert summary.p50_ms is not None
    assert summary.p95_ms is not None
    assert summary.peak_python_memory_mib >= 0
    assert call_count == 7
