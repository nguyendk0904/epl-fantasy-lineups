#!/usr/bin/env bash
# =====================================================================
# P4-Q02 / P4-NH04 - Prepare EC2 runtime for Phase 4 acceptance:
#   1) Start ephemeral `fpl-redis` container bound to the docker0 bridge
#      gateway (172.17.0.1:6379) so `fpl-backend` and `fpl-worker` keep
#      using the default bridge network (--forwarded-allow-ips=172.17.0.1).
#   2) Idempotently configure /opt/fpl/backend.env (chmod 600) with:
#        - REDIS_CACHE_ENABLED=true
#        - REDIS_CACHE_URL=redis://172.17.0.1:6379/0
#        - REDIS_CACHE_TTL_SECONDS=300
#        - GAMEWEEK_DEMO_AUTH_ENABLED=true
#        - GAMEWEEK_DEMO_TOKEN_SECRET=<generated locally if missing>
#   3) Recreate `fpl-backend` and `fpl-worker` preserving all CI/CD flags.
#
# Runs ON the EC2 instance:
#   scripts/ssm_run.sh --file scripts/acceptance/setup_p4_runtime.sh
#
# Never prints secrets or env values.
# =====================================================================
set -euo pipefail
ENV_FILE=/opt/fpl/backend.env

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

BRIDGE_GW="$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}')"
if [ -z "$BRIDGE_GW" ]; then
  echo "Could not resolve default bridge gateway" >&2
  exit 1
fi
echo "bridge_gateway = $BRIDGE_GW"

# 1. Start or verify fpl-redis bound strictly to the internal docker0 gateway.
if [ "$(docker inspect -f '{{.State.Running}}' fpl-redis 2>/dev/null || echo false)" != "true" ]; then
  docker rm -f fpl-redis 2>/dev/null || true
  docker run -d \
    --name fpl-redis \
    --restart unless-stopped \
    -p "${BRIDGE_GW}:6379:6379" \
    --log-opt max-size=10m --log-opt max-file=3 \
    redis:7-alpine \
    redis-server --save "" --maxmemory 64mb --maxmemory-policy allkeys-lru
fi

for _ in $(seq 1 10); do
  if [ "$(docker exec fpl-redis redis-cli ping 2>/dev/null || true)" = "PONG" ]; then
    break
  fi
  sleep 1
done
echo "redis_ping = $(docker exec fpl-redis redis-cli ping)"

# 2. Update /opt/fpl/backend.env without echoing any secret values.
python3 - "$ENV_FILE" "$BRIDGE_GW" <<'PY'
import os
import secrets
import sys
from pathlib import Path

env_path = Path(sys.argv[1])
bridge_gw = sys.argv[2]
lines = env_path.read_text(encoding="utf-8").splitlines()

updates = {
    "REDIS_CACHE_ENABLED": "true",
    "REDIS_CACHE_URL": f"redis://{bridge_gw}:6379/0",
    "REDIS_CACHE_TTL_SECONDS": "300",
    "GAMEWEEK_DEMO_AUTH_ENABLED": "true",
}

seen = set()
new_lines = []
has_demo_secret = False

for line in lines:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        new_lines.append(line)
        continue
    key, _, val = line.partition("=")
    key = key.strip()
    if key == "GAMEWEEK_DEMO_TOKEN_SECRET":
        has_demo_secret = len(val.strip()) >= 32
        new_lines.append(line if has_demo_secret else f"GAMEWEEK_DEMO_TOKEN_SECRET={secrets.token_urlsafe(48)}")
        has_demo_secret = True
        seen.add(key)
    elif key in updates:
        new_lines.append(f"{key}={updates[key]}")
        seen.add(key)
    else:
        new_lines.append(line)

for key, value in updates.items():
    if key not in seen:
        new_lines.append(f"{key}={value}")

if not has_demo_secret:
    new_lines.append(f"GAMEWEEK_DEMO_TOKEN_SECRET={secrets.token_urlsafe(48)}")

tmp_path = env_path.with_suffix(".env.tmp")
tmp_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
os.chmod(tmp_path, 0o600)
os.replace(tmp_path, env_path)
print("updated /opt/fpl/backend.env (chmod 600, values hidden)")
PY

# 3. Recreate fpl-backend and fpl-worker using the exact running image and CI/CD flags.
IMAGE="$(docker inspect fpl-backend --format '{{.Config.Image}}')"
echo "recreating containers with image = $IMAGE"

docker rm -f fpl-backend 2>/dev/null || true
docker run -d \
  --name fpl-backend \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p 127.0.0.1:8000:8000 \
  --log-opt max-size=10m --log-opt max-file=3 \
  "$IMAGE" \
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips=172.17.0.1

docker rm -f fpl-worker 2>/dev/null || true
docker run -d \
  --name fpl-worker \
  --restart unless-stopped \
  --no-healthcheck \
  --env-file "$ENV_FILE" \
  --log-opt max-size=10m --log-opt max-file=3 \
  "$IMAGE" \
  python -m app.services.cron_scheduler

for attempt in $(seq 1 20); do
  CODE="$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/health || true)"
  if [ "$CODE" = "200" ]; then
    break
  fi
  sleep 2
done
echo "local_health_http = $CODE"

docker exec -i fpl-backend python - <<'PY'
import asyncio
from app.core.config import settings
from app.core.redis_cache import cache_service

async def main():
    print("REDIS_CACHE_ENABLED =", settings.REDIS_CACHE_ENABLED)
    print("REDIS_CACHE_URL     =", settings.REDIS_CACHE_URL)
    print("REDIS_CACHE_TTL     =", settings.REDIS_CACHE_TTL_SECONDS)
    print("GAMEWEEK_DEMO_AUTH_ENABLED =", settings.GAMEWEEK_DEMO_AUTH_ENABLED)
    print("GAMEWEEK_DEMO_TOKEN_SECRET_SET =", settings.GAMEWEEK_DEMO_TOKEN_SECRET is not None)
    key = cache_service.build_key("probe", check="p4")
    await cache_service.set(key, {"ok": True})
    val = await cache_service.get(key)
    deleted = await cache_service.backend.delete_matching(f"{cache_service.namespace}:probe:*")
    print("redis_roundtrip =", val, "| deleted =", deleted)

asyncio.run(main())
PY

docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}'
