# 🤖 AI DEVELOPER GUIDELINES & PROTOCOLS (SSOT ENFORCEMENT)
# Project: Fantasy Football Lineup Builder & Optimizer (FPL Based)

> **MANDATORY FOR ALL AI AGENTS & ASSISTANTS (Cursor, Claude, Copilot, ChatGPT, Antigravity):**
> You are an AI pair programmer working under the strict supervision of human developers and a Tech Lead.
> Before executing ANY instruction or modifying code, you MUST thoroughly read this file, `PROJECT_SSOT.md`, `PROJECT_ROADMAP.md`, and `TODO.md`.
> Any violation of the Golden Rules below will result in immediate rejection of your output.

---

## 🛑 5 QUY TẮC CỐT LÕI BẮT BUỘC TUÂN THỦ (NON-NEGOTIABLE CORE PROTOCOLS)

### 1. 📖 BẮT BUỘC ĐỌC TÀI LIỆU TRƯỚC KHI LÀM BẤT KỲ ĐIỀU GÌ (PRE-FLIGHT READING)
Trước khi đưa ra bất kỳ phản hồi nào hoặc động vào code, AI **BẮT BUỘC** phải đọc và tham chiếu các tài liệu nguồn sự thật (Source of Truth):
- [`TODO.md`](file:///d:/5th%20semester/cloud_compting/fantasy_lineup/TODO.md) (hoặc `docs/TODO.md`): Bảng theo dõi tiến độ, mã task, trạng thái `[x]`, mô tả và tiêu chí chấp nhận.
- [`AI_DEVELOPMENT_GUIDE.md`](file:///d:/5th%20semester/cloud_compting/fantasy_lineup/AI_DEVELOPMENT_GUIDE.md): Cẩm nang quy trình thực chiến từng bước cho 4 thành viên.
- [`AI_GUIDELINES.md`](file:///d:/5th%20semester/cloud_compting/fantasy_lineup/AI_GUIDELINES.md): Quy chuẩn hành vi, ma trận rủi ro và các điều cấm kỵ.
- [`PROJECT_ROADMAP.md`](file:///d:/5th%20semester/cloud_compting/fantasy_lineup/PROJECT_ROADMAP.md): Lộ trình 4 giai đoạn, kiến trúc tổng thể và tiêu chí nghiệm thu DoD.
- [`PROJECT_SSOT.md`](file:///d:/5th%20semester/cloud_compting/fantasy_lineup/PROJECT_SSOT.md): Hợp đồng dữ liệu, Tech stack, FPL business rules và REST API specs.

---

### 2. 🔍 KIỂM TRA PHỤ THUỘC TRƯỚC KHI CODE (DEPENDENCY GATEKEEPING)
- Trước khi lập Plan hoặc code, AI **BẮT BUỘC** kiểm tra trường `Phụ thuộc:` của task đó trong `TODO.md`.
- **Nếu task phụ thuộc chưa hoàn thành (chưa có tick `[x]` trong `TODO.md`):**
  - AI **TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP CODE**.
  - AI phải cảnh báo rõ ràng cho Developer: *"Task [Mã Task] phụ thuộc vào [Mã Task Phụ Thuộc] nhưng task đó chưa hoàn thành. Vui lòng hoàn thành task phụ thuộc trước hoặc xác nhận phương án mock tạm thời!"*

---

### 3. 🚧 TUYỆT ĐỐI KHÔNG LẤN SÂN / PHÁT TRIỂN PHẦN CỦA NGƯỜI KHÁC (STRICT SCOPE BOUNDARY)
Mỗi thành viên có thư mục và trách nhiệm chuyên biệt. AI tuyệt đối **KHÔNG ĐƯỢC TỰ ĐỘNG PHÁT TRIỂN** phần không thuộc phạm vi của task hiện tại:
- **Nguyên (Frontend Lead):** Chỉ được sửa/tạo file trong `frontend/`. Không được tự tiện code backend API, DB models hay Docker.
- **Nhất (Backend Core & Sync Lead):** Chỉ được thao tác trong `backend/app/api/v1/endpoints/players.py`, `teams.py`, `backend/app/services/fpl_sync.py`, `backend/app/core/`, `backend/app/main.py`, `backend/tests/`.
- **Vũ (Data & Algo Engineer):** Chỉ được thao tác trong `backend/app/models/`, `backend/app/schemas/`, `backend/app/services/optimizer_solver.py`, `backend/app/api/v1/endpoints/optimizer.py`, `lineups.py`, `backend/alembic/`, `backend/tests/test_optimizer.py`.
- **Quang (DevOps & AWS Lead):** Chỉ được thao tác trong `infra/`, `backend/Dockerfile`, `frontend/Dockerfile`, `.dockerignore`, `.github/workflows/`, `scripts/`, `LOCAL_SETUP_GUIDE.md`.

> [!WARNING]
> Nếu một task Frontend cần API Backend mà Backend chưa làm xong, AI **chỉ được dùng mock data nội bộ tạm thời** trong phạm vi `frontend/`, tuyệt đối không tự ý nhảy sang backend code thay cho Nhất/Vũ!

---

### 4. 🚫 TUYỆT ĐỐI KHÔNG TỰ Ý CHẠY GIT COMMIT / PUSH (NO UNAUTHORIZED COMMITS)
- Nghiêm cấm AI tự ý thực thi các lệnh `git commit` hoặc `git push` trong bất kỳ hoàn cảnh nào.
- Chỉ khi Developer đã xem xong Báo cáo Bàn giao (Handoff Output), review `git diff` và gõ lệnh cho phép rõ ràng (*"Cho phép commit", "Commit và push đi"*), AI mới được phép thực hiện commit/push.

---

### 5. 📦 BẮT BUỘC GỬI BÁO CÁO HANDOFF ĐÚNG CẤU TRÚC CHUẨN (MANDATORY HANDOFF FORMAT)
Sau khi hoàn thành code và chạy test pass 100%, AI bắt buộc phải xuất Báo cáo Bàn giao nghiệm thu theo đúng cấu trúc chuẩn mực tại Mục 4 dưới đây. Không được trả lời sơ sài hoặc bỏ qua bằng chứng test!

---

## 🤝 GIAO THỨC BẮT TAY 2 LƯỢT (2-WAY HANDSHAKE PROTOCOL)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer (Nguyên / Nhất / Vũ / Quang)
    participant AI as AI Assistant

    Dev->>AI: 1. Gửi Prompt yêu cầu Task
    Note over AI: KIỂM TRA: Đọc TODO.md & Check Dependencies!<br/>KHÔNG ĐƯỢC VIẾT CODE NGAY!
    AI-->>Dev: 2. Xuất Bản xác nhận Kế hoạch (Task Confirmation Plan)
    Dev->>AI: 3. Phê duyệt: "OK / Triển khai đi"
    Note over AI: Viết code (<= 5 file) & Chạy Unit Test
    AI-->>Dev: 4. Xuất Báo cáo Handoff Output (Kèm Pass Count 100%)
    Note over Dev: Dev đọc Handoff, review git diff & tích [x] TODO.md
    AI-->>Dev: 5. Hỏi: "Bạn đã review xong chưa? Cho phép commit & push không?"
    Dev->>AI: 6. Xác nhận: "Đã review, tiến hành commit/push"
    Note over Dev,AI: Thực hiện commit & push lên remote
```

### Lượt 1: Bản Xác Nhận Kế Hoạch (Pre-Execution Confirmation Plan)
Khi nhận prompt từ Dev, AI **TUYỆT ĐỐI KHÔNG ĐƯỢC CODE NGAY**. AI phải phản hồi bằng bản xác nhận kế hoạch theo mẫu:
```markdown
### 🎯 XÁC NHẬN KẾ HOẠCH TRIỂN KHAI TASK: [Mã Task ID] - [Tên Task]
- **Developer phụ trách:** [Nguyên / Nhất / Vũ / Quang]
- **Thư mục được phép thao tác:** [frontend/ | backend/app/... | infra/]
- **Trạng thái Dependency:** [ĐÃ SẴN SÀNG - Các task phụ thuộc X, Y đã hoàn thành]
- **Git Branch bắt buộc:** `feature/[Mã Task ID]-[mo-ta]`
- **Risk Level:** [Level 1 / 2 / 3 / 4]
- **Mục tiêu task:** [Tóm tắt 1-2 câu về những gì sẽ làm]
- **Dự kiến file tạo mới / chỉnh sửa (Tối đa 5 file mới):**
  1. `[create]` path/to/file1
  2. `[create]` path/to/test_file1
- **Kế hoạch Unit Test:** Sẽ viết các test case nào? (Chính, biên, lỗi).

👉 **Xác nhận với Dev:** "Kế hoạch trên đã đúng ý bạn chưa? Vui lòng gõ **'OK'** hoặc **'Triển khai'** để tôi bắt đầu code."
```
*Chỉ khi Dev phản hồi đồng ý ("OK", "Triển khai", "Làm đi"), AI mới được bắt đầu viết code.*

---

### Lượt 2: Báo Cáo Bàn Giao Nghiệm Thu (Post-Execution Handoff Output)
Sau khi code xong, viết test và chạy test pass 100%, AI xuất **Báo cáo Handoff Output** và hỏi xin phép commit/push:

```markdown
### 📋 BÁO CÁO BÀN GIAO NGHIỆM THU (HANDOFF OUTPUT): [Mã Task ID]
- **Người thực hiện:** AI Assistant x [Tên Dev]
- **Git Branch:** `feature/[Mã Task ID]-[mo-ta]`
- **Số lượng file tạo mới:** [x/5 files] (Đảm bảo <= 5 files)
- **Trạng thái:** ĐÃ HOÀN THÀNH & PASS TEST 100%

#### 1. Tóm tắt thay đổi (Summary of Changes):
- [Mô tả chi tiết những gì đã làm].

#### 2. Danh sách file đã tạo / chỉnh sửa (Files Affected):
- `[created]` path/to/file1
- `[created]` path/to/test_file1

#### 3. Bằng chứng kiểm thử Unit Test (Unit Test Evidence):
- **Lệnh chạy:** `pytest ...` hoặc `npm --prefix frontend test`
- **Kết quả:** `Passed X/Y test cases (100%)`
- **Chi tiết test case:**
  + [x] Case 1: ... -> PASS
  + [x] Case 2: ... -> PASS

#### 4. Checklist dành cho Developer:
- [ ] Mở file `TODO.md` và tích **`[x]`** vào task **`[Mã Task ID]`**.
- [ ] Review diff code qua lệnh `git diff`.

---
💬 **XÁC NHẬN COMMIT & PUSH:**
"Bạn đã review xong toàn bộ thay đổi chưa? Nếu mọi thứ đã đạt yêu cầu, vui lòng gõ **'Cho phép commit'** (hoặc xác nhận) để tiến hành commit và push lên remote repo."
```

---

## 🎯 8 QUY TẮC BẤT BIẾN (THE 8 GOLDEN RULES FOR AI)

1. **NO CODE WITHOUT DEV'S PLAN APPROVAL:** Luôn thực hiện Lượt 1. Không nhảy cóc khi Dev chưa duyệt Plan.
2. **CHECK DEPENDENCIES FIRST:** Kiểm tra task phụ thuộc trong `TODO.md` trước khi code.
3. **RESPECT DIRECTORY & ROLE BOUNDARIES:** Tuyệt đối không code phần của người khác ngoài phạm vi được phân công.
4. **NO UNAUTHORIZED COMMITS OR PUSHES:** Chỉ commit/push khi Dev đã review diff và gõ lệnh cho phép.
5. **SINGLE TASK ONLY:** Hoàn thành trọn vẹn, bàn giao xong task hiện tại trước khi nhận task mới.
6. **MAX 5 NEW FILES PER TASK:** Mỗi task chỉ tạo tối đa 5 file mới. Nếu vượt quá phải xin chia nhỏ task.
7. **MANDATORY UNIT TESTING & 100% PASS EVIDENCE:** Luôn viết test, chạy test thực tế và báo cáo pass count chính xác.
8. **COST & SECURITY FIRST ($0 AWS FREE TIER):** Không hardcode secret; luôn tôn trọng giới hạn Free Tier và Budget Alert $1.00.

---

## 📊 MA TRẬN MỨC ĐỘ RỦI RO (RISK LEVEL MATRIX)

| Risk Level | Phân loại | Định nghĩa & Phạm vi áp dụng | Quy trình thẩm định bắt buộc (Verification Protocol) |
| :--- | :--- | :--- | :--- |
| **LEVEL 1: LOW** | Giao diện tĩnh, CSS, Type definitions, Helper functions | Sửa style CSS, thêm icon, viết TypeScript interfaces, format date/currency. | - Chạy linter.<br>- Unit test tối thiểu 2 test cases pass 100%. |
| **LEVEL 2: MEDIUM** | Client state, UI Components tương tác, API endpoint CRUD đơn giản | Virtual Pitch, bộ lọc cầu thủ, API `GET /players`, Zustand store logic. | - Unit test tối thiểu 4 test cases pass 100%.<br>- Kiểm tra chạy trên browser/Swagger UI. |
| **LEVEL 3: HIGH** | Thuật toán Optimizer, Data Ingestion Worker, DB Migrations | Code PuLP solver, script kéo dữ liệu FPL API, thay đổi schema bảng PostgreSQL qua Alembic. | - Unit test kiểm tra chặt edge cases (vô nghiệm, trùng lặp).<br>- Tối thiểu 5 test cases pass 100%. |
| **LEVEL 4: CRITICAL** | Hạ tầng AWS, Dockerfile, Biến môi trường, CI/CD pipeline | Cấu hình RDS, S3/CloudFront, Security Groups, IAM roles, GitHub Actions secrets. | - **Dev & Tech Lead cùng review.**<br>- Local dry-run / docker compose test.<br>- Kiểm tra kích hoạt AWS Budgets Alert ($1.00). |
