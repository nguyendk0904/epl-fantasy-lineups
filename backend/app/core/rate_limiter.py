"""P3-NH02: SlowAPI-backed limits without changing endpoint modules.

GET /api/v1/players: 60/minute; POST /api/v1/optimizer/solve: 10/minute.
Counters use a 60-second fixed window from the first request. Query strings
do not create new buckets. OPTIONS, health and other routes are unaffected.

RATE_LIMIT_STORAGE_URI defaults to memory:// (ONE process only). Quang must
configure a shared redis:// or rediss:// URI for multiple workers/replicas.
No Redis infrastructure is created here. Storage failures return 503, never
silently fall back to independent memory counters. Client identity comes only
from ASGI client: Quang configures Uvicorn trusted proxy addresses; raw forwarded
headers are never trusted here. Synchronous storage I/O runs off the event loop.
"""

import asyncio
import hashlib
import ipaddress
import logging
import math
import os
import time

from limits import parse
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


class APIRateLimiter:
    def __init__(self, config):
        self.enabled = config.RATE_LIMIT_ENABLED
        self.namespace = f"fpl:{config.ENVIRONMENT}:{config.API_V1_STR}"
        self.rules = {
            ("GET", f"{config.API_V1_STR}/players"): parse("60/minute"),
            ("POST", f"{config.API_V1_STR}/optimizer/solve"): parse("10/minute"),
        }
        self.backend = None
        if self.enabled:
            uri = config.RATE_LIMIT_STORAGE_URI.get_secret_value()
            options = {} if uri == "memory://" else {"socket_connect_timeout": 1, "socket_timeout": 1}
            try:
                self.backend = Limiter(
                    key_func=get_remote_address, storage_uri=uri,
                    strategy="fixed-window", storage_options=options,
                    auto_check=False, swallow_errors=False,
                    in_memory_fallback_enabled=False,
                    config_filename=os.devnull,
                )
            except Exception:
                raise RuntimeError("Rate-limit storage initialization failed; verify configuration") from None

    @staticmethod
    def client_key(scope: Scope) -> str:
        host = get_remote_address(Request(scope))
        try:
            address = ipaddress.ip_address(host)
            host = str(address.ipv4_mapped) if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped else address.compressed
        except ValueError:
            pass
        # Do not store raw client IPs as Redis keys.
        return hashlib.sha256(host.encode("utf-8")).hexdigest()

    def _check(self, rule, method: str, path: str, client: str) -> int | None:
        limiter = self.backend.limiter
        identifiers = (self.namespace, method, path, client)
        if limiter.hit(rule, *identifiers):
            return None
        window = limiter.get_window_stats(rule, *identifiers)
        return max(1, min(60, math.ceil(window.reset_time - time.time())))

    async def check(self, scope: Scope, path: str) -> int | None:
        return await asyncio.to_thread(
            self._check, self.rules[(scope["method"], path)],
            scope["method"], path, self.client_key(scope),
        )


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp, limiter: APIRateLimiter, routes):
        self.app = app
        self.limiter = limiter
        self.routes = routes

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http" or not self.limiter.enabled:
            await self.app(scope, receive, send)
            return
        path = scope["path"]
        root = scope.get("root_path", "").rstrip("/")
        if root and path.startswith(root + "/"):
            path = path[len(root):]
        if (scope["method"], path) not in self.limiter.rules:
            await self.app(scope, receive, send)
            return
        # Supply the real route object to request logging even when rejected
        # before FastAPI routing/dependencies run.
        for route in self.routes:
            if getattr(route, "path", None) == path:
                scope["route"] = route
                break
        try:
            retry_after = await self.limiter.check(scope, path)
        except Exception as error:
            logging.getLogger("app.rate_limiter").error(
                "rate_limit_storage_unavailable", extra={"error_type": type(error).__name__},
            )
            response = JSONResponse(
                {"detail": "Rate-limit service unavailable"}, status_code=503,
                headers={"Retry-After": "1"},
            )
            await response(scope, receive, send)
            return
        if retry_after is not None:
            response = JSONResponse(
                {"detail": "Rate limit exceeded"}, status_code=429,
                headers={"Retry-After": str(retry_after)},
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)
