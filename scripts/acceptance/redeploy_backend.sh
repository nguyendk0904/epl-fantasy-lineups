#!/usr/bin/env bash
# =====================================================================
# Runs ON the EC2 instance (scripts/ssm_run.sh --file <this file>).
#
# Applies the P3-NH01/NH02/P2-NH03 runtime configuration to the existing
# image and restarts the containers with an explicit, auditable command line:
#   * CloudWatch logging (log group /fpl/backend, instance-role credentials);
#   * trusted proxy for the rate limiter (Caddy -> docker NAT gateway);
#   * exactly ONE FPL sync worker (dedicated container, FPL_SYNC_ENABLED=false
#     inside the API container so no second scheduler can start).
#
# The image is NOT rebuilt here: it is the image already running, whose tag is
# the git SHA of main. Re-running this script is idempotent.
# =====================================================================
set -euo pipefail
ENV_FILE=/opt/fpl/backend.env
API=fpl-backend
WORKER=fpl-worker
LOG_GROUP=/fpl/backend
REGION=ap-southeast-1

set_env() { # key value file
  if grep -q "^$1=" "$3"; then
    sed -i "s|^$1=.*|$1=$2|" "$3"
  else
    printf '%s=%s\n' "$1" "$2" >> "$3"
  fi
}

IMAGE="$(docker inspect "$API" --format '{{.Config.Image}}')"
GATEWAY="$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}')"
echo "image   = $IMAGE"
echo "gateway = $GATEWAY (trusted proxy = Caddy -> docker NAT)"

chmod 600 "$ENV_FILE"
set_env AWS_REGION "$REGION" "$ENV_FILE"
set_env LOG_LEVEL INFO "$ENV_FILE"
set_env CLOUDWATCH_LOGGING_ENABLED true "$ENV_FILE"
set_env CLOUDWATCH_LOG_GROUP "$LOG_GROUP" "$ENV_FILE"
set_env CLOUDWATCH_SEND_INTERVAL_SECONDS 5 "$ENV_FILE"
set_env FPL_SYNC_ENABLED false "$ENV_FILE"
set_env FPL_SYNC_INTERVAL_SECONDS 21600 "$ENV_FILE"
set_env RATE_LIMIT_ENABLED true "$ENV_FILE"
set_env RATE_LIMIT_STORAGE_URI memory:// "$ENV_FILE"
echo "--- env keys (values hidden)"
sed -E 's/^(RDS_PASSWORD)=.*/\1=***REDACTED***/' "$ENV_FILE"

run_api() {
  docker run -d --name "$API" --restart unless-stopped \
    --env-file "$ENV_FILE" \
    -p 127.0.0.1:8000:8000 \
    --log-opt max-size=10m --log-opt max-file=3 \
    "$IMAGE" uvicorn app.main:app --host 0.0.0.0 --port 8000 \
    --proxy-headers --forwarded-allow-ips="$GATEWAY"
}

run_worker() {
  # --no-healthcheck: the image healthcheck probes an HTTP port the scheduler
  # does not serve, so without this the worker is permanently "unhealthy".
  docker run -d --name "$WORKER" --restart unless-stopped \
    --no-healthcheck \
    --env-file "$ENV_FILE" \
    --log-opt max-size=10m --log-opt max-file=3 \
    "$IMAGE" python -m app.services.cron_scheduler
}

echo "--- restarting API container"
docker rm -f "$API" >/dev/null 2>&1 || true
run_api >/dev/null

WAITED=0
for attempt in $(seq 1 40); do
  if curl -fsS -m 3 http://127.0.0.1:8000/health >/dev/null 2>&1; then
    WAITED=$((attempt * 2))
    echo "API healthy after ${WAITED}s"
    break
  fi
  sleep 2
done
curl -sS -m 5 -w '\nHTTP=%{http_code}\n' http://127.0.0.1:8000/health

echo "--- starting the single sync worker"
docker rm -f "$WORKER" >/dev/null 2>&1 || true
run_worker >/dev/null
sleep 5

echo "--- containers"
docker ps -a --format '{{.Names}}|{{.Status}}|{{.Ports}}'
echo "worker containers = $(docker ps -a --format '{{.Names}}' | grep -c '^fpl-worker$') (must be 1)"
echo "--- API log tail"
docker logs --tail 5 "$API" 2>&1 | cut -c1-300
echo "--- worker log tail"
docker logs --tail 10 "$WORKER" 2>&1 | cut -c1-300
