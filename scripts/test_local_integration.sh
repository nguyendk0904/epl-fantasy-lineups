#!/usr/bin/env bash
# =====================================================================
# P1-Q03 - Local Full-Stack Integration Test
# Project: Fantasy Football Lineup Builder & Optimizer
#
# Verifies the whole local stack end-to-end:
#   [1] Frontend SPA reachable              (Vite/Nginx, port 5173)
#   [2] Frontend -> Backend reverse proxy   (Nginx /api/* -> FastAPI)
#   [3] Backend -> PostgreSQL integrity     (teams + players + FK/positions)
#   [4] PuLP solver returns a legal squad   (15 players, FPL rules, budget)
#   [5] Solver constraints + compare API    (locked/excluded + lineups/compare)
#
# Prerequisites: the docker compose stack is up
#   docker compose -f infra/docker-compose.yml up -d --build
#   curl and python (3.8+) available on PATH (or PYTHON=/path/to/python)
#
# Usage:
#   bash scripts/test_local_integration.sh
#   bash scripts/test_local_integration.sh --seed      # seed demo data first
#   bash scripts/test_local_integration.sh --help
#
# Exit codes: 0 = all checks passed, 1 = at least one check failed,
#             3 = missing prerequisite (curl/python), 4 = seeding failed.
#
# NOTE: keep this file LF-only (bash breaks on CRLF). If Git converts line
# endings on checkout run: git config core.autocrlf input && dos2unix <file>
# =====================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

API_URL="${API_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
API_PREFIX="${API_PREFIX:-/api/v1}"
CURL_TIMEOUT="${CURL_TIMEOUT:-60}"
DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://postgres:postgres@localhost:5432/fantasy_fpl}"
PYTHON="${PYTHON:-}"
# Used by the --seed docker fallback (values mirror infra/docker-compose.yml).
COMPOSE_NETWORK="${COMPOSE_NETWORK:-fpl-local_fpl-network}"
BACKEND_IMAGE="${BACKEND_IMAGE:-fpl-local-backend}"
CONTAINER_DATABASE_URL="${CONTAINER_DATABASE_URL:-postgresql+asyncpg://postgres:postgres@postgres:5432/fantasy_fpl}"

TOTAL_CHECKS=5
PASSED=0
FAILED=0
FAILED_NAMES=()
RUN_SEED=0
KEEP_ARTIFACTS=0

usage() {
    cat <<'USAGE'
P1-Q03 - Local full-stack integration test

Options:
  --api-url <url>        Backend base URL        (default: http://localhost:8000)
  --frontend-url <url>   Frontend base URL       (default: http://localhost:5173)
  --api-prefix <path>    API version prefix      (default: /api/v1)
  --timeout <seconds>    Per-request timeout     (default: 60)
  --database-url <url>   DB URL used by --seed   (default: $DATABASE_URL)
  --seed                 Run scripts/seed_demo_data.py before the checks
  --keep-artifacts       Keep the temp directory with raw HTTP responses
  -h, --help             Show this help

Environment variables: API_URL, FRONTEND_URL, API_PREFIX, CURL_TIMEOUT,
DATABASE_URL, PYTHON (explicit interpreter path), COMPOSE_NETWORK,
BACKEND_IMAGE, CONTAINER_DATABASE_URL (docker fallback used by --seed).

Exit codes: 0 = all 5 checks passed, 1 = a check failed,
            3 = missing prerequisite, 4 = demo seeding failed.
USAGE
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --api-url) API_URL="${2:?missing value for --api-url}"; shift 2 ;;
        --frontend-url) FRONTEND_URL="${2:?missing value for --frontend-url}"; shift 2 ;;
        --api-prefix) API_PREFIX="${2:?missing value for --api-prefix}"; shift 2 ;;
        --timeout) CURL_TIMEOUT="${2:?missing value for --timeout}"; shift 2 ;;
        --database-url) DATABASE_URL="${2:?missing value for --database-url}"; shift 2 ;;
        --seed) RUN_SEED=1; shift ;;
        --keep-artifacts) KEEP_ARTIFACTS=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
    esac
done

# Strip trailing slashes so URL concatenation stays predictable.
API_URL="${API_URL%/}"
FRONTEND_URL="${FRONTEND_URL%/}"

die() {
    echo "ERROR: $*" >&2
    exit 3
}

find_python() {
    local candidate
    for candidate in "${PYTHON}" \
        "${ROOT_DIR}/backend/venv/Scripts/python.exe" \
        "${ROOT_DIR}/backend/venv/bin/python" \
        python3 python py; do
        [ -n "${candidate}" ] || continue
        if command -v "${candidate}" >/dev/null 2>&1 &&
            "${candidate}" -c "import json, sys" >/dev/null 2>&1; then
            printf '%s' "${candidate}"
            return 0
        fi
    done
    return 1
}

command -v curl >/dev/null 2>&1 || die "curl is required but was not found on PATH."
PYTHON="$(find_python)" || die "python 3 is required (set PYTHON=/path/to/python)."
# Keep JSON helper output readable on legacy Windows console code pages.
export PYTHONIOENCODING="${PYTHONIOENCODING:-utf-8}"

RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/fpl-integration.XXXXXX")" ||
    die "cannot create a temporary directory."
cleanup() {
    if [ "${KEEP_ARTIFACTS}" -eq 1 ]; then
        echo "Artifacts kept in: ${RUN_DIR}"
    else
        rm -rf "${RUN_DIR}"
    fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
req() {
    # req <METHOD> <URL> <OUT_FILE> [JSON_BODY] -> prints the HTTP status code
    local method="$1" url="$2" out_file="$3" body="${4:-}" code
    if [ -n "${body}" ]; then
        code="$(curl -sS --max-time "${CURL_TIMEOUT}" -X "${method}" \
            -H 'Content-Type: application/json' --data "${body}" \
            -o "${out_file}" -w '%{http_code}' "${url}" 2>"${RUN_DIR}/curl.err")" || code="000"
    else
        code="$(curl -sS --max-time "${CURL_TIMEOUT}" -X "${method}" \
            -o "${out_file}" -w '%{http_code}' "${url}" 2>"${RUN_DIR}/curl.err")" || code="000"
    fi
    # Defensive: some Windows shells add a trailing CR to captured output.
    code="${code//$'\r'/}"
    code="${code//$'\n'/}"
    printf '%s' "${code}"
}

http_error() {
    # http_error <expected> <actual> <method> <path> [response_file]
    local expected="$1" actual="$2" method="$3" path="$4" body_file="${5:-}"
    echo "  - ${method} ${path} expected HTTP ${expected}, got ${actual}"
    if [ -s "${RUN_DIR}/curl.err" ]; then
        sed 's/^/    /' "${RUN_DIR}/curl.err"
    fi
    if [ -n "${body_file}" ] && [ -s "${body_file}" ]; then
        head -c 400 "${body_file}" | sed 's/^/    body: /'
        echo
    fi
}

check() {
    # check <index> <name> <function...>
    local index="$1" name="$2"
    shift 2
    local output
    printf '[%s/%s] %-52s ' "${index}" "${TOTAL_CHECKS}" "${name}"
    if output="$("$@" 2>&1)"; then
        PASSED=$((PASSED + 1))
        printf 'PASS\n'
    else
        FAILED=$((FAILED + 1))
        FAILED_NAMES+=("${name}")
        printf 'FAIL\n'
    fi
    [ -n "${output}" ] && printf '%s\n' "${output}" | sed 's/^/         /'
    return 0
}

echo "Local full-stack integration test (P1-Q03)"
echo "  Frontend : ${FRONTEND_URL}"
echo "  Backend  : ${API_URL}${API_PREFIX}"
echo "  Python   : ${PYTHON}"
echo

seed_demo_data() {
    # 1) Prefer the local interpreter (needs backend/requirements.txt installed).
    # 2) Fall back to a one-off container built from backend/Dockerfile.
    local host_log="${RUN_DIR}/seed_host.log"
    if "${PYTHON}" "${SCRIPT_DIR}/seed_demo_data.py" \
        --database-url "${DATABASE_URL}" >"${host_log}" 2>&1; then
        grep '\[seed\]' "${host_log}" || true
        return 0
    fi
    echo "  host python could not seed (backend requirements not installed there)"
    if command -v docker >/dev/null 2>&1; then
        echo "  retrying inside the ${BACKEND_IMAGE} container on ${COMPOSE_NETWORK}..."
        if MSYS_NO_PATHCONV=1 docker run --rm \
            --network "${COMPOSE_NETWORK}" \
            -e DATABASE_URL="${CONTAINER_DATABASE_URL}" \
            -v "${ROOT_DIR}/backend:/app" \
            -v "${SCRIPT_DIR}:/scripts" \
            -w /app "${BACKEND_IMAGE}" \
            python /scripts/seed_demo_data.py; then
            return 0
        fi
    fi
    echo "  host attempt output:"
    tail -5 "${host_log}" | sed 's/^/    /'
    return 1
}

if [ "${RUN_SEED}" -eq 1 ]; then
    echo "Seeding demo data (6 demo clubs / 36 demo players)..."
    if ! seed_demo_data; then
        echo "ERROR: demo seeding failed, aborting integration test." >&2
        echo "Hint: make sure the stack is up and the schema is migrated:" >&2
        echo "  docker compose -f infra/docker-compose.yml up -d --build" >&2
        echo "  docker run --rm --network ${COMPOSE_NETWORK} -e DATABASE_URL=${CONTAINER_DATABASE_URL} \\" >&2
        echo "    -v \"\$PWD/backend:/app\" -w /app ${BACKEND_IMAGE} alembic upgrade head" >&2
        exit 4
    fi
    echo
fi

# ---------------------------------------------------------------------
# Check 1: Frontend SPA is served
# ---------------------------------------------------------------------
check_frontend_spa() {
    local out_file="${RUN_DIR}/frontend_index.html" code
    code="$(req GET "${FRONTEND_URL}/" "${out_file}")"
    if [ "${code}" != "200" ]; then
        http_error 200 "${code}" GET "${FRONTEND_URL}/"
        return 1
    fi
    if ! grep -qi 'id="root"' "${out_file}"; then
        echo "  - SPA shell returned by ${FRONTEND_URL}/ has no <div id=\"root\">"
        head -c 300 "${out_file}" | sed 's/^/    body: /'
        echo
        return 1
    fi
    echo "  - HTTP 200, Vite/Nginx SPA shell served ($(wc -c <"${out_file}" | tr -d ' ') bytes)"
}

# ---------------------------------------------------------------------
# Check 2: Frontend -> Backend through the Nginx reverse proxy
# ---------------------------------------------------------------------
check_frontend_proxy() {
    local out_file="${RUN_DIR}/proxy_health.json" path="${API_PREFIX}/health" code
    code="$(req GET "${FRONTEND_URL}${path}" "${out_file}")"
    if [ "${code}" != "200" ]; then
        http_error 200 "${code}" GET "${FRONTEND_URL}${path}" "${out_file}"
        return 1
    fi
    "${PYTHON}" - "${out_file}" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
if payload.get("status") != "healthy":
    print(f"  - health payload status={payload.get('status')!r} (expected 'healthy')")
    raise SystemExit(1)
print(
    "  - Nginx /api/* proxy -> FastAPI OK "
    f"(service={payload.get('service')!r}, version={payload.get('version')!r})"
)
PY
}

# ---------------------------------------------------------------------
# Check 3: Backend -> PostgreSQL data integrity
# ---------------------------------------------------------------------
check_database_integrity() {
    local code position
    code="$(req GET "${API_URL}${API_PREFIX}/teams" "${RUN_DIR}/teams.json")"
    if [ "${code}" != "200" ]; then
        http_error 200 "${code}" GET "${API_URL}${API_PREFIX}/teams" "${RUN_DIR}/teams.json"
        return 1
    fi
    for position in GKP DEF MID FWD; do
        code="$(req GET "${API_URL}${API_PREFIX}/players?position=${position}&limit=1" \
            "${RUN_DIR}/players_${position}.json")"
        if [ "${code}" != "200" ]; then
            http_error 200 "${code}" GET "${API_URL}${API_PREFIX}/players?position=${position}" \
                "${RUN_DIR}/players_${position}.json"
            return 1
        fi
    done
    code="$(req GET "${API_URL}${API_PREFIX}/players?limit=100&page=1&sort_by=total_points" \
        "${RUN_DIR}/players_page.json")"
    if [ "${code}" != "200" ]; then
        http_error 200 "${code}" GET "${API_URL}${API_PREFIX}/players" "${RUN_DIR}/players_page.json"
        return 1
    fi

    "${PYTHON}" - "${RUN_DIR}" <<'PY'
import json
import sys
from pathlib import Path

run_dir = Path(sys.argv[1])


def load(name):
    return json.loads((run_dir / name).read_text(encoding="utf-8"))


teams = load("teams.json")
page = load("players_page.json")
totals = {
    pos: load(f"players_{pos}.json").get("total", 0)
    for pos in ("GKP", "DEF", "MID", "FWD")
}
minimum = {"GKP": 2, "DEF": 5, "MID": 5, "FWD": 3}
errors = []

if not isinstance(teams, list) or len(teams) < 2:
    errors.append(f"expected >= 2 teams in PostgreSQL, got {teams!r}")
    teams = []
team_ids = [team.get("id") for team in teams]
if len(team_ids) != len(set(team_ids)):
    errors.append("GET /teams returned duplicate team ids")
for team in teams:
    if not str(team.get("short_name") or "").strip():
        errors.append(f"team {team.get('id')} has an empty short_name")

for position, required in minimum.items():
    if totals[position] < required:
        errors.append(f"not enough {position} available: {totals[position]} < {required}")

items = page.get("items") or []
if not items:
    errors.append("GET /players returned an empty items list")
if len({item.get("id") for item in items}) != len(items):
    errors.append("GET /players returned duplicate ids inside one page")

valid_positions = {"GKP", "DEF", "MID", "FWD"}
known_short_names = {team.get("short_name") for team in teams}
for item in items:
    label = item.get("web_name") or item.get("id")
    if not item.get("team_short_name"):
        errors.append(f"player {label!r} has no matching team (broken team_id foreign key)")
    elif known_short_names and item.get("team_short_name") not in known_short_names:
        errors.append(
            f"player {label!r} points at unknown club {item.get('team_short_name')!r}"
        )
    if item.get("element_type") not in valid_positions:
        errors.append(f"player {label!r} has invalid element_type {item.get('element_type')!r}")
    if float(item.get("now_cost") or 0) <= 0:
        errors.append(f"player {label!r} has a non-positive now_cost")

page_total = page.get("total", 0)
if page_total != sum(totals.values()):
    errors.append(
        f"players.total ({page_total}) != GKP+DEF+MID+FWD ({sum(totals.values())})"
    )

if errors:
    for error in errors:
        print(f"  - {error}")
    raise SystemExit(1)

print(
    f"  - PostgreSQL OK: {len(teams)} teams, {page_total} players "
    f"(GKP {totals['GKP']} / DEF {totals['DEF']} / MID {totals['MID']} / FWD {totals['FWD']}); "
    f"{len(items)} sampled rows have a valid club join, position and price"
)
PY
}

# ---------------------------------------------------------------------
# Check 4: PuLP solver produces a legal 15-man squad
# ---------------------------------------------------------------------
check_optimizer_solver() {
    local code out_file="${RUN_DIR}/solve_all.json"
    code="$(req POST "${API_URL}${API_PREFIX}/optimizer/solve" "${out_file}" \
        '{"budget": 100.0, "locked_player_ids": [], "excluded_player_ids": [], "target_formation": null}')"
    if [ "${code}" != "200" ]; then
        http_error 200 "${code}" POST "${API_URL}${API_PREFIX}/optimizer/solve" "${out_file}"
        return 1
    fi

    "${PYTHON}" - "${out_file}" <<'PY'
import json
import sys
from collections import Counter
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
starting = payload.get("starting_xi") or []
bench = payload.get("bench") or []
squad = starting + bench
errors = []

if payload.get("status") != "optimal":
    errors.append(
        f"status={payload.get('status')!r} message={payload.get('message')!r} "
        "(expected an optimal squad)"
    )
if len(starting) != 11:
    errors.append(f"starting_xi must contain 11 players, got {len(starting)}")
if len(bench) != 4:
    errors.append(f"bench must contain 4 players, got {len(bench)}")
if len(squad) != 15:
    errors.append(f"squad must contain 15 players, got {len(squad)}")
if len({player.get("id") for player in squad}) != len(squad):
    errors.append("squad contains duplicate player ids")

counts = Counter(player.get("element_type") for player in squad)
for position, expected in (("GKP", 2), ("DEF", 5), ("MID", 5), ("FWD", 3)):
    if counts.get(position, 0) != expected:
        errors.append(
            f"squad composition {position}={counts.get(position, 0)} (expected {expected})"
        )

for team_id, count in Counter(player.get("team_id") for player in squad).items():
    if count > 3:
        errors.append(f"club limit broken: team {team_id} has {count} players (max 3)")

total_cost = float(payload.get("total_cost") or 0)
if total_cost <= 0:
    errors.append("total_cost must be positive")
if total_cost > 100.0 + 1e-9:
    errors.append(f"total_cost GBP{total_cost}m exceeds the GBP100.0m budget")

starting_ids = {player.get("id") for player in starting}
captain_id = payload.get("captain_id")
vice_id = payload.get("vice_captain_id")
if captain_id not in starting_ids:
    errors.append(f"captain_id {captain_id} is not in the starting XI")
if vice_id not in starting_ids:
    errors.append(f"vice_captain_id {vice_id} is not in the starting XI")
if captain_id == vice_id:
    errors.append("captain_id and vice_captain_id must differ")

formation = "-".join(
    str(sum(player.get("element_type") == position for player in starting))
    for position in ("DEF", "MID", "FWD")
)
if payload.get("formation") != formation:
    errors.append(
        f"formation {payload.get('formation')!r} does not match the starting XI ({formation})"
    )

if errors:
    for error in errors:
        print(f"  - {error}")
    raise SystemExit(1)

print(
    f"  - PuLP optimal: GBP{total_cost}m, formation {payload.get('formation')} "
    f"(XI 11 + bench 4), captain={captain_id}, xP={payload.get('total_expected_points')}"
)
PY
}

# ---------------------------------------------------------------------
# Check 5: solver honours locked/excluded players + lineups/compare round-trip
# ---------------------------------------------------------------------
check_solver_constraints_and_compare() {
    local solve_all="${RUN_DIR}/solve_all.json" solve_locked="${RUN_DIR}/solve_locked.json"
    local compare_file="${RUN_DIR}/compare.json" code request compare_request
    if [ ! -s "${solve_all}" ]; then
        echo "  - check 4 produced no solver output, cannot verify constraints"
        return 1
    fi

    request="$("${PYTHON}" - "${solve_all}" <<'PY'
import json
import sys
from pathlib import Path

squad = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(
    json.dumps(
        {
            "budget": 100.0,
            "locked_player_ids": [squad["captain_id"]],
            "excluded_player_ids": [squad["vice_captain_id"]],
            "target_formation": None,
        }
    )
)
PY
)"
    code="$(req POST "${API_URL}${API_PREFIX}/optimizer/solve" "${solve_locked}" "${request}")"
    if [ "${code}" != "200" ]; then
        http_error 200 "${code}" POST "${API_URL}${API_PREFIX}/optimizer/solve (locked/excluded)" \
            "${solve_locked}"
        return 1
    fi

    compare_request="$("${PYTHON}" - "${solve_all}" "${solve_locked}" <<'PY'
import json
import sys
from pathlib import Path


def squad_ids(path):
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    squad = (payload.get("starting_xi") or []) + (payload.get("bench") or [])
    return [player["id"] for player in squad]


print(
    json.dumps(
        {
            "lineup_a_player_ids": squad_ids(sys.argv[1]),
            "lineup_b_player_ids": squad_ids(sys.argv[2]),
        }
    )
)
PY
)"
    code="$(req POST "${API_URL}${API_PREFIX}/lineups/compare" "${compare_file}" "${compare_request}")"
    if [ "${code}" != "200" ]; then
        http_error 200 "${code}" POST "${API_URL}${API_PREFIX}/lineups/compare" "${compare_file}"
        return 1
    fi

    "${PYTHON}" - "${solve_all}" "${solve_locked}" "${compare_file}" <<'PY'
import json
import sys
from pathlib import Path


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


solve_all = load(sys.argv[1])
solve_locked = load(sys.argv[2])
comparison = load(sys.argv[3])

errors = []
locked_id = solve_all.get("captain_id")
excluded_id = solve_all.get("vice_captain_id")

if solve_locked.get("status") != "optimal":
    errors.append(
        f"constrained solve status={solve_locked.get('status')!r} "
        f"message={solve_locked.get('message')!r}"
    )
locked_squad = (solve_locked.get("starting_xi") or []) + (solve_locked.get("bench") or [])
locked_squad_ids = {player.get("id") for player in locked_squad}
if locked_id not in locked_squad_ids:
    errors.append(f"locked player {locked_id} is missing from the constrained squad")
if excluded_id in locked_squad_ids:
    errors.append(f"excluded player {excluded_id} was still selected")
if len(locked_squad) != 15:
    errors.append(f"constrained squad must contain 15 players, got {len(locked_squad)}")

base_xi = [player.get("id") for player in (solve_all.get("starting_xi") or [])]
base_bench = [player.get("id") for player in (solve_all.get("bench") or [])]
base_ids = base_xi + base_bench
locked_ids = [player.get("id") for player in locked_squad]

lineup_a = comparison.get("lineup_a") or {}
lineup_b = comparison.get("lineup_b") or {}
delta = comparison.get("head_to_head_delta") or {}

for name, metrics in (("lineup_a", lineup_a), ("lineup_b", lineup_b)):
    for field in ("total_cost", "total_xp", "attack_rating", "defense_rating"):
        if not isinstance(metrics.get(field), (int, float)):
            errors.append(f"{name}.{field} is not numeric: {metrics.get(field)!r}")
    if float(metrics.get("total_cost") or 0) <= 0:
        errors.append(f"{name}.total_cost must be positive")

base_cost = float(solve_all.get("total_cost") or 0)
if abs(float(lineup_a.get("total_cost") or 0) - base_cost) > 0.05:
    errors.append(
        f"compare lineup_a.total_cost {lineup_a.get('total_cost')} does not match the solver "
        f"total_cost {base_cost}"
    )

expected_common = len(set(base_ids) & set(locked_ids))
if delta.get("common_players_count") != expected_common:
    errors.append(
        f"common_players_count {delta.get('common_players_count')} != {expected_common}"
    )
expected_cost_diff = round(float(lineup_a.get("total_cost") or 0) - float(lineup_b.get("total_cost") or 0), 1)
if abs(float(delta.get("cost_diff") or 0) - expected_cost_diff) > 0.05:
    errors.append(f"cost_diff {delta.get('cost_diff')} != {expected_cost_diff}")
expected_xp_diff = round(float(lineup_a.get("total_xp") or 0) - float(lineup_b.get("total_xp") or 0), 1)
if abs(float(delta.get("xp_diff") or 0) - expected_xp_diff) > 0.05:
    errors.append(f"xp_diff {delta.get('xp_diff')} != {expected_xp_diff}")

differential_ids = {player.get("id") for player in delta.get("differential_players") or []}
if differential_ids != set(locked_ids) - set(base_ids):
    errors.append("differential_players does not match lineup_b - lineup_a")

if errors:
    for error in errors:
        print(f"  - {error}")
    raise SystemExit(1)

print(
    f"  - locked player {locked_id} kept, excluded player {excluded_id} dropped; "
    f"compare API OK (cost delta {delta.get('cost_diff')}, xP delta {delta.get('xp_diff')}, "
    f"common {delta.get('common_players_count')})"
)
PY
}

# ---------------------------------------------------------------------
# Run all checks
# ---------------------------------------------------------------------
check 1 "Frontend SPA reachable" check_frontend_spa
check 2 "Frontend -> Backend reverse proxy" check_frontend_proxy
check 3 "Backend -> PostgreSQL data integrity" check_database_integrity
check 4 "PuLP optimizer returns a legal squad" check_optimizer_solver
check 5 "Solver constraints + compare API" check_solver_constraints_and_compare

echo
echo "Passed: ${PASSED}/${TOTAL_CHECKS}"
if [ "${FAILED}" -eq 0 ]; then
    echo "All ${TOTAL_CHECKS} integration checks passed"
    exit 0
fi

echo "Failed: ${FAILED}/${TOTAL_CHECKS} -> ${FAILED_NAMES[*]}"
echo "Troubleshooting:"
echo "  docker compose -f infra/docker-compose.yml ps"
echo "  docker compose -f infra/docker-compose.yml logs --tail 50 backend"
echo "  bash scripts/test_local_integration.sh --seed    # when the database is empty"
exit 1


