#!/usr/bin/env bash
# =====================================================================
# P3-NH03 - run the PostgreSQL test suites inside the VPC on the RDS
# `_test` database. Runs ON the EC2 instance:
#
#   scripts/ssm_run.sh --file scripts/acceptance/run_postgres_suites.sh
#
# 1. downloads the exact revision of the running image (public repo, no git);
# 2. verifies the source matches the image (sha256 of app/core/config.py);
# 3. runs pytest with E2E/SHARE/FPL_SYNC *_TEST_DATABASE_URL derived from the
#    container env-file, writing the log to /opt/fpl/evidence/.
#
# Extra pytest args can be passed through FPL_PYTEST_ARGS.
# =====================================================================
set -euo pipefail
ENV_FILE=/opt/fpl/backend.env
SRC=/opt/fpl/src
DRIVER=/opt/fpl/pg_suite_driver.py
EVIDENCE=/opt/fpl/evidence
REPO=nguyendk0904/epl-fantasy-lineups

mkdir -p "$EVIDENCE"
chmod 700 "$EVIDENCE"

IMAGE="$(docker inspect fpl-backend --format '{{.Config.Image}}')"
REV="${IMAGE##*:}"
TEST_DEPS=/opt/fpl/test-deps
echo "image   = $IMAGE"
echo "revision= $REV"

if [ ! -f "$SRC/backend/tests/conftest.py" ] || [ "$(cat "$SRC/.revision" 2>/dev/null)" != "$REV" ]; then
  echo "--- downloading source for $REV"
  curl -fsSL --retry 3 -o /tmp/fpl-src.tar.gz \
    "https://codeload.github.com/$REPO/tar.gz/$REV"
  rm -rf "$SRC"
  mkdir -p "$SRC"
  tar -xzf /tmp/fpl-src.tar.gz -C "$SRC" --strip-components=1
  rm -f /tmp/fpl-src.tar.gz
  printf '%s\n' "$REV" > "$SRC/.revision"
fi

if [ ! -d "$TEST_DEPS/pytest" ]; then
  echo "--- installing dev test dependencies (pytest, pytest-asyncio, aiosqlite) into $TEST_DEPS"
  mkdir -p "$TEST_DEPS"
  docker run --rm -u 0 \
    -v "$TEST_DEPS:/test-deps" \
    "$IMAGE" \
    pip install --no-cache-dir --quiet --target /test-deps \
      "pytest>=8.0.0,<9.0.0" "pytest-asyncio>=0.23.0,<1.0.0" "aiosqlite>=0.20.0"
fi

cat > "$DRIVER" <<'PY'
"""Derive the *_TEST_DATABASE_URL variables from RDS_* and run pytest.

Written by scripts/acceptance/run_postgres_suites.sh; runs inside the backend
image so the password never appears in argv or shell history. The three suites
only create/drop their own schema inside the `_test` database:
    E2E_TEST_DATABASE_URL           -> tests/test_e2e_api_suite.py   (P3-NH03)
    SHARE_TEST_DATABASE_URL         -> tests/test_share_api.py       (P2-NH02)
    FPL_SYNC_TEST_DATABASE_URL      -> tests/test_fpl_sync.py        (P1-NH02/P2-NH03)
    FIXTURE_SYNC_TEST_DATABASE_URL  -> tests/test_fixture_sync.py    (P4-NH01)
    LIVE_MATCH_TEST_DATABASE_URL    -> tests/test_live_match_sync.py (P4-NH02)
    FIXTURES_API_TEST_DATABASE_URL  -> tests/test_fixtures_api.py    (P4-NH03)
    GAMEWEEK_TEST_DATABASE_URL      -> tests/test_gameweeks_api.py   (P4-NH04)
"""
import os
import sys
from urllib.parse import quote

# cwd is backend/ (mounted repo); a script launched by path does not add cwd to
# sys.path, so make the `app` package and cached test deps importable.
if os.path.isdir("/test-deps"):
    sys.path.insert(0, "/test-deps")
sys.path.insert(0, os.getcwd())

test_db = os.environ.get("FPL_TEST_DATABASE_NAME", "fantasy_fpl_test")
if not test_db.endswith("_test"):
    raise SystemExit(f"refusing to use {test_db!r}: the test database name must end with _test")

host, port = os.environ["RDS_HOSTNAME"], os.environ["RDS_PORT"]
dsn = (
    f"postgresql+asyncpg://{quote(os.environ['RDS_USERNAME'], safe='')}:"
    f"{quote(os.environ['RDS_PASSWORD'], safe='')}@{host}:{port}/{test_db}?ssl=require"
)
for variable in (
    "E2E_TEST_DATABASE_URL",
    "SHARE_TEST_DATABASE_URL",
    "FPL_SYNC_TEST_DATABASE_URL",
    "FIXTURE_SYNC_TEST_DATABASE_URL",
    "LIVE_MATCH_TEST_DATABASE_URL",
    "FIXTURES_API_TEST_DATABASE_URL",
    "GAMEWEEK_TEST_DATABASE_URL",
):
    os.environ.setdefault(variable, dsn)
print(f"[acceptance] test database = {host}:{port}/{test_db} (TLS required, credentials hidden)", flush=True)

import pytest

args = sys.argv[1:] or ["tests", "-q", "-rs"]
if "-p" not in args:
    args += ["-p", "no:cacheprovider"]
raise SystemExit(pytest.main(args))
PY
chmod 644 "$DRIVER"

LOCAL_SUM="$(sha256sum "$SRC/backend/app/core/config.py" | cut -d' ' -f1)"
IMAGE_SUM="$(docker exec fpl-backend sha256sum app/core/config.py | cut -d' ' -f1)"
if [ "$LOCAL_SUM" != "$IMAGE_SUM" ]; then
  echo "MISMATCH: source $LOCAL_SUM != image $IMAGE_SUM" >&2
  exit 3
fi
echo "source matches image (config.py sha256 $LOCAL_SUM)"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$EVIDENCE/${STAMP}-pytest-postgres.log"

set +e
docker run --rm \
  -v "$SRC:/repo:ro" -v "$DRIVER:/run_pg_suites.py:ro" -v "$TEST_DEPS:/test-deps:ro" -w /repo/backend \
  --env-file "$ENV_FILE" \
  -e PYTHONDONTWRITEBYTECODE=1 -e HOME=/tmp \
  -e RUN_RDS_CONNECTION_TEST=1 \
  -e 'CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]' \
  "$IMAGE" python /run_pg_suites.py ${FPL_PYTEST_ARGS:-tests -q} \
  2>&1 | tee "$LOG"
RC=${PIPESTATUS[0]}
set -e

echo "--- pytest exit code: $RC"
echo "--- evidence log: $LOG"
tail -3 "$LOG"
exit "$RC"
