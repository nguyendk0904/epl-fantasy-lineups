# =====================================================================
# P2-Q01 - Amazon RDS PostgreSQL 15 (AWS Free Tier) provisioning
# Project : Fantasy Football Lineup Builder & Optimizer
# Owner   : Quang (DevOps & Cloud Infrastructure Lead)
# Branch  : feature/P2-Q01-aws-rds-init
# Docs    : infra/aws/rds_setup.md (runbook + verification + cost guardrails)
# Source  : docs/PROJECT_SSOT.md (PostgreSQL 15, region ap-southeast-1)
#
# Free Tier envelope enforced BY DESIGN in this file:
#   - Instance class db.t4g.micro (750 h/month, Single-AZ only)
#   - gp3 storage = 20 GB with storage autoscaling DISABLED (max_allocated_storage = 0)
#   - No Multi-AZ, no read replica, no Performance Insights, no log exports
#   - Backup retention 1 day (fits in the 20 GB free backup allowance)
#   - skip_final_snapshot = true -> destroying leaves NO paid snapshot behind
#
# Single-file bootstrap: the provider/version block lives here because this is
# the first Terraform file of the project (it will be split into
# providers.tf / main.tf once P2-Q03/P2-Q04 add more resources).
#
# Usage (details in rds_setup.md):
#   export TF_VAR_db_password="$(openssl rand -hex 16)"   # 32 hex chars, never commit it
#   terraform init && terraform plan && terraform apply
# =====================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  # Local state on purpose: this is a student Free Tier account and the state
  # contains the master password. Never commit terraform.tfstate / *.tfvars.
}

provider "aws" {
  region = var.aws_region

  # Applied to every resource of this config -> easier cost tracking in Billing.
  default_tags {
    tags = local.common_tags
  }
}

locals {
  common_tags = {
    Project     = "epl-fantasy-lineups"
    Environment = var.environment
    Owner       = "Quang"
    Task        = "P2-Q01"
    ManagedBy   = "Terraform"
    CostControl = "aws-free-tier"
  }

  # "15" / "15.8" -> "postgres15" (parameter group family)
  postgres_family = "postgres${split(".", var.engine_version)[0]}"
}

# =====================================================================
# 1. NETWORK - reuse the account's DEFAULT VPC (no NAT Gateway / ELB cost)
# =====================================================================
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# RDS requires subnets in at least 2 Availability Zones; the default VPC
# already provides one subnet per AZ, so no extra networking is created.
resource "aws_db_subnet_group" "this" {
  name        = "${var.db_identifier}-subnet-group"
  description = "Free Tier subnet group for ${var.db_identifier} (P2-Q01)"
  subnet_ids  = data.aws_subnets.default.ids

  tags = {
    Name = "${var.db_identifier}-subnet-group"
  }
}

# =====================================================================
# 2. SECURITY GROUP SHELL - intentionally has NO ingress rule
# ---------------------------------------------------------------------
# Baseline = "deny everything": the database stays unreachable until the
# least-privilege rules (dev IP + backend SG) are added by task P2-Q02.
# This keeps security-critical work in its own reviewed task and makes
# "0.0.0.0/0 on port 5432" structurally impossible to ship from P2-Q01.
# =====================================================================
resource "aws_security_group" "rds" {
  name        = "${var.db_identifier}-sg"
  description = "RDS PostgreSQL boundary for ${var.db_identifier} (ingress rules owned by P2-Q02)"
  vpc_id      = data.aws_vpc.default.id

  # --- P2-Q02 replaces this comment with the real least-privilege block ---
  # ingress {
  #   description = "PostgreSQL 5432 from fixed dev IPs only"
  #   from_port   = 5432
  #   to_port     = 5432
  #   protocol    = "tcp"
  #   cidr_blocks = var.dev_cidr_blocks # e.g. ["203.0.113.10/32"]
  # }

  # RDS never initiates outbound connections (replies are stateful), so
  # everything is denied here to remove any data-exfiltration path.
  egress {
    description = "Deny all egress - RDS only answers inbound connections"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["127.0.0.1/32"]
  }

  tags = {
    Name = "${var.db_identifier}-sg"
  }
}

# =====================================================================
# 3. PARAMETER GROUP - enforce TLS on every connection (free)
# =====================================================================
resource "aws_db_parameter_group" "this" {
  name        = "${var.db_identifier}-${local.postgres_family}"
  family      = local.postgres_family
  description = "TLS-only parameter group for ${var.db_identifier} (P2-Q01)"

  # force_ssl = 1 -> non-TLS clients are rejected by pg_hba (hostssl entries).
  # Static parameter -> requires a reboot (RDS applies it, or reboot manually).
  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }

  tags = {
    Name = "${var.db_identifier}-${local.postgres_family}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# =====================================================================
# 4. THE RDS INSTANCE (Free Tier shape, hard-coded guardrails)
# =====================================================================
resource "aws_db_instance" "this" {
  identifier = var.db_identifier

  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  # --- Storage guardrail: 20 GB gp3 is the Free Tier maximum ---
  storage_type          = "gp3"
  allocated_storage     = 20
  max_allocated_storage = 0    # 0 = storage autoscaling OFF (no silent growth = no bill)
  storage_encrypted     = true # AWS-managed key (aws/rds) -> no KMS CMK charge

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password # injected via TF_VAR_db_password, never committed
  port     = 5432

  # --- Paid features explicitly disabled ---
  multi_az                        = false
  performance_insights_enabled    = false
  monitoring_interval             = 0
  enabled_cloudwatch_logs_exports = [] # log ingestion beyond the 5 GB/month is billed

  # --- Built on top of the security baseline above ---
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.this.name
  publicly_accessible    = var.publicly_accessible # default false

  # --- Backups: 1 day of PITR stays inside the 20 GB free allowance ---
  backup_retention_period = 1
  backup_window           = "18:00-18:30" # 01:00-01:30 ICT (UTC+7)
  maintenance_window      = "sun:19:00-sun:19:30"

  auto_minor_version_upgrade  = true
  allow_major_version_upgrade = false
  apply_immediately           = false

  # --- Cost-exit guardrails: `terraform destroy` must be clean & immediate ---
  deletion_protection   = false # set to true only for a long-running production DB
  skip_final_snapshot   = true  # no paid snapshot left behind after destroy
  copy_tags_to_snapshot = true

  tags = {
    Name = var.db_identifier
  }
}

# =====================================================================
# 5. OUTPUTS - safe connection parameters only (never the password)
# =====================================================================
output "db_identifier" {
  description = "RDS DB instance identifier"
  value       = aws_db_instance.this.identifier
}

output "db_status" {
  description = "Current instance status - must be 'available' for the acceptance criteria"
  value       = aws_db_instance.this.status
}

output "db_host" {
  description = "Endpoint hostname used by the backend"
  value       = aws_db_instance.this.address
}

output "db_endpoint" {
  description = "host:port endpoint"
  value       = aws_db_instance.this.endpoint
}

output "db_port" {
  description = "PostgreSQL port"
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Initial database name"
  value       = aws_db_instance.this.db_name
}

output "db_username" {
  description = "Master username (stored in the team password manager)"
  value       = aws_db_instance.this.username
}

output "db_security_group_id" {
  description = "Security group to allow in P2-Q02 (backend SG / dev IP)"
  value       = aws_security_group.rds.id
}

output "database_url_template" {
  description = "SQLAlchemy async URL template - paste the password from the password manager"
  value       = "postgresql+asyncpg://${aws_db_instance.this.username}:<DB_PASSWORD>@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${aws_db_instance.this.db_name}?ssl=require"
}

output "psql_command_template" {
  description = "psql verification command (TLS required by rds.force_ssl = 1)"
  value       = "psql \"host=${aws_db_instance.this.address} port=${aws_db_instance.this.port} dbname=${aws_db_instance.this.db_name} user=${aws_db_instance.this.username} sslmode=require\""
}

# =====================================================================
# 6. VARIABLES (inputs)
# =====================================================================
variable "aws_region" {
  description = "AWS region - fixed by SSOT / .env.example"
  type        = string
  default     = "ap-southeast-1"

  validation {
    condition     = var.aws_region == "ap-southeast-1"
    error_message = "SSOT fixes AWS_REGION=ap-southeast-1 for this project (docs/PROJECT_SSOT.md section 5)."
  }
}

variable "environment" {
  description = "Deployment stage tag"
  type        = string
  default     = "prod"
}

variable "db_identifier" {
  description = "DB instance identifier (lowercase, starts with a letter)"
  type        = string
  default     = "fpl-fantasy-db"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,62}$", var.db_identifier))
    error_message = "db_identifier must be 3-63 chars: lowercase letters, digits or hyphens, starting with a letter."
  }
}

variable "engine_version" {
  description = "PostgreSQL major version (SSOT requires 15). Keep the major version only so RDS picks the latest 15.x available in the region."
  type        = string
  default     = "15"

  validation {
    condition     = can(regex("^15(\\.[0-9]+)?$", var.engine_version))
    error_message = "Only PostgreSQL 15 is approved for this project (PROJECT_SSOT tech stack)."
  }
}

variable "instance_class" {
  description = "Free Tier instance class - do not change without a cost review"
  type        = string
  default     = "db.t4g.micro"

  validation {
    condition     = var.instance_class == "db.t4g.micro"
    error_message = "Free Tier guardrail: only db.t4g.micro is allowed in P2-Q01."
  }
}

variable "db_name" {
  description = "Initial database name (same name as the local Docker Compose database)"
  type        = string
  default     = "fantasy_fpl"
}

variable "db_username" {
  description = "Master username - not 'postgres' (AWS best practice)"
  type        = string
  default     = "fpl_admin"
}

variable "db_password" {
  description = "Master password. Inject via TF_VAR_db_password (>= 16 chars, no / \" @ or space)."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[^/@\" ]{16,128}$", var.db_password))
    error_message = "RDS master password must be 16-128 printable chars and must not contain '/', '\"', '@' or space."
  }
}

variable "publicly_accessible" {
  description = "Keep false. Only set true for a short, time-boxed psql verification window (see rds_setup.md)."
  type        = bool
  default     = false
}

variable "dev_cidr_blocks" {
  description = "Fixed dev IPs (/32) consumed by the P2-Q02 least-privilege ingress rule. Empty = nobody."
  type        = list(string)
  default     = []
}
