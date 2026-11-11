#!/usr/bin/env bash
# =====================================================================
# P3-NH03 - create the dedicated PostgreSQL test database on RDS.
# Runs ON the EC2 instance (inside the VPC) because RDS is private:
#     scripts/ssm_run.sh --file scripts/acceptance/create_test_database.sh
#
# Name MUST end with "_test": backend/tests/conftest.py and
# backend/tests/test_fpl_sync.py refuse any other suffix.
# Idempotent: only creates the database when it is missing.
# Prints no credentials.
# =====================================================================
set -euo pipefail
ENV_FILE=/opt/fpl/backend.env
TEST_DB="${FPL_TEST_DATABASE_NAME:-fantasy_fpl_test}"

IMAGE="$(docker inspect fpl-backend --format '{{.Config.Image}}')"

docker run --rm -i --env-file "$ENV_FILE" -e "TEST_DB=$TEST_DB" "$IMAGE" python - <<'PY'
import asyncio
import os

import asyncpg


async def main() -> None:
    target = os.environ["TEST_DB"]
    if not target.endswith("_test"):
        raise SystemExit(f"refusing to create {target!r}: name must end with _test")
    connection = await asyncpg.connect(
        host=os.environ["RDS_HOSTNAME"],
        port=int(os.environ["RDS_PORT"]),
        user=os.environ["RDS_USERNAME"],
        password=os.environ["RDS_PASSWORD"],
        database=os.environ["RDS_DB_NAME"],
        ssl="require",
        timeout=10,
    )
    try:
        exists = await connection.fetchval("select 1 from pg_database where datname = $1", target)
        if exists:
            print(f"database exists  : {target}")
        else:
            await connection.execute(f'CREATE DATABASE "{target}"')
            print(f"database created : {target}")
        owner = await connection.fetchval(
            "select pg_get_userbyid(datdba) from pg_database where datname = $1", target
        )
        size = await connection.fetchval(
            "select pg_size_pretty(pg_database_size($1))", target
        )
        print(f"owner={owner} size={size}")
    finally:
        await connection.close()

    # Hygiene: suites must drop their own schema, so nothing should be left.
    probe = await asyncpg.connect(
        host=os.environ["RDS_HOSTNAME"],
        port=int(os.environ["RDS_PORT"]),
        user=os.environ["RDS_USERNAME"],
        password=os.environ["RDS_PASSWORD"],
        database=target,
        ssl="require",
        timeout=10,
    )
    try:
        rows = await probe.fetch(
            "select nspname from pg_namespace "
            "where nspname like 'e2e\\_%' or nspname like 'share\\_%' or nspname like 'fpl\\_sync\\_%'"
        )
        tables = [row["tablename"] for row in await probe.fetch(
            "select tablename from pg_tables where schemaname = 'public'"
        )]
        print(f"leftover test schemas = {[row['nspname'] for row in rows] or 'none'}")
        print(f"public tables in test db = {tables or 'none (suites create their own schema)'}")
    finally:
        await probe.close()


asyncio.run(main())
PY
