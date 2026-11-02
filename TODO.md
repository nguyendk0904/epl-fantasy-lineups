# 📋 BẢNG THEO DÕI TIẾN ĐỘ & ĐẶC TẢ CHI TIẾT TASK (PROJECT TODO)
# Fantasy Football Lineup Builder & Optimizer

> **HƯỚNG DẪN DÀNH CHO DEV & AI:**
> - Mỗi task tương ứng với một checkbox `[ ]`. Khi xong, review và test pass thì đổi thành `[x]`.
> - **Nguyên tắc phân định thư mục:** Chỉ được sửa/tạo file trong đúng **Thư mục cho phép** của task đó.
> - **Giới hạn file:** Mỗi task chỉ tạo tối đa **5 file** (đã liệt kê chi tiết dưới từng task).
> - **Branch riêng:** Bắt buộc checkout branch theo tên quy định trước khi code.

---

## 📊 TIẾN ĐỘ TỔNG QUAN

| Giai đoạn (Phase) | Hoàn thành | Tỷ lệ | Trạng thái |
| :--- | :---: | :---: | :---: |
| **Phase 1: Local Full-Stack Product** | **17 / 17** | `100%` | 🟡 Đang thực hiện |
| **Phase 2: AWS Services Integration** | **3 / 14** | `21%` | 🟡 Đang thực hiện |
| **Phase 3: Production Deploy & E2E Test** | **0 / 14** | `0%` | ⚪ Chờ Phase 2 |
| **Phase 4: Live Gamification & League Operations** | **0 / 14** | `0%` | ⚪ Chờ Phase 3 |
| **TỔNG CỘNG TOÀN DỰ ÁN** | **20 / 59** | `34%` | 🟡 Đang thực hiện |

---

## 📂 PHÂN ĐỊNH THƯ MỤC LÀM VIỆC (DIRECTORY SCOPES)

| Thành viên | Vai trò | Thư mục ĐƯỢC PHÉP thao tác |
| :--- | :--- | :--- |
| **Nguyên** | **Frontend Lead** | `frontend/` (src, public, package.json, tailwind.config.js,...) |
| **Nhất** | **Backend Core** | `backend/app/api/v1/endpoints/players.py`, `teams.py`, `backend/app/services/fpl_sync.py`, `backend/app/core/`, `backend/app/main.py`, `backend/tests/` |
| **Vũ** | **Data & Algo** | `backend/app/models/`, `backend/app/schemas/`, `backend/app/services/optimizer_solver.py`, `backend/app/api/v1/endpoints/optimizer.py`, `lineups.py`, `backend/alembic/`, `backend/tests/test_optimizer.py` |
| **Quang** | **DevOps & AWS** | `infra/`, `backend/Dockerfile`, `frontend/Dockerfile`, `.dockerignore`, `.github/workflows/`, `scripts/`, `LOCAL_SETUP_GUIDE.md` |

---

## 🚀 PHASE 1: TẠO SẢN PHẨM HOÀN CHỈNH & TEST TRÊN LOCAL (17/17)
*Mục tiêu: Chạy toàn bộ hệ thống trên localhost qua Docker Compose, dữ liệu FPL thật, test unit pass 100%.*

### 🎨 Nguyên (Frontend & UI Lead) - [5/5]

- [X] **`P1-NG01`** *(Level 1)*: Khởi tạo base React + Vite + TailwindCSS + Shadcn/ui
  - *Mô tả:* Setup khung dự án Frontend với Vite, TypeScript, cấu hình Tailwind, font chữ, layout Navbar và Tab điều hướng chính.
  - *Phụ thuộc:* Không (Bắt đầu ngay).
  - *Thư mục:* `frontend/`
  - *File tạo mới (4 files):* `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tailwind.config.js`, `frontend/src/App.tsx`.
  - *Branch:* `feature/P1-NG01-init-react`

- [x] **`P1-NG02`** *(Level 2)*: Xây dựng Sân bóng ảo (`VirtualPitch`) 11 chính + 4 bench
  - *Mô tả:* Component hiển thị sân cỏ trực quan với 11 vị trí thi đấu chính thức (sơ đồ 4-3-3 mặc định) và 4 vị trí bench bên dưới; hỗ trợ gắn badge Captain 'C' và Vice-Captain 'V'.
  - *Phụ thuộc:* `P1-NG01`
  - *Thư mục:* `frontend/src/components/pitch/`
  - *File tạo mới (3 files):* `frontend/src/components/pitch/VirtualPitch.tsx`, `frontend/src/components/pitch/PlayerPitchSlot.tsx`, `frontend/src/components/pitch/__tests__/VirtualPitch.test.tsx`.
  - *Branch:* `feature/P1-NG02-virtual-pitch`

- [x] **`P1-NG03`** *(Level 2)*: Bảng danh sách & Bộ lọc cầu thủ (`PlayerTable`)
  - *Mô tả:* Bảng dữ liệu cầu thủ sử dụng TanStack Table; hỗ trợ tìm kiếm tên tức thì, lọc theo vị trí (GKP/DEF/MID/FWD), lọc theo CLB và sắp xếp theo giá / điểm số.
  - *Phụ thuộc:* `P1-NG01`
  - *Thư mục:* `frontend/src/components/player-list/`
  - *File tạo mới (3 files):* `frontend/src/components/player-list/PlayerTable.tsx`, `frontend/src/components/player-list/PlayerFilters.tsx`, `frontend/src/components/player-list/__tests__/PlayerTable.test.tsx`.
  - *Branch:* `feature/P1-NG03-player-table`

- [x] **`P1-NG04`** *(Level 2)*: Zustand Store quản lý Lineup & Validation FPL
  - *Mô tả:* Quản lý state 15 cầu thủ đã chọn, tự động tính tổng tiền và ngân sách còn lại; validate chặn quá 100m, chặn quá 3 người/CLB; tự lưu và tải từ `localStorage`.
  - *Phụ thuộc:* `P1-NG01`
  - *Thư mục:* `frontend/src/stores/`
  - *File tạo mới (2 files):* `frontend/src/stores/lineupStore.ts`, `frontend/src/stores/__tests__/lineupStore.test.ts`.
  - *Branch:* `feature/P1-NG04-lineup-store`

- [x] **`P1-NG05`** *(Level 2)*: Giao diện Optimizer Control & So sánh Lineup (Radar Chart)
  - *Mô tả:* Bảng điều khiển nút bấm Auto-Optimize (chọn ngân sách, lock cầu thủ) và màn hình so sánh 2 đội hình song song hiển thị biểu đồ Radar (Recharts) chỉ số công/thủ.
  - *Phụ thuộc:* `P1-NG02`, `P1-NG04`
  - *Thư mục:* `frontend/src/components/comparison/`, `frontend/src/components/optimizer/`
  - *File tạo mới (3 files):* `frontend/src/components/optimizer/OptimizerControl.tsx`, `frontend/src/components/comparison/LineupComparisonView.tsx`, `frontend/src/components/comparison/__tests__/LineupComparison.test.tsx`.
  - *Branch:* `feature/P1-NG05-compare-ui`

---

### ⚙️ Nhất (Backend Core & FPL Sync Lead) - [4/4]

- [x] **`P1-NH01`** *(Level 2)*: Khởi tạo base FastAPI, CORS, SQLAlchemy Async
  - *Mô tả:* Dựng khung ứng dụng FastAPI, cấu hình CORS cho frontend, thiết lập file config biến môi trường Pydantic và session async kết nối PostgreSQL.
  - *Phụ thuộc:* Không (Bắt đầu ngay).
  - *Thư mục:* `backend/`
  - *File tạo mới (4 files):* `backend/requirements.txt`, `backend/app/main.py`, `backend/app/core/config.py`, `backend/app/core/database.py`.
  - *Branch:* `feature/P1-NH01-init-fastapi`

- [x] **`P1-NH02`** *(Level 3)*: Viết service `fpl_sync.py` kéo & Upsert dữ liệu FPL
  - *Mô tả:* Worker kéo JSON từ FPL API (`bootstrap-static`), chuẩn hóa giá chia 10 (£15.2m), map vị trí chữ (GKP/DEF/MID/FWD) và upsert dữ liệu 20 CLB, ~650 cầu thủ vào PostgreSQL.
  - *Phụ thuộc:* `P1-NH01`, `P1-V01` (Cần models DB của Vũ).
  - *Thư mục:* `backend/app/services/`
  - *File tạo mới (2 files):* `backend/app/services/fpl_sync.py`, `backend/tests/test_fpl_sync.py`.
  - *Branch:* `feature/P1-NH02-fpl-sync`

- [x] **`P1-NH03`** *(Level 2)*: Xây dựng REST API `GET /api/v1/players`
  - *Mô tả:* API trả về danh sách cầu thủ có phân trang, hỗ trợ query params lọc theo vị trí, team_id, khoảng giá, tìm kiếm tên và sắp xếp theo điểm/giá.
  - *Phụ thuộc:* `P1-NH02`
  - *Thư mục:* `backend/app/api/v1/endpoints/`
  - *File tạo mới (3 files):* `backend/app/schemas/player.py`, `backend/app/api/v1/endpoints/players.py`, `backend/tests/test_players_api.py`.
  - *Branch:* `feature/P1-NH03-players-api`

- [x] **`P1-NH04`** *(Level 1)*: Xây dựng REST API `GET /api/v1/teams`
  - *Mô tả:* API trả về danh sách 20 đội bóng Premier League kèm tên viết tắt (ARS, MCI,...), chỉ số sức mạnh tổng thể và sức mạnh công/thủ.
  - *Phụ thuộc:* `P1-NH02`
  - *Thư mục:* `backend/app/api/v1/endpoints/`
  - *File tạo mới (3 files):* `backend/app/schemas/team.py`, `backend/app/api/v1/endpoints/teams.py`, `backend/tests/test_teams_api.py`.
  - *Branch:* `feature/P1-NH04-teams-api`
  - *Kiểm thử:* 5/5 test Teams API pass; bộ kiểm thử Teams, Players, main và models: 37/37 pass trên SQLite. Chưa xác minh dữ liệu 20 CLB trên PostgreSQL thật; chưa chạy lint vì môi trường chưa có công cụ.

---

### 🧠 Vũ (Data & Algorithm Engineer) - [4/4]

- [x] **`P1-V01`** *(Level 3)*: Thiết kế Schema PostgreSQL & Alembic Migration
  - *Mô tả:* Khai báo SQLAlchemy ORM models cho bảng `teams`, `players` (kèm indexes vị trí, giá, điểm) và thiết lập file migration đầu tiên bằng Alembic.
  - *Phụ thuộc:* `P1-NH01`
  - *Thư mục:* `backend/app/models/`, `backend/alembic/`
  - *File tạo mới (4 files):* `backend/app/models/team.py`, `backend/app/models/player.py`, `backend/alembic/env.py`, `backend/alembic/versions/001_initial_schema.py`.
  - *Branch:* `feature/P1-V01-db-schema`

- [x] **`P1-V02`** *(Level 3)*: Module Thuật toán `optimizer_solver.py` bằng `PuLP`
  - *Mô tả:* Mô hình hóa và giải bài toán quy hoạch tuyến tính nguyên 0-1 (0-1 ILP) chọn 15 cầu thủ tối đa hóa điểm kỳ vọng trong ngân sách 100m, max 3/team, hỗ trợ khóa cầu thủ (locked players).
  - *Phụ thuộc:* Không (Chạy pure Python độc lập với mock data ngay Ngày 1).
  - *Thư mục:* `backend/app/services/`
  - *File tạo mới (2 files):* `backend/app/services/optimizer_solver.py`, `backend/tests/test_optimizer.py`.
  - *Branch:* `feature/P1-V02-pulp-optimizer`

- [x] **`P1-V03`** *(Level 3)*: Xây dựng REST API `POST /api/v1/optimizer/solve`
  - *Mô tả:* Endpoint nhận payload (ngân sách, locked_player_ids, excluded_player_ids, sơ đồ mong muốn), query danh sách cầu thủ từ DB và gọi `PuLP solver` trả về đội hình 15 người.
  - *Phụ thuộc:* `P1-V02`, `P1-NH01`
  - *Thư mục:* `backend/app/api/v1/endpoints/`
  - *File tạo mới (3 files):* `backend/app/schemas/optimizer.py`, `backend/app/api/v1/endpoints/optimizer.py`, `backend/tests/test_optimizer_api.py`.
  - *Branch:* `feature/P1-V03-optimizer-api`

- [x] **`P1-V04`** *(Level 2)*: Xây dựng REST API `POST /api/v1/lineups/compare`
  - *Mô tả:* Endpoint nhận vào 2 danh sách ID đội hình A và B, tính toán mức chênh lệch ngân sách, chênh lệch điểm xP, chỉ số sức mạnh từng tuyến và danh sách cầu thủ khác biệt.
  - *Phụ thuộc:* `P1-NH01`
  - *Thư mục:* `backend/app/api/v1/endpoints/`
  - *File tạo mới (3 files):* `backend/app/schemas/lineup.py`, `backend/app/api/v1/endpoints/lineups.py`, `backend/tests/test_compare_api.py`.
  - *Branch:* `feature/P1-V04-compare-api`

---

### 🐳 Quang (DevOps & AWS Lead) - [4/4]

- [x] **`P1-Q01`** *(Level 2)*: Viết `backend/Dockerfile` và `frontend/Dockerfile`
  - *Mô tả:* Đóng gói Docker đa tầng (multi-stage build) cho Backend (Python 3.11-slim kèm coinor-cbc solver) và Frontend (Vite build sang Nginx alpine phục vụ static file).
  - *Phụ thuộc:* `P1-NG01`, `P1-NH01` (Cần package.json và requirements.txt).
  - *Thư mục:* `backend/`, `frontend/`, root
  - *File tạo mới (3 files):* `backend/Dockerfile`, `frontend/Dockerfile`, `.dockerignore`.
  - *Branch:* `feature/P1-Q01-dockerfile`

- [x] **`P1-Q02`** *(Level 2)*: Xây dựng `infra/docker-compose.yml` chạy Local Full-Stack
  - *Mô tả:* File compose kết nối 3 container: PostgreSQL 15, FastAPI (port 8000), Vite React (port 5173); cấu hình volume lưu data DB và healthcheck đảm bảo thứ tự khởi động.
  - *Phụ thuộc:* `P1-Q01`
  - *Thư mục:* `infra/`
  - *File tạo mới (2 files):* `infra/docker-compose.yml`, `infra/init.sql`.
  - *Branch:* `feature/P1-Q02-docker-compose`

- [x] **`P1-Q03`** *(Level 2)*: Viết kịch bản Kiểm thử Tích hợp Local (Integration Test)
  - *Mô tả:* Script tự động gửi request kiểm tra tính thông suốt của toàn bộ hệ thống: Frontend gọi Backend $\rightarrow$ Backend query Postgres $\rightarrow$ PuLP solver trả kết quả.
  - *Phụ thuộc:* `P1-Q02`, `P1-NH03`, `P1-V03`
  - *Thư mục:* `scripts/`
  - *File tạo mới (2 files):* `scripts/test_local_integration.sh` (hoặc `.ps1`), `scripts/seed_demo_data.py`.
  - *Branch:* `feature/P1-Q03-local-integration-test`

- [x] **`P1-Q04`** *(Level 1)*: Viết tài liệu `LOCAL_SETUP_GUIDE.md`
  - *Mô tả:* Hướng dẫn chi tiết bằng markdown cho 3 bạn còn lại clone repo về, cài đặt Docker Desktop và gõ 1 lệnh `docker compose up` là toàn bộ app chạy mượt mà.
  - *Phụ thuộc:* `P1-Q02`
  - *Thư mục:* Root
  - *File tạo mới (1 file):* `LOCAL_SETUP_GUIDE.md`.
  - *Branch:* `feature/P1-Q04-setup-guide`

---

## ☁️ PHASE 2: TÍCH HỢP SỬ DỤNG CÁC DỊCH VỤ CỦA AWS (4/14)
*Mục tiêu: Đưa CSDL lên Amazon RDS, lưu trữ static web trên S3, kích hoạt AWS Budgets Alert ($\rightarrow$1.00) bảo vệ tài khoản của Quang.*

### 🎨 Nguyên (Frontend) - [0/3]
- [ ] **`P2-NG01`** *(Level 2)*: Tích hợp tính năng tạo Share Link đội hình qua Cloud API. *(Branch: `feature/P2-NG01-share-lineup`, Thư mục: `frontend/src/components/`, Files: `ShareModal.tsx`, `useShareLineup.ts`)*
- [ ] **`P2-NG02`** *(Level 2)*: Màn hình xem đội hình qua link chia sẻ (`/share/:code`) ở chế độ Read-only. *(Branch: `feature/P2-NG02-view-shared-lineup`, Thư mục: `frontend/src/pages/`, Files: `SharedLineupPage.tsx`)*
- [ ] **`P2-NG03`** *(Level 1)*: Cấu hình file môi trường `.env.production` trỏ API về domain Cloud. *(Branch: `feature/P2-NG03-frontend-env-prod`, Thư mục: `frontend/`, Files: `.env.production`)*

### ⚙️ Nhất (Backend) - [0/3]
- [ ] **`P2-NH01`** *(Level 3)*: Chuyển chuỗi kết nối Database sang Amazon RDS PostgreSQL qua biến môi trường. *(Branch: `feature/P2-NH01-rds-connection`, Thư mục: `backend/app/core/`, Files: `config.py`)*
- [ ] **`P2-NH02`** *(Level 2)*: REST API `POST /api/v1/lineups/share` và `GET /share/:code` đọc/ghi snapshot RDS. *(Branch: `feature/P2-NH02-shared-lineups-api`, Thư mục: `backend/app/api/v1/endpoints/`, Files: `lineup_share.py`)*
- [ ] **`P2-NH03`** *(Level 3)*: Cron job / Background worker định kỳ chạy FPL sync trên Cloud khi có Gameweek mới. *(Branch: `feature/P2-NH03-cloud-sync-cron`, Thư mục: `backend/app/services/`, Files: `cron_scheduler.py`)*

### 🧠 Vũ (Data & Algorithm) - [0/3]
- [ ] **`P2-V01`** *(Level 3)*: Chạy script migration toàn bộ Schema lên Amazon RDS PostgreSQL (kèm bảng `shared_lineups`). *(Branch: `feature/P2-V01-rds-migration`, Thư mục: `backend/alembic/`, Files: `002_add_shared_lineups.py`)*
- [ ] **`P2-V02`** *(Level 3)*: Tinh chỉnh Connection Pool (pool_size, max_overflow) tối ưu riêng cho instance `db.t4g.micro`. *(Branch: `feature/P2-V02-db-pool-tuning`, Thư mục: `backend/app/core/`, Files: `database.py`)*
- [ ] **`P2-V03`** *(Level 2)*: Bổ sung trọng số độ khó trận đấu (FDR) vào công thức tính điểm dự kiến (xP) của Optimizer. *(Branch: `feature/P2-V03-fdr-weighting`, Thư mục: `backend/app/services/`, Files: `optimizer_solver.py`)*

### 🐳 Quang (DevOps & AWS) - [4/4]
- [x] **`P2-Q01`** *(Level 4)*: Khởi tạo instance Amazon RDS PostgreSQL (`db.t4g.micro`, Single-AZ, 20GB gp3) trên tài khoản AWS của Quang. *(Branch: `feature/P2-Q01-aws-rds-init`, Thư mục: `infra/aws/`, Files: `rds_setup.md`)*
- [x] **`P2-Q02`** *(Level 4)*: Cấu hình Security Group an toàn: Chỉ mở port 5432 cho IP nhóm dev hoặc Backend. *(Branch: `feature/P2-Q02-rds-security-group`, Thư mục: `infra/aws/`, Files: `security_groups.md`)*
- [x] **`P2-Q03`** *(Level 4)*: **BẮT BUỘC:** Kích hoạt AWS Budgets Alert mức $\rightarrow$1.00 gửi email cảnh báo tự động về hòm thư của nhóm. *(Branch: `feature/P2-Q03-aws-budget-guard`, Thư mục: `infra/aws/`, Files: `budget_alert_setup.md`)*
- [x] **`P2-Q04`** *(Level 3)*: Khởi tạo AWS S3 Bucket cấu hình static hosting và chính sách truy cập an toàn. *(Branch: `feature/P2-Q04-s3-bucket-setup`, Thư mục: `infra/aws/`, Files: `s3_setup.md`, `s3_bucket_policy.json`)*

---

## 🌐 PHASE 3: DEPLOY & TEST ĐẦU CUỐI (END-TO-END) (0/14)
*Mục tiêu: Domain HTTPS công khai, CI/CD tự động, tải trang < 2s, kiểm thử tải và demo đồ án mượt mà.*

### 🎨 Nguyên (Frontend) - [0/3]
- [ ] **`P3-NG01`** *(Level 2)*: Tối ưu hiệu năng: Code splitting, Lazy load Recharts/Pitch, giảm bundle size < 500KB. *(Branch: `feature/P3-NG01-perf-optimization`)*
- [ ] **`P3-NG02`** *(Level 2)*: Hoàn thiện trải nghiệm responsive trên Mobile & Tablet: Co giãn sân bóng, drawer danh sách. *(Branch: `feature/P3-NG02-mobile-responsive`)*
- [ ] **`P3-NG03`** *(Level 1)*: Thực hiện User Acceptance Testing (UAT): Rà soát UI states (Loading skeleton, Error boundary). *(Branch: `feature/P3-NG03-uat-testing`)*

### ⚙️ Nhất (Backend) - [0/3]
- [ ] **`P3-NH01`** *(Level 2)*: Cấu hình Structured Logging và tích hợp đẩy log lên AWS CloudWatch theo dõi lỗi production. *(Branch: `feature/P3-NH01-cloudwatch-logging`)*
- [ ] **`P3-NH02`** *(Level 2)*: Tích hợp Rate Limiting (FastAPI-Limiter) ngăn chặn spam request vào backend. *(Branch: `feature/P3-NH02-api-rate-limit`)*
- [ ] **`P3-NH03`** *(Level 2)*: Viết bộ kịch bản kiểm thử API đầu cuối (End-to-End API Test Suite) tự động bằng Pytest. *(Branch: `feature/P3-NH03-e2e-api-tests`)*

### 🧠 Vũ (Data & Algorithm) - [0/3]
- [ ] **`P3-V01`** *(Level 3)*: Stress test thuật toán Optimizer: Đo đạc thời gian giải khi có 20-50 request đồng thời. *(Branch: `feature/P3-V01-optimizer-stress-test`)*
- [ ] **`P3-V02`** *(Level 3)*: Xây dựng cơ chế In-Memory Cache lưu kết quả các tổ hợp optimize phổ biến. *(Branch: `feature/P3-V02-optimizer-cache`)*
- [ ] **`P3-V03`** *(Level 1)*: Chuẩn bị bộ dữ liệu mẫu (Sample Data) và kịch bản demo so sánh đội hình cho buổi thuyết trình. *(Branch: `feature/P3-V03-demo-data-prep`)*

### 🐳 Quang (DevOps & AWS) - [0/4]
- [ ] **`P3-Q01`** *(Level 4)*: Triển khai Frontend lên AWS S3 + CloudFront (kèm chứng chỉ SSL HTTPS, CDN toàn cầu). *(Branch: `feature/P3-Q01-s3-cloudfront-deploy`)*
- [ ] **`P3-Q02`** *(Level 4)*: Đóng gói và triển khai Backend FastAPI lên AWS App Runner (hoặc EC2 t4g.small). *(Branch: `feature/P3-Q02-backend-aws-deploy`)*
- [ ] **`P3-Q03`** *(Level 4)*: Xây dựng pipeline GitHub Actions CI/CD: Push vào nhánh `main` tự động test và deploy lên AWS. *(Branch: `feature/P3-Q03-github-actions-cicd`)*
- [ ] **`P3-Q04`** *(Level 1)*: Kiểm tra hóa đơn AWS Billing, đối soát chi phí $\rightarrow$0.00 và viết tài liệu kiến trúc Cloud nộp đồ án. *(Branch: `feature/P3-Q04-cloud-architecture-doc`)*

---

## 🏆 PHASE 4: VẬN HÀNH MÙA GIẢI & GAMIFICATION (0/14)
*Mục tiêu: Vận hành trực tiếp với FPL thật: Lịch thi đấu 38 vòng, chấm điểm live, quản lý chấn thương, BXH và luật chuyển nhượng 3 người/tuần.*

### 🎨 Nguyên (Frontend & UI Lead) - [0/4]
- [ ] **`P4-NG01`** *(Level 2)*: Màn hình Lịch thi đấu các tuần & Độ khó trận đấu (`FixturesView`): 38 vòng đấu, tỉ số thực tế, badge FDR 1-5. *(Branch: `feature/P4-NG01-fixtures-ui`, Thư mục: `frontend/src/components/fixtures/`, Files: `FixturesView.tsx`, `FixtureCard.tsx`, `FixturesView.test.tsx`)*
- [ ] **`P4-NG02`** *(Level 2)*: Huy hiệu Trạng thái Chấn thương & Treo giò (`PlayerStatusBadge`): Cờ đỏ 🚑 (Nghỉ/0%), cờ vàng ⚠️ (Nghi ngờ), cờ đỏ 🟥 (Treo giò). *(Branch: `feature/P4-NG02-player-status-badge`, Thư mục: `frontend/src/components/common/`, Files: `PlayerStatusBadge.tsx`, `PlayerStatusBadge.test.tsx`)*
- [ ] **`P4-NG03`** *(Level 2)*: Bảng xếp hạng Người chơi (`LeaderboardView`) & Sân bóng vinh danh Đội hình tiêu biểu tuần (`DreamTeamModal`). *(Branch: `feature/P4-NG03-leaderboard-ui`, Thư mục: `frontend/src/components/leaderboard/`, Files: `LeaderboardView.tsx`, `DreamTeamModal.tsx`, `LeaderboardView.test.tsx`)*
- [ ] **`P4-NG04`** *(Level 2)*: Giao diện Luật Chuyển nhượng tuần: Bộ đếm đổi người `(Còn lại: X / 3)`, đồng hồ đếm ngược Deadline, modal chốt đội hình tuần. *(Branch: `feature/P4-NG04-transfer-rules-ui`, Thư mục: `frontend/src/components/transfers/`, Files: `TransferControl.tsx`, `TransferSummaryModal.tsx`, `TransferControl.test.tsx`)*

### ⚙️ Nhất (Backend Core & Live Data Lead) - [0/4]
- [ ] **`P4-NH01`** *(Level 3)*: Worker `live_sync.py`: Tự động cào Lịch thi đấu 38 vòng (`/api/fixtures/`) & Trạng thái y tế (`/api/bootstrap-static/`) lưu PostgreSQL. *(Branch: `feature/P4-NH01-sync-fixtures-injuries`, Thư mục: `backend/app/services/`, Files: `fixture_sync.py`, `test_fixture_sync.py`)*
- [ ] **`P4-NH02`** *(Level 3)*: Worker `gameweek_sync.py`: Cào Điểm trực tiếp sau trận (`/api/event/{gw}/live/`) và Đội hình tiêu biểu (`/api/dream-team/{gw}/`) lưu DB. *(Branch: `feature/P4-NH02-live-match-sync`, Thư mục: `backend/app/services/`, Files: `live_match_sync.py`, `test_live_match_sync.py`)*
- [ ] **`P4-NH03`** *(Level 2)*: REST API `GET /api/v1/fixtures` & `GET /api/v1/dream-team/{gw}`: Cung cấp lịch thi đấu và 11 cầu thủ xuất sắc nhất vòng. *(Branch: `feature/P4-NH03-fixtures-api`, Thư mục: `backend/app/api/v1/endpoints/`, Files: `fixture.py`, `fixtures.py`, `test_fixtures_api.py`)*
- [ ] **`P4-NH04`** *(Level 3)*: REST API `GET /api/v1/leaderboard` & `POST /api/v1/transfers/confirm`: Trả về BXH và thực thi validation chặn chuyển nhượng > 3 cầu thủ. *(Branch: `feature/P4-NH04-leaderboard-transfers-api`, Thư mục: `backend/app/api/v1/endpoints/`, Files: `gameweek.py`, `gameweeks.py`, `test_gameweeks_api.py`)*

### 🧠 Vũ (Data & Algorithm Engineer) - [0/3]
- [ ] **`P4-V01`** *(Level 3)*: Thiết kế Schema Migration Alembic cho các bảng: `fixtures`, `player_gameweek_stats`, `user_gameweek_lineups`, `dream_teams`. *(Branch: `feature/P4-V01-gameweek-schema`, Thư mục: `backend/app/models/`, `backend/alembic/`, Files: `fixture.py`, `gameweek.py`, `003_live_gameweek_schema.py`, `test_gameweek_models.py`)*
- [ ] **`P4-V02`** *(Level 3)*: Game Engine tính điểm tự động (`scoring_engine.py`): Điểm Captain x2, cơ chế Auto-sub thay thế cầu thủ không thi đấu từ hàng ghế dự bị. *(Branch: `feature/P4-V02-scoring-engine`, Thư mục: `backend/app/services/`, Files: `scoring_engine.py`, `test_scoring_engine.py`)*
- [ ] **`P4-V03`** *(Level 3)*: Nâng cấp PuLP Optimizer: Tự động loại bỏ cầu thủ chấn thương/treo giò và xây dựng Transfer Optimizer gợi ý 3 lượt thay tốt nhất. *(Branch: `feature/P4-V03-transfer-optimizer`, Thư mục: `backend/app/services/`, Files: `transfer_optimizer.py`, `test_transfer_optimizer.py`)*

### 🐳 Quang (DevOps & Cloud Automation Lead) - [0/3]
- [ ] **`P4-Q01`** *(Level 3)*: Thiết lập AWS EventBridge Scheduler định kỳ tự động chạy Live Sync lịch thi đấu và điểm số sau trận. *(Branch: `feature/P4-Q01-eventbridge-scheduler`, Thư mục: `infra/aws/`, Files: `eventbridge_schedules.tf`, `README_SCHEDULER.md`)*
- [ ] **`P4-Q02`** *(Level 3)*: Tích hợp Redis Caching cho Bảng xếp hạng và Lịch thi đấu chịu tải cao khi kết thúc trận đấu. *(Branch: `feature/P4-Q02-redis-caching`, Thư mục: `backend/app/core/`, Files: `redis_cache.py`, `test_redis_cache.py`)*
- [ ] **`P4-Q03`** *(Level 2)*: Kịch bản Kiểm thử Vòng đời Tuần thi đấu (Gameweek Lifecycle Test): Đổi 3 người $\rightarrow$
ightarrow$\rightarrow$ Khóa deadline $\rightarrow$
ightarrow$\rightarrow$ Tính điểm $\rightarrow$
ightarrow$\rightarrow$ Cập nhật BXH. *(Branch: `feature/P4-Q03-gameweek-integration-test`, Thư mục: `scripts/`, Files: `test_gameweek_lifecycle.py`, `seed_mock_fixtures.py`)*
