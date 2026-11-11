"""Read-only probe of the live FPL bootstrap payload (P1-NH02 / P2-NH03).

Why: `backend/app/services/fpl_sync.py` validates the payload with strict
pydantic models. When the real API sends `null` in a field that is typed as a
required int/Decimal, the sync aborts with
`FPLSyncError: Invalid FPL bootstrap payload` and the cloud worker can never
populate RDS. This script reports which fields are null so the owner of
`fpl_sync.py` (Nhất) can decide how to normalise them.

Usage (no dependencies, works on Windows or inside the backend image):
    python scripts/acceptance/fpl_payload_probe.py
    python scripts/acceptance/fpl_payload_probe.py https://example/bootstrap-static/
"""

from __future__ import annotations

import json
import sys
import urllib.request

URL = sys.argv[1] if len(sys.argv) > 1 else "https://fantasy.premierleague.com/api/bootstrap-static/"

TEAM_FIELDS = ["id", "name", "short_name", "strength",
               "strength_attack_home", "strength_attack_away",
               "strength_defence_home", "strength_defence_away"]
ELEMENT_FIELDS = ["id", "web_name", "team", "element_type", "now_cost", "status",
                  "total_points", "form", "selected_by_percent",
                  "expected_goals", "expected_assists", "ict_index"]


def nulls(rows: list[dict], field: str) -> list[int]:
    return [row["id"] for row in rows if row.get(field) is None]


def main() -> int:
    request = urllib.request.Request(URL, headers={"User-Agent": "fpl-acceptance-probe/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)

    teams = payload.get("teams") or []
    elements = payload.get("elements") or []
    events = payload.get("events") or []
    print(f"url={URL}")
    print(f"teams={len(teams)} elements={len(elements)} events={len(events)}")

    print("\nteam fields with null values:")
    for field in TEAM_FIELDS:
        missing = nulls(teams, field)
        print(f"  {field:24s} nulls={len(missing):3d} ids={missing[:8]}")

    print("\nelement fields with null values:")
    for field in ELEMENT_FIELDS:
        missing = nulls(elements, field)
        print(f"  {field:24s} nulls={len(missing):3d} ids={missing[:8]}")

    current = [event["id"] for event in events if event.get("is_current")]
    upcoming = [event["id"] for event in events if event.get("is_next")]
    deadline_types = {type(event.get("deadline_time")).__name__ for event in events}
    print(f"\ngameweek current={current} next={upcoming} deadline_time_types={sorted(deadline_types)}")

    blocking = [field for field in ("strength",) if nulls(teams, field)]
    for field in ("now_cost", "element_type", "total_points", "form", "web_name", "team"):
        if nulls(elements, field):
            blocking.append(f"elements.{field}")
    print("\nBLOCKING fpl_sync.py strict validators:", blocking or "none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
