#!/usr/bin/env bash
# =====================================================================
# P3-NH01/NH02/P2-NH02/NH03 - read-only preflight ON the EC2 instance.
# Run with:  scripts/ssm_run.sh --file scripts/acceptance/remote_preflight.sh
# Never prints secret values: only variable NAMES, host names and counts.
# =====================================================================
set -uo pipefail
C=fpl-backend

echo "== containers"
docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}'

echo
echo "== backend env variable names (values hidden)"
docker exec "$C" env | cut -d= -f1 | sort | grep -Ev '^(PATH|HOSTNAME|LANG|GPG_KEY|PYTHON_VERSION|PYTHON_SHA256|PYTHON_SETUPTOOLS_VERSION|PYTHON_GET_PIP_URL|PYTHON_GET_PIP_SHA256|PWD|HOME|SHLVL|_|PYTHONUNBUFFERED|PYTHONDONTWRITEBYTECODE)$'

echo
echo "== runtime dependencies + CBC (P1-Q01/P3-NH01/P3-NH02)"
docker exec -i "$C" python - <<'PY'
import importlib.metadata as md
import pulp
rows = []
for name in ("fastapi", "uvicorn", "sqlalchemy", "asyncpg", "alembic", "pulp",
             "boto3", "botocore", "watchtower", "slowapi", "limits", "redis", "httpx"):
    try:
        rows.append((name, md.version(name)))
    except md.PackageNotFoundError:
        rows.append((name, "MISSING"))
print(" | ".join(f"{n}={v}" for n, v in rows))
solver = pulp.COIN_CMD(msg=False)
print("pulp.COIN_CMD.available =", solver.available(), "| path =", getattr(solver, "path", None))
print("pulp.PULP_CBC_CMD.available =", pulp.PULP_CBC_CMD(msg=False).available())
PY

echo
echo "== database: private RDS connectivity, TLS, migrations, data"
docker exec -i "$C" python - <<'PY'
import asyncio
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine

async def main():
    async with engine.connect() as conn:
        print("target_host =", engine.url.host, "| db =", engine.url.database, "| ssl =", engine.url.query.get("ssl"))
        print("select 1 =", await conn.scalar(text("select 1")))
        row = (await conn.execute(text("""
            select current_database() as db,
                   current_user as usr,
                   inet_server_addr()::text as server_addr,
                   inet_server_port() as server_port,
                   ssl.ssl as tls_on,
                   ssl.version as tls_version
            from pg_stat_ssl ssl
            where ssl.pid = pg_backend_pid()
        """))).one()
        print(f"connected db={row.db} user={row.usr} server={row.server_addr}:{row.server_port} "
              f"tls={row.tls_on} tls_version={row.tls_version}")
        tables = (await conn.execute(text(
            "select tablename from pg_tables where schemaname='public' order by 1"
        ))).scalars().all()
        print("public_tables =", ",".join(tables))
        rev = await conn.scalar(text("select version_num from alembic_version"))
        print("alembic_version =", rev)
        for table in ("teams", "players", "shared_lineups"):
            if table in tables:
                print(f"{table}_rows =", await conn.scalar(text(f"select count(*) from {table}")))
        if "players" in tables:
            print("players_max_id =", await conn.scalar(text("select max(id) from players")))
            print("shared_lineups_latest =", await conn.scalar(text(
                "select max(created_at)::text from shared_lineups"
            )))
    await engine.dispose()

asyncio.run(main())
PY

echo
echo "== platform"
echo "environment = $(docker exec "$C" printenv ENVIRONMENT)"
echo "uvicorn processes = $(docker top "$C" -eo args 2>/dev/null | grep -c '[u]vicorn')"
echo "fpl-worker count = $(docker ps -a --format '{{.Names}}' | grep -c '^fpl-worker$')"
