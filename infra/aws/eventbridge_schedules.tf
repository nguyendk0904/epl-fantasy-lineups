# =====================================================================
# P4-Q01 - AWS EventBridge Scheduler for automatic FPL live-sync triggers
# Project : Fantasy Football Lineup Builder & Optimizer
# Owner   : Quang (DevOps & Cloud Infrastructure Lead)
# Branch  : feature/P4-Q01-eventbridge-scheduler
# Docs    : infra/aws/README_SCHEDULER.md (runbook + verification + cost guardrails)
# Deps    : P4-NH01 (app/services/fixture_sync.py)      [x] in docs/TODO.md
#           P4-NH02 (app/services/live_match_sync.py)   [x] in docs/TODO.md
# Source  : docs/PROJECT_SSOT.md (AWS Free Tier, region ap-southeast-1)
#
# DESIGN OVERVIEW
# ---------------
# EventBridge Scheduler (the successor of CloudWatch Events) fires on EPL
# fixture-aware cron expressions and uses a UNIVERSAL TARGET
#   arn:aws:scheduler:::aws-sdk:ssm:sendCommand
# -> AWS Systems Manager Run Command (AWS-RunShellScript) on the SSM-managed
# EC2 host that already runs the FPL backend Docker containers (P3-Q02).
# The host then docker-exec's the one-shot workers delivered by P4-NH01 /
# P4-NH02. There is no new Lambda, no SQS, no new EC2 and no paid target,
# so the whole task stays on the AWS Free Tier ($0).
#
# Why SSM and not Lambda/SQS/HTTP?
#   * No new backend code: the workers are one-shot CLIs (`python -m ...`),
#     so the trigger only has to start them inside the existing containers.
#   * No new public surface: nothing is exposed to the Internet (the API sits
#     behind Caddy + rate-limit; there is no webhook for scheduling).
#   * Reuses the exact operational path of P3-Q03 CI/CD (`aws ssm send-command`).
#
# Worker-name mapping (roadmap names vs. real modules):
#   live_sync.py     (P4-NH01) -> app/services/fixture_sync.py        (pre-round)
#   gameweek_sync.py (P4-NH02) -> app/services/live_match_sync.py     (post-match)
# =====================================================================

# The `terraform` / `provider` blocks intentionally live in
# infra/aws/terraform_rds.tf (P2-Q01) and MUST NOT be duplicated here.

data "aws_caller_identity" "current" {}

locals {
  # EventBridge Scheduler "universal target" that invokes ANY AWS API.
  send_command_target_arn = "arn:aws:scheduler:::aws-sdk:ssm:sendCommand"

  # Least-privilege resource ARNs for the ssm:SendCommand permission.
  # AWS-managed SSM documents use an empty account ID (`::document/...`).
  fpl_host_instance_arn = "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${var.ec2_instance_id}"
  fpl_run_shell_doc_arn = "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript"

  # Single-line container selector: prefer the dedicated sync worker
  # container (fpl-worker, P2-NH03); fall back to the API container
  # (fpl-backend, same image) while a re-deploy is in progress.
  pick_worker_container = "C=fpl-worker; [ \"$(docker inspect -f '{{.State.Running}}' \"$C\" 2>/dev/null)\" = true ] || C=fpl-backend"

  # -- SCHEDULE 1 (pre-gameweek): fixtures + injuries (P4-NH01) ------------
  pre_gameweek_commands = [
    "set -e",
    local.pick_worker_container,
    "echo \"[P4-Q01] pre-gameweek fixture sync on container: $C\"",
    "docker exec \"$C\" python -m app.services.fixture_sync",
  ]
  pre_gameweek_input = jsonencode({
    Comment        = "P4-Q01 pre-gameweek fixture/availability sync (P4-NH01)"
    DocumentName   = "AWS-RunShellScript"
    InstanceIds    = [var.ec2_instance_id]
    TimeoutSeconds = 900
    Parameters = {
      commands = local.pre_gameweek_commands
    }
  })

  # -- SCHEDULES 2 & 3 (post-match / overnight catch-up): P4-NH02 ----------
  # 1) fixture_sync first so `fixtures.finished` mirrors the FPL API;
  # 2) resolve the newest gameweek whose fixtures have finished, reading
  #    straight from the project DB (P4-V01 schema: column `gameweek`,
  #    boolean `finished`) using the app's own async engine;
  # 3) run live_match_sync for that gameweek. The worker is idempotent
  #    (upsert, no double counting) so re-running the same gameweek is safe.
  live_sync_commands = [
    "set -e",
    local.pick_worker_container,
    "echo \"[P4-Q01] post-match live sync on container: $C\"",
    "docker exec \"$C\" python -m app.services.fixture_sync",
    "GW=\"$(docker exec \"$C\" python -c 'import asyncio\nfrom sqlalchemy import text\nfrom app.core.database import engine\nasync def _gw():\n    async with engine.connect() as c:\n        return (await c.execute(text(\"SELECT COALESCE(MAX(gameweek),0)::int FROM fixtures WHERE finished = TRUE\"))).scalar()\nprint(asyncio.run(_gw()))')\"",
    "case \"$GW\" in ''|*[!0-9]*) GW=0 ;; esac",
    "echo \"resolved last finished gameweek=$GW\"",
    "if [ \"$GW\" -ge 1 ]; then",
    "  docker exec \"$C\" python -m app.services.live_match_sync --gameweek \"$GW\"",
    "else",
    "  echo \"no finished gameweek yet - skipping live sync\"",
    "fi",
  ]
  live_sync_input = jsonencode({
    Comment        = "P4-Q01 post-match live + Dream Team sync (P4-NH02) for the latest finished gameweek"
    DocumentName   = "AWS-RunShellScript"
    InstanceIds    = [var.ec2_instance_id]
    TimeoutSeconds = 1800
    Parameters = {
      commands = local.live_sync_commands
    }
  })
}
# =====================================================================
# 1. IAM - EventBridge Scheduler execution role (least privilege)
# =====================================================================
resource "aws_iam_role" "fpl_eventbridge_scheduler" {
  name = "fpl-p4q01-eventbridge-scheduler-role"

  description = "EventBridge Scheduler -> SSM Run Command on the FPL backend EC2 host (P4-Q01)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "fpl-p4q01-eventbridge-scheduler-role"
    Task = "P4-Q01"
  }
}

resource "aws_iam_role_policy" "fpl_eventbridge_scheduler_ssm" {
  name = "ssm-send-command-scoped"
  role = aws_iam_role.fpl_eventbridge_scheduler.id

  # Scoped to exactly ONE instance and ONE SSM document - never Resource:"*".
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SendCommandToFplBackendHost"
        Effect = "Allow"
        Action = "ssm:SendCommand"
        Resource = [
          local.fpl_host_instance_arn,
          local.fpl_run_shell_doc_arn,
        ]
      }
    ]
  })
}

# =====================================================================
# 2. SCHEDULE 1 - Pre-gameweek sync (before every EPL round)
# ---------------------------------------------------------------------
# cron(0 9 * * ? *) = every day at 09:00 UTC. EPL gameweek deadlines are
# UK mornings (typically 11:00 UK on Saturday; Friday/Sunday openers are
# usually evening UK). 09:00 UTC is earlier than every real deadline in
# BOTH GMT (09:00 UK) and BST (10:00 UK), so this run is always strictly
# "before the round".
# =====================================================================
resource "aws_scheduler_schedule" "fpl_pre_gameweek_sync" {
  name = "fpl-pre-gameweek-sync"

  description = "[P4-Q01] Daily 09:00 UTC - refresh EPL fixtures + injury status (P4-NH01) before every gameweek deadline"

  schedule_expression          = var.pre_gameweek_cron
  schedule_expression_timezone = var.scheduler_timezone
  state                        = var.schedule_state

  flexible_time_window {
    mode = "OFF" # fire at the exact cron minute (precise EPL timing)
  }

  target {
    arn      = local.send_command_target_arn
    role_arn = aws_iam_role.fpl_eventbridge_scheduler.arn
    input    = local.pre_gameweek_input

    retry_policy {
      maximum_event_age_in_seconds = 300
      maximum_retry_attempts       = 3
    }
  }

  # NOTE: the Terraform AWS provider in use (locked to ~> 5.60) does not
  # expose `tags` on aws_scheduler_schedule yet; provider default_tags apply
  # from terraform_rds.tf wherever the API supports tagging.
}
# =====================================================================
# 3. SCHEDULE 2 - Post-match live sync (after EPL matches finish)
# ---------------------------------------------------------------------
# cron(0 13-23 * * ? *) = hourly from 13:00 to 23:00 UTC. Covers every
# realistic finish time of Premier League matches (earliest ~14:30 UK,
# latest ~22:15 UK) in both GMT and BST. fixture_sync runs first so the
# `finished` flags / scores are current, then live_match_sync ingests the
# stats + Dream Team of the newest finished gameweek.
# =====================================================================
resource "aws_scheduler_schedule" "fpl_post_match_live_sync" {
  name = "fpl-post-match-live-sync"

  description = "[P4-Q01] Hourly 13:00-23:00 UTC - live stats + Dream Team sync (P4-NH02) after matches finish"

  schedule_expression          = var.post_match_cron
  schedule_expression_timezone = var.scheduler_timezone
  state                        = var.schedule_state

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = local.send_command_target_arn
    role_arn = aws_iam_role.fpl_eventbridge_scheduler.arn
    input    = local.live_sync_input

    retry_policy {
      maximum_event_age_in_seconds = 300
      maximum_retry_attempts       = 3
    }
  }
}

# =====================================================================
# 4. SCHEDULE 3 - Overnight settle catch-up
# ---------------------------------------------------------------------
# cron(0 6 * * ? *) = every day at 06:00 UTC. Runs the same idempotent
# live-sync chain once more to pick up late bonus/BPS corrections and the
# official Dream Team, which FPL usually finalises only after the whole
# gameweek is complete.
# =====================================================================
resource "aws_scheduler_schedule" "fpl_overnight_settle_catchup" {
  name = "fpl-overnight-settle-catchup"

  description = "[P4-Q01] Daily 06:00 UTC - catch-up re-sync (P4-NH02) for bonus/BPS/Dream Team finalisation"

  schedule_expression          = var.overnight_catchup_cron
  schedule_expression_timezone = var.scheduler_timezone
  state                        = var.schedule_state

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = local.send_command_target_arn
    role_arn = aws_iam_role.fpl_eventbridge_scheduler.arn
    input    = local.live_sync_input

    retry_policy {
      maximum_event_age_in_seconds = 300
      maximum_retry_attempts       = 3
    }
  }
}
# =====================================================================
# 5. OUTPUTS
# =====================================================================
output "scheduler_role_arn" {
  description = "IAM role assumed by EventBridge Scheduler (P4-Q01)"
  value       = aws_iam_role.fpl_eventbridge_scheduler.arn
}

output "scheduler_schedule_arns" {
  description = "EventBridge Scheduler schedule ARNs (P4-Q01)"
  value = {
    pre_gameweek_sync    = aws_scheduler_schedule.fpl_pre_gameweek_sync.arn
    post_match_live_sync = aws_scheduler_schedule.fpl_post_match_live_sync.arn
    overnight_catchup    = aws_scheduler_schedule.fpl_overnight_settle_catchup.arn
  }
}

# =====================================================================
# 6. VARIABLES (inputs) - names intentionally do not collide with
# terraform_rds.tf (aws_region, environment, db_*, ... stay over there).
# =====================================================================
variable "ec2_instance_id" {
  description = "SSM-managed EC2 instance running the FPL backend Docker containers (P3-Q02)."
  type        = string
  default     = "i-0f1e71fa1a78b0013"
}

variable "schedule_state" {
  description = "EventBridge Scheduler state; switch to DISABLED when the EPL season ends or during teardown."
  type        = string
  default     = "ENABLED"

  validation {
    condition     = contains(["ENABLED", "DISABLED"], var.schedule_state)
    error_message = "schedule_state must be either ENABLED or DISABLED."
  }
}

variable "scheduler_timezone" {
  description = "IANA timezone applied to every schedule_expression (SSOT defaults to UTC)."
  type        = string
  default     = "UTC"
}

variable "pre_gameweek_cron" {
  description = "6-field cron for the pre-deadline fixture/availability sync. Default daily 09:00 UTC - before any EPL deadline in GMT and BST."
  type        = string
  default     = "cron(0 9 * * ? *)"
}

variable "post_match_cron" {
  description = "6-field cron for the hourly post-match live sync window. Default 13:00-23:00 UTC daily."
  type        = string
  default     = "cron(0 13-23 * * ? *)"
}

variable "overnight_catchup_cron" {
  description = "6-field cron for the daily overnight catch-up. Default 06:00 UTC daily."
  type        = string
  default     = "cron(0 6 * * ? *)"
}

