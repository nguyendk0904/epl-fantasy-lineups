# =====================================================================
# P1-Q01 - Backend Dockerfile (Multi-stage build)
# Project: Fantasy Football Lineup Builder & Optimizer
# Stack: Python 3.11-slim + FastAPI + PuLP + Coin-OR CBC solver
# Best practices: slim base, non-root user, no cache, lean runtime
# =====================================================================

# ---------------------------------------------------------------------
# Stage 1: Builder - install Python dependencies into an isolated venv
# ---------------------------------------------------------------------
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Install build essentials (only needed to compile any missing wheels)
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install declared deps + PuLP (0-1 ILP optimizer library, SSOT >= 2.8)
COPY requirements.txt .
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements.txt "pulp>=2.8.0"

# ---------------------------------------------------------------------
# Stage 2: Runtime - slim image with only what is needed at run time
# ---------------------------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Install the Coin-OR CBC mixed-integer LP solver used by PuLP,
# then create a dedicated non-root user (security best practice).
RUN apt-get update \
    && apt-get install -y --no-install-recommends coinor-cbc \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system appuser \
    && useradd --system --gid appuser --no-create-home --home-dir /app appuser

# Copy the pre-built virtualenv from the builder stage
COPY --from=builder /opt/venv /opt/venv

WORKDIR /app

# Copy application source code with ownership for the non-root user
COPY --chown=appuser:appuser ./app ./app

# Switch to non-root user
USER appuser

EXPOSE 8000

# Lightweight healthcheck against the FastAPI /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]