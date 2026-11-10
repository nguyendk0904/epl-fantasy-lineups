"""P3-NH02: real SlowAPI counters, fake clocks and no Redis/RDS network calls."""

import asyncio
import importlib
import io
import json
import time
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx
from limits.storage import MemoryStorage
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core import rate_limiter as rates
from app.core.logging_config import configure_logging, RequestLoggingMiddleware


def config(**overrides):
    values = dict(
        _env_file=None, ENVIRONMENT="development", API_V1_STR="/api/v1",
        DATABASE_URL="postgresql+asyncpg://user:fake@localhost/fpl",
        RDS_HOSTNAME=None, RDS_DB_NAME=None, RDS_USERNAME=None, RDS_PASSWORD=None,
        RATE_LIMIT_ENABLED=True, RATE_LIMIT_STORAGE_URI="memory://",
        CLOUDWATCH_LOGGING_ENABLED=False, LOG_LEVEL="INFO",
    )
    values.update(overrides)
    return Settings(**values)


def build_app(**overrides):
    cfg = config(**overrides)
    app = FastAPI()
    calls = {"players": 0, "optimizer": 0}

    @app.get(f"{cfg.API_V1_STR}/players")
    async def players():
        calls["players"] += 1
        return {"ok": True}

    @app.post(f"{cfg.API_V1_STR}/optimizer/solve")
    async def optimizer():
        calls["optimizer"] += 1
        return {"ok": True}

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    limiter = rates.APIRateLimiter(cfg)
    app.add_middleware(rates.RateLimitMiddleware, limiter=limiter, routes=app.router.routes)
    app.add_middleware(CORSMiddleware, allow_origins=["https://frontend.example"], allow_methods=["GET", "POST"])
    app.add_middleware(RequestLoggingMiddleware)
    return app, limiter, calls


def client(app, ip="192.0.2.1"):
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, client=(ip, 12345)), base_url="http://test",
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("method,path,limit", [
    ("GET", "/api/v1/players", 60), ("POST", "/api/v1/optimizer/solve", 10),
])
async def test_exact_quota_then_429_before_endpoint_runs(method, path, limit):
    app, _, calls = build_app()
    async with client(app) as http:
        responses = [await http.request(method, path) for _ in range(limit)]
        rejected = await http.request(method, path)
    assert all(response.status_code == 200 for response in responses)
    assert rejected.status_code == 429
    assert rejected.json() == {"detail": "Rate limit exceeded"}
    assert 1 <= int(rejected.headers["retry-after"]) <= 60
    assert sum(calls.values()) == limit


@pytest.mark.asyncio
async def test_quota_resets_at_sixty_seconds_and_rejections_do_not_extend_it(monkeypatch):
    clock = [time.time()]
    fake_time = SimpleNamespace(time=lambda: clock[0])
    monkeypatch.setattr(importlib.import_module("limits.storage.memory"), "time", fake_time)
    monkeypatch.setattr(rates, "time", fake_time)
    app, _, _ = build_app()
    async with client(app) as http:
        for _ in range(10):
            assert (await http.post("/api/v1/optimizer/solve")).status_code == 200
        clock[0] += 59
        response = await http.post("/api/v1/optimizer/solve")
        assert response.status_code == 429
        assert response.headers["retry-after"] == "1"
        clock[0] += 1
        assert (await http.post("/api/v1/optimizer/solve")).status_code == 200


@pytest.mark.asyncio
async def test_query_parameters_do_not_bypass_limit():
    app, _, _ = build_app()
    async with client(app) as http:
        for i in range(60):
            assert (await http.get("/api/v1/players", params={"search": f"name-{i}"})).status_code == 200
        assert (await http.get("/api/v1/players?search=different")).status_code == 429


@pytest.mark.asyncio
async def test_clients_and_endpoints_have_separate_buckets():
    app, _, _ = build_app()
    async with client(app, "192.0.2.1") as first, client(app, "192.0.2.2") as second:
        for _ in range(10):
            await first.post("/api/v1/optimizer/solve")
        assert (await first.post("/api/v1/optimizer/solve")).status_code == 429
        assert (await second.post("/api/v1/optimizer/solve")).status_code == 200
        assert (await first.get("/api/v1/players")).status_code == 200


@pytest.mark.asyncio
async def test_forwarded_headers_cannot_spoof_client_identity():
    app, _, _ = build_app()
    async with client(app) as http:
        for i in range(10):
            assert (await http.post("/api/v1/optimizer/solve", headers={"x-forwarded-for": f"198.51.100.{i}"})).status_code == 200
        response = await http.post("/api/v1/optimizer/solve", headers={"x-forwarded-for": "203.0.113.1", "x-real-ip": "203.0.113.2", "forwarded": "for=203.0.113.3"})
        assert response.status_code == 429


@pytest.mark.asyncio
async def test_health_and_preflight_are_unlimited_and_429_keeps_cors_and_logging():
    app, _, _ = build_app()
    stream = io.StringIO()
    runtime = configure_logging(config(), stream=stream)
    try:
        async with client(app) as http:
            for _ in range(11):
                response = await http.post("/api/v1/optimizer/solve", headers={"origin": "https://frontend.example"})
            assert response.status_code == 429
            assert response.headers["access-control-allow-origin"] == "https://frontend.example"
            assert len(response.headers["x-request-id"]) == 32
            for _ in range(12):
                assert (await http.get("/health")).status_code == 200
                preflight = await http.options("/api/v1/optimizer/solve", headers={
                    "origin": "https://frontend.example", "access-control-request-method": "POST",
                })
                assert preflight.status_code == 200
        rejected = [json.loads(line) for line in stream.getvalue().splitlines() if json.loads(line).get("status_code") == 429]
        assert len(rejected) == 1
        assert rejected[0]["path"] == "/api/v1/optimizer/solve"
        assert rejected[0]["request_id"] == response.headers["x-request-id"]
    finally:
        runtime.close()


@pytest.mark.asyncio
async def test_concurrent_requests_cannot_exceed_quota():
    app, _, calls = build_app()
    async with client(app) as http:
        responses = await asyncio.gather(*[http.post("/api/v1/optimizer/solve") for _ in range(25)])
    assert sum(response.status_code == 200 for response in responses) == 10
    assert sum(response.status_code == 429 for response in responses) == 15
    assert calls["optimizer"] == 10


@pytest.mark.asyncio
async def test_disabled_limiter_never_uses_storage():
    app, limiter, calls = build_app(RATE_LIMIT_ENABLED=False)
    assert limiter.backend is None
    async with client(app) as http:
        for _ in range(12):
            assert (await http.post("/api/v1/optimizer/solve")).status_code == 200
    assert calls["optimizer"] == 12


@pytest.mark.asyncio
async def test_storage_failure_returns_503_without_fail_open_or_secret_leak(monkeypatch, caplog):
    app, limiter, calls = build_app()

    def fail(*args, **kwargs):
        raise OSError("redis://user:private-password@redis.example/0")

    monkeypatch.setattr(limiter.backend.limiter, "hit", fail)
    async with client(app) as http:
        response = await http.post("/api/v1/optimizer/solve")
        assert (await http.get("/health")).status_code == 200
    assert response.status_code == 503
    assert response.headers["retry-after"] == "1"
    assert calls["optimizer"] == 0
    assert "private-password" not in response.text + caplog.text


@pytest.mark.asyncio
async def test_two_app_instances_share_counters_when_using_same_backend(monkeypatch):
    storage = MemoryStorage()
    configured = []

    def storage_factory(uri, **kwargs):
        configured.append((uri, kwargs))
        return storage

    monkeypatch.setattr(importlib.import_module("slowapi.extension"), "storage_from_string", storage_factory)
    first, _, _ = build_app(RATE_LIMIT_STORAGE_URI="redis://redis.example/0")
    second, _, _ = build_app(RATE_LIMIT_STORAGE_URI="redis://redis.example/0")
    async with client(first) as one, client(second) as two:
        for _ in range(6):
            assert (await one.post("/api/v1/optimizer/solve")).status_code == 200
        for _ in range(4):
            assert (await two.post("/api/v1/optimizer/solve")).status_code == 200
        assert (await two.post("/api/v1/optimizer/solve")).status_code == 429
    assert len(configured) == 2
    assert configured[0][1] == {"socket_connect_timeout": 1, "socket_timeout": 1}


@pytest.mark.asyncio
async def test_configured_api_prefix_is_respected():
    app, _, _ = build_app(API_V1_STR="/custom/v1")
    async with client(app) as http:
        for _ in range(10):
            await http.post("/custom/v1/optimizer/solve")
        assert (await http.post("/custom/v1/optimizer/solve")).status_code == 429


@pytest.mark.asyncio
async def test_trailing_slash_redirect_does_not_bypass_limit():
    app, _, _ = build_app()
    async with client(app) as http:
        for _ in range(10):
            assert (await http.post("/api/v1/optimizer/solve/", follow_redirects=True)).status_code == 200
        assert (await http.post("/api/v1/optimizer/solve/", follow_redirects=True)).status_code == 429


@pytest.mark.parametrize("uri", ["", "sqlite:///db", "redis://", "redis://host:99999"])
def test_invalid_storage_uri_is_rejected(uri):
    with pytest.raises(ValidationError):
        config(RATE_LIMIT_STORAGE_URI=uri)


@pytest.mark.parametrize("uri", ["memory://", "redis://localhost:6379/0", "rediss://user:private-password@redis.example:6379/0"])
def test_supported_storage_uri_and_secret_repr(uri):
    cfg = config(RATE_LIMIT_STORAGE_URI=uri)
    assert cfg.RATE_LIMIT_STORAGE_URI.get_secret_value() == uri
    assert "private-password" not in repr(cfg)


def test_equivalent_ipv6_addresses_have_same_client_key():
    def scope(host):
        return {"type": "http", "client": (host, 123), "method": "GET", "path": "/", "headers": []}
    assert rates.APIRateLimiter.client_key(scope("2001:db8::1")) == rates.APIRateLimiter.client_key(scope("2001:0db8:0:0:0:0:0:1"))
    assert rates.APIRateLimiter.client_key(scope("::ffff:192.0.2.1")) == rates.APIRateLimiter.client_key(scope("192.0.2.1"))
