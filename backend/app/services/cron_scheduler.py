"""P2-NH03: check FPL gameweek and sync on a six-hour interval.

Dedicated worker (from backend/): python -m app.services.cron_scheduler
Alternatively set FPL_SYNC_ENABLED=true for FastAPI lifespan integration.
Deploy ONE scheduler process, either dedicated or embedded, never both. The
async lock prevents overlap inside one scheduler; it is not a distributed lock.
Gameweek state is in memory: restart performs one idempotent bootstrap sync.
No schema changes, migration, infrastructure changes or external scheduler.
"""

import asyncio
from contextlib import suppress
import logging
import math
from collections.abc import Awaitable, Callable

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.services.fpl_sync import sync_fpl_data


logger = logging.getLogger(__name__)
GameweekKey = tuple[int, str | None]


def get_gameweek_key(payload: object) -> GameweekKey | None:
    """Prefer current GW; use next GW before the first current GW exists.

    Include deadline_time so the next season's GW 1 is not confused with the
    previous season. Invalid event metadata must not advance scheduler state.
    """
    if not isinstance(payload, dict) or not isinstance(payload.get("events"), list):
        raise ValueError("Bootstrap must contain an events list")
    events = payload["events"]
    for event in events:
        if not isinstance(event, dict) or type(event.get("id")) is not int or not 1 <= event["id"] <= 38:
            raise ValueError("Invalid gameweek ID")
        if not isinstance(event.get("is_current"), bool) or not isinstance(event.get("is_next"), bool):
            raise ValueError("Invalid gameweek flags")
        if event.get("deadline_time") is not None and not isinstance(event["deadline_time"], str):
            raise ValueError("Invalid gameweek deadline")
    if len({event["id"] for event in events}) != len(events):
        raise ValueError("Duplicate gameweek IDs")
    current = [event for event in events if event["is_current"]]
    upcoming = [event for event in events if event["is_next"]]
    if len(current) > 1 or len(upcoming) > 1:
        raise ValueError("Ambiguous gameweek flags")
    selected = current or upcoming
    if not selected:
        return None
    return selected[0]["id"], selected[0].get("deadline_time")


class FPLSyncScheduler:
    def __init__(
        self,
        *,
        interval_seconds: float = 6 * 60 * 60,
        url: str | None = None,
        session_factory: Callable[[], AsyncSession] = AsyncSessionLocal,
        client: httpx.AsyncClient | None = None,
        sync: Callable[..., Awaitable[dict[str, int]]] = sync_fpl_data,
    ):
        if not math.isfinite(interval_seconds) or interval_seconds <= 0:
            raise ValueError("Scheduler interval must be finite and positive")
        self.interval_seconds = interval_seconds
        self.url = url or settings.FPL_BOOTSTRAP_URL
        self.session_factory = session_factory
        self.client = client
        self.sync = sync
        self.last_gameweek: GameweekKey | None = None
        self._lock = asyncio.Lock()
        self._task: asyncio.Task | None = None

    async def check_once(self) -> bool:
        """Return True only after a successful sync. Failures propagate to caller."""
        if self._lock.locked():
            return False
        async with self._lock:
            if self.client is None:
                async with httpx.AsyncClient() as client:
                    return await self._check_with_client(client)
            return await self._check_with_client(self.client)

    async def _check_with_client(self, client: httpx.AsyncClient) -> bool:
        response = await client.get(self.url, timeout=30.0)
        response.raise_for_status()
        key = get_gameweek_key(response.json())
        if key is None or key == self.last_gameweek:
            return False
        await self.sync(self.session_factory, client=client, url=self.url)
        self.last_gameweek = key
        logger.info("FPL sync succeeded for gameweek %s", key[0])
        return True

    async def run(self) -> None:
        """Check immediately, then at the configured interval; retry next tick."""
        loop = asyncio.get_running_loop()
        while True:
            started = loop.time()
            try:
                await self.check_once()
            except Exception as error:
                # Never log exception text/tracebacks that could contain DB URLs.
                logger.warning("FPL scheduled sync failed (%s); retry next interval", type(error).__name__)
            await asyncio.sleep(max(0.0, self.interval_seconds - (loop.time() - started)))

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self.run(), name="fpl-sync-scheduler")

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            with suppress(asyncio.CancelledError):
                await self._task
            self._task = None


async def _main() -> None:
    worker = FPLSyncScheduler(interval_seconds=settings.FPL_SYNC_INTERVAL_SECONDS)
    try:
        await worker.run()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_main())
