"""P2-NH03: deterministic scheduler tests without network, DB writes or waits."""

import asyncio
import importlib
from unittest.mock import AsyncMock

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.services import cron_scheduler as cron


def bootstrap(gameweek=1, *, current=True, deadline="2026-08-01T10:00:00Z"):
    return {"events": [{"id": gameweek, "is_current": current,
                        "is_next": not current, "deadline_time": deadline}]}


def client_for(payload):
    return httpx.AsyncClient(transport=httpx.MockTransport(
        lambda request: httpx.Response(200, json=payload)
    ))


def test_default_interval_and_disabled_api_setting():
    config = Settings(_env_file=None, FPL_SYNC_ENABLED=False)
    assert config.FPL_SYNC_INTERVAL_SECONDS == 21600
    assert config.FPL_SYNC_ENABLED is False
    assert cron.FPLSyncScheduler().interval_seconds == 21600


@pytest.mark.parametrize("interval", [0, -1, float("inf"), float("nan")])
def test_invalid_interval_is_rejected(interval):
    with pytest.raises(ValueError):
        cron.FPLSyncScheduler(interval_seconds=interval)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, FPL_SYNC_INTERVAL_SECONDS=interval)


def test_gameweek_prefers_current_over_next_and_supports_preseason():
    events = bootstrap(5)["events"] + bootstrap(6, current=False)["events"]
    assert cron.get_gameweek_key({"events": events})[0] == 5
    assert cron.get_gameweek_key(bootstrap(1, current=False))[0] == 1


def test_no_active_gameweek_returns_none():
    assert cron.get_gameweek_key({"events": []}) is None
    payload = bootstrap()
    payload["events"][0].update(is_current=False, is_next=False)
    assert cron.get_gameweek_key(payload) is None


@pytest.mark.parametrize("payload", [
    {}, [], {"events": None}, {"events": [None]},
    {"events": [{"id": True, "is_current": True, "is_next": False}]},
    {"events": [{"id": 39, "is_current": True, "is_next": False}]},
    {"events": [{"id": 1, "is_current": "true", "is_next": False}]},
    {"events": [{"id": 1, "is_current": True, "is_next": False, "deadline_time": 5}]},
    {"events": bootstrap(1)["events"] * 2},
    {"events": bootstrap(1)["events"] + bootstrap(2)["events"]},
])
def test_invalid_or_ambiguous_metadata_is_rejected(payload):
    with pytest.raises(ValueError):
        cron.get_gameweek_key(payload)


@pytest.mark.asyncio
async def test_sync_first_check_skip_same_gw_and_sync_next_gw():
    payload = bootstrap(1)
    sync = AsyncMock(return_value={"teams_processed": 20, "players_processed": 650})
    session_factory = object()
    async with client_for(payload) as client:
        worker = cron.FPLSyncScheduler(client=client, sync=sync, session_factory=session_factory)
        assert await worker.check_once() is True
        assert await worker.check_once() is False
        payload["events"][0]["id"] = 2
        assert await worker.check_once() is True
        assert worker.last_gameweek[0] == 2
        assert sync.await_count == 2
        sync.assert_awaited_with(session_factory, client=client, url=worker.url)
        assert not client.is_closed


@pytest.mark.asyncio
async def test_new_season_deadline_triggers_sync_even_if_gw_id_repeats():
    payload = bootstrap(1)
    sync = AsyncMock()
    async with client_for(payload) as client:
        worker = cron.FPLSyncScheduler(client=client, sync=sync)
        await worker.check_once()
        payload["events"][0]["deadline_time"] = "2027-08-01T10:00:00Z"
        assert await worker.check_once() is True
        assert sync.await_count == 2


@pytest.mark.asyncio
async def test_no_gameweek_does_not_sync():
    sync = AsyncMock()
    async with client_for({"events": []}) as client:
        worker = cron.FPLSyncScheduler(client=client, sync=sync)
        assert await worker.check_once() is False
        sync.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_failure_keeps_previous_state_and_retries():
    payload = bootstrap(1)
    sync = AsyncMock(side_effect=[None, RuntimeError("database unavailable"), None])
    async with client_for(payload) as client:
        worker = cron.FPLSyncScheduler(client=client, sync=sync)
        await worker.check_once()
        old_key = worker.last_gameweek
        payload["events"][0]["id"] = 2
        with pytest.raises(RuntimeError):
            await worker.check_once()
        assert worker.last_gameweek == old_key
        assert await worker.check_once() is True
        assert worker.last_gameweek[0] == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["http", "timeout", "json", "metadata"])
async def test_fetch_errors_do_not_sync_or_advance_state(failure):
    def respond(request):
        if failure == "timeout":
            raise httpx.ReadTimeout("timeout", request=request)
        if failure == "http":
            return httpx.Response(500)
        if failure == "json":
            return httpx.Response(200, content=b"not json")
        return httpx.Response(200, json={})

    sync = AsyncMock()
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        worker = cron.FPLSyncScheduler(client=client, sync=sync)
        with pytest.raises((httpx.HTTPError, ValueError)):
            await worker.check_once()
        assert worker.last_gameweek is None
        sync.assert_not_awaited()


@pytest.mark.asyncio
async def test_overlapping_check_is_skipped():
    entered, release = asyncio.Event(), asyncio.Event()

    async def sync(*args, **kwargs):
        entered.set()
        await release.wait()

    async with client_for(bootstrap()) as client:
        worker = cron.FPLSyncScheduler(client=client, sync=sync)
        first = asyncio.create_task(worker.check_once())
        try:
            await asyncio.wait_for(entered.wait(), timeout=1)
            assert await worker.check_once() is False
        finally:
            release.set()
            assert await first is True


@pytest.mark.asyncio
async def test_loop_retries_after_failure_and_waits_six_hours(monkeypatch, caplog):
    worker = cron.FPLSyncScheduler()
    worker.check_once = AsyncMock(side_effect=[RuntimeError("do-not-log-this-secret"), False])
    waits = []

    async def sleep(delay):
        waits.append(delay)
        if len(waits) == 2:
            raise asyncio.CancelledError

    monkeypatch.setattr(cron.asyncio, "sleep", sleep)
    with pytest.raises(asyncio.CancelledError):
        await worker.run()
    assert worker.check_once.await_count == 2
    assert all(21599 < delay <= 21600 for delay in waits)
    assert "RuntimeError" in caplog.text
    assert "do-not-log-this-secret" not in caplog.text


@pytest.mark.asyncio
async def test_start_is_idempotent_and_stop_cancels_inflight_sync():
    entered, cancelled = asyncio.Event(), asyncio.Event()

    async def sync(*args, **kwargs):
        entered.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    async with client_for(bootstrap()) as client:
        worker = cron.FPLSyncScheduler(client=client, sync=sync)
        try:
            worker.start()
            first_task = worker._task
            worker.start()
            assert worker._task is first_task
            await asyncio.wait_for(entered.wait(), timeout=1)
        finally:
            await worker.stop()
        await worker.stop()
        assert cancelled.is_set()
        assert worker.last_gameweek is None
        assert not worker._lock.locked()


@pytest.mark.asyncio
async def test_disabled_lifespan_never_starts_scheduler(monkeypatch):
    main = importlib.import_module("app.main")
    monkeypatch.setattr(main.settings, "FPL_SYNC_ENABLED", False)

    def unexpected(**kwargs):
        pytest.fail("Disabled scheduler must not be created")

    monkeypatch.setattr(main, "FPLSyncScheduler", unexpected)
    async with main.app.router.lifespan_context(main.app):
        assert main.app.state.fpl_sync_scheduler is None


@pytest.mark.asyncio
async def test_enabled_lifespan_serves_health_while_sync_runs_and_stops_on_exit(monkeypatch):
    main = importlib.import_module("app.main")
    entered, cancelled = asyncio.Event(), asyncio.Event()

    async def sync(*args, **kwargs):
        entered.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    async with client_for(bootstrap()) as upstream:
        worker = cron.FPLSyncScheduler(client=upstream, sync=sync)
        monkeypatch.setattr(main.settings, "FPL_SYNC_ENABLED", True)
        monkeypatch.setattr(main, "FPLSyncScheduler", lambda **kwargs: worker)
        async with main.app.router.lifespan_context(main.app):
            await asyncio.wait_for(entered.wait(), timeout=1)
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
                response = await asyncio.wait_for(client.get("/api/v1/health"), timeout=1)
                assert response.status_code == 200
        assert cancelled.is_set()
