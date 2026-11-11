# ✅ NGHIỆM THU P2-NH02 · P2-NH03 · P3-NH01 · P3-NH02 · P3-NH03 — HẠ TẦNG BACKEND

> **Người chuẩn bị:** Quang (DevOps & AWS Lead) · **Ngày:** 11/11/2026 (UTC+7)
> **Phạm vi:** chỉ hạ tầng/vận hành + bằng chứng; **không sửa code của Nhất/Vũ/Nguyên**.
> **URL nghiệm thu:** 🔗 **<https://54.255.194.74.sslip.io>** (`/health`, `/docs`, `/api/v1/*`)
> **Tài khoản/Region:** `711695043505` · `ap-southeast-1`
> **Trạng thái:** hạ tầng **XONG** · phần chức năng còn **1 blocker thuộc `fpl_sync.py` của Nhất** (xem §5).

---

## 1. ⚡ TL;DR — trạng thái từng task

| Task | Nội dung nghiệm thu | Trạng thái | Bằng chứng |
| :--- | :--- | :---: | :--- |
| `P2-NH02` | Lưu/đọc snapshot trên **PostgreSQL thật (RDS)** | ✅ ĐẠT | §4.3 — `test_postgres_snapshot_roundtrip_and_collision` PASSED trên `fantasy_fpl_test`; `GET /lineups/share/XXXXXX` → 404 |
| `P2-NH03` | Worker định kỳ 6 h sync vào RDS (đúng **1 worker**) | ⚠️ **CHẶN** | §4.4 — 1 container `fpl-worker`, timer 6 h đã bật, nhưng sync lỗi `Invalid FPL bootstrap payload` (null `strength`) ⇒ `teams/players = 0` |
| `P3-NH01` | JSON log + CloudWatch Log Group + retention + quyền instance role | ✅ ĐẠT | §4.1 — log group `/fpl/backend` (30 ngày), stream + event thật, log ERROR truy vấn được |
| `P3-NH02` | 429 sau hạn mức, qua **trusted proxy** đúng IP người dùng | ✅ ĐẠT | §4.2 — 60×200 rồi 429 (`Retry-After`), IP khác vẫn 200, `solve` 10 reques → 429 |
| `P3-NH03` | E2E PostgreSQL trên DB `_test` | ✅ ĐẠT (nửa PostgreSQL) | §4.3 — `261 passed, 1 skipped` trên RDS; nửa **deployed** chờ dữ liệu (cùng blocker §5) |

**Điều duy nhất còn thiếu để tick hết:** Nhất sửa `teams[].strength = null` trong `backend/app/services/fpl_sync.py` (§5.2 có patch dán được ngay). Sau khi merge, CI tự build/deploy, worker tự sync, rồi chạy `scripts/acceptance/run_remote_e2e.sh` là xong.

---

## 2. 🔗 ĐẦU MỐI BÀN GIAO

| Hạng mục | Giá trị |
| :--- | :--- |
| Backend (HTTPS, Let's Encrypt) | **https://54.255.194.74.sslip.io** |
| Health | `GET https://54.255.194.74.sslip.io/health` → `200 {"status":"healthy","environment":"production"}` |
| OpenAPI | `https://54.255.194.74.sslip.io/docs` → 200 |
| API base cho frontend | `https://54.255.194.74.sslip.io/api/v1` |
| Frontend (CORS allow-list) | `https://d24f3bc3qfp5xf.cloudfront.net` |
| EC2 | `i-0f1e71fa1a78b0013` · `t3.micro` · public `54.255.194.74` · private `172.31.35.103` · **không mở SSH** (chỉ SSM) |
| RDS | `fpl-fantasy-db.cr0maoomq80d.ap-southeast-1.rds.amazonaws.com:5432` · PostgreSQL **15.17** · private `172.31.18.192` · `PubliclyAccessible=false` |
| Database production | `fantasy_fpl` (user `fpl_admin`, TLS `require`) |
| **Database test** | **`fantasy_fpl_test`** — đã tạo, owner `fpl_admin`, ~8 MB, **rỗng** (bộ test tự tạo/dọn schema riêng) |
| Image đang chạy | `711695043505.dkr.ecr.ap-southeast-1.amazonaws.com/fpl-backend:a20716dfda1165f3a8965a116f3d81c72ee8305c` |
| Secrets | `arn:aws:secretsmanager:ap-southeast-1:711695043505:secret:fpl/backend/rds-…` (chỉ đọc bằng **instance role**) |
| CloudWatch | `/fpl/backend` (retention **30 ngày**) · `/fpl/worker` (retention **30 ngày**) |

> ❗ **Mật khẩu RDS/secret tuyệt đối không nằm trong repo, trong tài liệu này, trong log hay trong argv.** Container đọc `RDS_PASSWORD` từ `/opt/fpl/backend.env` (`chmod 600`) và file này được bơm từ Secrets Manager bằng instance role.

---

## 3. 🚀 CODE MỚI NHẤT · BUILD · DEPLOY · DEPENDENCIES · CBC

### 3.1. Code trên `main`

```text
git fetch origin --prune           -> không có commit mới
git status                         -> working tree clean
HEAD == origin/main == a20716d     "Merge pull request #47 from …/feature/P3-Q05-frontend-api-base-url"
```

> **Cập nhật 22:29 UTC+7:** commit công cụ nghiệm thu `1ace8af` (chỉ `scripts/`, `infra/aws/`, `.github/`, `.env.example`,
> `.gitattributes` — **không đổi một dòng nào trong `backend/`**) đã được CI/CD tự build → push ECR → SSM rollout.
> Image đang chạy chuyển sang tag `1ace8af…`, `fpl-backend` healthy, `fpl-worker` chạy lại (1 container),
> 2 flag proxy và toàn bộ env `CLOUDWATCH_*`/`RATE_LIMIT_*` được giữ nguyên ⇒ bảng sha256 của code app bên dưới vẫn đúng.

### 3.2. Image đang chạy **chính là** bản build của `a20716d`

Không cần build lại: tag image bằng đúng SHA của `main`, và nội dung file trong container được đối chiếu bằng sha256 với source (chuẩn hoá LF vì Windows checkout CRLF):

| File | sha256 trong container | sha256 của `main` (LF) |
| :--- | :--- | :--- |
| `app/main.py` | `1bd1b50f584d7f76…` | `1bd1b50f584d7f76…` ✅ |
| `app/core/logging_config.py` | `4c583036f946fe6f…` | `4c583036f946fe6f…` ✅ |
| `app/core/rate_limiter.py` | `8a349118028acf56…` | `8a349118028acf56…` ✅ |
| `app/services/cron_scheduler.py` | `d3c9e19a9255b6af…` | `d3c9e19a9255b6af…` ✅ |

### 3.3. Dependencies + CBC bên trong image (đo trực tiếp trong container)

```text
fastapi=0.162.3 | uvicorn=0.54.0 | sqlalchemy=2.1.8 | asyncpg=0.32.0 | alembic=1.20.1
pulp=3.3.2 | boto3=1.43.127 | botocore=1.43.127 | watchtower=3.4.0
slowapi=0.1.10 | limits=5.8.0 | redis=6.4.0 | httpx=0.28.1
pulp.COIN_CMD.available = /opt/venv/bin/cbc        # coinor-cbc (apt) có thật
pulp.PULP_CBC_CMD.available = …/pulp/solverdir/cbc/linux/i64/cbc   # wheel pulp[cbc]
```

⇒ **CBC cho optimizer đã cài đủ 2 đường** (binary hệ thống + wheel), solver thật đã chạy trong bộ test (`tests/test_optimizer.py`, `tests/test_e2e_api_suite.py`).
Khi cần build lại từ `main` (sau khi Nhất merge): CI `ci_cd.yml` tự `docker build` → push ECR → SSM rollout; thủ công thì `infra/aws/app_runner_setup.md` §7.2.

### 3.4. Cấu hình runtime đang áp dụng — **không chứa mật khẩu**

```dotenv
# /opt/fpl/backend.env  (chmod 600, sinh từ Secrets Manager bằng instance role)
ENVIRONMENT=production
RDS_HOSTNAME=fpl-fantasy-db.cr0maoomq80d.ap-southeast-1.rds.amazonaws.com
RDS_PORT=5432
RDS_DB_NAME=fantasy_fpl
RDS_USERNAME=fpl_admin
RDS_PASSWORD=***             # <- chỉ có ở đây, không ở Git/chat/log
CORS_ORIGINS=["https://d24f3bc3qfp5xf.cloudfront.net"]
FPL_SYNC_ENABLED=false       # API KHÔNG chạy scheduler (chỉ worker riêng chạy)
FPL_SYNC_INTERVAL_SECONDS=21600
FPL_BOOTSTRAP_URL=https://fantasy.premierleague.com/api/bootstrap-static/
AWS_REGION=ap-southeast-1
LOG_LEVEL=INFO
CLOUDWATCH_LOGGING_ENABLED=true
CLOUDWATCH_LOG_GROUP=/fpl/backend
CLOUDWATCH_SEND_INTERVAL_SECONDS=5
RATE_LIMIT_ENABLED=true
RATE_LIMIT_STORAGE_URI=memory://     # hợp lệ vì chỉ 1 process (xem §6)
```

Command line của container (phần “trusted proxy” là bắt buộc, xem §4.2):

```text
fpl-backend : uvicorn app.main:app --host 0.0.0.0 --port 8000 \
                --proxy-headers --forwarded-allow-ips=172.17.0.1
              (publish 127.0.0.1:8000, Caddy trên host lo TLS)
fpl-worker  : python -m app.services.cron_scheduler         # ĐÚNG 1 container
              docker run --no-healthcheck …   # image healthcheck probe HTTP :8000,
                                              # scheduler không phục vụ HTTP ⇒ tắt
```

Ba bất biến đã ghi cả vào `ci_cd.yml` để lần deploy sau không làm mất cấu hình:
1. `--proxy-headers --forwarded-allow-ips=172.17.0.1` (rate limit theo IP thật);
2. `fpl-worker` được restart cùng image mới (không để worker chạy image cũ);
3. API luôn `FPL_SYNC_ENABLED=false` (không bao giờ có 2 scheduler).

---

## 4. 🧪 BẰNG CHỨNG ĐO THẬT (11/11/2026)

### 4.1. `P3-NH01` — CloudWatch

```console
# log group + retention (đã tạo bằng scripts/acceptance/provision_cloudwatch.sh)
$ aws logs describe-log-groups --log-group-name-prefix /fpl/
/fpl/backend   30      <- retentionInDays = 30
/fpl/worker    30

# IAM inline policy trên instance role (least privilege, chỉ 2 group)
$ aws iam list-role-policies --role-name fpl-p3q02-ec2-role
fpl-p3q02-inline            # ECR pull + secretsmanager:GetSecretValue
fpl-p3q02-cloudwatch-logs   # logs:CreateLogStream / DescribeLogStreams / PutLogEvents
                            #   trên arn:aws:logs:ap-southeast-1:711695043505:
                            #   log-group:/fpl/backend:* và /fpl/worker:*

# stream do container tạo và event thật đã lên CloudWatch
$ aws logs describe-log-streams --log-group-name /fpl/backend --order-by LastEventTime --descending
backend/dd52aafa93b0/1   lastEvent=…     (hostname container / pid)
backend/934be86f4da4/1   lastEvent=…

$ aws logs filter-log-events --log-group-name /fpl/backend --filter-pattern '{ $.level = "ERROR" }'
{"timestamp":"2026-11-11T15:02:37.155840+00:00","level":"ERROR","logger":"app.requests",
 "environment":"production","message":"request_completed","request_id":"b38579cbf5864ab1937a0565731be2ce",
 "method":"POST","path":"/optimizer/solve","status_code":503,"latency_ms":229.707}
```

⇒ Đủ 4 thành phần AC: **JSON** có `timestamp/method/path/status_code/latency_ms`, **log lỗi tự lên CloudWatch**, Log Group + retention do hạ tầng tạo, quyền ghi lấy từ **instance role** (không có access key nào trong container).

### 4.2. `P3-NH02` — Rate limit + trusted proxy

```console
# 65 request liên tiếp GET /api/v1/players từ IP của dev
$ for i in $(seq 1 65); do curl -o /dev/null -w '%{http_code} ' \
      https://54.255.194.74.sslip.io/api/v1/players; done
200 ×60   429 429 429 429 429        <- đúng 60/phút, reset sau 60 s

$ curl -D - https://54.255.194.74.sslip.io/api/v1/players
HTTP/1.1 429 Too Many Requests
Retry-After: 32
Server: uvicorn
Via: 1.1 Caddy
X-Request-Id: 2629b6476948457295b50a2d7f060399     <- do middleware của app thêm

# rule thứ 2: POST /api/v1/optimizer/solve = 10/phút
$ for i in $(seq 1 12); do curl -X POST …/optimizer/solve -d '{"budget":100,"target_formation":"4-3-3"}'; done
503 ×10   429 429                    <- 10 request được đếm rồi chặn (503 là do DB rỗng, xem §5)

# chứng minh key theo ĐÚNG IP người dùng (không phải IP của Caddy/NAT):
# trong lúc IP dev đã bị chặn, request từ IP của EC2 vẫn 200
$ curl -o /dev/null -w '%{http_code}' …/api/v1/players   # chạy trên EC2
200
```

Vì sao phải có `--forwarded-allow-ips=172.17.0.1`: Caddy chạy `network_mode: host`, publish `127.0.0.1:8000` bị Docker NAT sang bridge ⇒ app nhìn thấy peer `172.17.0.1`. Nếu uvicorn không tin proxy đó, **mọi người dùng chung 1 bucket** và một người có thể khoá cả hệ thống.

### 4.3. `P3-NH03` + `P2-NH02` — bộ test PostgreSQL trên RDS thật

Tạo DB test riêng (kết thúc `_test`) ngay trong VPC:

```console
$ scripts/ssm_run.sh --file scripts/acceptance/create_test_database.sh
database exists  : fantasy_fpl_test
owner=fpl_admin size=8351 kB
leftover test schemas = none
public tables in test db = none (suites create their own schema)
```

Chạy toàn bộ backend suite với `E2E_TEST_DATABASE_URL` / `SHARE_TEST_DATABASE_URL` /
`FPL_SYNC_TEST_DATABASE_URL` trỏ vào `fantasy_fpl_test` (container trong VPC, TLS `require`):

```console
$ scripts/ssm_run.sh --file scripts/acceptance/run_postgres_suites.sh
[acceptance] test database = fpl-fantasy-db.…:5432/fantasy_fpl_test (TLS required, credentials hidden)
261 passed, 1 skipped, 33 warnings in 12.66s          <- exit code 0
# 1 skip = test_deployed_api_journey_opt_in (chờ dữ liệu, xem §5)

# chạy riêng 4 file để có tên test rõ ràng:
105 passed, 1 skipped, 20 warnings in 7.37s
tests/test_share_api.py::test_postgres_snapshot_roundtrip_and_collision PASSED   <- P2-NH02 trên RDS
tests/test_share_api.py::test_postgres_collision_detection_only_retries_share_code[...] PASSED
tests/test_rds_connection.py::test_live_rds_select_one PASSED                    <- P2-NH01 live RDS
tests/test_e2e_api_suite.py::test_full_api_journey_real_solver_and_persisted_snapshot PASSED
tests/test_e2e_api_suite.py::test_deployed_api_journey_opt_in SKIPPED
```

Log bằng chứng được giữ trên instance: `/opt/fpl/evidence/<UTC>-pytest-postgres.log`.

Kiểm tra API đang chạy (production, dữ liệu rỗng — xem §5):

```console
/health                      200      /api/v1/health   200      /docs  200
/api/v1/teams                200 ([]) /api/v1/lineups/share/XXXXXX  404   <- AC “mã không tồn tại”
```

### 4.4. `P2-NH03` — Đúng **một** worker + bằng chứng 6 giờ

```console
$ docker ps --format '{{.Names}}|{{.Status}}|{{.Ports}}'
fpl-backend | Up (healthy) | 127.0.0.1:8000->8000/tcp
fpl-worker  | Up           | 8000/tcp         <- ĐÚNG 1 worker, không publish port
fpl-caddy   | Up 2 days    |
worker containers = 1 (must be 1)
```

Scheduler 6 h (`FPL_SYNC_INTERVAL_SECONDS=21600`) chạy trong container riêng; API giữ
`FPL_SYNC_ENABLED=false` ⇒ **không thể** có 2 scheduler.

Bằng chứng định kỳ: systemd timer trên instance chạy **mỗi 6 giờ**, mỗi lần ghi 1 dòng JSON
vào `/opt/fpl/evidence/sync-checks.jsonl` **và** đẩy lên CloudWatch `/fpl/worker` (mỗi lần 1 stream riêng):

```console
$ systemctl list-timers fpl-sync-evidence.timer
NEXT                         LEFT       LAST                         PASSED  UNIT
Wed 2026-11-11 21:04:41 UTC  5h 59min   Wed 2026-11-11 15:04:41 UTC  4s ago  fpl-sync-evidence.timer

$ tail -1 /opt/fpl/evidence/sync-checks.jsonl
{"checked_at":"2026-11-11T15:04:43+00:00","worker_state":"running",
 "worker_started_at":"2026-11-11T14:52:22Z","worker_restarts":"0",
 "last_sync_succeeded_at":"none","api_health_http":"200",
 "rds":{"teams":0,"players":0,"shared_lineups":0,
        "alembic_version":"002_add_shared_lineups","server_tls":true}}
[cw] pushed /fpl/worker/evidence/20261111T150443Z
```

⇒ Cơ chế bằng chứng **đã chạy**; số liệu `teams=0, players=0, last_sync=none` chính là
hiện trạng blocker §5, và sẽ tự đổi thành `players=672, teams=20` sau khi Nhất sửa xong.

### 4.5. Migration + dữ liệu trên RDS

```console
target_host = fpl-fantasy-db.…rds.amazonaws.com | db = fantasy_fpl | ssl = require
select 1 = 1
connected db=fantasy_fpl user=fpl_admin server=172.31.18.192/32:5432 tls=True tls_version=TLSv1.2
public_tables = alembic_version,players,shared_lineups,teams
alembic_version = 002_add_shared_lineups          <- head của Alembic, đủ 3 bảng
teams_rows = 0 | players_rows = 0 | shared_lineups_rows = 0
```

Migration **đã ở head**, TLS bật, kết nối đi **mạng private** (endpoint `172.31.18.192`,
`PubliclyAccessible=false`) — không hề mở RDS ra Internet.

---

## 5. 🚧 BLOCKER DUY NHẤT — `fpl_sync.py` (thuộc Nhất)

### 5.1. Triệu chứng

```console
$ docker run --rm --env-file /opt/fpl/backend.env $IMAGE python -m app.services.fpl_sync
pydantic_core._pydantic_core.ValidationError: 1 validation error for _TeamData
strength
  Input should be a valid integer [type=int_type, input_value=None, input_type=NoneType]
FPLSyncError: Invalid FPL bootstrap payload
```

Payload thật của FPL (đo 11/11/2026, script `scripts/acceptance/fpl_payload_probe.py`):

```text
teams=20 elements=672 events=38
team.strength             nulls= 20 ids=[1,2,3,…,20]      <- TẤT CẢ 20 CLB
element.* (now_cost, element_type, form, …)  nulls= 0
gameweek current=[10] next=[11]
BLOCKING fpl_sync.py strict validators: ['strength']
```

`_TeamData.strength: int = 3` chỉ dùng default khi **thiếu key**, còn API đang trả **`null`**
⇒ validate fail ⇒ `sync_fpl_data` raise `FPLSyncError` ⇒ **0 team / 0 player** ⇒ optimizer trả
`503 "status: Undefined"`, `/api/v1/teams` trả `[]`, snapshot share không có dữ liệu để tạo.

### 5.2. Patch đề xuất (Nhất tự áp — không nằm trong phần Quang được sửa)

`backend/app/services/fpl_sync.py`, trong `class _TeamData`:

```diff
 class _TeamData(BaseModel):
     model_config = ConfigDict(extra="ignore")
     id: Identifier
     name: Name
     short_name: Annotated[str, Field(min_length=1, max_length=5)]
     strength: int = 3
+
+    @field_validator("strength", mode="before")
+    @classmethod
+    def default_missing_strength(cls, value):
+        """FPL trả strength=null đầu mùa; DB là NOT NULL default 3."""
+        return 3 if value is None else value
+
     strength_attack_home: int | None = None
```

`field_validator` đã được import sẵn ở đầu file (`from pydantic import … field_validator …`),
nên chỉ cần thêm method. Test đi kèm (`backend/tests/test_fpl_sync.py`):

```python
def test_null_team_strength_falls_back_to_default(payload):
    payload["teams"][0]["strength"] = None
    teams, _ = fpl_sync._parse_payload(payload)
    assert teams[0]["strength"] == 3
```

Rồi từ `backend/`: `python -m pytest tests/test_fpl_sync.py tests/test_cron_scheduler.py -q`.

> Nếu Nhất chọn hướng khác (ví dụ map `strength` từ `strength_attack_home`), miễn
> `_parse_payload` luôn trả **int** cho `strength` là được — DB `teams.strength` là `NOT NULL`.

### 5.3. Sau khi merge — tất cả tự động

1. CI `ci_cd.yml` build + push ECR + SSM rollout **và restart `fpl-worker`** cùng image;
2. Worker chạy `check_once()` **ngay** khi start → sync 20 teams + 672 players vào RDS;
3. Kiểm tra: `scripts/ssm_run.sh --file scripts/acceptance/remote_preflight.sh` (kỳ vọng `players_rows ≈ 672`);
4. Chạy nửa “deployed” của E2E: `scripts/ssm_run.sh --file scripts/acceptance/run_remote_e2e.sh`
   → `1 passed` (tạo 1 snapshot nghiệm thu, API không có DELETE nên chỉ chạy trên deployment test này).

---

## 6. 🧮 RATE-LIMIT STORAGE: 1 process dùng `memory://`, nhiều process phải dùng Redis

| Tình huống | Cấu hình đúng | Ghi chú |
| :--- | :--- | :--- |
| **Hiện tại** — 1 container, uvicorn **1 worker**, không dùng `--workers` | `RATE_LIMIT_STORAGE_URI=memory://` | ✅ đã kiểm chứng: 60/phút, 429, `Retry-After`, key theo IP thật |
| Nhiều uvicorn worker **hoặc** nhiều container/replica | `RATE_LIMIT_STORAGE_URI=redis://…` (bắt buộc) | `memory://` khiến mỗi process đếm riêng ⇒ hạn mức thực tế × số process |

Nếu cần scale ngang (chưa làm vì Free Tier không có ElastiCache):

1. Dựng Redis trong cùng VPC, SG chỉ mở `6379` từ SG backend (không public);
2. Đặt `RATE_LIMIT_STORAGE_URI=redis://<host>:6379/0` trong `/opt/fpl/backend.env`;
3. Thêm egress `6379` từ SG backend tới SG Redis;
4. Container **đã cài sẵn** `redis=6.4.0` ⇒ không cần build lại image;
5. Kiểm chứng bằng 2 container: tổng request vẫn ≤ 60/phút.

Redis chết **không** âm thầm quay về memory: middleware trả `503 {"detail":"Rate-limit service unavailable"}`
(theo thiết kế trong `app/core/rate_limiter.py`).

---

## 7. 🧰 BỘ SCRIPT CHUẨN BỊ SẴN (trong `scripts/`, chạy từ máy dev)

| Script | Việc nó làm |
| :--- | :--- |
| `scripts/ssm_run.sh "<cmd>"` / `--file <script>` | Chạy lệnh trên EC2 qua **SSM Run Command** (không cần SSH), tự bỏ CRLF |
| `scripts/acceptance/remote_preflight.sh` | Read-only: container, env (che giá trị), deps, CBC, RDS/TLS, migration, số dòng bảng |
| `scripts/acceptance/provision_cloudwatch.sh` | Tạo log group + retention + IAM inline policy (idempotent) |
| `scripts/acceptance/redeploy_backend.sh` | Áp env + restart API (proxy headers) + (re)start **1** worker |
| `scripts/acceptance/create_test_database.sh` | Tạo `fantasy_fpl_test` + kiểm tra hygiene schema |
| `scripts/acceptance/run_postgres_suites.sh` | Chạy suite PostgreSQL trong VPC trên `_test` DB, lưu log bằng chứng |
| `scripts/acceptance/run_remote_e2e.sh` | Chạy `-k deployed` vào URL công khai (chặn sớm nếu `/teams` rỗng) |
| `scripts/acceptance/install_sync_evidence.sh` | Cài systemd timer 6 h + collector → JSONL + CloudWatch `/fpl/worker` |
| `scripts/acceptance/fpl_payload_probe.py` | Soi payload FPL: field nào `null` sẽ làm `fpl_sync` fail |

Chạy lại **toàn bộ** bằng chứng (≈3 phút):

```bash
bash scripts/ssm_run.sh --file scripts/acceptance/remote_preflight.sh
bash scripts/acceptance/provision_cloudwatch.sh                     # idempotent
bash scripts/ssm_run.sh --file scripts/acceptance/create_test_database.sh
bash scripts/ssm_run.sh --file scripts/acceptance/run_postgres_suites.sh
bash scripts/ssm_run.sh --file scripts/acceptance/install_sync_evidence.sh
# sau khi Nhất merge:
bash scripts/ssm_run.sh --file scripts/acceptance/run_remote_e2e.sh
```

---

## 8. 📋 NHẤT CẦN LÀM (gửi lại nguyên mục này)

| # | Việc | Chi tiết | Xong khi |
| :-- | :--- | :--- | :--- |
| **N-1** | Sửa `teams[].strength = null` trong `backend/app/services/fpl_sync.py` | Patch ở §5.2 (thêm `field_validator` map `None → 3`) | `pytest tests/test_fpl_sync.py tests/test_cron_scheduler.py -q` xanh |
| **N-2** | Thêm test hồi quy cho payload thật | `test_null_team_strength_falls_back_to_default` (§5.2) | Test fail trước khi sửa, pass sau khi sửa |
| **N-3** | Merge vào `main` (cần Dev duyệt) | Sau merge, CI tự build/deploy + restart worker | Image mới = SHA mới; `docker ps` có `fpl-worker` mới |
| **N-4** | Xác nhận sync vào RDS | `scripts/ssm_run.sh --file scripts/acceptance/remote_preflight.sh` | `teams_rows = 20`, `players_rows ≈ 672`, `alembic_version = 002_add_shared_lineups` |
| **N-5** | Chạy nửa “deployed” của `P3-NH03` | `scripts/ssm_run.sh --file scripts/acceptance/run_remote_e2e.sh` | `1 passed` (log `/opt/fpl/evidence/<UTC>-pytest-deployed.log`) |
| **N-6** | (tuỳ chọn) tự kiểm tra rate limit | 60 request `/api/v1/players` rồi request thứ 61 | 429 + `Retry-After` |
| **N-7** | Cập nhật `docs/TODO.md` | Ghi bằng chứng + ngày cho 5 task | 5 mục có “Bằng chứng …” trỏ về tài liệu này |

**Những gì Nhất KHÔNG cần làm:** không tạo log group/IAM, không tạo DB test, không cấu hình
proxy/Redis, không deploy tay — hạ tầng đã xong và có script chạy lại.

---

## 9. ⏱️ THỜI GIAN SẴN SÀNG & RỦI RO

| Mốc | Thời điểm |
| :--- | :--- |
| Hạ tầng + URL test sẵn sàng | **ngay bây giờ** (11/11/2026, ~22:20 UTC+7) |
| Bằng chứng RDS / PostgreSQL / CloudWatch / rate-limit | **đã có**, chạy lại được bất cứ lúc nào (§7) |
| Nghiệm thu chức năng đầy đủ (data thật + optimizer + share + E2E deployed) | **+30–45 phút sau khi Nhất merge**: CI build+push ≈6–8 phút → rollout ≈1 phút → sync ≈1 phút → E2E ≈2 phút |
| Lần chạy timer bằng chứng kế tiếp | **21:04 UTC** = 04:04 UTC+7 |

Rủi ro đang mở (đã biết, không chặn nghiệm thu):

| # | Rủi ro | Xử lý |
| :-- | :--- | :--- |
| R-1 | EC2 **không gắn Elastic IP** ⇒ `stop/start` đổi IP và **URL `*.sslip.io` chết** | Không stop instance trước buổi nghiệm thu; muốn cố định thì gắn EIP + sửa `Caddyfile` + `CORS_ORIGINS` |
| R-2 | `memory://` chỉ đúng khi **1 process** | Xem §6; cấm thêm `--workers`/replica khi chưa có Redis |
| R-3 | Chi phí 24/7 ≈ **$11–12/tháng** (budget guard `$10`) | Teardown theo `app_runner_setup.md` §8.3 sau demo (mốc tối đa 06/12/2026) |
| R-4 | Snapshot nghiệm thu không xoá được (API không có DELETE) | Chỉ chạy `run_remote_e2e.sh` trên chính deployment test này |
| R-5 | Log group tăng dung lượng nếu traffic lớn | Retention 30 ngày + volume hiện tại nằm trong Free Tier (5 GB) |

---

## 10. 📎 VỊ TRÍ BẰNG CHỨNG (trên instance)

```text
/opt/fpl/backend.env                              # env production (chmod 600, có mật khẩu — KHÔNG copy ra ngoài)
/opt/fpl/evidence/<UTC>-pytest-postgres.log       # 261 passed / 105 passed
/opt/fpl/evidence/<UTC>-pytest-deployed.log       # sau khi Nhất merge
/opt/fpl/evidence/sync-checks.jsonl               # 1 dòng / 6 giờ (kèm bản trên CloudWatch /fpl/worker)
/opt/fpl/src                                      # source đúng SHA của image (đối chiếu sha256)
```

CloudWatch (giữ 30 ngày): `/fpl/backend` = log request JSON của API · `/fpl/worker` = bằng chứng sync 6 h.



