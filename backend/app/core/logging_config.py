"""P3-NH01: JSON stdout logs with optional queued AWS CloudWatch delivery.

Enable CLOUDWATCH_LOGGING_ENABLED, set CLOUDWATCH_LOG_GROUP and AWS_REGION.
Quang provisions the group/retention and instance-role permissions. No keys
are passed to boto3; no log groups or IAM resources are created here.
Request bodies, headers, query strings and raw exception text are excluded.
"""

import asyncio
import contextvars
from datetime import datetime, timezone
import json
import logging
import os
import re
import socket
import sys
import time
import traceback
from uuid import uuid4
from urllib.parse import quote

from sqlalchemy.engine import make_url
from starlette.types import ASGIApp, Message, Receive, Scope, Send


request_id_context = contextvars.ContextVar("fpl_request_id", default=None)
_active_runtime = None


class JsonLogFormatter(logging.Formatter):
    def __init__(self, config):
        super().__init__()
        self.environment = config.ENVIRONMENT
        self.secrets = [config.DATABASE_URL]
        password = make_url(config.DATABASE_URL).password
        if password:
            self.secrets.extend((password, quote(password, safe="")))
        if config.RDS_PASSWORD is not None:
            self.secrets.append(config.RDS_PASSWORD.get_secret_value())

    def redact(self, message: str) -> str:
        for secret in self.secrets:
            if secret:
                message = message.replace(secret, "[REDACTED]")
        message = re.sub(r"(?i)\bBearer\s+[^\s,;]+", "Bearer [REDACTED]", message)
        message = re.sub(
            r"(?i)([a-z][a-z0-9+.-]*://)[^\s/@]+(?::[^\s/@]*)?@",
            r"\1[REDACTED]@", message,
        )
        message = re.sub(
            r'''(?i)(["']?(?:password|passwd|token|secret|api_key|authorization)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)''',
            r"\1[REDACTED]", message,
        )
        return message

    def format(self, record: logging.LogRecord) -> str:
        data = {
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "environment": self.environment,
            "message": self.redact(record.getMessage()),
            "request_id": getattr(record, "request_id", None) or request_id_context.get(),
        }
        for field in ("method", "path", "status_code", "latency_ms", "error_type"):
            value = getattr(record, field, None)
            if value is not None:
                data[field] = value
        if record.exc_info and record.exc_info[0] is not None:
            data["error_type"] = record.exc_info[0].__name__
            data["frames"] = [
                {"file": os.path.basename(frame.filename), "line": frame.lineno, "function": frame.name}
                for frame in traceback.extract_tb(record.exc_info[2])
            ]
        return json.dumps(data, ensure_ascii=False, allow_nan=False)


def _create_cloudwatch_handler(config):
    # Disabled mode never imports/initializes AWS SDK or looks up credentials.
    import boto3
    from botocore.config import Config
    import watchtower

    client = boto3.client(
        "logs", region_name=config.AWS_REGION,
        config=Config(connect_timeout=3, read_timeout=3, retries={"max_attempts": 2}),
    )
    return watchtower.CloudWatchLogHandler(
        boto3_client=client, log_group_name=config.CLOUDWATCH_LOG_GROUP,
        log_stream_name=f"backend/{socket.gethostname()}/{os.getpid()}",
        use_queues=True, send_interval=config.CLOUDWATCH_SEND_INTERVAL_SECONDS,
        create_log_group=False, create_log_stream=True,
    )


class LoggingRuntime:
    def __init__(self, handlers, previous, access_disabled):
        self.handlers = handlers
        self.previous = previous
        self.access_disabled = access_disabled
        self.closed = False

    def close(self):
        global _active_runtime
        if self.closed:
            return
        self.closed = True
        for logger, handlers, level, propagate, disabled in self.previous:
            logger.handlers = handlers
            logger.setLevel(level)
            logger.propagate = propagate
            logger.disabled = disabled
        logging.getLogger("uvicorn.access").disabled = self.access_disabled
        try:
            for handler in self.handlers:
                handler.close()  # Watchtower drains its queue on close.
        finally:
            if _active_runtime is self:
                _active_runtime = None


def configure_logging(config, *, stream=None) -> LoggingRuntime:
    """Configure once per process. Caller closes runtime on shutdown."""
    global _active_runtime
    if _active_runtime is not None and not _active_runtime.closed:
        return _active_runtime
    formatter = JsonLogFormatter(config)
    handlers = [logging.StreamHandler(stream if stream is not None else sys.stdout)]
    try:
        if config.CLOUDWATCH_LOGGING_ENABLED:
            handlers.append(_create_cloudwatch_handler(config))
    except Exception:
        for handler in handlers:
            handler.close()
        raise RuntimeError("CloudWatch logging initialization failed; verify configuration and instance role") from None
    for handler in handlers:
        handler.setFormatter(formatter)
        handler.setLevel(config.LOG_LEVEL)
    previous = []
    for name in ("app", "uvicorn.error"):
        logger = logging.getLogger(name)
        previous.append((logger, logger.handlers[:], logger.level, logger.propagate, logger.disabled))
        logger.handlers = handlers[:]
        logger.setLevel(config.LOG_LEVEL)
        logger.propagate = False
        logger.disabled = False
    access = logging.getLogger("uvicorn.access")
    runtime = LoggingRuntime(handlers, previous, access.disabled)
    access.disabled = True
    _active_runtime = runtime
    return runtime


class RequestLoggingMiddleware:
    """Pure ASGI; does not buffer or consume request/response bodies."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = uuid4().hex
        token = request_id_context.set(request_id)
        started = time.perf_counter()
        status_code = None
        error_type = None

        async def traced_send(message: Message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                message = dict(message)
                headers = [(key, value) for key, value in message.get("headers", []) if key.lower() != b"x-request-id"]
                message["headers"] = headers + [(b"x-request-id", request_id.encode("ascii"))]
            await send(message)

        try:
            await self.app(scope, receive, traced_send)
        except asyncio.CancelledError:
            error_type = "CancelledError"
            status_code = status_code or 499
            raise
        except Exception as error:
            error_type = type(error).__name__
            status_code = status_code or 500
            raise
        finally:
            try:
                route = scope.get("route")
                status = status_code or 499
                level = logging.ERROR if error_type or status >= 500 else logging.WARNING if status >= 400 else logging.INFO
                logging.getLogger("app.requests").log(
                    level, "request_failed" if error_type else "request_completed",
                    extra={
                        "request_id": request_id, "method": scope["method"],
                        "path": getattr(route, "path", "[unmatched]"),
                        "status_code": status,
                        "latency_ms": round((time.perf_counter() - started) * 1000, 3),
                        "error_type": error_type,
                    },
                )
            finally:
                request_id_context.reset(token)
