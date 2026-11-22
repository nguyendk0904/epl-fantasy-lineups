from unittest.mock import Mock

import httpx
import pytest

from app.services import fdr_service
from app.services.optimizer_cache import optimizer_response_cache


def response():
    return httpx.Response(200, request=httpx.Request("GET", fdr_service.FPL_FIXTURES_URL), json=[{
        "event": 1, "finished": False, "team_h": 1, "team_a": 2,
        "team_h_difficulty": 1, "team_a_difficulty": 5,
    }])


def test_cache_reuses_response_within_ttl(monkeypatch):
    clock = [100.0]
    monkeypatch.setattr(fdr_service, "monotonic", lambda: clock[0], raising=False)
    get = Mock(return_value=response())
    monkeypatch.setattr(httpx, "get", get)
    first = fdr_service.get_next_gameweek_fdr_multipliers()
    first[1] = 99
    clock[0] += 899
    assert fdr_service.get_next_gameweek_fdr_multipliers() == {1: 1.2, 2: 0.8}
    assert get.call_count == 1


def test_cache_refreshes_after_ttl_and_clear(monkeypatch):
    clock = [100.0]
    monkeypatch.setattr(fdr_service, "monotonic", lambda: clock[0], raising=False)
    get = Mock(return_value=response())
    monkeypatch.setattr(httpx, "get", get)
    fdr_service.get_next_gameweek_fdr_multipliers()
    clock[0] += 900
    fdr_service.get_next_gameweek_fdr_multipliers()
    assert get.call_count == 2
    fdr_service.clear_fdr_cache()
    fdr_service.get_next_gameweek_fdr_multipliers()
    assert get.call_count == 3


def test_expired_cache_survives_fetch_or_parse_failure(monkeypatch, caplog):
    clock = [100.0]
    monkeypatch.setattr(fdr_service, "monotonic", lambda: clock[0], raising=False)
    get = Mock(return_value=response())
    monkeypatch.setattr(httpx, "get", get)
    expected = fdr_service.get_next_gameweek_fdr_multipliers()
    clock[0] += 900
    get.side_effect = httpx.ConnectError("offline")
    assert fdr_service.get_next_gameweek_fdr_multipliers() == expected
    get.side_effect = None
    get.return_value = httpx.Response(200, request=httpx.Request("GET", fdr_service.FPL_FIXTURES_URL), json={"bad": "payload"})
    assert fdr_service.get_next_gameweek_fdr_multipliers() == expected
    assert get.call_count == 3
    assert "WARNING" in caplog.text


@pytest.mark.asyncio
async def test_network_failure_without_cache_keeps_optimizer_available(monkeypatch, e2e_api):
    warning = Mock()
    monkeypatch.setattr(fdr_service.logger, "warning", warning)
    get = Mock(side_effect=httpx.ConnectError("offline"))
    monkeypatch.setattr(httpx, "get", get)
    assert fdr_service.get_next_gameweek_fdr_multipliers() == {}
    optimizer_response_cache.clear()
    try:
        result = await e2e_api.client.post("/api/v1/optimizer/solve", json={"budget": 100})
        assert result.status_code == 200
        assert result.json()["status"] == "optimal"
        assert warning.call_count >= 2
    finally:
        optimizer_response_cache.clear()
