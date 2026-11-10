"""P3-NH01 tests: no AWS credentials, remote calls, DB writes or infra changes."""

import asyncio
from datetime import datetime
import importlib
import io
import json
import logging
import re

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core import logging_config as logs


def config(**overrides):
    values = dict(
        _env_file=None, ENVIRONMENT="development",
        DATABASE_URL="postgresql+asyncpg://dev:fake-db-password@localhost/fantasy_fpl",
        RDS_HOSTNAME=None, RDS_DB_NAME=None, RDS_USERNAME=None, RDS_PASSWORD=None,
        LOG_LEVEL="INFO", CLOUDWATCH_LOGGING_ENABLED=False,
    )
    values.update(overrides)
    return Settings(**values)


@pytest.fixture
def captured_logs():
    stream = io.StringIO()
    runtime = logs.configure_logging(config(), stream=stream)
    try:
        yield stream
    finally:
        runtime.close()


def records(stream):
    return [json.loads(line) for line in stream.getvalue().splitlines()]


def test_formatter_json_fields_and_no_arbitrary_extra(captured_logs):
    logging.getLogger("app.test").info("hello", extra={"body": "secret-body", "headers": "secret-header"})
    row = records(captured_logs)[0]
    assert datetime.fromisoformat(row["timestamp"]).utcoffset().total_seconds() == 0
    assert row["level"] == "INFO"
    assert row["environment"] == "development"
    assert row["message"] == "hello"
    assert "secret-body" not in captured_logs.getvalue()
    assert "secret-header" not in captured_logs.getvalue()


@pytest.mark.parametrize("message,secret", [
    ("password=private-value", "private-value"),
    ('{"token": "private-value"}', "private-value"),
    ("Authorization: Bearer private-value", "private-value"),
    ("postgresql+asyncpg://user:private-value@db.example.com/fpl", "private-value"),
    ("unexpected fake-db-password", "fake-db-password"),
])
def test_sensitive_application_messages_are_redacted(captured_logs, message, secret):
    logging.getLogger("app.test").warning(message)
    assert secret not in captured_logs.getvalue()
    assert "[REDACTED]" in captured_logs.getvalue()


def test_exception_type_and_frames_survive_but_text_does_not(captured_logs):
    try:
        raise ValueError("secret-exception-with-db-password")
    except ValueError:
        logging.getLogger("uvicorn.error").exception("operation failed")
    row = records(captured_logs)[0]
    assert row["error_type"] == "ValueError"
    assert row["frames"][0]["function"] == "test_exception_type_and_frames_survive_but_text_does_not"
    assert "secret-exception" not in captured_logs.getvalue()


def app_for_tests():
    app = FastAPI()
    app.add_middleware(logs.RequestLoggingMiddleware)

    @app.get("/players/{player_id}")
    async def player(player_id: int):
        await asyncio.sleep(0)
        logging.getLogger("app.test").info("inside request")
        return {"id": player_id}

    @app.post("/echo")
    async def echo(request: Request):
        return await request.json()

    @app.get("/handled-error")
    async def handled_error():
        raise HTTPException(503, "unavailable")

    @app.get("/error")
    async def error():
        raise RuntimeError("private-exception-payload")

    @app.get("/stream")
    async def stream():
        async def chunks():
            yield b"first"
            await asyncio.sleep(0)
            yield b"second"
        return StreamingResponse(chunks())

    return app


@pytest.mark.asyncio
async def test_request_fields_correlation_and_secret_query_exclusion(captured_logs):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app_for_tests()), base_url="http://test") as client:
        response = await client.get("/players/1?token=private-query", headers={"authorization": "Bearer private-header", "x-request-id": "spoofed-id"})
    assert response.status_code == 200
    request_id = response.headers["x-request-id"]
    assert re.fullmatch(r"[0-9a-f]{32}", request_id)
    rows = records(captured_logs)
    completed = next(row for row in rows if row["message"] == "request_completed")
    assert completed["method"] == "GET"
    assert completed["path"] == "/players/{player_id}"
    assert completed["status_code"] == 200
    assert completed["latency_ms"] >= 0
    assert all(row["request_id"] == request_id for row in rows)
    assert "private-query" not in captured_logs.getvalue()
    assert "private-header" not in captured_logs.getvalue()
    assert "spoofed-id" not in captured_logs.getvalue()
    assert logs.request_id_context.get() is None


@pytest.mark.asyncio
async def test_body_passes_through_unchanged_and_is_not_logged(captured_logs):
    body = {"password": "private-body"}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app_for_tests()), base_url="http://test") as client:
        response = await client.post("/echo", json=body)
    assert response.json() == body
    assert "private-body" not in captured_logs.getvalue()


@pytest.mark.asyncio
@pytest.mark.parametrize("path,status,level", [
    ("/players/not-an-int", 422, "WARNING"),
    ("/unknown-secret-path", 404, "WARNING"),
    ("/handled-error", 503, "ERROR"),
    ("/error", 500, "ERROR"),
])
async def test_error_statuses_logged_once_without_sensitive_details(captured_logs, path, status, level):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app_for_tests(), raise_app_exceptions=False), base_url="http://test") as client:
        response = await client.get(path)
    assert response.status_code == status
    rows = records(captured_logs)
    assert len(rows) == 1
    assert rows[0]["status_code"] == status
    assert rows[0]["level"] == level
    if status == 500:
        assert rows[0]["error_type"] == "RuntimeError"
    assert "private-exception-payload" not in captured_logs.getvalue()
    assert "unknown-secret-path" not in captured_logs.getvalue()
    assert logs.request_id_context.get() is None


@pytest.mark.asyncio
async def test_concurrent_request_contexts_are_isolated(captured_logs):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app_for_tests()), base_url="http://test") as client:
        responses = await asyncio.gather(client.get("/players/1"), client.get("/players/2"))
    ids = {response.headers["x-request-id"] for response in responses}
    assert len(ids) == 2
    rows = records(captured_logs)
    for request_id in ids:
        assert len([row for row in rows if row["request_id"] == request_id]) == 2


@pytest.mark.asyncio
async def test_streaming_response_is_preserved(captured_logs):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app_for_tests()), base_url="http://test") as client:
        response = await client.get("/stream")
    assert response.content == b"firstsecond"
    assert len(records(captured_logs)) == 1


def test_disabled_mode_never_initializes_aws_and_configuration_is_idempotent(monkeypatch):
    def unexpected(config):
        pytest.fail("Disabled mode must not initialize AWS")
    monkeypatch.setattr(logs, "_create_cloudwatch_handler", unexpected)
    stream = io.StringIO()
    access_before = logging.getLogger("uvicorn.access").disabled
    runtime = logs.configure_logging(config(), stream=stream)
    try:
        assert logs.configure_logging(config(), stream=stream) is runtime
        assert logging.getLogger("uvicorn.access").disabled
        logging.getLogger("app.test").info("one event")
        assert len(records(stream)) == 1
    finally:
        runtime.close()
        runtime.close()
    assert logging.getLogger("uvicorn.access").disabled == access_before


def test_initialization_failure_is_sanitized_and_does_not_replace_loggers(monkeypatch):
    previous = logging.getLogger("app").handlers[:]
    def fail(config):
        raise RuntimeError("secret-aws-config")
    monkeypatch.setattr(logs, "_create_cloudwatch_handler", fail)
    with pytest.raises(RuntimeError) as caught:
        logs.configure_logging(config(CLOUDWATCH_LOGGING_ENABLED=True))
    assert "secret-aws-config" not in str(caught.value)
    assert logging.getLogger("app").handlers == previous
    assert logs._active_runtime is None


def test_watchtower_queued_delivery_with_stubbed_aws(monkeypatch):
    boto3 = pytest.importorskip("boto3")
    pytest.importorskip("watchtower")
    from botocore.stub import Stubber, ANY

    # Explicit fake credentials keep boto3 away from EC2 metadata/real secrets.
    client = boto3.client("logs", region_name="ap-southeast-1", aws_access_key_id="testing", aws_secret_access_key="testing")
    captured = []
    client.meta.events.register("before-parameter-build.logs.PutLogEvents", lambda params, **kwargs: captured.append(params.copy()))
    monkeypatch.setattr(boto3, "client", lambda *args, **kwargs: client)
    cfg = config(CLOUDWATCH_LOGGING_ENABLED=True)
    stream_name = f"backend/{logs.socket.gethostname()}/{logs.os.getpid()}"
    with Stubber(client) as stub:
        stub.add_response("put_log_events", {}, {
            "logGroupName": cfg.CLOUDWATCH_LOG_GROUP, "logStreamName": stream_name,
            "logEvents": [{"timestamp": ANY, "message": ANY}],
        })
        runtime = logs.configure_logging(cfg, stream=io.StringIO())
        try:
            cloud = runtime.handlers[1]
            assert cloud.use_queues is True
            # Stub permits only PutLogEvents: group creation would fail here.
            logging.getLogger("app.test").error("simulated error", extra={"status_code": 500})
        finally:
            runtime.close()
        stub.assert_no_pending_responses()
    row = json.loads(captured[0]["logEvents"][0]["message"])
    assert row["status_code"] == 500
    assert row["level"] == "ERROR"


@pytest.mark.asyncio
async def test_real_app_lifespan_installs_logging_and_restores_it(monkeypatch):
    main = importlib.import_module("app.main")
    stream = io.StringIO()
    monkeypatch.setattr(main.settings, "FPL_SYNC_ENABLED", False)
    monkeypatch.setattr(main, "configure_logging", lambda _: logs.configure_logging(config(), stream=stream))
    async with main.app.router.lifespan_context(main.app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as client:
            response = await client.get("/api/v1/health")
            assert response.status_code == 200
    assert logs._active_runtime is None
    assert records(stream)[0]["path"] == "/api/v1/health"


@pytest.mark.parametrize("overrides", [
    {"LOG_LEVEL": "VERBOSE"}, {"CLOUDWATCH_LOG_GROUP": ""},
    {"CLOUDWATCH_LOG_GROUP": "invalid group"}, {"CLOUDWATCH_SEND_INTERVAL_SECONDS": 0},
])
def test_invalid_logging_settings_rejected(overrides):
    with pytest.raises(ValidationError):
        config(**overrides)
