# 🚀 HƯỚNG DẪN CÀI ĐẶT & CHẠY LOCAL (LOCAL SETUP GUIDE)
# Fantasy Football Lineup Builder & Optimizer

> **Task:** `P1-Q04` — *Risk Level 1 (Low)* | **Owner:** Quang (DevOps & Cloud Lead)
> **Dành cho:** Nguyên (Frontend), Nhất (Backend), Vũ (Data & Algo) và bất kỳ ai vừa clone repo về máy mới.
> **Mục tiêu:** Từ máy "trắng" → toàn bộ hệ thống (**Frontend + Backend + PostgreSQL**) chạy trên `localhost` trong **≤ 5 phút**. Không cần cài Python, Node.js hay PostgreSQL trên máy thật — tất cả nằm trong Docker.
> **Nguồn chuẩn:** [`docs/PROJECT_SSOT.md`](docs/PROJECT_SSOT.md) · [`docs/PROJECT_ROADMAP.md`](docs/PROJECT_ROADMAP.md) · [`docs/TODO.md`](docs/TODO.md) · [`infra/docker-compose.yml`](infra/docker-compose.yml)

---

## 🧭 MỤC LỤC

| # | Nội dung | # | Nội dung |
| :--- | :--- | :--- | :--- |
| 1 | Yêu cầu hệ thống | 8 | Kiểm thử tự động toàn hệ thống (5 check) |
| 2 | Cài đặt Docker Desktop (Win/macOS/Linux) | 9 | Bộ lệnh thường dùng (cheat sheet) |
| 3 | Clone repo & chọn branch | 10 | Kiến trúc local & cách reset |
| 4 | Cấu hình biến môi trường `.env` | 11 | Xử lý sự cố (troubleshooting) |
| 5 | **Chạy toàn bộ hệ thống bằng 1 lệnh** | 12 | Ghi chú quan trọng |
| 6 | **Khởi tạo database lần đầu (bắt buộc, 1 lần)** | 13 | Checklist nghiệm thu |
| 7 | Truy cập ứng dụng & smoke test | — | — |

---

## ⚡ QUICK START (TL;DR — COPY & PASTE)

```bash
# 1) Clone repo
git clone https://github.com/nguyendk0904/epl-fantasy-lineups.git
cd epl-fantasy-lineups

# 2) Bật Docker Desktop và chờ icon 🐳 chuyển xanh ("Engine running")

# 3) MỘT LỆNH DUY NHẤT: build + start cả 3 service (Postgres -> Backend -> Frontend)
docker compose -f infra/docker-compose.yml up -d --build

# 4) CHỈ LẦN ĐẦU TIÊN: tạo schema DB (Alembic) + nạp dữ liệu demo
#    (Git Bash trên Windows cần MSYS_NO_PATHCONV=1; PowerShell/macOS/Linux xem biến thể ở mục 6)
MSYS_NO_PATHCONV=1 docker run --rm --network fpl-local_fpl-network \
  -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/fantasy_fpl \
  -v "$PWD/backend:/app" -w /app fpl-local-backend alembic upgrade head

MSYS_NO_PATHCONV=1 docker run --rm --network fpl-local_fpl-network \
  -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/fantasy_fpl \
  -v "$PWD/backend:/app" -v "$PWD/scripts:/scripts" -w /app fpl-local-backend \
  python /scripts/seed_demo_data.py

# 5) Mở trình duyệt
#    Frontend (SPA)      ->  http://localhost:5173
#    Backend Swagger UI  ->  http://localhost:8000/docs
```

> ⚠️ **Bước 4 là bắt buộc với máy mới.** `docker compose up` chỉ khởi động 3 container; **schema database do Alembic quản lý** ([P1-V01](docs/TODO.md)) nên phải chạy migration 1 lần. Nếu bỏ qua, API sẽ trả `500 Internal Server Error` (xem [mục 6](#-6-khởi-tạo-database-lần-đầu-bắt-buộc-chỉ-1-lần) và [mục 11](#-11-xử-lý-sự-cố-troubleshooting)).
>
> ✅ Người dùng **PowerShell** hoặc **macOS/Linux**: dùng biến thể lệnh ở [mục 6](#-6-khởi-tạo-database-lần-đầu-bắt-buộc-chỉ-1-lần).

---

## 📋 1. YÊU CẦU HỆ THỐNG

| Thành phần | Bắt buộc | Khuyến nghị | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Hệ điều hành** | Windows 10/11 64-bit, macOS 12+, Ubuntu 20.04+ | Windows 11 + WSL 2 | Windows 10 phải bật virtualization trong BIOS. |
| **Docker Desktop** | Bản mới nhất (Docker Engine 24+, Compose v2) | Docker Desktop 4.x | **Bắt buộc dùng `docker compose` (v2)**, không dùng `docker-compose` (v1) — file compose dùng key `name:` và `depends_on.condition`. |
| **Git** | ✅ | Git for Windows (kèm Git Bash) | Script test là bash script → trên Windows nên dùng **Git Bash**. |
| **RAM** | 8 GB | 16 GB | Docker Desktop nên cấp ≥ 4 GB RAM. |
| **Ổ cứng trống** | 10 GB | 15 GB | 3 image thực tế: backend **1.27 GB** + postgres **417 MB** + frontend **95 MB** ≈ **1.8 GB**. |
| **Cổng trống** | `5173`, `8000`, `5432` | — | Xem cách đổi cổng ở [mục 11](#-11-xử-lý-sự-cố-troubleshooting). |
| **Internet** | ✅ (lần đầu) | — | Cần để pull image, `pip install`, `npm ci`. |

**Không cần cài:** Python, Node.js, npm, PostgreSQL, PuLP/CBC solver → tất cả đã nằm trong image ([`backend/Dockerfile`](backend/Dockerfile), [`frontend/Dockerfile`](frontend/Dockerfile)).

---

## 🐳 2. CÀI ĐẶT DOCKER DESKTOP

### 2.1. Windows 10 / 11

1. **Bật WSL 2** (mở **PowerShell với quyền Administrator**):
   ```powershell
   wsl --install
   wsl --status        # phải thấy "Default Version: 2"
   ```
   Nếu máy đã có WSL 1: `wsl --set-default-version 2`. Khởi động lại máy sau khi cài.
2. **Tải Docker Desktop**: <https://www.docker.com/products/docker-desktop/> → chọn **Windows (AMD64)**.
3. **Chạy file cài đặt** → giữ nguyên tuỳ chọn **"Use WSL 2 instead of Hyper-V"** → `Ok` → khởi động lại máy.
4. **Mở Docker Desktop** → chờ thanh trạng thái dưới cùng hiện **"Engine running"** (icon 🐳 ở khay hệ thống chuyển xanh). Không bắt buộc đăng nhập tài khoản Docker Hub.
5. **Kiểm tra** trong **Git Bash** hoặc PowerShell (xem [mục 2.4](#24-kiểm-tra-cài-đặt)).

> 💡 Nếu gặp `docker: error during connect ... The system cannot find the file specified`: Docker Desktop **chưa chạy**. Mở app và chờ ~1 phút.

### 2.2. macOS

```bash
# Apple Silicon (M1/M2/M3): tải "Apple Chip"; Intel: tải "Intel Chip"
# https://www.docker.com/products/docker-desktop/ -> Docker Desktop for Mac
open -a Docker        # hoặc mở app từ Launchpad, chờ "Engine running"
```

### 2.3. Linux (Ubuntu/Debian)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo apt-get install -y docker-compose-plugin
sudo usermod -aG docker "$USER"     # logout/login lại để không cần sudo
docker compose version
```

### 2.4. Kiểm tra cài đặt

Chạy 4 lệnh sau — cả 4 phải in ra phiên bản, **không báo lỗi**:

```bash
git --version          # ví dụ: git version 2.4x
docker --version       # ví dụ: Docker version 27.x / 29.x
docker compose version # ví dụ: Docker Compose version v2.x (KHÔNG phải 1.x)
docker info --format '{{.ServerVersion}}'   # ví dụ: 29.9.2 -> daemon đang chạy
```

Nếu `docker info` báo `failed to connect to the docker API ... dockerDesktopLinuxEngine`: **bật Docker Desktop** rồi chạy lại.

---

## 📥 3. CLONE REPO & CHỌN BRANCH

```bash
git clone https://github.com/nguyendk0904/epl-fantasy-lineups.git
cd epl-fantasy-lineups

git branch --show-current     # nhánh hiện tại (mặc định: main)
git log --oneline -3          # kiểm tra commit mới nhất
```

> 📌 **Mọi lệnh trong tài liệu này đều chạy từ thư mục gốc repo** (`epl-fantasy-lineups/`), trừ khi có ghi chú khác. Lý do: compose file nằm ở `infra/` nên ta dùng cờ `-f infra/docker-compose.yml`.

Cấu trúc thư mục quan trọng:

```text
epl-fantasy-lineups/
├── backend/                  # FastAPI + Alembic + PuLP (Dockerfile P1-Q01)
│   ├── app/                  # source code API (KHÔNG mount khi chạy chuẩn)
│   ├── alembic/versions/     # migration 001_initial_schema (P1-V01)
│   └── tests/                # unit tests (pytest)
├── frontend/                 # React + Vite + Tailwind (Dockerfile P1-Q01)
├── infra/
│   ├── docker-compose.yml    # 3 service: postgres / backend / frontend (P1-Q02)
│   └── init.sql              # chạy 1 lần: CREATE EXTENSION pgcrypto + timezone UTC
├── scripts/
│   ├── seed_demo_data.py     # nạp 6 CLB / 36 cầu thủ demo (P1-Q03)
│   └── test_local_integration.sh  # 5 check tích hợp end-to-end (P1-Q03)
├── docs/                     # TODO.md, SSOT, Roadmap, Guidelines
└── LOCAL_SETUP_GUIDE.md      # tài liệu này (P1-Q04)
```

---

## 🔧 4. CẤU HÌNH BIẾN MÔI TRƯỜNG (`.env` — KHÔNG BẮT BUỘC)

**Chạy mặc định thì không cần tạo file `.env`.** Mọi biến trong [`infra/docker-compose.yml`](infra/docker-compose.yml) đều có giá trị mặc định (`${VAR:-default}`) đúng với [`docs/PROJECT_SSOT.md`](docs/PROJECT_SSOT.md).

### 4.1. Khi nào cần tạo `.env`?

Chỉ khi bạn muốn **đổi cổng PostgreSQL, mật khẩu, tên DB, CORS**… mà không sửa file compose.

```bash
# ✅ ĐÚNG (cách 1 — khuyến nghị): chỉ khai báo đúng biến bạn muốn đổi
printf 'POSTGRES_PORT=5433\n' > infra/.env

# ✅ ĐÚNG (cách 2): copy toàn bộ mẫu rồi chỉnh lại
cp .env.example infra/.env
#   -> nhớ sửa: VITE_API_URL=/api/v1   (giữ dạng tương đối để request đi qua proxy Nginx)

# ❌ SAI (rất thường gặp): đặt .env ở thư mục root — compose sẽ KHÔNG đọc file này
#    (trừ khi chạy kèm cờ: docker compose --env-file .env -f infra/docker-compose.yml up -d)
```

> 🧪 **Đã kiểm chứng:** `infra/.env` có hiệu lực (đổi `POSTGRES_PORT=5499` → cổng host đổi đúng), còn `.env` ở root **bị bỏ qua** khi dùng `-f infra/docker-compose.yml`.
> PowerShell: `Set-Content infra\.env 'POSTGRES_PORT=5433'` rồi `Copy-Item .env.example infra\.env`.

### 4.2. Bảng biến môi trường & giá trị mặc định

| Biến | Mặc định | Ý nghĩa |
| :--- | :--- | :--- |
| `POSTGRES_USER` | `postgres` | User của PostgreSQL. |
| `POSTGRES_PASSWORD` | `postgres` | Password (chỉ dùng local, **không** dùng cho production/AWS). |
| `POSTGRES_DB` | `fantasy_fpl` | Tên database. |
| `POSTGRES_PORT` | `5432` | Cổng PostgreSQL trên máy thật (đổi nếu 5432 đang bị chiếm). |
| `ENVIRONMENT` | `development` | Trả về trong `/health`. |
| `CORS_ORIGINS` | `["http://localhost:5173", "http://localhost:3000"]` | JSON array các origin được phép gọi API. |
| `FPL_BOOTSTRAP_URL` | `https://fantasy.premierleague.com/api/bootstrap-static/` | Endpoint dữ liệu FPL (P1-NH02). |
| `VITE_API_URL` | `/api/v1` (build-arg của frontend) | **Giữ nguyên dạng tương đối** để Nginx proxy `/api/*` → `backend:8000`. |

> 🛑 **Bảo mật:** `.env` đã nằm trong [`.gitignore`](.gitignore) — **tuyệt đối không commit** file này (Golden Rule 8: không hardcode secret).
>
> ⚠️ Cổng của **backend (8000)** và **frontend (5173)** được khai báo cố định trong compose, không đọc từ `.env`. Muốn đổi → sửa `infra/docker-compose.yml` (task P1-Q02, owner Quang).

---

## ▶️ 5. CHẠY TOÀN BỘ HỆ THỐNG BẰNG 1 LỆNH

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

Hoặc tương đương (đứng trong thư mục `infra/`):

```bash
cd infra && docker compose up -d --build
```

**Điều gì xảy ra khi bạn gõ lệnh này?**

1. Docker **build song song** 2 image: `fpl-local-backend` (Python 3.11 + FastAPI + PuLP/CBC) và `fpl-local-frontend` (Node 20 build → Nginx alpine), đồng thời pull `postgres:15-alpine`.
2. Khởi động theo **đúng thứ tự nhờ healthcheck**:
   `postgres` (healthy) → `backend` (healthy, chờ `GET /health` trả 200) → `frontend` (healthy, chờ Nginx trả 200).
3. Toàn bộ service nằm trong network `fpl-local_fpl-network`; dữ liệu DB nằm trong named volume `fpl-pgdata`.

### 5.1. Thời gian & log

| Lần chạy | Thời gian | Ghi chú |
| :--- | :--- | :--- |
| Lần đầu (build từ đầu) | **3 – 8 phút** | Tải image + `pip install` + `npm ci` + `vite build`. Kiên nhẫn, đừng Ctrl+C. |
| Các lần sau (có cache) | **10 – 30 giây** | Docker dùng lại layer cache. |

Muốn **xem log trực tiếp** ngay từ đầu (không dùng `-d`):

```bash
docker compose -f infra/docker-compose.yml up --build
```

### 5.2. Kiểm tra trạng thái (phải thấy 3/3 `healthy`)

```bash
docker compose -f infra/docker-compose.yml ps
```

Kết quả mong đợi:

```text
NAME           SERVICE    STATUS                   PORTS
fpl-postgres   postgres   Up (healthy)             0.0.0.0:5432->5432/tcp
fpl-backend    backend    Up (healthy)             0.0.0.0:8000->8000/tcp
fpl-frontend   frontend   Up (healthy)             0.0.0.0:5173->80/tcp
```

> Nếu một service hiện `(health: starting)` → chờ thêm 15–30 giây rồi kiểm tra lại.
> Nếu hiện `unhealthy` hoặc `Restarting` → xem log: `docker compose -f infra/docker-compose.yml logs --tail 60 backend`.

---

## 🗄️ 6. KHỞI TẠO DATABASE LẦN ĐẦU (BẮT BUỘC, CHỈ 1 LẦN)

### 6.1. Vì sao cần bước này?

`docker compose up` chỉ **khởi động container**, không tạo bảng. Schema `teams / players / shared_lineups` được quản lý bằng **Alembic migration** ([`backend/alembic/versions/001_initial_schema.py`](backend/alembic/versions/001_initial_schema.py) — task P1-V01).

Nếu bỏ qua bước này, bạn sẽ thấy:

```bash
curl http://localhost:8000/api/v1/teams
# -> HTTP 500 {"detail":"Internal Server Error"}   (Postgres: relation "teams" does not exist)
```

`infra/init.sql` chỉ chạy **1 lần duy nhất** khi volume `fpl-pgdata` còn trống (tạo extension `pgcrypto` + timezone UTC), **không** tạo bảng nghiệp vụ.

### 6.2. Bước 6a — Tạo schema (Alembic `upgrade head`)

**Windows – Git Bash** (khuyến nghị):

```bash
MSYS_NO_PATHCONV=1 docker run --rm --network fpl-local_fpl-network \
  -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/fantasy_fpl \
  -v "$PWD/backend:/app" -w /app fpl-local-backend alembic upgrade head
```

**Windows – PowerShell** (1 dòng):

```powershell
docker run --rm --network fpl-local_fpl-network -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/fantasy_fpl -v "${PWD}\backend:/app" -w /app fpl-local-backend alembic upgrade head
```

**macOS / Linux:**

```bash
docker run --rm --network fpl-local_fpl-network \
  -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/fantasy_fpl \
  -v "$PWD/backend:/app" -w /app fpl-local-backend alembic upgrade head
```

Kết quả mong đợi:

```text
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 001_initial_schema, Create initial FPL teams and players tables.
```

> 🧠 **Giải thích lệnh:** chạy một container **tạm** (`--rm`) từ image backend đã build, join vào network của stack, mount thư mục `backend/` vào `/app` (vì `alembic.ini` + `alembic/versions/` không nằm trong image), rồi trỏ `DATABASE_URL` vào hostname `postgres` (DNS nội bộ của compose).
> Windows Git Bash cần `MSYS_NO_PATHCONV=1` để Git Bash không tự đổi `-w /app` thành `C:/Program Files/Git/app`.

### 6.3. Bước 6b — Nạp dữ liệu demo (6 CLB / 36 cầu thủ)

```bash
# Windows - Git Bash
MSYS_NO_PATHCONV=1 docker run --rm --network fpl-local_fpl-network \
  -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/fantasy_fpl \
  -v "$PWD/backend:/app" -v "$PWD/scripts:/scripts" -w /app fpl-local-backend \
  python /scripts/seed_demo_data.py
```

```powershell
# Windows - PowerShell
docker run --rm --network fpl-local_fpl-network -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/fantasy_fpl -v "${PWD}\backend:/app" -v "${PWD}\scripts:/scripts" -w /app fpl-local-backend python /scripts/seed_demo_data.py
```

```bash
# macOS / Linux
docker run --rm --network fpl-local_fpl-network \
  -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/fantasy_fpl \
  -v "$PWD/backend:/app" -v "$PWD/scripts:/scripts" -w /app fpl-local-backend \
  python /scripts/seed_demo_data.py
```

Kết quả mong đợi:

```text
[seed] Seeded teams=6 (ids 9001-9006), players=36 (ids 900001-900036), GKP 6 / DEF 12 / MID 12 / FWD 6
[seed] Verified in database: teams=6, players=36, composition={'FWD': 6, 'GKP': 6, 'MID': 12, 'DEF': 12}
```

> 🔒 Script **idempotent** (upsert theo primary key) và dùng dải ID riêng cho demo (`teams 9001–9006`, `players 900001–900036`) nên **không bao giờ ghi đè** dữ liệu FPL thật (id 1–20, element id thật). Chạy lại nhiều lần vẫn an toàn.
> Xoá dữ liệu demo: thêm `--clear` vào cuối lệnh trên.

### 6.4. Xác nhận database đã sẵn sàng

```bash
curl http://localhost:8000/api/v1/teams          # -> 200, JSON 6 CLB demo
curl "http://localhost:8000/api/v1/players?limit=2"
```

Nếu 2 lệnh trên trả `200` + JSON → **database đã sẵn sàng**, bạn có thể bỏ qua toàn bộ mục 6 ở các lần chạy sau.

---

## 🌐 7. TRUY CẬP ỨNG DỤNG & KIỂM TRA NHANH (SMOKE TEST)

| Dịch vụ | URL | Mô tả |
| :--- | :--- | :--- |
| **Frontend (SPA)** | <http://localhost:5173> | Bản build production của React/Vite, phục vụ bởi **Nginx**. Route lạ tự fallback về `index.html` (SPA routing). |
| **Nginx → Backend proxy** | <http://localhost:5173/api/v1/teams> | Mọi request `/api/*` được Nginx chuyển tiếp tới `backend:8000`. |
| **Swagger UI (Backend)** | <http://localhost:8000/docs> | Thử nghiệm toàn bộ REST API theo hợp đồng [`docs/PROJECT_SSOT.md`](docs/PROJECT_SSOT.md). |
| **ReDoc** | <http://localhost:8000/redoc> | Tài liệu API dạng đọc. |
| **Health check** | <http://localhost:8000/health> · <http://localhost:8000/api/v1/health> | `{"status":"healthy", ...}` — dùng cho healthcheck của Docker. |
| **PostgreSQL** | `localhost:5432` | user/pass/db: `postgres` / `postgres` / `fantasy_fpl`. |

Bộ smoke test bằng `curl` (chạy từ Git Bash / macOS / Linux):

```bash
# 1) Frontend phục vụ SPA shell (tìm thấy <div id="root">)
curl -s http://localhost:5173/ | grep -o 'id="root"'

# 2) Backend sống
curl -s http://localhost:8000/health

# 3) Proxy Nginx -> Backend hoạt động
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/api/v1/health

# 4) Optimizer (PuLP + CBC) trả về đội hình 15 người tối ưu
curl -s -X POST http://localhost:8000/api/v1/optimizer/solve \
  -H 'Content-Type: application/json' \
  -d '{"budget":100.0,"locked_player_ids":[],"excluded_player_ids":[],"target_formation":null}'
```

Kết quả `4` mong đợi (rút gọn):

```text
{"status":"optimal","total_cost":95.4,"total_expected_points":62.6,"starting_xi":[...11...],"bench":[...4...],"captain_id":...,"formation":"3-4-3"}
```

> 💡 Kiểm tra nhanh cổng có bị chiếm hay không (Windows): `netstat -ano | findstr :5173` · (macOS/Linux): `lsof -i :5173`.

---

## 🧪 8. KIỂM THỬ TỰ ĐỘNG TOÀN HỆ THỐNG (5 CHECK — KHUYẾN NGHỊ CHẠY)

Script [`scripts/test_local_integration.sh`](scripts/test_local_integration.sh) (task P1-Q03) kiểm tra end-to-end: Frontend → Nginx proxy → Backend → PostgreSQL → PuLP solver → Compare API.

```bash
# Git Bash / macOS / Linux (thêm --seed để tự nạp dữ liệu demo trước khi test)
bash scripts/test_local_integration.sh --seed
```

Kết quả **chuẩn** (đã chạy thực tế trên Windows + Docker Desktop):

```text
Local full-stack integration test (P1-Q03)
  Frontend : http://localhost:5173
  Backend  : http://localhost:8000/api/v1

Seeding demo data (6 demo clubs / 36 demo players)...
[seed] Seeded teams=6 (ids 9001-9006), players=36 (ids 900001-900036), GKP 6 / DEF 12 / MID 12 / FWD 6

[1/5] Frontend SPA reachable                               PASS
[2/5] Frontend -> Backend reverse proxy                    PASS
[3/5] Backend -> PostgreSQL data integrity                 PASS
[4/5] PuLP optimizer returns a legal squad                 PASS
[5/5] Solver constraints + compare API                     PASS

Passed: 5/5
All 5 integration checks passed
```

| # | Check | Nội dung |
| :--- | :--- | :--- |
| 1 | Frontend SPA reachable | `GET /` trả 200 và có `<div id="root">`. |
| 2 | Frontend → Backend proxy | `GET http://localhost:5173/api/v1/health` trả 200 qua Nginx. |
| 3 | Backend → PostgreSQL | Đủ 6 CLB / ≥ 2 mỗi vị trí, FK `team_id` hợp lệ, `now_cost > 0`. |
| 4 | PuLP optimizer | `POST /optimizer/solve` trả `status=optimal`, đúng 15 cầu thủ (11 XI + 4 bench), tuân luật FPL. |
| 5 | Constraints + Compare | `locked_player_ids` / `excluded_player_ids` được tôn trọng; `POST /lineups/compare` trả delta chính xác. |

**Yêu cầu phụ:** `curl` và Python 3 trên máy (script tự tìm `backend/venv` → `python3` → `python`; có thể chỉ định: `PYTHON=/c/Python312/python.exe bash scripts/test_local_integration.sh`).
Trên Windows, nếu gặp `$'\r': command not found` → file bị checkout CRLF: xem [mục 11](#-11-xử-lý-sự-cố-troubleshooting).

Các tuỳ chọn hữu ích: `--help`, `--api-url`, `--frontend-url`, `--timeout 90`, `--keep-artifacts` (giữ lại response HTTP thô để debug).

### 8.1. Unit test riêng từng layer (tuỳ chọn)

```bash
# Backend: pytest chạy trong container (đã cài sẵn pytest / pytest-asyncio / aiosqlite)
MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/backend:/app" -w /app fpl-local-backend python -m pytest tests -q

# Frontend: vitest trên máy thật (cần Node 20+; chạy 1 lần: npm --prefix frontend install)
npm --prefix frontend test
```

Kết quả tham chiếu: backend `84 passed, 2 skipped`; frontend `27 passed (5 files)`.

---

## 🧰 9. BỘ LỆNH THƯỜNG DÙNG (CHEAT SHEET)

Tất cả chạy từ **thư mục gốc repo**:

| Mục đích | Lệnh |
| :--- | :--- |
| Bật / cập nhật stack | `docker compose -f infra/docker-compose.yml up -d --build` |
| Xem trạng thái | `docker compose -f infra/docker-compose.yml ps` |
| Xem log 1 service | `docker compose -f infra/docker-compose.yml logs -f --tail 100 backend` |
| Log cả 3 service | `docker compose -f infra/docker-compose.yml logs -f` |
| Restart 1 service | `docker compose -f infra/docker-compose.yml restart backend` |
| Tắt stack (giữ dữ liệu DB) | `docker compose -f infra/docker-compose.yml down` |
| **Xoá sạch** (kèm mất dữ liệu DB) | `docker compose -f infra/docker-compose.yml down -v` |
| Build lại sau khi sửa Dockerfile | `docker compose -f infra/docker-compose.yml build --no-cache` |
| Vào shell trong backend | `docker compose -f infra/docker-compose.yml exec backend sh` |
| Mở psql trong DB | `docker compose -f infra/docker-compose.yml exec postgres psql -U postgres -d fantasy_fpl` |
| Xem dung lượng Docker | `docker system df` |
| Dọn image/volume rác | `docker system prune -f` (⚠️ **không** thêm `--volumes` nếu muốn giữ DB) |

> ♻️ Sau khi sửa code **backend**: `docker compose -f infra/docker-compose.yml up -d --build backend` (image không mount source nên phải build lại).
> ♻️ Sau khi sửa code **frontend**: `docker compose -f infra/docker-compose.yml up -d --build frontend` (build lại bundle Vite). Muốn hot-reload khi code UI: `npm --prefix frontend install` rồi `npm --prefix frontend run dev` (Vite ở `localhost:5173`) — nhớ `docker compose ... stop frontend` trước để tránh trùng cổng.

---

## 🏗️ 10. KIẾN TRÚC LOCAL & CÁCH RESET

```mermaid
flowchart LR
    B["Browser<br/>http://localhost:5173"] --> FE["fpl-frontend<br/>Nginx :80 → host :5173<br/>SPA + /api proxy"]
    FE -->|"/api/*"| BE["fpl-backend<br/>FastAPI :8000<br/>+ PuLP / CBC solver"]
    BE --> DB["fpl-postgres<br/>PostgreSQL 15 :5432<br/>volume: fpl-pgdata"]
    MA["Host shell<br/>docker run --rm"] -->|"alembic / seed / test"| BE
```

| Thành phần | Giá trị |
| :--- | :--- |
| Compose project name | `fpl-local` |
| Image | `fpl-local-backend`, `fpl-local-frontend`, `postgres:15-alpine` |
| Container | `fpl-postgres`, `fpl-backend`, `fpl-frontend` |
| Network | `fpl-local_fpl-network` (bridge) |
| Volume dữ liệu | `fpl-pgdata` (tên cố định, **không** mất khi `down` thường) |
| Cổng host | `5173` (frontend), `8000` (backend), `5432` (postgres) |

**Reset hoàn toàn về trạng thái "máy mới"** (khi DB hỏng hoặc muốn thử lại từ đầu):

```bash
docker compose -f infra/docker-compose.yml down -v          # tắt + xoá volume dữ liệu
docker compose -f infra/docker-compose.yml up -d --build    # chạy lại
# rồi chạy lại mục 6.2 (migration) + 6.3 (seed demo data)
```

---

## 🆘 11. XỬ LÝ SỰ CỐ (TROUBLESHOOTING)

| Triệu chứng (thông báo thật) | Nguyên nhân | Cách xử lý |
| :--- | :--- | :--- |
| `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine` | Docker Desktop chưa chạy | Mở Docker Desktop, chờ **"Engine running"**, chạy lại lệnh. |
| `docker: 'compose' is not a docker command` | Thiếu Compose v2 (chỉ có Docker CLI cũ) | Cập nhật Docker Desktop, hoặc `apt-get install docker-compose-plugin`. **Không** dùng `docker-compose` v1. |
| `Bind for 0.0.0.0:8000 failed: port is already allocated` | Cổng 8000/5173/5432 bị app khác chiếm | Tắt app đó, hoặc đổi cổng trong `infra/docker-compose.yml` (frontend/backend) và `infra/.env` (`POSTGRES_PORT`). Kiểm tra: `netstat -ano \| findstr :8000`. |
| `GET /api/v1/teams` → `500 Internal Server Error`; log có `relation "teams" does not exist` | Chưa chạy Alembic migration trên volume mới | Chạy lại [mục 6.2](#62-bước-6a--tạo-schema-alembic-upgrade-head). |
| `GET /api/v1/players` → `{"total":0,...}` hoặc optimizer trả `infeasible` | Database trống, chưa nạp dữ liệu | Chạy [mục 6.3](#63-bước-6b--nạp-dữ-liệu-demo-6-clb--36-cầu-thủ). |
| `docker: Error response from daemon: the working directory 'C:/Program Files/Git/app' is invalid` | Git Bash tự convert đường dẫn của `-w /app` | Thêm tiền tố `MSYS_NO_PATHCONV=1` trước `docker run` (xem mục 6.2). |
| `$'\r': command not found` khi chạy `bash scripts/test_local_integration.sh` | File `.sh` bị checkout kiểu CRLF | `git config core.autocrlf input && git rm --cached -r . && git reset --hard`, hoặc `dos2unix scripts/test_local_integration.sh`. |
| Service `frontend` hiện `unhealthy`, `curl :5173` fail | Backend chưa healthy nên frontend chưa được start | `docker compose -f infra/docker-compose.yml ps` → xem log backend trước. |
| Mở `localhost:5173` được nhưng gọi API trả `502 Bad Gateway` | Nginx không resolve được upstream `backend` | `docker compose ... logs frontend`; đảm bảo backend `healthy`; thử `docker compose ... restart frontend`. |
| Build lần đầu rất chậm / treo ở `npm ci` hoặc `pip install` | Mạng chậm, proxy công ty, VPN | Đổi mạng / tắt VPN; tăng CPU-RAM cho Docker Desktop (Settings → Resources). |
| `WSL 2 installation is incomplete` — Docker Desktop không start | WSL2 lỗi hoặc chưa bật virtualization | `wsl --update`; bật Virtualization trong BIOS; Docker Desktop → Troubleshoot → Restart. |
| Sửa code nhưng ứng dụng không thay đổi | Image không mount source (immutable build) | Build lại service tương ứng: `docker compose -f infra/docker-compose.yml up -d --build backend` (hoặc `frontend`). |

Vẫn lỗi? Thu thập log rồi gửi vào nhóm:

```bash
docker compose -f infra/docker-compose.yml ps
docker compose -f infra/docker-compose.yml logs --tail 80 > local.docker.log
docker info > docker-info.log
```

(`*.docker.log` đã nằm trong [`.gitignore`](.gitignore) nên `local.docker.log` sẽ không bị commit nhầm.)

---

## 📝 12. GHI CHÚ QUAN TRỌNG

1. **Dữ liệu FPL thật (tuỳ chọn, chưa khuyến nghị):** service [`backend/app/services/fpl_sync.py`](backend/app/services/fpl_sync.py) (task P1-NH02 — Nhất) chạy thủ công bằng:
   ```bash
   MSYS_NO_PATHCONV=1 docker run --rm --network fpl-local_fpl-network \
     -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/fantasy_fpl \
     -v "$PWD/backend:/app" -w /app fpl-local-backend python -m app.services.fpl_sync
   ```
   ⚠️ **Trạng thái đã kiểm tra (11/2026):** payload `bootstrap-static` mới nhất có CLB với `strength = null` → validator Pydantic báo `FPLSyncError: Invalid FPL bootstrap payload`. Đây là phạm vi **P1-NH02 (Nhất)**. Vì vậy ở local hãy dùng **dữ liệu demo** (mục 6.3) để test trọn luồng.
2. **Không commit `.env`, không hardcode secret** (Golden Rule 8). Toàn bộ cấu hình AWS Free Tier thuộc Phase 2/3 và **không** cần cho môi trường local.
3. **Frontend trong Docker là bản production build** (không hot-reload) — đúng mục tiêu "test end-to-end như production". Cần HMR khi code UI thì dùng `npm --prefix frontend run dev` (mục 9).
4. **Đổi phiên bản dependency** (Python / Node / PostgreSQL) hoặc sửa `Dockerfile`/`docker-compose.yml` ⇒ risk **LEVEL 4**, phải báo **Quang** review trước khi merge.
5. Tài liệu này phản ánh đúng trạng thái `main` hiện tại; khi compose/Dockerfile thay đổi, cập nhật guide trong cùng PR.

---

## ✅ 13. CHECKLIST NGHIỆM THU (DÀNH CHO NGƯỜI CÀI MÁY MỚI)

- [ ] `docker --version` + `docker compose version` OK; `docker info` in ra ServerVersion.
- [ ] `docker compose -f infra/docker-compose.yml ps` → **3/3 service `healthy`**.
- [ ] <http://localhost:5173> hiển thị giao diện ứng dụng (không trắng trang, console không lỗi).
- [ ] <http://localhost:8000/docs> mở được Swagger UI.
- [ ] `curl http://localhost:8000/api/v1/health` → `{"status":"healthy",...}`.
- [ ] `curl http://localhost:8000/api/v1/teams` → `200` + 6 CLB demo (sau khi làm mục 6).
- [ ] `POST http://localhost:8000/api/v1/optimizer/solve` → `status: "optimal"`, 11 cầu thủ XI + 4 dự bị.
- [ ] `bash scripts/test_local_integration.sh --seed` → **`Passed: 5/5`**.
- [ ] Tổng thời gian clone → chạy được: **≤ 5 phút** (không tính lần build đầu tiên).

📚 **Đọc tiếp:**
[`docs/TODO.md`](docs/TODO.md) (nhận task của bạn) · [`docs/AI_DEVELOPMENT_GUIDE.md`](docs/AI_DEVELOPMENT_GUIDE.md) (quy trình làm việc với AI) · [`docs/PROJECT_SSOT.md`](docs/PROJECT_SSOT.md) (luật FPL & API contract) · [`docs/PROJECT_ROADMAP.md`](docs/PROJECT_ROADMAP.md) (lộ trình 4 Phase).

---

<div align="center">

**P1-Q04 · LOCAL SETUP GUIDE** — Owner: **Quang (DevOps & Cloud Lead)** · Risk Level 1 (Low)
Đã kiểm chứng thực tế trên Windows 11 + Docker Desktop (Compose v2): build 3 image, 3/3 container `healthy`, integration test **5/5 PASS**.

</div>
