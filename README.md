# ⚽ FPL Fantasy Football Lineup Builder & Optimizer

> **Dự án xây dựng đội hình Fantasy Premier League (FPL), phân tích chỉ số chuyên sâu, so sánh đối đầu và tối ưu hóa điểm số bằng quy hoạch tuyến tính (Integer Linear Programming).**

---

## 📖 BỘ TÀI LIỆU CHUẨN HÓA CHO DỰ ÁN & AI (BẮT BUỘC ĐỌC)

Dự án này áp dụng phương pháp **Vibe Coding có kỷ luật (Disciplined Vibe Coding)**. Toàn bộ tài liệu chuẩn hóa của dự án được lưu trữ tập trung tại thư mục [`docs/`](docs/README.md). Trước khi code hoặc giao việc cho AI, tất cả thành viên và AI Assistant bắt buộc phải tham chiếu:

1. **[`docs/TODO.md`](docs/TODO.md)**:
   - **Bảng theo dõi tiến độ & Đặc tả chi tiết 59 task (Phase 1 - Phase 4):** Tích hợp đầy đủ mô tả ngắn, quan hệ phụ thuộc (dependencies), thư mục được phép làm việc, tên chính xác từng file tạo mới ($\le$ 5 file/task), tiêu chí nghiệm thu (Acceptance Criteria) và cách kiểm chứng (Verification).
2. **[`docs/AI_DEVELOPMENT_GUIDE.md`](docs/AI_DEVELOPMENT_GUIDE.md)**:
   - **Cẩm nang thực chiến dành cho thành viên:** Hướng dẫn 6 bước làm việc với AI theo Giao thức Bắt tay 2 lượt (2-Way Handshake), kỹ thuật Prompting, cách thẩm định output, xử lý lỗi và kịch bản riêng cho từng bạn.
3. **[`docs/PROJECT_ROADMAP.md`](docs/PROJECT_ROADMAP.md)**:
   - **Lộ trình 4 giai đoạn:** Phase 1 (Local Full-Stack), Phase 2 (AWS Services Integration), Phase 3 (Production Deploy & CI/CD), Phase 4 (Live Season & Gamification).
   - Phân chia nhiệm vụ chi tiết, luồng dữ liệu kiến trúc (Mermaid flow) và tiêu chí nghiệm thu (DoD) của 4 thành viên.
4. **[`docs/AI_GUIDELINES.md`](docs/AI_GUIDELINES.md)**: 
   - **5 Quy tắc vàng bất biến cho AI:** Đọc tài liệu trước, kiểm tra dependency, không lấn sân vai trò khác, **cấm tự động commit/push**, bắt buộc xuất Handoff đúng chuẩn 4 phần.
   - Ma trận phân loại rủi ro (Risk Level 1 đến 4).
5. **[`docs/PROJECT_SSOT.md`](docs/PROJECT_SSOT.md)**: 
   - Nguồn sự thật duy nhất (Single Source of Truth) về Tech Stack, Luật FPL, Database Schema PostgreSQL và REST API Contract.
6. **[`docs/DEV_PROMPT_TEMPLATES.md`](docs/DEV_PROMPT_TEMPLATES.md)**: 
   - Bộ prompt mẫu chuẩn hóa cho từng bạn trong nhóm (Nguyên, Nhất, Vũ, Quang) để giao việc cho AI.

---

## 🛠 TECH STACK

- **Frontend:** React, TypeScript, Vite, TailwindCSS, Shadcn/ui, Zustand, Recharts, TanStack Table.
- **Backend:** Python (FastAPI), SQLAlchemy 2.0 Async, Alembic.
- **Optimizer Engine:** PuLP (0-1 Integer Linear Programming with CBC Solver).
- **Database:** PostgreSQL 15.
- **Data Source:** Official FPL API (`bootstrap-static`, `fixtures`).
- **Cloud Infrastructure:** AWS Free Tier (S3, CloudFront, RDS db.t4g.micro, EC2/App Runner).

---

## 👥 PHÂN CÔNG NHIỆM VỤ NHÓM 4 NGƯỜI & QUY CHUẨN TASK ID

Cú pháp mã task bắt buộc: `<Phase>-<Chữ đầu của tên>ID` (Ví dụ: `P1-NG01`, `P1-NH01`, `P1-V01`, `P1-Q01`).

| Thành viên | Ký hiệu Task ID | Vai trò chuyên môn | Trách nhiệm chính |
| :--- | :--- | :--- | :--- |
| **Nguyên** | `P<x>-NG<id>` | **Frontend & UI Lead** | Virtual Pitch sân bóng ảo, Lineup Store (Zustand + localStorage), Player table, Compare UI. |
| **Nhất** | `P<x>-NH<id>` | **Backend & Data Lead** | FastAPI base, FPL data sync worker, REST API endpoints cho cầu thủ & CLB. |
| **Vũ** | `P<x>-V<id>` | **Data & Algorithm Engineer** | PostgreSQL Schema DDL, Lõi thuật toán PuLP Optimizer, API so sánh đội hình. |
| **Quang** | `P<x>-Q<id>` | **DevOps & Cloud Lead** *(Chủ tài khoản AWS)* | Docker & Docker-Compose, Quản lý tài nguyên AWS Free Tier, CI/CD GitHub Actions. |
