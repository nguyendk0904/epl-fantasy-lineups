#!/usr/bin/env bash
# =====================================================================
# P4-NH01 / P4-V01 - Apply Alembic migrations up to head on production RDS.
# Runs ON the EC2 instance (inside the VPC) because RDS is private:
#
#   scripts/ssm_run.sh --file scripts/acceptance/run_migrations.sh
#
# Why mount source: backend/Dockerfile copies ./app only (no alembic/),
# so this script mounts the exact Git revision matching the running image
# and runs `alembic upgrade head` with /opt/fpl/backend.env.
# Prints no secret values.
# =====================================================================
set -euo pipefail
ENV_FILE=/opt/fpl/backend.env
SRC=/opt/fpl/src
REPO=nguyendk0904/epl-fantasy-lineups

IMAGE="$(docker inspect fpl-backend --format '{{.Config.Image}}')"
REV="${IMAGE##*:}"
echo "image    = $IMAGE"
echo "revision = $REV"

if [ ! -f "$SRC/backend/alembic.ini" ] || [ "$(cat "$SRC/.revision" 2>/dev/null)" != "$REV" ]; then
  echo "--- downloading source for $REV"
  curl -fsSL --retry 3 -o /tmp/fpl-src.tar.gz \
    "https://codeload.github.com/$REPO/tar.gz/$REV"
  rm -rf "$SRC"
  mkdir -p "$SRC"
  tar -xzf /tmp/fpl-src.tar.gz -C "$SRC" --strip-components=1
  rm -f /tmp/fpl-src.tar.gz
  printf '%s\n' "$REV" > "$SRC/.revision"
fi

LOCAL_SUM="$(sha256sum "$SRC/backend/app/core/config.py" | cut -d' ' -f1)"
IMAGE_SUM="$(docker exec fpl-backend sha256sum app/core/config.py | cut -d' ' -f1)"
if [ "$LOCAL_SUM" != "$IMAGE_SUM" ]; then
  echo "MISMATCH: source $LOCAL_SUM != image $IMAGE_SUM" >&2
  exit 3
fi
echo "source matches image (config.py sha256 $LOCAL_SUM)"

echo "--- running alembic upgrade head"
docker run --rm \
  -v "$SRC:/repo:ro" -w /repo/backend \
  --env-file "$ENV_FILE" \
  -e PYTHONDONTWRITEBYTECODE=1 \
  -e PYTHONPATH=/repo/backend \
  "$IMAGE" alembic upgrade head

echo "--- verifying schema state"
docker exec -i fpl-backend python - <<'PY'
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def main():
    async with engine.connect() as conn:
        rev = await conn.scalar(text("select version_num from alembic_version"))
        tables = (await conn.execute(text(
            "select tablename from pg_tables where schemaname='public' order by 1"
        ))).scalars().all()
        col = await conn.scalar(text(
            "select column_name from information_schema.columns "
            "where table_schema='public' and table_name='players' "
            "and column_name='chance_of_playing_next_round'"
        ))
        print("alembic_version =", rev)
        print("public_tables   =", ",".join(tables))
        print("players.chance_of_playing_next_round =", col or "MISSING")
    await engine.dispose()

asyncio.run(main())
PY
