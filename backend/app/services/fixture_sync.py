"""P4-NH01: atomic fixture and player availability ingestion.

Run once from backend/: python -m app.services.fixture_sync
Requires Alembic head 005_add_player_availability. Scheduling belongs to P4-Q01.
Reuses bootstrap/fixture parsers and upsert; never deletes rows or runs migrations.
Fixtures with event=null are counted and skipped, preserving any stored row until
FPL assigns a gameweek. The existing schema requires a non-null gameweek.
"""

import asyncio
from collections.abc import Callable
import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.models import Fixture, Player, Team
from app.services.fdr_service import FPL_FIXTURES_URL, clear_fdr_cache
from app.services.fixtures_sync import _parse_fixture_payload
from app.services.fpl_sync import FPLSyncError, _parse_payload, _upsert
from app.services.optimizer_cache import optimizer_response_cache


logger = logging.getLogger(__name__)


async def sync_fixtures_and_injuries(
    session_factory: Callable[[], AsyncSession] = AsyncSessionLocal,
    *,
    client: httpx.AsyncClient | None = None,
    bootstrap_url: str | None = None,
    fixtures_url: str = FPL_FIXTURES_URL,
) -> dict[str, int]:
    """Validate both responses before opening one transaction for all writes.

    Caller-owned clients are left open. Status/news/percentage and other bootstrap
    fields refresh even within the same gameweek. Counts are processed records,
    not newly inserted rows. Cache invalidation affects only this process; API
    processes rely on their existing cache TTLs for freshness.
    """
    if client is None:
        async with httpx.AsyncClient() as owned_client:
            return await sync_fixtures_and_injuries(
                session_factory, client=owned_client,
                bootstrap_url=bootstrap_url, fixtures_url=fixtures_url,
            )
    try:
        bootstrap = await client.get(bootstrap_url or settings.FPL_BOOTSTRAP_URL, timeout=30.0)
        bootstrap.raise_for_status()
        fixtures = await client.get(fixtures_url, timeout=30.0)
        fixtures.raise_for_status()
    except httpx.HTTPError as exc:
        raise FPLSyncError("FPL fixture/availability request failed") from exc
    try:
        teams, players = _parse_payload(bootstrap.json())
        rows, unassigned = _parse_fixture_payload(fixtures.json())
        team_ids = {team["id"] for team in teams}
        if any(row["team_h"] not in team_ids or row["team_a"] not in team_ids for row in rows):
            raise ValueError("Fixture references a team missing from bootstrap")
    except (ValueError, TypeError) as exc:
        raise FPLSyncError("Invalid FPL fixture/availability payload") from exc
    try:
        async with session_factory() as session:
            async with session.begin():
                await _upsert(session, Team.__table__, teams)
                await _upsert(session, Player.__table__, players)
                await _upsert(session, Fixture.__table__, rows)
    except Exception as exc:
        raise FPLSyncError("Fixture/availability sync failed; transaction rolled back") from exc
    optimizer_response_cache.clear()
    clear_fdr_cache()
    result = {
        "teams_processed": len(teams), "players_processed": len(players),
        "fixtures_processed": len(rows), "fixtures_unassigned": unassigned,
    }
    logger.info("P4-NH01 sync succeeded: %s", result)
    if unassigned:
        logger.warning("P4-NH01 skipped %s fixtures without a gameweek", unassigned)
    return result


async def _main() -> None:
    try:
        await sync_fixtures_and_injuries()
    except FPLSyncError as exc:
        # No raw database exception or credential-bearing traceback in CLI output.
        logger.error("P4-NH01: %s", exc)
        raise SystemExit(1) from None
    finally:
        await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_main())
