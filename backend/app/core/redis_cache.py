"""P4-Q02: 5-minute Redis cache for Leaderboard & Fixtures with invalidation.

Why this module exists
----------------------
P4-NH03's ``GET /api/v1/fixtures`` and P4-NH04's ``GET /api/v1/leaderboard`` are
read-heavy endpoints that run several SQL passes (window ranks, joins, player
metadata lookups). Under thousands of simultaneous requests they consume the
RDS connection pool even though the response is identical for minutes. The cache
stores their final JSON payloads for ``REDIS_CACHE_TTL_SECONDS`` (default 300 s
= 5 minutes), so a cache hit costs no SQL and answers well under the <20 ms
acceptance budget.

Free-Tier / cost-first design ($0)
----------------------------------
* Local, dev and tests default to ``REDIS_CACHE_ENABLED=false`` and use the
  in-process :class:`MemoryCache` backend: zero servers, zero cost, no extra
  container.
* On AWS, ``REDIS_CACHE_URL`` can point to an ElastiCache for Redis node
  (``cache.t3.micro``, inside the Free Tier) or the ``infra/docker-compose.yml``
  redis service for local load tests. The same code path is exercised either way.
* Every read/write failure degrades to a cache *miss* -> PostgreSQL. A Redis
  outage is logged as ``redis_cache_unavailable`` and never returns 5xx.

Safety properties
-----------------
* Keys are namespaced ``fpl:{ENVIRONMENT}:{kind}:...`` so environments never
  collide (leaderboard keys use gameweek/sort/page/limit, fixtures use gameweek).
* Invalidation uses SCAN (cursor-based) + DELETE, never blocking ``KEYS``, so a
  production keyspace never freezes the Redis single thread.
* Values are JSON strings produced from ``model_dump(mode="json")``, so API
  response contracts stay byte-for-byte identical on hit and miss.
* Invalidation fires where points are written: ``score_completed_gameweek()``
  and ``confirm_transfers()`` clear the leaderboard namespace and fixture sync
  clears the fixtures namespace. Cache reads only happen in the endpoint layer.
"""

from __future__ import annotations

import asyncio
import fnmatch
import json
import logging
from datetime import date, datetime
from decimal import Decimal
from time import monotonic
from typing import Any, Awaitable, Callable

from app.core.config import settings

logger = logging.getLogger("app.redis_cache")


def _json_default(value: Any) -> str:
    """Make values JSON-safe even if a future caller forgets ``mode="json"``."""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def _pattern_matches(pattern: str, key: str) -> bool:
    return fnmatch.fnmatchcase(key, pattern)


class MemoryCache:
    """Process-local TTL store; the $0 backend for dev/tests and ONE worker.

    A single uvicorn worker (the current deployment) sees exactly these entries;
    multi-worker/replica deployments must use the shared Redis backend instead.
    """

    def __init__(self, ttl_seconds: float) -> None:
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be a positive number")
        self._ttl_seconds = float(ttl_seconds)
        self._entries: dict[str, tuple[float, str]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> str | None:
        async with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            created_at, payload = entry
            if monotonic() - created_at >= self._ttl_seconds:
                del self._entries[key]
                return None
            return payload

    async def set(self, key: str, payload: str, ttl: float | None = None) -> None:
        async with self._lock:
            self._entries[key] = (monotonic(), payload)

    async def delete_matching(self, pattern: str) -> int:
        async with self._lock:
            keys = [key for key in self._entries if _pattern_matches(pattern, key)]
            for key in keys:
                del self._entries[key]
            return len(keys)

    async def clear(self) -> None:
        async with self._lock:
            self._entries.clear()


class RedisClientCache:
    """Async Redis backend (``redis.asyncio``) with short, fail-fast timeouts.

    The redis package is imported lazily so this module imports cleanly even on
    a machine without the Redis dependency; the memory backend simply stays in
    use there.
    """

    def __init__(self, url: str, ttl_seconds: float) -> None:
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be a positive number")
        self._url = url
        self._ttl_seconds = float(ttl_seconds)
        self._client: Any | None = None
        self._client_lock = asyncio.Lock()

    async def _get_client(self) -> Any:
        if self._client is None:
            async with self._client_lock:
                if self._client is None:
                    import redis.asyncio as aioredis

                    self._client = aioredis.from_url(
                        self._url,
                        decode_responses=True,
                        socket_connect_timeout=1.0,
                        socket_timeout=1.0,
                        health_check_interval=30,
                    )
        return self._client

    async def get(self, key: str) -> str | None:
        client = await self._get_client()
        return await client.get(key)

    async def set(self, key: str, payload: str, ttl: float | None = None) -> None:
        client = await self._get_client()
        await client.set(key, payload, ex=int(ttl or self._ttl_seconds))

    async def delete_matching(self, pattern: str) -> int:
        # SCAN + DELETE instead of KEYS: never block the Redis single thread.
        client = await self._get_client()
        deleted = 0
        async for key in client.scan_iter(match=pattern, count=100):
            deleted += await client.delete(key)
        return deleted


class CacheService:
    """Facade: namespaced keys, get-or-set access and per-kind invalidation.

    Any backend exception is treated as a miss so endpoints fall back to the
    database rather than failing when Redis is down.
    """

    def __init__(
        self,
        backend: MemoryCache | RedisClientCache,
        namespace: str,
        ttl_seconds: float,
        *,
        enabled: bool = True,
    ) -> None:
        self.backend = backend
        self.namespace = namespace.rstrip(":")
        self.ttl_seconds = float(ttl_seconds)
        self.enabled = enabled
        self.hits = 0
        self.misses = 0

    def build_key(self, kind: str, **parts: Any) -> str:
        """Return a stable, ordered key like ``fpl:dev:leaderboard:gameweek=2:page=1``."""
        suffix = ":".join(f"{name}={value}" for name, value in sorted(parts.items()))
        return f"{self.namespace}:{kind}:{suffix}" if suffix else f"{self.namespace}:{kind}"

    async def get(self, key: str) -> Any | None:
        if not self.enabled:
            self.misses += 1
            return None
        try:
            payload = await self.backend.get(key)
        except Exception as exc:
            self.misses += 1
            logger.warning("redis_cache_unavailable key=%s error=%s", key, type(exc).__name__)
            return None
        if payload is None:
            self.misses += 1
            return None
        try:
            value = json.loads(payload)
        except (TypeError, ValueError):
            # Corrupt or foreign payload: treat as a miss instead of crashing.
            self.misses += 1
            return None
        self.hits += 1
        return value

    async def set(self, key: str, value: Any) -> None:
        if not self.enabled:
            return
        payload = json.dumps(value, separators=(",", ":"), default=_json_default)
        try:
            await self.backend.set(key, payload, ttl=self.ttl_seconds)
        except Exception as exc:
            logger.warning("redis_cache_write_failed key=%s error=%s", key, type(exc).__name__)

    async def get_or_set(self, key: str, factory: Callable[[], Awaitable[Any]]) -> Any:
        """Return the cached value or build it via ``factory`` and store it."""
        cached = await self.get(key)
        if cached is not None:
            return cached
        value = await factory()
        await self.set(key, value)
        return value

    async def invalidate(self, pattern: str) -> int:
        """Delete every key under ``fpl:{ENV}:{pattern}``; returns removed count."""
        if not self.enabled:
            return 0
        full_pattern = f"{self.namespace}:{pattern}"
        try:
            return await self.backend.delete_matching(full_pattern)
        except Exception as exc:
            logger.warning("redis_cache_invalidate_failed pattern=%s error=%s", pattern, type(exc).__name__)
            return 0

    async def invalidate_leaderboard(self) -> int:
        """Clear all cached leaderboard pages — called when points change."""
        return await self.invalidate("leaderboard:*")

    async def invalidate_fixtures(self) -> int:
        """Clear all cached fixture lists — called whenever fixtures are synced."""
        return await self.invalidate("fixtures:*")


def _select_backend(url: str, ttl_seconds: float, enabled: bool) -> MemoryCache | RedisClientCache:
    if enabled and not str(url).startswith("memory://"):
        return RedisClientCache(str(url), ttl_seconds)
    return MemoryCache(ttl_seconds)


def create_cache_service(config: Any | None = None) -> CacheService:
    """Build the app-wide service from settings, or from an injected test config."""
    cfg = config if config is not None else settings
    enabled = bool(getattr(cfg, "REDIS_CACHE_ENABLED", False))
    url = str(getattr(cfg, "REDIS_CACHE_URL", "memory://") or "memory://")
    ttl = float(getattr(cfg, "REDIS_CACHE_TTL_SECONDS", 300))
    backend = _select_backend(url, ttl, enabled)
    return CacheService(
        backend,
        namespace=f"fpl:{cfg.ENVIRONMENT}",
        ttl_seconds=ttl,
        enabled=enabled,
    )


# App-wide singleton. ``REDIS_CACHE_ENABLED=false`` (the default) keeps it on the
# in-memory backend; production flips it on and points REDIS_CACHE_URL at a
# shared Redis endpoint before scaling beyond one worker.
cache_service = create_cache_service()
