#!/usr/bin/env bash
# =====================================================================
# P3-NH03 (cloud half) - run the DEPLOYED opt-in E2E journey against the
# public HTTPS URL. Runs ON the EC2 instance:
#
#   scripts/ssm_run.sh --file scripts/acceptance/run_remote_e2e.sh
#
# Why on the instance: the deployed API needs seeded FPL data, everything is
# already cached there (image + source) and the request leaves through Caddy,
# so TLS, trusted-proxy and rate limiting are exercised for real.
#
# WARNING: this journey creates ONE acceptance snapshot (the API has no DELETE).
# Only run it against the isolated test deployment, i.e. this backend.
# =====================================================================
set -euo pipefail
BASE_URL="${E2E_REMOTE_BASE_URL:-https://54.255.194.74.sslip.io}"
ENV_FILE=/opt/fpl/backend.env
SRC=/opt/fpl/src
EVIDENCE=/opt/fpl/evidence
REPO=nguyendk0904/epl-fantasy-lineups

mkdir -p "$EVIDENCE"

IMAGE="$(docker inspect fpl-backend --format '{{.Config.Image}}')"
REV="${IMAGE##*:}"
echo "target = $BASE_URL"
echo "image  = $IMAGE"

if [ ! -f "$SRC/backend/tests/conftest.py" ] || [ "$(cat "$SRC/.revision" 2>/dev/null)" != "$REV" ]; then
  curl -fsSL --retry 3 -o /tmp/fpl-src.tar.gz "https://codeload.github.com/$REPO/tar.gz/$REV"
  rm -rf "$SRC"; mkdir -p "$SRC"
  tar -xzf /tmp/fpl-src.tar.gz -C "$SRC" --strip-components=1
  rm -f /tmp/fpl-src.tar.gz
  printf '%s\n' "$REV" > "$SRC/.revision"
fi

TEAMS="$(curl -sS -m 15 "$BASE_URL/api/v1/teams")"
if [ "$TEAMS" = "[]" ]; then
  echo "BLOCKED: /api/v1/teams is empty, so the deployed journey cannot pass." >&2
  echo "The worker must sync FPL data into RDS first (see P2-NH03 / fpl_sync fix)." >&2
  exit 4
fi
echo "teams payload length = ${#TEAMS} bytes (data present)"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$EVIDENCE/${STAMP}-pytest-deployed.log"

set +e
docker run --rm \
  -v "$SRC:/repo:ro" -w /repo/backend \
  -e E2E_REMOTE_BASE_URL="$BASE_URL" -e E2E_ALLOW_REMOTE_WRITES=1 \
  -e PYTHONDONTWRITEBYTECODE=1 -e HOME=/tmp \
  "$IMAGE" python -m pytest tests/test_e2e_api_suite.py -k deployed -v \
  -p no:cacheprovider 2>&1 | tee "$LOG"
RC=${PIPESTATUS[0]}
set -e

echo "--- pytest exit code: $RC"
echo "--- evidence log: $LOG"
exit "$RC"
