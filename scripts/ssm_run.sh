#!/usr/bin/env bash
# =====================================================================
# P3-NH0x - Run a shell command on the FPL backend EC2 instance via
# AWS Systems Manager Run Command (no SSH port, no key pair needed).
#
# Usage:
#   scripts/ssm_run.sh "<shell command>" [timeout_seconds]
#   scripts/ssm_run.sh --file <local-script.sh> [timeout_seconds]
#
# Env overrides:
#   FPL_INSTANCE_ID   default i-0f1e71fa1a78b0013
#   FPL_AWS_REGION    default ap-southeast-1
#
# The remote command runs as root (AWS-RunShellScript). Output is
# printed to stdout/stderr and the script exits with the SSM status.
# =====================================================================
set -euo pipefail

INSTANCE_ID="${FPL_INSTANCE_ID:-i-0f1e71fa1a78b0013}"
REGION="${FPL_AWS_REGION:-ap-southeast-1}"
TIMEOUT="${2:-600}"

if [ "${1:-}" = "--file" ]; then
  if [ ! -f "${2:-}" ]; then
    echo "Usage: $0 --file <local-script.sh> [timeout_seconds]" >&2
    exit 2
  fi
  # Strip CRLF: a Windows checkout would otherwise send "#!/usr/bin/env bash\r".
  COMMAND="$(tr -d '\r' < "$2")"
  TIMEOUT="${3:-600}"
else
  COMMAND="${1:-}"
fi

if [ -z "$COMMAND" ]; then
  echo "Usage: $0 \"<shell command>\" [timeout_seconds] | $0 --file <script.sh> [timeout_seconds]" >&2
  exit 2
fi

# JSON-encode the command so quotes/newlines survive the CLI hop.
PARAMS="$(python - "$COMMAND" <<'PY'
import json, sys
print(json.dumps({"commands": [sys.argv[1]], "executionTimeout": ["3600"]}))
PY
)"

COMMAND_ID="$(aws ssm send-command \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --comment "fpl-ops $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --timeout-seconds "$TIMEOUT" \
  --parameters "$PARAMS" \
  --query 'Command.CommandId' --output text --no-cli-pager)"

echo "SSM command: $COMMAND_ID (instance $INSTANCE_ID)" >&2

deadline=$(( $(date +%s) + TIMEOUT / 2 ))
while :; do
  STATUS="$(aws ssm get-command-invocation --region "$REGION" \
    --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
    --query 'Status' --output text --no-cli-pager 2>/dev/null || echo Pending)"
  case "$STATUS" in
    Pending|InProgress|Delayed|"") ;;
    *) break ;;
  esac
  if [ "$(date +%s)" -gt "$deadline" ]; then
    echo "Timed out waiting for $COMMAND_ID (last status: $STATUS)" >&2
    break
  fi
  sleep 3
done

OUT="$(aws ssm get-command-invocation --region "$REGION" \
  --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
  --query 'StandardOutputContent' --output text --no-cli-pager 2>/dev/null || true)"
ERR="$(aws ssm get-command-invocation --region "$REGION" \
  --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
  --query 'StandardErrorContent' --output text --no-cli-pager 2>/dev/null || true)"

printf '%s\n' "$OUT"
[ -n "${ERR//[$'\r\n\t ']/}" ] && printf '%s\n' "$ERR" >&2
echo "--- SSM status: $STATUS ---" >&2

[ "$STATUS" = "Success" ]
