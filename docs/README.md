# 📚 TRUNG TÂM TÀI LIỆU DỰ ÁN (PROJECT DOCUMENTATION HUB)
# Fantasy Football Lineup Builder & Optimizer

> **Dành cho Developer (Nguyên, Nhất, Vũ, Quang) và Tất cả AI Agents:**
> Toàn bộ tài liệu chuẩn mực (Source of Truth), quy chuẩn làm việc, cẩm nang AI và bảng tiến độ dự án được tập trung tại thư mục `docs/`.

---

## 🗂️ MỤC LỤC TÀI LIỆU DỰ ÁN (DOCUMENTATION INDEX)

| Tên tài liệu | File | Mục đích & Nội dung chính |
| :--- | :--- | :--- |
| **Bảng Theo Dõi Tiến Độ & Task** | [`TODO.md`](file:///d:/5th%20semester/cloud_compting/fantasy_lineup/docs/TODO.md) | Toàn bộ 59 tasks chi tiết qua 4 Phase kèm: Mô tả, Phụ thuộc, Thư mục cho phép, File tạo mới, Tiêu chí chấp nhận (Acceptance Criteria), Cách kiểm chứng (Verification) và Branch. |
| **Cẩm Nang Phát Triển Với AI** | [`AI_DEVELOPMENT_GUIDE.md`](file:///d:/5th%20semester/cloud_compting/fantasy_lineup/docs/AI_DEVELOPMENT_GUIDE.md) | Quy trình thực chiến 6 bước cho 4 thành viên điều phối AI qua Giao thức Bắt tay 2 lượt (2-Way Handshake Protocol). |
| **Quy Chuẩn Hoạt Động Của AI** | [`AI_GUIDELINES.md`](file:///d:/5th%20semester/cloud_compting/fantasy_lineup/docs/AI_GUIDELINES.md) | 5 Quy tắc cốt lõi bắt buộc cho AI: Đọc tài liệu trước, kiểm tra dependency, không lấn sân vai trò khác, không tự ý commit/push, xuất handoff chuẩn. |
| **Lộ Trình & Kế Hoạch 4 Giai Đoạn** | [`PROJECT_ROADMAP.md`](file:///d:/5th%20semester/cloud_compting/fantasy_lineup/docs/PROJECT_ROADMAP.md) | Kế hoạch chi tiết 4 Phase: Phase 1 (Local Full-Stack), Phase 2 (AWS Services), Phase 3 (Production Deploy & CI/CD), Phase 4 (Live Season Gamification) kèm kiến trúc CSDL. |
| **Nguồn Sự Thật Cốt Lõi Dự Án** | [`PROJECT_SSOT.md`](file:///d:/5th%20semester/cloud_compting/fantasy_lineup/docs/PROJECT_SSOT.md) | Hợp đồng công nghệ (Tech Stack), luật chơi FPL, thiết kế Schema CSDL PostgreSQL, quy chuẩn mã lỗi và đặc tả REST API. |
| **Bộ Prompt Mẫu Cho 4 Thành Viên** | [`DEV_PROMPT_TEMPLATES.md`](file:///d:/5th%20semester/cloud_compting/fantasy_lineup/docs/DEV_PROMPT_TEMPLATES.md) | Các mẫu prompt chuẩn hóa sẵn theo từng task cho Nguyên, Nhất, Vũ, Quang copy & paste khi giao việc cho AI. |

---

## 🛑 NGUYÊN TẮC BẮT BUỘC DÀNH CHO AI MODELS

Trước khi bắt đầu thực hiện bất kỳ task nào, mọi mô hình AI (Cursor, Claude, Copilot, ChatGPT, Antigravity) **BẮT BUỘC PHẢI**:
1. Đọc kỹ task tương ứng trong [`TODO.md`](file:///d:/5th%20semester/cloud_compting/fantasy_lineup/docs/TODO.md).
2. **Kiểm tra Dependency:** Nếu các task phụ thuộc chưa hoàn thành (`[x]`), **DỪNG LẠI NGAY** và báo cho Dev, không được code.
3. **Tuân thủ đúng phạm vi thư mục:** Không được tự ý sửa code của thành viên khác ngoài phạm vi được chỉ định.
4. **Không tự ý commit/push:** Luôn xuất Handoff Output chuẩn mực và chờ Developer phê duyệt bằng lời trước khi commit.

