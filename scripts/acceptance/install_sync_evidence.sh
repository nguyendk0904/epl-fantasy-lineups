#!/usr/bin/env bash
# =====================================================================
# P2-NH03 - periodic (6 h) evidence that the single FPL worker syncs into RDS.
# Runs ON the EC2 instance:
#     scripts/ssm_run.sh --file scripts/acceptance/install_sync_evidence.sh
#
# Installs:
#   /usr/local/bin/fpl-sync-evidence         collector (JSON one-liner)
#   /etc/systemd/system/fpl-sync-evidence.*  oneshot + 6-hour timer
# Evidence lands in:
#   /opt/fpl/evidence/sync-checks.jsonl      append-only, one line per check
#   CloudWatch /fpl/worker -> evidence/<UTC timestamp>   (one stream per check)
#
# Each line records worker container state, last successful sync log line,
# RDS row counts, alembic revision and API health. No credentials are read or
# written: the DB probe runs inside the backend container with its own env.
# =====================================================================
set -euo pipefail
EVIDENCE_DIR=/opt/fpl/evidence
CW_GROUP=${CLOUDWATCH_WORKER_LOG_GROUP:-/fpl/worker}
REGION=${AWS_REGION:-ap-southeast-1}

mkdir -p "$EVIDENCE_DIR"
chmod 700 "$EVIDENCE_DIR"

cat > /usr/local/bin/fpl-sync-evidence <<'COLLECTOR'
#!/usr/bin/env bash
set -uo pipefail
EVIDENCE_FILE=/opt/fpl/evidence/sync-checks.jsonl
CW_GROUP=${CLOUDWATCH_WORKER_LOG_GROUP:-/fpl/worker}
REGION=${AWS_REGION:-ap-southeast-1}
export AWS_PAGER=""

worker="$(docker inspect fpl-worker --format '{{.State.Status}}|{{.State.StartedAt}}|{{.RestartCount}}' 2>/dev/null || echo 'missing||0')"
last_sync_line="$(docker logs -t fpl-worker 2>&1 | grep -F 'sync succeeded' | tail -1 || true)"
last_sync_at="${last_sync_line%% *}"
[ -z "$last_sync_line" ] && last_sync_at="none"
health="$(curl -s -o /dev/null -m 5 -w '%{http_code}' http://127.0.0.1:8000/health || echo 000)"

db_counts="$(docker exec -i fpl-backend python - <<'PY' 2>/dev/null || echo '{}'
import asyncio, json
from sqlalchemy import text
from app.core.database import engine

async def main():
    async with engine.connect() as conn:
        tables = (await conn.execute(text(
            "select tablename from pg_tables where schemaname='public'"))).scalars().all()
        counts = {}
        for table in ("teams", "players", "shared_lineups"):
            if table in tables:
                counts[table] = await conn.scalar(text(f"select count(*) from {table}"))
        counts["alembic_version"] = await conn.scalar(text("select version_num from alembic_version"))
        counts["server_tls"] = (await conn.execute(text(
            "select ssl from pg_stat_ssl where pid = pg_backend_pid()"))).scalar()
        print(json.dumps(counts))
    await engine.dispose()

asyncio.run(main())
PY
)"

line="$(python3 - "$worker" "$last_sync_at" "$health" "$db_counts" <<'PY'
import json, sys
from datetime import datetime, timezone

worker_state, last_sync_at, health, counts = sys.argv[1:5]
state, started, restarts = (worker_state.split("|") + ["", ""])[:3]
try:
    counts = json.loads(counts)
except json.JSONDecodeError:
    counts = {}
print(json.dumps({
    "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "worker_state": state,
    "worker_started_at": started,
    "worker_restarts": restarts,
    "last_sync_succeeded_at": last_sync_at,
    "api_health_http": health,
    "rds": counts,
}, separators=(",", ":")))
PY
)"

printf '%s\n' "$line" >> "$EVIDENCE_FILE"
printf '%s\n' "$line"

if command -v aws >/dev/null 2>&1; then
  STREAM="evidence/$(date -u +%Y%m%dT%H%M%SZ)"
  TS="$(($(date +%s) * 1000))"
  python3 - "$CW_GROUP" "$STREAM" "$TS" "$line" <<'PY' > /tmp/fpl_put_events.json
import json, sys
group, stream, timestamp, message = sys.argv[1:5]
json.dump({"logGroupName": group, "logStreamName": stream,
           "logEvents": [{"timestamp": int(timestamp), "message": message}]}, sys.stdout)
PY
  aws logs create-log-stream --region "$REGION" --log-group-name "$CW_GROUP" \
    --log-stream-name "$STREAM" --no-cli-pager >/dev/null 2>&1 || true
  aws logs put-log-events --region "$REGION" --no-cli-pager \
    --cli-input-json file:///tmp/fpl_put_events.json >/dev/null 2>&1 \
    && echo "[cw] pushed $CW_GROUP/$STREAM" \
    || echo "[cw] push failed (local evidence kept)"
fi
COLLECTOR
chmod 755 /usr/local/bin/fpl-sync-evidence

cat > /etc/systemd/system/fpl-sync-evidence.service <<'UNIT'
[Unit]
Description=FPL worker sync evidence (P2-NH03)
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/fpl-sync-evidence
UNIT

cat > /etc/systemd/system/fpl-sync-evidence.timer <<'UNIT'
[Unit]
Description=Collect FPL sync evidence every 6 hours (P2-NH03)

[Timer]
OnBootSec=10min
OnUnitActiveSec=6h
AccuracySec=1min
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now fpl-sync-evidence.timer

echo "--- first check (now)"
CLOUDWATCH_WORKER_LOG_GROUP="$CW_GROUP" AWS_REGION="$REGION" /usr/local/bin/fpl-sync-evidence

echo "--- timer"
systemctl list-timers fpl-sync-evidence.timer --no-pager || true
