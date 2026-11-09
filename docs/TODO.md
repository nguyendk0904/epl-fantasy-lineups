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
| **Phase 1: Local Full-Stack Product** | **17 / 17** | `100%` |  Hoàn thành |
| **Phase 2: AWS Services Integration** | **13 / 13** | `100%` |  Hoàn thành |
| **Phase 3: Production Deploy & E2E Test** | **6 / 14** | `43%` | 🟡 Đang thực hiện |
| **Phase 4: Live Gamification & League Operations** | **0 / 14** | `0%` | ⚪ Chờ Phase 3 |
| **TỔNG CỘNG TOÀN DỰ ÁN** | **36 / 59** | `61%` | 🟡 Đang thực hiện |

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
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Khởi chạy `npm run dev` không lỗi, layout Navbar và Tab điều hướng hiển thị đúng theme FPL tím/xanh ngọc.
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend run build` thành công (exit code 0), truy cập `http://localhost:5173/` hiển thị đầy đủ giao diện.

- [x] **`P1-NG02`** *(Level 2)*: Xây dựng Sân bóng ảo (`VirtualPitch`) 11 chính + 4 bench
  - *Mô tả:* Component hiển thị sân cỏ trực quan với 11 vị trí thi đấu chính thức (sơ đồ 4-3-3 mặc định) và 4 vị trí bench bên dưới; hỗ trợ gắn badge Captain 'C' và Vice-Captain 'V'.
  - *Phụ thuộc:* `P1-NG01`
  - *Thư mục:* `frontend/src/components/pitch/`
  - *File tạo mới (3 files):* `frontend/src/components/pitch/VirtualPitch.tsx`, `frontend/src/components/pitch/PlayerPitchSlot.tsx`, `frontend/src/components/pitch/__tests__/VirtualPitch.test.tsx`.
  - *Branch:* `feature/P1-NG02-virtual-pitch`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Render đủ 11 vị trí chính thức + 4 bench, hỗ trợ chọn Captain 'C' và Vice-Captain 'V' không bị trùng lặp, hiệu ứng hover mượt.
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend test -- VirtualPitch.test.tsx` pass 5/5 tests (100%).

- [x] **`P1-NG03`** *(Level 2)*: Bảng danh sách & Bộ lọc cầu thủ (`PlayerTable`)
  - *Mô tả:* Bảng dữ liệu cầu thủ sử dụng TanStack Table; hỗ trợ tìm kiếm tên tức thì, lọc theo vị trí (GKP/DEF/MID/FWD), lọc theo CLB và sắp xếp theo giá / điểm số.
  - *Phụ thuộc:* `P1-NG01`
  - *Thư mục:* `frontend/src/components/player-list/`
  - *File tạo mới (3 files):* `frontend/src/components/player-list/PlayerTable.tsx`, `frontend/src/components/player-list/PlayerFilters.tsx`, `frontend/src/components/player-list/__tests__/PlayerTable.test.tsx`.
  - *Branch:* `feature/P1-NG03-player-table`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Tìm kiếm tên tức thì, lọc theo 4 vị trí, lọc theo CLB, sắp xếp theo giá và điểm, click chọn cầu thủ vào slot mục tiêu chính xác.
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend test -- PlayerTable.test.tsx` pass 7/7 tests (100%).

- [x] **`P1-NG04`** *(Level 2)*: Zustand Store quản lý Lineup & Validation FPL
  - *Mô tả:* Quản lý state 15 cầu thủ đã chọn, tự động tính tổng tiền và ngân sách còn lại; validate chặn quá 100m, chặn quá 3 người/CLB; tự lưu và tải từ `localStorage`.
  - *Phụ thuộc:* `P1-NG01`
  - *Thư mục:* `frontend/src/stores/`
  - *File tạo mới (2 files):* `frontend/src/stores/lineupStore.ts`, `frontend/src/stores/__tests__/lineupStore.test.ts`.
  - *Branch:* `feature/P1-NG04-lineup-store`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Validate ngân sách $\le$ 100m, chặn quá 3 người/CLB, đủ 15 vị trí, tự lưu và phục hồi state từ `localStorage` khi F5.
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend test -- lineupStore.test.ts` pass 8/8 tests (100%).

- [x] **`P1-NG05`** *(Level 2)*: Giao diện Optimizer Control & So sánh Lineup (Radar Chart)
  - *Mô tả:* Bảng điều khiển nút bấm Auto-Optimize (chọn ngân sách, lock cầu thủ) và màn hình so sánh 2 đội hình song song hiển thị biểu đồ Radar (Recharts) chỉ số công/thủ.
  - *Phụ thuộc:* `P1-NG02`, `P1-NG04`
  - *Thư mục:* `frontend/src/components/comparison/`, `frontend/src/components/optimizer/`
  - *File tạo mới (3 files):* `frontend/src/components/optimizer/OptimizerControl.tsx`, `frontend/src/components/comparison/LineupComparisonView.tsx`, `frontend/src/components/comparison/__tests__/LineupComparison.test.tsx`.
  - *Branch:* `feature/P1-NG05-compare-ui`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Thanh trượt ngân sách £80.0m - £105.0m, chọn sơ đồ, lock/exclude cầu thủ, so sánh 2 đội hình bằng Radar Chart 5 trục, không bao giờ tạo đội hình âm ngân sách.
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend test -- LineupComparison.test.tsx` pass 4/4 tests (100%).

---

### ⚙️ Nhất (Backend Core & FPL Sync Lead) - [4/4]

- [x] **`P1-NH01`** *(Level 2)*: Khởi tạo base FastAPI, CORS, SQLAlchemy Async
  - *Mô tả:* Dựng khung ứng dụng FastAPI, cấu hình CORS cho frontend, thiết lập file config biến môi trường Pydantic và session async kết nối PostgreSQL.
  - *Phụ thuộc:* Không (Bắt đầu ngay).
  - *Thư mục:* `backend/`
  - *File tạo mới (4 files):* `backend/requirements.txt`, `backend/app/main.py`, `backend/app/core/config.py`, `backend/app/core/database.py`.
  - *Branch:* `feature/P1-NH01-init-fastapi`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Server FastAPI khởi chạy tại port 8000, cấu hình CORS cho origin localhost:5173, Swagger UI `/docs` hoạt động, session async kết nối DB sẵn sàng.
  - *Cách kiểm chứng (Verification):* `curl http://localhost:8000/docs` trả về HTTP 200.

- [x] **`P1-NH02`** *(Level 3)*: Viết service `fpl_sync.py` kéo & Upsert dữ liệu FPL
  - *Mô tả:* Worker kéo JSON từ FPL API (`bootstrap-static`), chuẩn hóa giá chia 10 (£15.2m), map vị trí chữ (GKP/DEF/MID/FWD) và upsert dữ liệu 20 CLB, ~650 cầu thủ vào PostgreSQL.
  - *Phụ thuộc:* `P1-NH01`, `P1-V01` (Cần models DB của Vũ).
  - *Thư mục:* `backend/app/services/`
  - *File tạo mới (2 files):* `backend/app/services/fpl_sync.py`, `backend/tests/test_fpl_sync.py`.
  - *Branch:* `feature/P1-NH02-fpl-sync`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Kéo đủ 20 CLB và $\ge 600$ cầu thủ vào PostgreSQL, giá cầu thủ chia 10 chuẩn xác (15.2m), map vị trí chữ chuẩn (GKP/DEF/MID/FWD).
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_fpl_sync.py` pass 100%, kiểm tra DB `SELECT count(*) FROM players;` $\ge 600$.

- [x] **`P1-NH03`** *(Level 2)*: Xây dựng REST API `GET /api/v1/players`
  - *Mô tả:* API trả về danh sách cầu thủ có phân trang, hỗ trợ query params lọc theo vị trí, team_id, khoảng giá, tìm kiếm tên và sắp xếp theo điểm/giá.
  - *Phụ thuộc:* `P1-NH02`
  - *Thư mục:* `backend/app/api/v1/endpoints/`
  - *File tạo mới (3 files):* `backend/app/schemas/player.py`, `backend/app/api/v1/endpoints/players.py`, `backend/tests/test_players_api.py`.
  - *Branch:* `feature/P1-NH03-players-api`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* API trả về JSON đúng định dạng SSOT, hỗ trợ filter vị trí, team_id, min_cost, max_cost, search tên và sắp xếp theo điểm/giá kèm phân trang.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_players_api.py` pass 100%.

- [x] **`P1-NH04`** *(Level 1)*: Xây dựng REST API `GET /api/v1/teams`
  - *Mô tả:* API trả về danh sách 20 đội bóng Premier League kèm tên viết tắt (ARS, MCI,...), chỉ số sức mạnh tổng thể và sức mạnh công/thủ.
  - *Phụ thuộc:* `P1-NH02`
  - *Thư mục:* `backend/app/api/v1/endpoints/`
  - *File tạo mới (3 files):* `backend/app/schemas/team.py`, `backend/app/api/v1/endpoints/teams.py`, `backend/tests/test_teams_api.py`.
  - *Branch:* `feature/P1-NH04-teams-api`
  - *Kiểm thử:* 5/5 test Teams API pass; bộ kiểm thử Teams, Players, main và models: 37/37 pass trên SQLite. Chưa xác minh dữ liệu 20 CLB trên PostgreSQL thật; chưa chạy lint vì môi trường chưa có công cụ.
  - *Tiêu chí chấp nhận (Acceptance Criteria):* API trả về đúng 20 CLB Ngoại hạng Anh kèm short_name, strength chỉ số công/thủ.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_teams_api.py` pass 100%.

---

### 🧠 Vũ (Data & Algorithm Engineer) - [4/4]

- [x] **`P1-V01`** *(Level 3)*: Thiết kế Schema PostgreSQL & Alembic Migration
  - *Mô tả:* Khai báo SQLAlchemy ORM models cho bảng `teams`, `players` (kèm indexes vị trí, giá, điểm) và thiết lập file migration đầu tiên bằng Alembic.
  - *Phụ thuộc:* `P1-NH01`
  - *Thư mục:* `backend/app/models/`, `backend/alembic/`
  - *File tạo mới (4 files):* `backend/app/models/team.py`, `backend/app/models/player.py`, `backend/alembic/env.py`, `backend/alembic/versions/001_initial_schema.py`.
  - *Branch:* `feature/P1-V01-db-schema`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Models ORM chuẩn SQLAlchemy 2.0 async, indexes trên các cột tìm kiếm thường xuyên, script Alembic migration chạy mượt mà.
  - *Cách kiểm chứng (Verification):* `alembic upgrade head` áp dụng thành công tạo đủ bảng trong PostgreSQL.

- [x] **`P1-V02`** *(Level 3)*: Module Thuật toán `optimizer_solver.py` bằng `PuLP`
  - *Mô tả:* Mô hình hóa và giải bài toán quy hoạch tuyến tính nguyên 0-1 (0-1 ILP) chọn 15 cầu thủ tối đa hóa điểm kỳ vọng trong ngân sách 100m, max 3/team, hỗ trợ khóa cầu thủ (locked players).
  - *Phụ thuộc:* Không (Chạy pure Python độc lập với mock data ngay Ngày 1).
  - *Thư mục:* `backend/app/services/`
  - *File tạo mới (2 files):* `backend/app/services/optimizer_solver.py`, `backend/tests/test_optimizer.py`.
  - *Branch:* `feature/P1-V02-pulp-optimizer`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Giải ra nghiệm tối ưu điểm xP trong ngân sách $\le$ 100m, không quá 3 người/CLB, đủ 2 GKP, 5 DEF, 5 MID, 3 FWD; thời gian giải < 100ms.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_optimizer.py` pass 100%.

- [x] **`P1-V03`** *(Level 3)*: Xây dựng REST API `POST /api/v1/optimizer/solve`
  - *Mô tả:* Endpoint nhận payload (ngân sách, locked_player_ids, excluded_player_ids, sơ đồ mong muốn), query danh sách cầu thủ từ DB và gọi `PuLP solver` trả về đội hình 15 người.
  - *Phụ thuộc:* `P1-V02`, `P1-NH01`
  - *Thư mục:* `backend/app/api/v1/endpoints/`
  - *File tạo mới (3 files):* `backend/app/schemas/optimizer.py`, `backend/app/api/v1/endpoints/optimizer.py`, `backend/tests/test_optimizer_api.py`.
  - *Branch:* `feature/P1-V03-optimizer-api`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Nhận payload JSON hợp lệ, gọi solver PuLP và trả về đội hình 15 người (Starting XI + Bench) kèm captain; xử lý an toàn ca vô nghiệm (status: infeasible).
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_optimizer_api.py` pass 100%.

- [x] **`P1-V04`** *(Level 2)*: Xây dựng REST API `POST /api/v1/lineups/compare`
  - *Mô tả:* Endpoint nhận vào 2 danh sách ID đội hình A và B, tính toán mức chênh lệch ngân sách, chênh lệch điểm xP, chỉ số sức mạnh từng tuyến và danh sách cầu thủ khác biệt.
  - *Phụ thuộc:* `P1-NH01`
  - *Thư mục:* `backend/app/api/v1/endpoints/`
  - *File tạo mới (3 files):* `backend/app/schemas/lineup.py`, `backend/app/api/v1/endpoints/lineups.py`, `backend/tests/test_compare_api.py`.
  - *Branch:* `feature/P1-V04-compare-api`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Tính toán chính xác delta cost, delta xP, chỉ số sức mạnh 5 chiều (Attack, Defense, xP, Form, Value) và danh sách cầu thủ khác biệt giữa 2 đội hình.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_compare_api.py` pass 100%.

---

### 🐳 Quang (DevOps & AWS Lead) - [4/4]

- [x] **`P1-Q01`** *(Level 2)*: Viết `backend/Dockerfile` và `frontend/Dockerfile`
  - *Mô tả:* Đóng gói Docker đa tầng (multi-stage build) cho Backend (Python 3.11-slim kèm coinor-cbc solver) và Frontend (Vite build sang Nginx alpine phục vụ static file).
  - *Phụ thuộc:* `P1-NG01`, `P1-NH01` (Cần package.json và requirements.txt).
  - *Thư mục:* `backend/`, `frontend/`, root
  - *File tạo mới (3 files):* `backend/Dockerfile`, `frontend/Dockerfile`, `.dockerignore`.
  - *Branch:* `feature/P1-Q01-dockerfile`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Multi-stage build tối ưu kích thước image (< 200MB cho frontend, < 350MB cho backend), không chứa file thừa hay cache.
  - *Cách kiểm chứng (Verification):* `docker build -t test-fe frontend/` và `docker build -t test-be backend/` thành công.

- [x] **`P1-Q02`** *(Level 2)*: Xây dựng `infra/docker-compose.yml` chạy Local Full-Stack
  - *Mô tả:* File compose kết nối 3 container: PostgreSQL 15, FastAPI (port 8000), Vite React (port 5173); cấu hình volume lưu data DB và healthcheck đảm bảo thứ tự khởi động.
  - *Phụ thuộc:* `P1-Q01`
  - *Thư mục:* `infra/`
  - *File tạo mới (2 files):* `infra/docker-compose.yml`, `infra/init.sql`.
  - *Branch:* `feature/P1-Q02-docker-compose`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Chạy `docker compose up` khởi động đồng bộ 3 container postgres, backend, frontend; có healthcheck và persist data qua volume.
  - *Cách kiểm chứng (Verification):* `docker compose ps` hiển thị cả 3 service ở trạng thái `running` hoặc `healthy`.

- [x] **`P1-Q03`** *(Level 2)*: Viết kịch bản Kiểm thử Tích hợp Local (Integration Test)
  - *Mô tả:* Script tự động gửi request kiểm tra tính thông suốt của toàn bộ hệ thống: Frontend gọi Backend $\rightarrow$ Backend query Postgres $\rightarrow$ PuLP solver trả kết quả.
  - *Phụ thuộc:* `P1-Q02`, `P1-NH03`, `P1-V03`
  - *Thư mục:* `scripts/`
  - *File tạo mới (2 files):* `scripts/test_local_integration.sh` (hoặc `.ps1`), `scripts/seed_demo_data.py`.
  - *Branch:* `feature/P1-Q03-local-integration-test`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Script tự động kiểm tra kết nối API, tính toàn vẹn CSDL, gọi thử optimizer solver và trả về exit code 0 khi tất cả đều thông suốt.
  - *Cách kiểm chứng (Verification):* Chạy `scripts/test_local_integration.sh` (hoặc `.ps1`) báo cáo `All 5 integration checks passed`.

- [x] **`P1-Q04`** *(Level 1)*: Viết tài liệu `LOCAL_SETUP_GUIDE.md`
  - *Mô tả:* Hướng dẫn chi tiết bằng markdown cho 3 bạn còn lại clone repo về, cài đặt Docker Desktop và gõ 1 lệnh `docker compose up` là toàn bộ app chạy mượt mà.
  - *Phụ thuộc:* `P1-Q02`
  - *Thư mục:* Root
  - *File tạo mới (1 file):* `LOCAL_SETUP_GUIDE.md`.
  - *Branch:* `feature/P1-Q04-setup-guide`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Tài liệu hướng dẫn rõ ràng từng bước từ clone repo, cấu hình file .env mẫu, lệnh chạy Docker Compose đến các cổng truy cập.
  - *Cách kiểm chứng (Verification):* Thành viên khác đọc tài liệu và cài đặt thành công trên máy mới trong 5 phút.

---

## ☁️ PHASE 2: TÍCH HỢP SỬ DỤNG CÁC DỊCH VỤ CỦA AWS (9/14)
*Mục tiêu: Đưa CSDL lên Amazon RDS, lưu trữ static web trên S3, tối ưu Connection Pool cho db.t4g.micro, bổ sung độ khó trận đấu FDR và kích hoạt AWS Budgets Alert ($1.00) bảo vệ tài khoản của Quang.*

### 🎨 Nguyên (Frontend & UI Lead) - [3/3]

- [x] **`P2-NG01`** *(Level 2)*: Tích hợp tính năng tạo Share Link đội hình qua Cloud API
  - *Mô tả:* Bổ sung nút "Chia sẻ đội hình" trên Navbar/Pitch; khi bấm gọi API `POST /api/v1/lineups/share` lưu snapshot 15 cầu thủ lên Cloud DB và nhận lại short-code; hiển thị modal copy link và QR code.
  - *Phụ thuộc:* `P1-NG04`, `P2-NH02`
  - *Thư mục:* `frontend/src/components/share/`, `frontend/src/hooks/`
  - *File tạo mới (3 files):* `frontend/src/components/share/ShareModal.tsx`, `frontend/src/hooks/useShareLineup.ts`, `frontend/src/components/share/__tests__/ShareModal.test.tsx`.
  - *Branch:* `feature/P2-NG01-share-lineup`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Nút Share gọi API lưu snapshot thành công, modal hiển thị link rút gọn `domain/share/{code}`, nút copy link hoạt động với tooltip phản hồi.
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend test -- ShareModal.test.tsx` pass 100%.

- [x] **`P2-NG02`** *(Level 2)*: Màn hình xem đội hình qua link chia sẻ (`/share/:code`) - Chế độ Read-only
  - *Mô tả:* Trang công khai cho người khác xem đội hình qua link (chế độ Read-only); gọi API `GET /api/v1/lineups/share/:code`, hiển thị VirtualPitch với badge C/V và tổng điểm/giá, nút "Sao chép đội hình này vào máy tôi".
  - *Phụ thuộc:* `P2-NG01`, `P2-NH02`
  - *Thư mục:* `frontend/src/pages/`, `frontend/src/components/share/`
  - *File tạo mới (3 files):* `frontend/src/pages/SharedLineupPage.tsx`, `frontend/src/components/share/SharedPitchView.tsx`, `frontend/src/pages/__tests__/SharedLineupPage.test.tsx`.
  - *Branch:* `feature/P2-NG02-view-shared-lineup`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Truy cập route `/share/:code` render đúng 15 cầu thủ ở chế độ chỉ xem, nút sao chép nạp toàn bộ cầu thủ vào `lineupStore` cá nhân.
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend test -- SharedLineupPage.test.tsx` pass 100%.

- [x] **`P2-NG03`** *(Level 1)*: Cấu hình file môi trường `.env.production` & API Client Cloud
  - *Mô tả:* Thiết lập file `.env.production` trỏ `VITE_API_BASE_URL` về domain AWS Backend; đóng gói Fetch/Axios client tự động switch baseURL theo `import.meta.env.MODE`.
  - *Phụ thuộc:* `P1-NG01`
  - *Thư mục:* `frontend/`, `frontend/src/services/`
  - *File tạo mới (3 files):* `frontend/.env.production`, `frontend/src/services/apiClient.ts`, `frontend/src/services/__tests__/apiClient.test.ts`.
  - *Branch:* `feature/P2-NG03-frontend-env-prod`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Client tự động trỏ về localhost:8000 khi dev và trỏ về domain Cloud khi build production.
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend test -- apiClient.test.ts` pass 100%.

---

### ⚙️ Nhất (Backend Core & FPL Sync Lead) - [3/3] (NH02/NH03 xong triển khai, chờ nghiệm thu RDS/cloud)

- [x] **`P2-NH01`** *(Level 3)*: Chuyển chuỗi kết nối Database sang Amazon RDS PostgreSQL
  - *Mô tả:* Cập nhật cấu hình kết nối DB hỗ trợ kết nối an toàn tới AWS RDS qua biến môi trường (`RDS_HOSTNAME`, `RDS_DB_NAME`, `RDS_USERNAME`, `RDS_PASSWORD`); cơ chế fallback tự động về Postgres local khi dev offline.
  - *Phụ thuộc:* `P1-NH01`, `P2-Q01`
  - *Thư mục:* `backend/app/core/`, `backend/tests/`
  - *File tạo mới (2 files):* `backend/app/core/rds_config.py`, `backend/tests/test_rds_connection.py`.
  - *Branch:* `feature/P2-NH01-rds-connection`
  - *Bằng chứng NH cung cấp ngày 2026-11-04:* `29 passed, 19 warnings in 2.47s`, gồm test `SELECT 1` trên RDS thật, không skip. Hồi quy do AI chạy trước đó: 90 passed, 3 skipped (live RDS chưa bật và hai test PostgreSQL của FPL sync).
  - *Fallback:* Dev không cấu hình RDS dùng `DATABASE_URL` local; cấu hình RDS thiếu một phần hoặc kết nối lỗi được báo lỗi, không tự chuyển database. Production yêu cầu database remote có TLS.
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Kết nối thành công tới RDS PostgreSQL trên AWS khi có biến môi trường, tự fallback về Postgres local khi chạy offline.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_rds_connection.py` pass 100%.

- [x] **`P2-NH02`** *(Level 2)*: REST API `POST /api/v1/lineups/share` & `GET /api/v1/lineups/share/:code`
  - *Trạng thái theo xác nhận của NH:* Hoàn thành phần code và test local; **CHỜ NGHIỆM THU lưu/đọc trên PostgreSQL/RDS thật**, chưa xác nhận hoàn thành nghiệm thu cloud.
  - *Bằng chứng:* NH02: 26 passed, 1 skipped; bộ hồi quy đã chạy: 125 passed, 4 skipped. Test PostgreSQL riêng của NH02 skip do chưa cấu hình `SHARE_TEST_DATABASE_URL`.
  - *Mô tả:* Endpoint lưu snapshot đội hình (15 cầu thủ, formation, captain) sinh mã short-code ngẫu nhiên (6 ký tự base62) lưu vào bảng `shared_lineups` trên RDS, và endpoint truy vấn snapshot theo mã code.
  - *Phụ thuộc:* `P2-NH01`, `P2-V01`
  - *Thư mục:* `backend/app/schemas/`, `backend/app/api/v1/endpoints/`, `backend/tests/`
  - *File tạo mới (3 files):* `backend/app/schemas/share.py`, `backend/app/api/v1/endpoints/lineup_share.py`, `backend/tests/test_share_api.py`.
  - *Branch:* `feature/P2-NH02-shared-lineups-api`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* `POST /share` sinh mã short-code 6 ký tự duy nhất; `GET /share/:code` trả về đúng snapshot đội hình; trả về 404 nếu mã không tồn tại.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_share_api.py` pass 100%.

- [x] **`P2-NH03`** *(Level 3)*: Cron job / Background worker định kỳ chạy FPL sync trên Cloud
  - *Trạng thái theo xác nhận của NH:* Xong code/test local; **CHỜ NGHIỆM THU sync trên RDS thật và vận hành worker trên cloud**.
  - *Bằng chứng:* NH03: 30/30 pass; bộ hồi quy đã chạy: 155 passed, 4 skipped (các test PostgreSQL/RDS chưa cấu hình).
  - *Vận hành:* API mặc định `FPL_SYNC_ENABLED=false`; chỉ bật một worker duy nhất (chạy riêng hoặc nhúng API). Kiểm tra ngay khi chạy rồi mỗi 21600 giây; trạng thái Gameweek trong bộ nhớ, khởi động lại sẽ sync một lần.
  - *Mô tả:* Service scheduler (APScheduler / asyncio task) định kỳ kích hoạt `fpl_sync.py` kiểm tra và kéo dữ liệu mới từ FPL API mỗi khi có Gameweek mới mà không cần trigger thủ công.
  - *Phụ thuộc:* `P1-NH02`, `P2-NH01`
  - *Thư mục:* `backend/app/services/`, `backend/tests/`
  - *File tạo mới (2 files):* `backend/app/services/cron_scheduler.py`, `backend/tests/test_cron_scheduler.py`.
  - *Branch:* `feature/P2-NH03-cloud-sync-cron`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Scheduler chạy nền định kỳ mỗi 6 tiếng kiểm tra Gameweek mới, tự động chạy sync không làm block luồng API chính.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_cron_scheduler.py` pass 100%.

---

### 🧠 Vũ (Data & Algorithm Engineer) - [3/3]

- [x] **`P2-V01`** *(Level 3)*: Chạy script migration toàn bộ Schema lên Amazon RDS PostgreSQL
  - *Mô tả:* Khai báo model ORM cho bảng `shared_lineups`, tạo Alembic migration và thực thi migrate đồng bộ toàn bộ schema (`teams`, `players`, `shared_lineups`) lên Amazon RDS của Quang kèm đầy đủ indexes.
  - *Phụ thuộc:* `P1-V01`, `P2-Q01`
  - *Thư mục:* `backend/app/models/`, `backend/alembic/versions/`, `backend/tests/`
  - *File tạo mới (3 files):* `backend/app/models/shared_lineup.py`, `backend/alembic/versions/002_add_shared_lineups.py`, `backend/tests/test_shared_lineup_model.py`.
  - *Branch:* `feature/P2-V01-rds-migration`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Toàn bộ các bảng và index được tạo đầy đủ trên RDS PostgreSQL của Quang, dữ liệu khóa ngoại và indexes hoạt động chuẩn xác.
  - *Cách kiểm chứng (Verification):* Chạy `alembic upgrade head` trỏ vào RDS thành công; `pytest backend/tests/test_shared_lineup_model.py` pass 100%.

- [x] **`P2-V02`** *(Level 3)*: Tinh chỉnh Connection Pool tối ưu riêng cho instance `db.t4g.micro`
  - *Mô tả:* Cấu hình SQLAlchemy pool settings (`pool_size=5`, `max_overflow=10`, `pool_timeout=30`, `pool_recycle=1800`) phù hợp với giới hạn 1GB RAM của `db.t4g.micro` để không bị cạn kiệt RAM/connection.
  - *Phụ thuộc:* `P2-NH01`, `P2-V01`
  - *Thư mục:* `backend/app/core/`, `backend/tests/`
  - *File tạo mới (2 files):* `backend/app/core/pool_manager.py`, `backend/tests/test_pool_limits.py`.
  - *Branch:* `feature/P2-V02-db-pool-tuning`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Không bị tràn RAM hoặc lỗi Connection Exhaustion khi có 20 kết nối đồng thời trên instance `db.t4g.micro`.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_pool_limits.py` pass 100%.

- [x] **`P2-V03`** *(Level 2)*: Bổ sung trọng số độ khó trận đấu (FDR) vào công thức tính điểm (xP)
  - *Mô tả:* Thu thập chỉ số Fixture Difficulty Rating (FDR 1-5); cập nhật hàm tính điểm dự kiến trong `optimizer_solver.py`: ưu tiên chọn cầu thủ gặp đối thủ dễ (FDR 2) và giảm xP khi gặp đối thủ khó (FDR 4-5).
  - *Phụ thuộc:* `P1-V02`
  - *Thư mục:* `backend/app/services/`, `backend/tests/`
  - *File tạo mới (2 files):* `backend/app/services/fdr_service.py`, `backend/tests/test_fdr_optimizer.py`.
  - *Branch:* `feature/P2-V03-fdr-weighting`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Điểm xP tính toán có tính đến hệ số FDR: cầu thủ gặp đội FDR 2 được nhân hệ số 1.15x, gặp đội FDR 5 bị nhân hệ số 0.8x.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_fdr_optimizer.py` pass 100%.

---

### 🐳 Quang (DevOps & AWS Lead) - [4/4]

- [x] **`P2-Q01`** *(Level 4)*: Khởi tạo instance Amazon RDS PostgreSQL (`db.t4g.micro`, 20GB gp3)
  - *Mô tả:* Khởi tạo instance Amazon RDS PostgreSQL 15 (`db.t4g.micro`, Single-AZ, 20GB gp3 storage - Free Tier) trên tài khoản AWS của Quang; lưu tài liệu thông số kết nối an toàn.
  - *Phụ thuộc:* Không (Bắt đầu ngay khi vào Phase 2).
  - *Thư mục:* `infra/aws/`
  - *File tạo mới (2 files):* `infra/aws/rds_setup.md`, `infra/aws/terraform_rds.tf`.
  - *Branch:* `feature/P2-Q01-aws-rds-init`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Instance RDS PostgreSQL 15 khởi tạo thành công ở trạng thái `Available`, nằm trọn trong hạn mức AWS Free Tier.
  - *Cách kiểm chứng (Verification):* Kiểm tra AWS Management Console trạng thái RDS `Available`, kiểm tra kết nối bằng `psql`.

- [x] **`P2-Q02`** *(Level 4)*: Cấu hình Security Group an toàn cho RDS
  - *Mô tả:* Thiết lập Inbound/Outbound Rules cho Security Group: Chỉ cho phép port 5432 từ Security Group của Backend hoặc IP cố định của nhóm dev, tuyệt đối không mở public `0.0.0.0/0`.
  - *Phụ thuộc:* `P2-Q01`
  - *Thư mục:* `infra/aws/`
  - *File tạo mới (2 files):* `infra/aws/security_groups.md`, `infra/aws/rds_sg_policy.json`.
  - *Branch:* `feature/P2-Q02-rds-security-group`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Port 5432 chỉ mở cho IP dev và backend; kết nối từ IP lạ bên ngoài bị từ chối truy cập ngay lập tức.
  - *Cách kiểm chứng (Verification):* Quét port từ IP ngoài mạng bị chặn kết nối (Connection timed out).

- [x] **`P2-Q03`** *(Level 4)*: **BẮT BUỘC:** Kích hoạt AWS Budgets Alert mức $1.00 bảo vệ tài khoản
  - *Mô tả:* Tạo cảnh báo ngân sách AWS Budgets với ngưỡng $1.00; cấu hình SNS topic tự động gửi email cảnh báo về hòm thư nhóm ngay khi chi phí vượt 80% ($0.80) hoặc 100% ($1.00).
  - *Phụ thuộc:* Không (Bắt đầu ngay).
  - *Thư mục:* `infra/aws/`
  - *File tạo mới (2 files):* `infra/aws/budget_alert_setup.md`, `infra/aws/budget_policy.json`.
  - *Branch:* `feature/P2-Q03-aws-budget-guard`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Budget Alert kích hoạt thành công trên AWS Budgets ở mức $1.00; nhận email xác nhận subscription từ AWS SNS.
  - *Cách kiểm chứng (Verification):* Email xác nhận đăng ký cảnh báo từ AWS Notification được nhận trong hòm thư của Quang.

- [x] **`P2-Q04`** *(Level 3)*: Khởi tạo AWS S3 Bucket cấu hình static hosting
  - *Mô tả:* Tạo bucket S3 trên AWS region ap-southeast-1, bật tính năng Static Website Hosting, cấu hình index.html/error.html và thiết lập S3 Bucket Policy cho phép CloudFront truy cập.
  - *Phụ thuộc:* Không.
  - *Thư mục:* `infra/aws/`
  - *File tạo mới (2 files):* `infra/aws/s3_setup.md`, `infra/aws/s3_bucket_policy.json`.
  - *Branch:* `feature/P2-Q04-s3-bucket-setup`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Bucket S3 được tạo ở region ap-southeast-1, cấu hình quyền truy cập qua CloudFront Origin Access Control.
  - *Cách kiểm chứng (Verification):* Upload thử file `index.html` và kiểm tra phản hồi HTTP 200 qua S3 API.
  - *Ghi chú triển khai (02/11/2026):* Static Website Hosting **cố ý để OFF** (OAC không hỗ trợ website endpoint); bucket private 100% (`BlockPublicAccess` 4/4) + OAC `E2IX1YDEAHD87E`, kiểm chứng `HTTP 200` bằng S3 API có chữ ký SigV4, truy cập nặc danh `403`. **P3-Q01** phải gắn OAC vào distribution và siết policy `AWS:SourceAccount` → `AWS:SourceArn` (chi tiết: `infra/aws/s3_setup.md` §13.2).

---

## 🌐 PHASE 3: DEPLOY & TEST ĐẦU CUỐI (END-TO-END) (3/14)
*Mục tiêu: Đưa toàn bộ sản phẩm lên Internet qua CloudFront HTTPS và AWS App Runner, xây dựng CI/CD tự động qua GitHub Actions, kiểm thử tải và chuẩn bị demo đồ án với chi phí $0.00.*

### 🎨 Nguyên (Frontend & UI Lead) - [3/3]

- [x] **`P3-NG01`** *(Level 2)*: Tối ưu hiệu năng: Code splitting, Lazy loading, giảm bundle < 500KB
  - *Mô tả:* Áp dụng `React.lazy()` và `Suspense` cho các tab (Optimizer, Compare, Pitch); cấu hình `manualChunks` trong `vite.config.ts` chia nhỏ Recharts và Lucide Icons để bundle size < 500KB.
  - *Phụ thuộc:* `P1-NG05`, `P2-NG03`
  - *Thư mục:* `frontend/`, `frontend/src/components/common/`
  - *File tạo mới (2 files):* `frontend/src/components/common/LoadingSpinner.tsx`, `frontend/src/components/common/ErrorBoundary.tsx`.
  - *Branch:* `feature/P3-NG01-perf-optimization`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Không có chunk nào lớn hơn 500KB sau khi minification, Lighthouse Performance đạt $\ge 90$ điểm.
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend run build` kiểm tra kích thước chunk; chạy Lighthouse audit trên Chrome DevTools.
  - *Ghi chú triển khai (09/11/2026):* Phân tách manualChunks (`vendor-recharts`, `vendor-react`, `vendor-tanstack`, `vendor-lucide`, `vendor-utils`), lazy load 5 dynamic components (`OptimizerControl`, `LineupComparisonView`, `FixturesPanel`, `ShareModal`, `SharedLineupPage`) bọc trong `ErrorBoundary` + `LoadingSpinner`. Tất cả chunk < 360KB (index.js = 70.5KB, vendor-recharts = 353.5KB). 61/61 tests pass 100%.

- [x] **`P3-NG02`** *(Level 2)*: Hoàn thiện trải nghiệm responsive trên Mobile & Tablet
  - *Mô tả:* Điều chỉnh giao diện trên màn hình nhỏ (< 768px): Tự động co giãn VirtualPitch bằng CSS scale / touch pan, drawer trượt danh sách cầu thủ cho Mobile, tối ưu bố cục so sánh 2 đội hình.
  - *Phụ thuộc:* `P1-NG02`, `P1-NG03`
  - *Thư mục:* `frontend/src/components/pitch/`, `frontend/src/components/player-list/`
  - *File tạo mới (2 files):* `frontend/src/components/pitch/MobilePitchControls.tsx`, `frontend/src/components/player-list/MobilePlayerDrawer.tsx`.
  - *Branch:* `feature/P3-NG02-mobile-responsive`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Giao diện hiển thị trơn tru trên màn hình điện thoại (375px - 430px) và tablet (768px), không xuất hiện thanh cuộn ngang vỡ khung.
  - *Cách kiểm chứng (Verification):* Kiểm thử giao diện qua Chrome DevTools Mobile Emulation (iPhone 14, Pixel 7, iPad Mini).
  - *Ghi chú triển khai (09/11/2026):* Tạo `MobilePitchControls.tsx` (quick formation chips, stats, action pills) và `MobilePlayerDrawer.tsx` (bottom-sheet drawer chọn cầu thủ với search, target slot sync, club limits). Tối ưu kích thước thẻ cầu thủ responsive trên mobile (`w-[62px] min-[390px]:w-[70px] min-[440px]:w-20 sm:w-24`), chạm tap để chọn Captain/Vice-Captain. Tối ưu bố cục `LineupComparisonView` trên mobile. 69/69 tests pass 100%.

- [x] **`P3-NG03`** *(Level 1)*: Thực hiện User Acceptance Testing (UAT) & Hoàn thiện UI states
  - *Mô tả:* Kiểm thử giao diện người dùng trên 3 trình duyệt (Chrome, Safari, Edge): Bổ sung skeleton loader khi fetch dữ liệu, thông báo Toast chuyên nghiệp, xử lý mất mạng offline và banner thông báo.
  - *Phụ thuộc:* `P3-NG01`, `P3-NG02`
  - *Thư mục:* `frontend/src/components/common/`
  - *File tạo mới (2 files):* `frontend/src/components/common/SkeletonLoader.tsx`, `frontend/src/components/common/OfflineBanner.tsx`.
  - *Branch:* `feature/P3-NG03-uat-testing`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Đầy đủ trạng thái loading skeleton, không có lỗi console rác, hiển thị banner cảnh báo khi mất kết nối mạng.
  - *Cách kiểm chứng (Verification):* Test offline mode trên trình duyệt kiểm tra hiển thị `OfflineBanner`.
  - *Ghi chú triển khai (09/11/2026):* Tạo `SkeletonLoader.tsx` (hỗ trợ các biến thể pitch-slot, player-row, card, stat-widget, text) và `OfflineBanner.tsx` (tự động phát hiện mạng online/offline qua window events, nút kiểm tra lại và thông báo khôi phục). Tích hợp vào `App.tsx`. 77/77 tests pass 100%.

---

### ⚙️ Nhất (Backend Core & FPL Sync Lead) - [0/3]

- [ ] **`P3-NH01`** *(Level 2)*: Cấu hình Structured Logging và tích hợp đẩy log lên AWS CloudWatch
  - *Mô tả:* Cấu hình `logging` xuất log định dạng JSON chuẩn; tích hợp `watchtower` gửi log lỗi hệ thống và API latency lên AWS CloudWatch Log Groups để giám sát production.
  - *Phụ thuộc:* `P2-NH01`
  - *Thư mục:* `backend/app/core/`, `backend/tests/`
  - *File tạo mới (2 files):* `backend/app/core/logging_config.py`, `backend/tests/test_logging.py`.
  - *Branch:* `feature/P3-NH01-cloudwatch-logging`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Mỗi request ghi nhận JSON log có timestamp, HTTP method, path, response status và latency; log lỗi tự động đẩy lên CloudWatch.
  - *Cách kiểm chứng (Verification):* Gửi request lỗi và kiểm tra log xuất hiện trên AWS CloudWatch Console.

- [ ] **`P3-NH02`** *(Level 2)*: Tích hợp Rate Limiting (FastAPI-Limiter) ngăn chặn spam request
  - *Mô tả:* Tích hợp middleware giới hạn tần suất gọi API (tối đa 60 requests/phút cho `/players`, 10 requests/phút cho `/optimizer/solve`) bằng SlowAPI / FastAPI-Limiter bảo vệ backend không bị quá tải.
  - *Phụ thuộc:* `P1-NH03`, `P1-V03`
  - *Thư mục:* `backend/app/core/`, `backend/tests/`
  - *File tạo mới (2 files):* `backend/app/core/rate_limiter.py`, `backend/tests/test_rate_limiter.py`.
  - *Branch:* `feature/P3-NH02-api-rate-limit`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Trả về HTTP status 429 Too Many Requests khi gọi quá hạn mức cho phép; reset hạn mức sau 60 giây.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_rate_limiter.py` pass 100%.

- [ ] **`P3-NH03`** *(Level 2)*: Viết bộ kịch bản kiểm thử API đầu cuối (End-to-End API Test Suite)
  - *Mô tả:* Bộ kiểm thử tích hợp tự động bằng Pytest bao quát toàn bộ REST APIs (`/players`, `/teams`, `/optimizer/solve`, `/lineups/compare`, `/lineups/share`), kiểm tra mã HTTP 200, 400, 404, 422 và tính nhất quán dữ liệu.
  - *Phụ thuộc:* `P1-NH03`, `P1-NH04`, `P1-V03`, `P1-V04`, `P2-NH02`
  - *Thư mục:* `backend/tests/`
  - *File tạo mới (2 files):* `backend/tests/test_e2e_api_suite.py`, `backend/tests/conftest.py`.
  - *Branch:* `feature/P3-NH03-e2e-api-tests`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Bộ test case bao quát 100% các endpoint của hệ thống, kiểm thử thành công các ca biên, ca hợp lệ và ca lỗi nghiệp vụ.
  - *Cách kiểm chứng (Verification):* Chạy `pytest backend/tests/test_e2e_api_suite.py` pass 100%.

---

### 🧠 Vũ (Data & Algorithm Engineer) - [0/3]

- [ ] **`P3-V01`** *(Level 3)*: Stress test thuật toán Optimizer dưới tải đồng thời
  - *Mô tả:* Viết kịch bản Locust hoặc script Python benchmark giả lập 20-50 request giải quy hoạch tuyến tính đồng thời; đo đạc RAM/CPU và tinh chỉnh thời gian giải của PuLP solver duy trì < 200ms.
  - *Phụ thuộc:* `P1-V02`, `P1-V03`
  - *Thư mục:* `backend/tests/`
  - *File tạo mới (2 files):* `backend/tests/benchmark_optimizer.py`, `backend/tests/locustfile.py`.
  - *Branch:* `feature/P3-V01-optimizer-stress-test`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Solver chịu tải 30 request giải đồng thời với độ trễ p95 < 200ms, không làm tràn bộ nhớ của tiến trình.
  - *Cách kiểm chứng (Verification):* Chạy `python backend/tests/benchmark_optimizer.py` xác nhận latency p95 < 200ms.

- [ ] **`P3-V02`** *(Level 3)*: Xây dựng cơ chế Cache kết quả Optimizer
  - *Mô tả:* Xây dựng cơ chế cache LRU hoặc In-Memory Cache dựa trên hash payload `(budget, formation, locked_ids, excluded_ids)`: các request lặp lại trả kết quả ngay trong 5ms mà không cần chạy lại solver.
  - *Phụ thuộc:* `P1-V02`, `P3-V01`
  - *Thư mục:* `backend/app/services/`, `backend/tests/`
  - *File tạo mới (2 files):* `backend/app/services/optimizer_cache.py`, `backend/tests/test_optimizer_cache.py`.
  - *Branch:* `feature/P3-V02-optimizer-cache`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Request có cùng cấu hình input trả về kết quả từ Cache trong < 5ms thay vì giải lại bằng solver.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_optimizer_cache.py` pass 100%.

- [ ] **`P3-V03`** *(Level 1)*: Chuẩn bị bộ dữ liệu mẫu (Sample Data) và kịch bản demo đồ án
  - *Mô tả:* Chuẩn bị 3 kịch bản demo so sánh đội hình ấn tượng cho buổi nghiệm thu (Đội hình Tối ưu siêu sao vs Đội hình Cân bằng tiềm năng), tạo file seed dữ liệu và slide tóm tắt kết quả phân tích.
  - *Phụ thuộc:* `P1-V04`, `P2-V03`
  - *Thư mục:* `scripts/`, `docs/`
  - *File tạo mới (2 files):* `scripts/seed_demo_scenarios.py`, `docs/DEMO_SCENARIOS.md`.
  - *Branch:* `feature/P3-V03-demo-data-prep`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* 3 kịch bản demo chạy trơn tru, số liệu chênh lệch điểm xP và radar chart thể hiện rõ giá trị của giải thuật tối ưu.
  - *Cách kiểm chứng (Verification):* Chạy `python scripts/seed_demo_scenarios.py` nạp kịch bản demo và kiểm tra giao diện hiển thị đúng kịch bản.

---

### 🐳 Quang (DevOps & AWS Lead) - [3/4]

- [x] **`P3-Q01`** *(Level 4)*: Triển khai Frontend lên AWS S3 + AWS CloudFront (SSL HTTPS, CDN)
  - *Mô tả:* Cấu hình phân phối CDN qua AWS CloudFront trỏ về origin S3 static website; cấu hình SSL/TLS miễn phí qua AWS Certificate Manager (ACM), custom error response 404 $\rightarrow$ /index.html cho SPA routing.
  - *Phụ thuộc:* `P2-Q04`
  - *Thư mục:* `infra/aws/`
  - *File tạo mới (2 files):* `infra/aws/cloudfront_setup.md`, `infra/aws/cloudfront_distribution.json`.
  - *Branch:* `feature/P3-Q01-s3-cloudfront-deploy`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Website truy cập công khai qua domain HTTPS của CloudFront, định tuyến SPA hoạt động (F5 trang không bị lỗi 404).
  - *Cách kiểm chứng (Verification):* Truy cập `https://xxxx.cloudfront.net` trên trình duyệt tải trang thành công, chứng chỉ SSL hợp lệ.

- [x] **`P3-Q02`** *(Level 4)*: Đóng gói và triển khai Backend FastAPI lên AWS App Runner
  - *Mô tả:* Triển khai container Backend FastAPI lên AWS App Runner (hoặc EC2 t4g.small Free Tier); cấu hình biến môi trường kết nối RDS an toàn, healthcheck endpoint `/health` và auto deployment.
  - *Phụ thuộc:* `P1-Q01`, `P2-Q01`, `P2-Q02`
  - *Thư mục:* `infra/aws/`
  - *File tạo mới (2 files):* `infra/aws/app_runner_setup.md`, `infra/aws/apprunner.yaml`.
  - *Branch:* `feature/P3-Q02-backend-aws-deploy`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Backend FastAPI online 24/7 trên AWS, kết nối thông suốt với RDS, endpoint `/health` trả về status 200.
  - *Cách kiểm chứng (Verification):* `curl https://xxxx.awsapprunner.com/health` trả về HTTP 200 `{"status": "healthy"}`.

- [x] **`P3-Q03`** *(Level 4)*: Xây dựng pipeline GitHub Actions CI/CD tự động
  - *Mô tả:* Viết workflow `.github/workflows/deploy.yml`: Mỗi khi commit/PR merge vào nhánh `main` $\rightarrow$ Tự động Lint & Test Frontend + Backend $\rightarrow$ Build Vite deploy lên S3 & invalidate CloudFront cache $\rightarrow$ Deploy Backend lên App Runner.
  - *Phụ thuộc:* `P3-Q01`, `P3-Q02`
  - *Thư mục:* `.github/workflows/`
  - *File tạo mới (2 files):* `.github/workflows/ci_cd.yml`, `.github/workflows/test_backend.yml`.
  - *Branch:* `feature/P3-Q03-github-actions-cicd`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Khi merge PR vào `main`, pipeline GitHub Actions tự động kích hoạt, chạy test và deploy thành công lên AWS mà không cần thao tác tay.
  - *Cách kiểm chứng (Verification):* Kiểm tra tab Actions trên GitHub báo cáo trạng thái xanh (Success).

- [ ] **`P3-Q04`** *(Level 1)*: Kiểm tra hóa đơn AWS Billing, đối soát $0.00 và viết báo cáo Cloud
  - *Mô tả:* Đối soát toàn bộ tài nguyên trên AWS Management Console đảm bảo chi phí chính xác $0.00 (nằm trong Free Tier); viết tài liệu `CLOUD_ARCHITECTURE.md` tổng hợp sơ đồ kiến trúc đám mây nộp đồ án.
  - *Phụ thuộc:* `P3-Q01`, `P3-Q02`, `P3-Q03`
  - *Thư mục:* `docs/`
  - *File tạo mới (2 files):* `docs/CLOUD_ARCHITECTURE.md`, `docs/COST_REPORT.md`.
  - *Branch:* `feature/P3-Q04-cloud-architecture-doc`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Báo cáo chi phí trên AWS Billing hiển thị $0.00; tài liệu kiến trúc đám mây hoàn chỉnh sơ đồ hệ thống nộp giảng viên.
  - *Cách kiểm chứng (Verification):* Chụp ảnh màn hình trang AWS Billing & Cost Management xác nhận số dư $0.00.

---

## 🏆 PHASE 4: VẬN HÀNH MÙA GIẢI & GAMIFICATION (0/14)
*Mục tiêu: Vận hành trực tiếp với FPL thật: Lịch thi đấu 38 vòng, chấm điểm live, quản lý chấn thương, BXH và luật chuyển nhượng 3 người/tuần.*

### 🎨 Nguyên (Frontend & UI Lead) - [0/4]

- [ ] **`P4-NG01`** *(Level 2)*: Màn hình Lịch thi đấu các tuần & Độ khó trận đấu (`FixturesView`)
  - *Mô tả:* Giao diện xem lịch 38 vòng đấu Premier League, tỉ số thực tế các trận đã kết thúc, ngày giờ bóng lăn và huy hiệu độ khó trận đấu FDR (Fixture Difficulty Rating từ 1 đến 5).
  - *Phụ thuộc:* `P4-NH03`
  - *Thư mục:* `frontend/src/components/fixtures/`
  - *File tạo mới (3 files):* `frontend/src/components/fixtures/FixturesView.tsx`, `frontend/src/components/fixtures/FixtureCard.tsx`, `frontend/src/components/fixtures/__tests__/FixturesView.test.tsx`.
  - *Branch:* `feature/P4-NG01-fixtures-ui`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Xem được lịch thi đấu 38 vòng, có thanh chọn Gameweek, hiển thị tỉ số thực tế và badge màu FDR (1-dễ đến 5-khó).
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend test -- FixturesView.test.tsx` pass 100%.

- [ ] **`P4-NG02`** *(Level 2)*: Huy hiệu Trạng thái Chấn thương & Treo giò (`PlayerStatusBadge`)
  - *Mô tả:* Tích hợp badge cảnh báo tình trạng y tế trực quan trên `VirtualPitch` và `PlayerTable`: Cờ đỏ 🚑 (Nghỉ thi đấu / Chấn thương 0%), cờ vàng ⚠️ (Nghi ngờ 25%-75%), cờ đỏ 🟥 (Treo giò); tooltip giải thích chi tiết lý do chấn thương (`news`).
  - *Phụ thuộc:* `P1-NG02`, `P4-NH01`
  - *Thư mục:* `frontend/src/components/common/`
  - *File tạo mới (2 files):* `frontend/src/components/common/PlayerStatusBadge.tsx`, `frontend/src/components/common/__tests__/PlayerStatusBadge.test.tsx`.
  - *Branch:* `feature/P4-NG02-player-status-badge`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Badge hiển thị chính xác theo trạng thái y tế (`d`, `i`, `s`), hover chuột hiển thị tooltip lý do chấn thương.
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend test -- PlayerStatusBadge.test.tsx` pass 100%.

- [ ] **`P4-NG03`** *(Level 2)*: Bảng xếp hạng Người chơi (`LeaderboardView`) & Sân bóng vinh danh Đội hình tiêu biểu tuần (`DreamTeamModal`)
  - *Mô tả:* Màn hình Bảng xếp hạng hiển thị Top người chơi điểm cao nhất tuần và cả mùa giải (vinh danh Top 1, 2, 3 bằng huy chương vàng/bạc/đồng); Tab hiển thị Sân bóng ảo vinh danh Đội hình tiêu biểu (Dream Team) của vòng đấu.
  - *Phụ thuộc:* `P4-NH04`, `P1-NG02`
  - *Thư mục:* `frontend/src/components/leaderboard/`
  - *File tạo mới (3 files):* `frontend/src/components/leaderboard/LeaderboardView.tsx`, `frontend/src/components/leaderboard/DreamTeamModal.tsx`, `frontend/src/components/leaderboard/__tests__/LeaderboardView.test.tsx`.
  - *Branch:* `feature/P4-NG03-leaderboard-ui`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Hiển thị bảng xếp hạng phân trang rõ ràng, vinh danh Top 3; mở modal render sân cỏ 11 cầu thủ Dream Team với điểm số cao nhất.
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend test -- LeaderboardView.test.tsx` pass 100%.

- [ ] **`P4-NG04`** *(Level 2)*: Giao diện Luật Chuyển nhượng tuần (Tối đa 3 transfers/tuần)
  - *Mô tả:* Chế độ Chuyển nhượng (Transfer Mode): Bộ đếm hiển thị số lượt thay đổi cầu thủ còn lại `(Còn lại: X / 3)`, đếm ngược thời gian đóng cổng chuyển nhượng (Gameweek Deadline), modal xác nhận chốt đội hình tuần.
  - *Phụ thuộc:* `P4-NH04`, `P1-NG04`
  - *Thư mục:* `frontend/src/components/transfers/`
  - *File tạo mới (3 files):* `frontend/src/components/transfers/TransferControl.tsx`, `frontend/src/components/transfers/TransferSummaryModal.tsx`, `frontend/src/components/transfers/__tests__/TransferControl.test.tsx`.
  - *Branch:* `feature/P4-NG04-transfer-rules-ui`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Bộ đếm giảm khi đổi cầu thủ, vô hiệu hóa nút chuyển nhượng khi đã đổi đủ 3 người, modal tóm tắt các lượt đổi trước khi lưu.
  - *Cách kiểm chứng (Verification):* `npm --prefix frontend test -- TransferControl.test.tsx` pass 100%.

---

### ⚙️ Nhất (Backend Core & Live Data Lead) - [0/4]

- [ ] **`P4-NH01`** *(Level 3)*: Worker `live_sync.py`: Tự động cào Lịch thi đấu 38 vòng & Trạng thái y tế/chấn thương
  - *Mô tả:* Worker kéo dữ liệu từ FPL API (`/api/fixtures/` và `/api/bootstrap-static/`), chuẩn hóa và upsert lịch 38 vòng đấu, danh sách chấn thương/treo giò kèm % khả năng ra sân vào PostgreSQL.
  - *Phụ thuộc:* `P4-V01`, `P1-NH02`
  - *Thư mục:* `backend/app/services/`
  - *File tạo mới (2 files):* `backend/app/services/fixture_sync.py`, `backend/tests/test_fixture_sync.py`.
  - *Branch:* `feature/P4-NH01-sync-fixtures-injuries`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Kéo và cập nhật đầy đủ 380 trận đấu và cờ trạng thái y tế (`d`, `i`, `s`) vào bảng `fixtures` và `players`.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_fixture_sync.py` pass 100%.

- [ ] **`P4-NH02`** *(Level 3)*: Worker `gameweek_sync.py`: Cào Điểm trực tiếp sau trận & Đội hình tiêu biểu
  - *Mô tả:* Worker tải dữ liệu thống kê trực tiếp từng trận đấu (`/api/event/{gw}/live/`: bàn thắng, kiến tạo, sạch lưới, điểm thưởng BPS) và dữ liệu Đội hình tiêu biểu (`/api/dream-team/{gw}/`) lưu vào DB.
  - *Phụ thuộc:* `P4-V01`
  - *Thư mục:* `backend/app/services/`
  - *File tạo mới (2 files):* `backend/app/services/live_match_sync.py`, `backend/tests/test_live_match_sync.py`.
  - *Branch:* `feature/P4-NH02-live-match-sync`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Điểm số thực tế của từng cầu thủ và danh sách 11 cầu thủ Dream Team của tuần được lưu chính xác vào DB.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_live_match_sync.py` pass 100%.

- [ ] **`P4-NH03`** *(Level 2)*: REST API `GET /api/v1/fixtures` & `GET /api/v1/dream-team/{gw}`
  - *Mô tả:* Endpoint trả về danh sách lịch thi đấu theo vòng (Gameweek 1-38) kèm tỉ số, và endpoint trả về 11 cầu thủ xuất sắc nhất vòng.
  - *Phụ thuộc:* `P4-NH01`, `P4-NH02`
  - *Thư mục:* `backend/app/api/v1/endpoints/`
  - *File tạo mới (3 files):* `backend/app/schemas/fixture.py`, `backend/app/api/v1/endpoints/fixtures.py`, `backend/tests/test_fixtures_api.py`.
  - *Branch:* `feature/P4-NH03-fixtures-api`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Trả về danh sách trận đấu lọc theo param `gameweek`, và trả về 11 cầu thủ Dream Team kèm sơ đồ thi đấu.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_fixtures_api.py` pass 100%.

- [ ] **`P4-NH04`** *(Level 3)*: REST API `GET /api/v1/leaderboard` & `POST /api/v1/transfers/confirm`
  - *Mô tả:* API trả về bảng xếp hạng người chơi có phân trang; API tiếp nhận yêu cầu chuyển nhượng tuần và thực thi validation cứng: chặn nếu thay đổi vượt quá 3 cầu thủ hoặc quá ngân sách.
  - *Phụ thuộc:* `P4-V02`
  - *Thư mục:* `backend/app/api/v1/endpoints/`
  - *File tạo mới (3 files):* `backend/app/schemas/gameweek.py`, `backend/app/api/v1/endpoints/gameweeks.py`, `backend/tests/test_gameweeks_api.py`.
  - *Branch:* `feature/P4-NH04-leaderboard-transfers-api`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Trả về bảng xếp hạng phân trang; endpoint chuyển nhượng từ chối (HTTP 400) nếu người chơi thay đổi quá 3 cầu thủ trong 1 tuần.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_gameweeks_api.py` pass 100%.

---

### 🧠 Vũ (Data & Algorithm Engineer) - [0/3]

- [ ] **`P4-V01`** *(Level 3)*: Thiết kế Schema Migration Alembic cho Gameweek & Live Operations
  - *Mô tả:* Khai báo ORM models và tạo migration file cho các bảng: `fixtures`, `player_gameweek_stats`, `user_gameweek_lineups`, `dream_teams`.
  - *Phụ thuộc:* `P1-V01`
  - *Thư mục:* `backend/app/models/`, `backend/alembic/`
  - *File tạo mới (4 files):* `backend/app/models/fixture.py`, `backend/app/models/gameweek.py`, `backend/alembic/versions/003_live_gameweek_schema.py`, `backend/tests/test_gameweek_models.py`.
  - *Branch:* `feature/P4-V01-gameweek-schema`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Script migration tạo đầy đủ 4 bảng mới kèm khóa ngoại, indexes trên `gameweek` và `player_id`.
  - *Cách kiểm chứng (Verification):* `alembic upgrade head` chạy thành công; `pytest backend/tests/test_gameweek_models.py` pass 100%.

- [ ] **`P4-V02`** *(Level 3)*: Xây dựng Game Engine tính điểm tự động (`scoring_engine.py`)
  - *Mô tả:* Logic chấm điểm đội hình người chơi: nhân đôi điểm Captain (x2), cơ chế Auto-sub thay thế cầu thủ không ra sân từ hàng ghế dự bị, tính tổng điểm Gameweek và cập nhật bảng xếp hạng.
  - *Phụ thuộc:* `P4-V01`
  - *Thư mục:* `backend/app/services/`
  - *File tạo mới (2 files):* `backend/app/services/scoring_engine.py`, `backend/tests/test_scoring_engine.py`.
  - *Branch:* `feature/P4-V02-scoring-engine`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Tính đúng nhân đôi Captain; tự động kích hoạt Auto-sub khi cầu thủ chính có 0 phút thi đấu; cập nhật tổng điểm vào BXH.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_scoring_engine.py` pass 100%.

- [ ] **`P4-V03`** *(Level 3)*: Nâng cấp PuLP Optimizer: Lọc Chấn thương & Gợi ý 3 Chuyển nhượng Tối ưu
  - *Mô tả:* Optimizer tự động loại bỏ cầu thủ chấn thương/treo giò (tỷ lệ ra sân < 50%) và xây dựng Transfer Optimizer: giữ khung đội hình hiện tại và giải bài toán chọn tối đa 3 lượt thay người mang lại xP cao nhất trong ngân sách.
  - *Phụ thuộc:* `P1-V02`
  - *Thư mục:* `backend/app/services/`
  - *File tạo mới (2 files):* `backend/app/services/transfer_optimizer.py`, `backend/tests/test_transfer_optimizer.py`.
  - *Branch:* `feature/P4-V03-transfer-optimizer`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Optimizer không bao giờ chọn cầu thủ đang chấn thương (status != 'a'); Transfer Optimizer gợi ý đúng tối đa 3 lượt thay cầu thủ tối ưu nhất.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_transfer_optimizer.py` pass 100%.

---

### 🐳 Quang (DevOps & Cloud Automation Lead) - [0/3]

- [ ] **`P4-Q01`** *(Level 3)*: Thiết lập AWS EventBridge Scheduler định kỳ chạy Live Sync
  - *Mô tả:* Cấu hình CloudWatch Events / EventBridge tự động kích hoạt `live_sync.py` trước mỗi vòng đấu và kích hoạt `gameweek_sync.py` sau khi các trận đấu kết thúc.
  - *Phụ thuộc:* `P4-NH01`, `P4-NH02`
  - *Thư mục:* `infra/aws/`
  - *File tạo mới (2 files):* `infra/aws/eventbridge_schedules.tf`, `infra/aws/README_SCHEDULER.md`.
  - *Branch:* `feature/P4-Q01-eventbridge-scheduler`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* EventBridge Scheduler gửi signal tự động theo đúng lịch thi đấu Ngoại hạng Anh để trigger backend sync.
  - *Cách kiểm chứng (Verification):* Kiểm tra cron trigger event trên CloudWatch Metrics / EventBridge Console.

- [ ] **`P4-Q02`** *(Level 3)*: Tích hợp Redis Caching cho Bảng xếp hạng & Lịch thi đấu
  - *Mô tả:* Cấu hình In-Memory Redis Cache (hoặc ElastiCache Free Tier) lưu cache Leaderboard và Fixtures trong 5 phút để chịu tải hàng ngàn request cùng lúc mà không làm nghẽn RDS.
  - *Phụ thuộc:* `P4-NH03`, `P4-NH04`
  - *Thư mục:* `backend/app/core/`, `infra/`
  - *File tạo mới (2 files):* `backend/app/core/redis_cache.py`, `backend/tests/test_redis_cache.py`.
  - *Branch:* `feature/P4-Q02-redis-caching`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Response time cho BXH và Fixtures giảm xuống < 20ms khi cache hit; tự động invalidate cache khi có điểm mới.
  - *Cách kiểm chứng (Verification):* `pytest backend/tests/test_redis_cache.py` pass 100%.

- [ ] **`P4-Q03`** *(Level 2)*: Kịch bản Kiểm thử Vòng đời Tuần thi đấu (Gameweek Lifecycle Test)
  - *Mô tả:* Script tự động giả lập 1 tuần thi đấu hoàn chỉnh: Người dùng đổi 3 cầu thủ $\rightarrow$ Khóa deadline $\rightarrow$ Kéo kết quả trận $\rightarrow$ Engine tính điểm $\rightarrow$ Cập nhật BXH thành công.
  - *Phụ thuộc:* `P4-NH04`, `P4-V02`
  - *Thư mục:* `scripts/`
  - *File tạo mới (2 files):* `scripts/test_gameweek_lifecycle.py`, `scripts/seed_mock_fixtures.py`.
  - *Branch:* `feature/P4-Q03-gameweek-integration-test`
  - *Tiêu chí chấp nhận (Acceptance Criteria):* Kịch bản test giả lập chạy từ đầu đến cuối không lỗi, xác nhận tính toàn vẹn của toàn bộ vòng lặp trò chơi tuần.
  - *Cách kiểm chứng (Verification):* Chạy `python scripts/test_gameweek_lifecycle.py` hiển thị `Gameweek Lifecycle Test: ALL 5 STAGES PASSED`.
