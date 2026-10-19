# BỘ PROMPT MẪU CHO 4 THÀNH VIÊN (DEV PROMPT TEMPLATES)
# Sử dụng để giao việc cho AI (Cursor, Claude, Copilot, ChatGPT, Antigravity)

> **QUY TRÌNH TƯƠNG TÁC 3 BƯỚC CHO DEV:**
> 1. **Dán Prompt:** AI sẽ KHÔNG code ngay mà xuất Bản Xác Nhận Kế Hoạch (Plan).
> 2. **Duyệt Plan:** Bạn đọc lướt qua và gõ **`OK`** hoặc **`Triển khai đi`** để AI bắt đầu code & chạy unit test.
> 3. **Nghiệm thu:** Đọc Handoff Output của AI, tích `[x]` vào `TODO.md`, review diff và gõ **`Cho phép commit và push`**.
>
> **QUY CHUẨN MÃ TASK:** `<Phase>-<Chữ đầu của tên>ID`
> - **Nguyên (NG) - Frontend & UI Lead:** `P1-NG01`, `P1-NG02`, ...
> - **Nhất (NH) - Backend Core & FPL Sync Lead:** `P1-NH01`, `P1-NH02`, ...
> - **Vũ (V) - Data & Algorithm Engineer:** `P1-V01`, `P1-V02`, ...
> - **Quang (Q) - DevOps & AWS Cloud Lead:** `P1-Q01`, `P1-Q02`, ...

---

## 1. PROMPT DÀNH CHO NGUYÊN (FRONTEND & UI LEAD)

### Task `P1-NG02`: Xây dựng Virtual Pitch (Sân bóng ảo 11 chính + 4 bench)
```text
Bạn là chuyên gia "React-Pitch-Interactive UI Specialist".
Trước khi làm việc, hãy đọc kỹ AI_GUIDELINES.md, PROJECT_SSOT.md và PROJECT_ROADMAP.md.

THÔNG TIN TASK:
- Task ID: P1-NG02
- Owner: Nguyên
- Git Branch bắt buộc: feature/P1-NG02-virtual-pitch
- Risk Level: LEVEL 2 (Medium)
- Giới hạn file: Tối đa 5 file tạo mới (nếu cần nhiều hơn phải cảnh báo và chia nhỏ).

YÊU CẦU:
- Hãy tạo component `VirtualPitch` bằng React + TypeScript + TailwindCSS tại `frontend/src/components/pitch/VirtualPitch.tsx`.
- Cấu trúc: 
  + Sân bóng màu cỏ xanh có kẻ vạch (CSS gradient hoặc SVG).
  + Hiển thị 11 cầu thủ đá chính theo sơ đồ hiện tại (mặc định 4-3-3: 1 GKP, 4 DEF, 3 MID, 3 FWD).
  + Mỗi slot cầu thủ hiển thị: Icon áo đấu, web_name, giá (now_cost), điểm (total_points), nút remove (X), badge 'C' (Captain) và 'V' (Vice-captain).
  + Khu vực Bench bên dưới sân: 1 slot GKP dự bị, 3 slot Outfield dự bị.
- KIỂM THỬ BẮT BUỘC (UNIT TEST):
  + Viết unit test cho component `VirtualPitch.test.tsx` (kiểm tra render đủ 11 chính, 4 bench, click chọn Captain).
  + Chạy test và báo cáo chính xác: "Passed X/Y test cases (100%)".
- RÀNG BUỘC:
  + Không tự động chạy git commit.
  + Xuất báo cáo chuẩn theo mẫu quy định tại Mục 4 của AI_GUIDELINES.md.
```

### Task `P1-NG04`: Xây dựng Zustand Store quản lý Lineup & Validation FPL
```text
Bạn là chuyên gia "React-Pitch-Interactive UI Specialist".
Trước khi làm việc, hãy đọc kỹ AI_GUIDELINES.md, PROJECT_SSOT.md và PROJECT_ROADMAP.md.

THÔNG TIN TASK:
- Task ID: P1-NG04
- Owner: Nguyên
- Git Branch bắt buộc: feature/P1-NG04-lineup-store
- Risk Level: LEVEL 2 (Medium)
- Giới hạn file: Tối đa 5 file tạo mới.

YÊU CẦU:
- Hãy tạo Zustand store `useLineupStore` tại `frontend/src/stores/lineupStore.ts`.
- Chức năng:
  + Quản lý danh sách 15 cầu thủ (`startingXI`, `bench`).
  + Ngân sách ban đầu 100.0, tự động cộng/trừ khi thêm/bớt cầu thủ.
  + Validation: Chặn thêm quá 3 cầu thủ/CLB, chặn vượt quá 100.0m, kiểm tra đủ 15 vị trí.
  + Tự động đồng bộ và đọc từ `localStorage`.
- KIỂM THỬ BẮT BUỘC (UNIT TEST):
  + Viết `frontend/src/stores/__tests__/lineupStore.test.ts`.
  + Test tối thiểu 4 cases: (1) Add hợp lệ, (2) Chặn vượt ngân sách 100m, (3) Chặn cầu thủ thứ 4 cùng CLB, (4) Lưu/đọc localStorage.
  + Chạy test và báo cáo số lượng pass: "Passed X/Y test cases (100%)".
- RÀNG BUỘC:
  + Không tự động commit. Xuất báo cáo chuẩn Mục 4 của AI_GUIDELINES.md.
```

---

## 2. PROMPT DÀNH CHO NHẤT (BACKEND CORE & FPL SYNC LEAD)

### Task `P1-NH02`: Viết Data Sync Worker kéo dữ liệu từ FPL API vào PostgreSQL
```text
Bạn là chuyên gia "FPL Data Pipeline & REST Specialist".
Trước khi làm việc, hãy đọc kỹ AI_GUIDELINES.md, PROJECT_SSOT.md và PROJECT_ROADMAP.md.

THÔNG TIN TASK:
- Task ID: P1-NH02
- Owner: Nhất
- Git Branch bắt buộc: feature/P1-NH02-fpl-sync
- Risk Level: LEVEL 3 (High)
- Giới hạn file: Tối đa 5 file tạo mới.

YÊU CẦU:
- Hãy viết service `fpl_sync.py` tại `backend/app/services/fpl_sync.py` (FastAPI / httpx / SQLAlchemy Async).
- Nhiệm vụ:
  + Gửi GET request đến: https://fantasy.premierleague.com/api/bootstrap-static/
  + Trích xuất danh sách `teams` và `elements` (cầu thủ).
  + Thực hiện Upsert (Insert on Conflict Update) vào PostgreSQL theo schema trong PROJECT_SSOT.md.
  + Chuyển đổi `now_cost` từ giá FPL (chia 10, ví dụ 152 -> 15.2m).
  + Chuyển đổi `element_type` từ số (1, 2, 3, 4) sang chữ ("GKP", "DEF", "MID", "FWD").
- KIỂM THỬ BẮT BUỘC (UNIT TEST):
  + Viết `backend/tests/test_fpl_sync.py` dùng mock response từ FPL JSON.
  + Test tối thiểu 3 cases: (1) Parse và mapping giá đúng, (2) Upsert không sinh duplicate, (3) Xử lý khi FPL API trả mã lỗi 500.
  + Chạy test bằng lệnh `pytest tests/test_fpl_sync.py` và báo cáo: "Passed X/Y test cases (100%)".
- RÀNG BUỘC:
  + Không tự động commit. Xuất báo cáo chuẩn Mục 4 của AI_GUIDELINES.md.
```

### Task `P1-NH03`: Xây dựng REST API Filter & Search cầu thủ
```text
Bạn là chuyên gia "FPL Data Pipeline & REST Specialist".
Trước khi làm việc, hãy đọc kỹ AI_GUIDELINES.md, PROJECT_SSOT.md và PROJECT_ROADMAP.md.

THÔNG TIN TASK:
- Task ID: P1-NH03
- Owner: Nhất
- Git Branch bắt buộc: feature/P1-NH03-players-api
- Risk Level: LEVEL 2 (Medium)
- Giới hạn file: Tối đa 5 file tạo mới.

YÊU CẦU:
- Tạo endpoint `GET /api/v1/players` tại `backend/app/api/v1/endpoints/players.py`.
- Hỗ trợ các query parameter: `position`, `team_id`, `max_cost`, `search`, `sort_by` (theo contract trong PROJECT_SSOT.md).
- Kết quả trả về kèm phân trang (`total`, `page`, `limit`, `items`).
- KIỂM THỬ BẮT BUỘC (UNIT TEST):
  + Viết `backend/tests/test_players_api.py` bằng `TestClient(app)`.
  + Test tối thiểu 4 cases: (1) Lọc theo position, (2) Lọc theo team_id, (3) Search theo tên Haaland, (4) Phân trang đúng limit/page.
  + Chạy test `pytest tests/test_players_api.py` và báo cáo: "Passed X/Y test cases (100%)".
- RÀNG BUỘC:
  + Không tự động commit. Xuất báo cáo chuẩn Mục 4 của AI_GUIDELINES.md.
```

---

## 3. PROMPT DÀNH CHO VŨ (ALGORITHM & DATA MODELING ENGINEER)

### Task `P1-V02`: Xây dựng Lõi Thuật toán Tối ưu Đội hình bằng PuLP
```text
Bạn là chuyên gia "PuLP Linear Programming & Data Modeling Specialist".
Trước khi làm việc, hãy đọc kỹ AI_GUIDELINES.md, PROJECT_SSOT.md và PROJECT_ROADMAP.md.

THÔNG TIN TASK:
- Task ID: P1-V02
- Owner: Vũ
- Git Branch bắt buộc: feature/P1-V02-pulp-optimizer
- Risk Level: LEVEL 3 (High)
- Giới hạn file: Tối đa 5 file tạo mới.

YÊU CẦU:
- Viết module `backend/app/services/optimizer_solver.py` sử dụng thư viện `PuLP`.
- Bài toán: 0-1 Integer Linear Programming.
  + Input: List danh sách cầu thủ, budget (float), locked_player_ids (list int), excluded_player_ids (list int).
  + Ràng buộc: Đúng 15 cầu thủ (2 GKP, 5 DEF, 5 MID, 3 FWD), tổng giá <= budget, max 3 cầu thủ/CLB, cầu thủ locked = 1, cầu thủ excluded = 0.
  + Hàm mục tiêu: Tối đa hóa tổng điểm kỳ vọng.
- KIỂM THỬ BẮT BUỘC (UNIT TEST):
  + Viết `backend/tests/test_optimizer.py`.
  + Test tối thiểu 4 cases:
    1. Nghiệm chuẩn: Đúng 15 cầu thủ, tổng giá <= 100m, max 3/team.
    2. Cầu thủ locked: Nghiệm bắt buộc chứa đúng các cầu thủ locked_ids.
    3. Cầu thủ excluded: Nghiệm tuyệt đối không chứa excluded_ids.
    4. Ca vô nghiệm (Infeasible): Ngân sách quá thấp (< 60m), hàm trả về lỗi rõ ràng không crash server.
  + Chạy test `pytest tests/test_optimizer.py` và báo cáo: "Passed X/Y test cases (100%)".
- RÀNG BUỘC:
  + Không tự động commit. Xuất báo cáo chuẩn Mục 4 của AI_GUIDELINES.md.
```

### Task `P1-V04`: Endpoint So sánh Lineup & Radar Chart Metrics
```text
Bạn là chuyên gia "PuLP Linear Programming & Data Modeling Specialist".
Trước khi làm việc, hãy đọc kỹ AI_GUIDELINES.md, PROJECT_SSOT.md và PROJECT_ROADMAP.md.

THÔNG TIN TASK:
- Task ID: P1-V04
- Owner: Vũ
- Git Branch bắt buộc: feature/P1-V04-compare-api
- Risk Level: LEVEL 2 (Medium)
- Giới hạn file: Tối đa 5 file tạo mới.

YÊU CẦU:
- Tạo endpoint `POST /api/v1/lineups/compare` tại `backend/app/api/v1/endpoints/lineups.py`.
- Input: `lineup_a_player_ids: list[int]`, `lineup_b_player_ids: list[int]`.
- Output: So sánh chênh lệch chi phí, điểm xP, chỉ số công/thủ của từng đội, danh sách cầu thủ khác biệt (differentials) theo contract trong PROJECT_SSOT.md.
- KIỂM THỬ BẮT BUỘC (UNIT TEST):
  + Viết `backend/tests/test_compare_api.py`.
  + Test tối thiểu 3 cases: (1) Hai đội hình khác nhau hoàn toàn, (2) Hai đội hình trùng nhau 100%, (3) Tính toán đúng delta points.
  + Chạy test và báo cáo: "Passed X/Y test cases (100%)".
- RÀNG BUỘC:
  + Không tự động commit. Xuất báo cáo chuẩn Mục 4 của AI_GUIDELINES.md.
```

---

## 4. PROMPT DÀNH CHO QUANG (AWS DEVOPS & CLOUD INFRASTRUCTURE LEAD)

### Task `P1-Q01` & `P1-Q02`: Tạo Dockerfile và Docker-Compose chuẩn Local
```text
Bạn là chuyên gia "AWS Free-Tier & DevOps Guardian".
Trước khi làm việc, hãy đọc kỹ AI_GUIDELINES.md, PROJECT_SSOT.md và PROJECT_ROADMAP.md.

THÔNG TIN TASK:
- Task ID: P1-Q01 và P1-Q02
- Owner: Quang
- Git Branch bắt buộc: feature/P1-Q01-docker-setup
- Risk Level: LEVEL 2 (Medium)
- Giới hạn file: Tối đa 5 file tạo mới (`backend/Dockerfile`, `frontend/Dockerfile`, `infra/docker-compose.yml`, `infra/init.sql`, `.dockerignore`).

YÊU CẦU:
- Hãy tạo cấu hình Docker cho local:
  1. `backend/Dockerfile`: Multi-stage build Python 3.11-slim, non-root user, cài đặt thư viện PuLP và solver CBC.
  2. `frontend/Dockerfile`: Multi-stage build Node 20-alpine -> Nginx alpine phục vụ static file.
  3. `infra/docker-compose.yml`: Kết nối 3 services (PostgreSQL 15, Backend FastAPI, Frontend React) có kèm healthcheck.
- KIỂM THỬ BẮT BUỘC:
  + Chạy thử lệnh kiểm tra cú pháp: `docker compose config`
  + Báo cáo: "Passed syntax check (0 errors)".
- RÀNG BUỘC:
  + Không tự động commit. Xuất báo cáo chuẩn Mục 4 của AI_GUIDELINES.md.
```

### Task `P2-Q03`: Thiết lập Cảnh báo AWS Budgets Alert ($1.00) trên tài khoản của Quang
```text
Bạn là chuyên gia "AWS Free-Tier & DevOps Guardian".
Trước khi làm việc, hãy đọc kỹ AI_GUIDELINES.md, PROJECT_SSOT.md và PROJECT_ROADMAP.md.

THÔNG TIN TASK:
- Task ID: P2-Q03
- Owner: Quang
- Git Branch bắt buộc: feature/P2-Q03-aws-budget-guard
- Risk Level: LEVEL 4 (Critical)
- Giới hạn file: Tối đa 5 file tạo mới.

YÊU CẦU:
- Hãy viết tài liệu và CLI script hướng dẫn thiết lập AWS Budgets Alert trên tài khoản cá nhân của Quang:
  + Ngưỡng cảnh báo: $1.00 USD.
  + Gửi thông báo ngay lập tức qua SNS / Email khi chi phí thực tế hoặc chi phí dự báo đạt 80% ($0.80) và 100% ($1.00).
- KIỂM THỬ BẮT BUỘC:
  + Kiểm tra JSON schema của file budget definition qua AWS CLI dry-run.
  + Báo cáo số lượng test check đã pass.
- RÀNG BUỘC:
  + Không tự động commit. Xuất báo cáo chuẩn Mục 4 của AI_GUIDELINES.md.
```
