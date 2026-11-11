#!/usr/bin/env bash
# =====================================================================
# P3-NH01 - CloudWatch Logs for the FPL backend (run from the dev machine).
#
#   1. creates the log group(s) if missing and pins retention;
#   2. attaches a least-privilege inline policy to the EC2 instance role so
#      the container can write logs with the instance profile (no static keys).
#
# Idempotent: safe to re-run. Prints only non-secret identifiers.
# =====================================================================
set -euo pipefail
# Git Bash on Windows rewrites arguments that start with "/" into Windows
# paths, which corrupts log group names such as /fpl/backend.
export MSYS_NO_PATHCONV=1

REGION="${FPL_AWS_REGION:-ap-southeast-1}"
ROLE="${FPL_INSTANCE_ROLE:-fpl-p3q02-ec2-role}"
API_GROUP="${FPL_LOG_GROUP:-/fpl/backend}"
WORKER_GROUP="${FPL_WORKER_LOG_GROUP:-/fpl/worker}"
RETENTION="${FPL_LOG_RETENTION_DAYS:-30}"
POLICY_NAME="${FPL_LOG_POLICY_NAME:-fpl-p3q02-cloudwatch-logs}"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text --no-cli-pager)"

echo "account=$ACCOUNT region=$REGION role=$ROLE retention=${RETENTION}d"

for GROUP in "$API_GROUP" "$WORKER_GROUP"; do
  if aws logs describe-log-groups --region "$REGION" --no-cli-pager \
      --log-group-name-prefix "$GROUP" \
      --query "logGroups[?logGroupName=='$GROUP'].logGroupName" --output text | grep -qx "$GROUP"; then
    echo "log group exists : $GROUP"
  else
    aws logs create-log-group --region "$REGION" --log-group-name "$GROUP" --no-cli-pager
    echo "log group created: $GROUP"
  fi
  aws logs put-retention-policy --region "$REGION" \
    --log-group-name "$GROUP" --retention-in-days "$RETENTION" --no-cli-pager
  echo "retention set    : $GROUP -> ${RETENTION} days"
done

# Least privilege: only streams/PutLogEvents inside these two groups.
POLICY_DOC="$(python - "$REGION" "$ACCOUNT" "$API_GROUP" "$WORKER_GROUP" <<'PY'
import json, sys

region, account, api_group, worker_group = sys.argv[1:5]
groups = [api_group, worker_group]
print(json.dumps({
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "DescribeGroupsForDiag",
            "Effect": "Allow",
            "Action": ["logs:DescribeLogGroups"],
            "Resource": "*",
        },
        {
            "Sid": "WriteOnlyTheseGroups",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:DescribeLogStreams",
                "logs:PutLogEvents",
            ],
            "Resource": [
                f"arn:aws:logs:{region}:{account}:log-group:{group}:*" for group in groups
            ],
        },
    ],
}, indent=2))
PY
)"

aws iam put-role-policy --role-name "$ROLE" --policy-name "$POLICY_NAME" \
  --policy-document "$POLICY_DOC" --no-cli-pager
echo "inline policy applied: $ROLE/$POLICY_NAME"

aws logs describe-log-groups --region "$REGION" --no-cli-pager \
  --log-group-name-prefix "${API_GROUP%%/*}/" \
  --query 'logGroups[].[logGroupName,retentionInDays]' --output text
