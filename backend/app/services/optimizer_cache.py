"""Small process-local LRU cache for optimizer API responses."""

from collections import OrderedDict
from threading import Lock
from typing import TypeAlias

from app.schemas.optimizer import OptimizerRequest, OptimizerResponse


OptimizerCacheKey: TypeAlias = tuple[float, str | None, tuple[int, ...], tuple[int, ...]]


def build_optimizer_cache_key(request: OptimizerRequest) -> OptimizerCacheKey:
    """Build a stable key; player ID order does not affect optimization."""
    return (
        float(request.budget),
        request.target_formation,
        tuple(sorted(request.locked_player_ids)),
        tuple(sorted(request.excluded_player_ids)),
    )


class OptimizerResponseCache:
    """Thread-safe bounded LRU cache that returns independent response copies."""

    def __init__(self, max_entries: int = 256) -> None:
        if max_entries < 1:
            raise ValueError("max_entries must be a positive integer.")
        self.max_entries = max_entries
        self._entries: OrderedDict[OptimizerCacheKey, OptimizerResponse] = OrderedDict()
        self._lock = Lock()

    def get(self, key: OptimizerCacheKey) -> OptimizerResponse | None:
        with self._lock:
            response = self._entries.get(key)
            if response is None:
                return None
            self._entries.move_to_end(key)
            return response.model_copy(deep=True)

    def put(self, key: OptimizerCacheKey, response: OptimizerResponse) -> None:
        # Store a copy so callers cannot mutate a cached object after insertion.
        cached_response = response.model_copy(deep=True)
        with self._lock:
            self._entries[key] = cached_response
            self._entries.move_to_end(key)
            while len(self._entries) > self.max_entries:
                self._entries.popitem(last=False)

    def clear(self) -> None:
        """Clear all entries. Primarily useful for tests and local operations."""
        with self._lock:
            self._entries.clear()


optimizer_response_cache = OptimizerResponseCache()
