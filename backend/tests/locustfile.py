"""Optional Locust profile for end-to-end optimizer API load.

Install Locust separately, start an isolated backend with
RATE_LIMIT_ENABLED=false, and point Locust at that test deployment. Unlike
benchmark_optimizer.py, this profile includes database and live FPL service
latency; use it as an API load check rather than the solver-only p95 gate.
"""

from locust import HttpUser, constant, task


class OptimizerUser(HttpUser):
    wait_time = constant(0)

    @task
    def solve_squad(self):
        self.client.post(
            "/api/v1/optimizer/solve",
            json={
                "budget": 100.0,
                "locked_player_ids": [],
                "excluded_player_ids": [],
                "target_formation": None,
            },
            name="POST /api/v1/optimizer/solve",
        )
