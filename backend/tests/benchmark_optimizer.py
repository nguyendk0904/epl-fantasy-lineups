"""Concurrent benchmark for the squad solver using mock data and mock FDR.

Run from the repository root with:
    python backend/tests/benchmark_optimizer.py

This measures solver calls directly so database, HTTP API, rate-limit, and FPL
network latency do not affect the P3-V01 acceptance measurement.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
import math
from pathlib import Path
import sys
from threading import Barrier
from time import perf_counter, process_time
import tracemalloc
from unittest.mock import patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
TESTS_ROOT = Path(__file__).resolve().parent
for import_path in (str(BACKEND_ROOT), str(TESTS_ROOT)):
    if import_path not in sys.path:
        sys.path.insert(0, import_path)

from app.services.optimizer_solver import (
    MAX_CONCURRENT_SOLVES,
    load_players_from_json,
    optimize_squad,
)
from mock_fdr_service import get_next_gameweek_fdr_multipliers

MOCK_DATA_PATH = TESTS_ROOT / "mock_data.json"


@dataclass(frozen=True)
class BenchmarkSummary:
    concurrency: int
    requested: int
    completed: int
    failed: int
    p50_ms: float | None
    p95_ms: float | None
    max_ms: float | None
    wall_seconds: float
    python_cpu_seconds: float
    peak_python_memory_mib: float


def percentile(samples: list[float], percentile_value: float) -> float:
    """Return a nearest-rank percentile from a non-empty sample list."""
    if not samples:
        raise ValueError("At least one sample is required.")
    if not 0 <= percentile_value <= 100:
        raise ValueError("Percentile must be between 0 and 100.")
    ordered = sorted(samples)
    rank = max(1, math.ceil(percentile_value / 100 * len(ordered)))
    return ordered[rank - 1]


def _solve_once(players, budget: float) -> float:
    started_at = perf_counter()
    result = optimize_squad(players, budget=budget)
    elapsed = perf_counter() - started_at
    if len(result.selected_player_ids) != 15:
        raise RuntimeError("Optimizer returned a squad with an invalid player count.")
    return elapsed * 1000


def run_benchmark(
    players,
    concurrency: int,
    request_count: int,
    budget: float = 100.0,
    warmup_count: int = 1,
) -> BenchmarkSummary:
    """Run concurrent solver calls and return latency and process metrics."""
    if concurrency < 1 or request_count < 1 or warmup_count < 0:
        raise ValueError("Concurrency/request counts must be positive; warmup non-negative.")

    with patch(
        "app.services.optimizer_solver.get_next_gameweek_fdr_multipliers",
        get_next_gameweek_fdr_multipliers,
    ):
        for _ in range(warmup_count):
            _solve_once(players, budget)

        latencies = []
        failures = 0
        started_at = perf_counter()
        cpu_started_at = process_time()
        tracemalloc.start()

        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            submitted = 0
            while submitted < request_count:
                batch_size = min(concurrency, request_count - submitted)
                start_barrier = Barrier(batch_size)

                def synchronized_solve():
                    start_barrier.wait(timeout=30)
                    return _solve_once(players, budget)

                futures = [
                    executor.submit(synchronized_solve)
                    for _ in range(batch_size)
                ]
                submitted += batch_size
                for future in as_completed(futures):
                    try:
                        latencies.append(future.result())
                    except Exception:
                        failures += 1

        _, peak_bytes = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        wall_seconds = perf_counter() - started_at
        cpu_seconds = process_time() - cpu_started_at

    return BenchmarkSummary(
        concurrency=concurrency,
        requested=request_count,
        completed=len(latencies),
        failed=failures,
        p50_ms=round(percentile(latencies, 50), 2) if latencies else None,
        p95_ms=round(percentile(latencies, 95), 2) if latencies else None,
        max_ms=round(max(latencies), 2) if latencies else None,
        wall_seconds=round(wall_seconds, 2),
        python_cpu_seconds=round(cpu_seconds, 2),
        peak_python_memory_mib=round(peak_bytes / (1024 * 1024), 2),
    )


def _print_summary(summary: BenchmarkSummary) -> None:
    print(f"Configured concurrent CBC capacity: {MAX_CONCURRENT_SOLVES}")
    print(
        f"Concurrency {summary.concurrency}: {summary.completed}/"
        f"{summary.requested} succeeded, {summary.failed} failed; "
        f"p50={summary.p50_ms} ms, p95={summary.p95_ms} ms, "
        f"max={summary.max_ms} ms; wall={summary.wall_seconds}s, "
        f"Python CPU={summary.python_cpu_seconds}s, "
        f"peak Python allocations={summary.peak_python_memory_mib} MiB"
    )


def main() -> int:
    players = load_players_from_json(MOCK_DATA_PATH)
    summaries = [
        run_benchmark(players, concurrency=count, request_count=60)
        for count in (20, 30, 50)
    ]
    for summary in summaries:
        _print_summary(summary)

    target = next(summary for summary in summaries if summary.concurrency == 30)
    passed = target.failed == 0 and target.p95_ms is not None and target.p95_ms < 200
    print(
        "P3-V01 acceptance: "
        + ("PASS (30 concurrent, p95 < 200 ms)" if passed else "FAIL")
    )
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
