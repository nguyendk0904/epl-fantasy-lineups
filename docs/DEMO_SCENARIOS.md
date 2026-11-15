# P3-V03 — Kịch bản demo so sánh đội hình

## Mục đích

Bộ demo tạo sáu snapshot đội hình và ba cặp payload cho `POST /api/v1/lineups/compare`:

1. **Siêu sao xP vs Cân bằng giá trị** — đội xP cao hơn đổi lại chi phí cao hơn.
2. **Ưu tiên tấn công vs Ưu tiên phòng thủ** — minh họa sự đánh đổi giữa Attack và Defense.
3. **Đội hình tiết kiệm vs Đội hình cao cấp** — minh họa phần xP tăng thêm khi chi nhiều hơn.

Dữ liệu là dữ liệu tổng hợp để trình diễn, không phải dự đoán FPL thực tế. Các player ID bắt đầu từ `900001` và team ID từ `9001`, cùng vùng ID dành riêng với `scripts/seed_demo_data.py`; script chỉ upsert các hàng demo này và sáu mã share `P3S001`–`P3S006`. Script không xóa dữ liệu.

## Chuẩn bị và nạp dữ liệu

1. Đảm bảo PostgreSQL local đã chạy và schema đã được migrate đến `head`.
2. Trong PowerShell, đặt `DATABASE_URL` trỏ đến **database local** bằng mật khẩu của bạn trong biến môi trường, không ghi mật khẩu vào tài liệu:

   ```powershell
   $encodedDbPassword = [uri]::EscapeDataString($env:MYSQL_PASSWORD)
   $env:DATABASE_URL = "postgresql+asyncpg://postgres:$encodedDbPassword@localhost:5432/fantasy_fpl"
   ```

3. Kiểm tra payload mà không ghi database:

   ```powershell
   python scripts/seed_demo_scenarios.py --dry-run
   ```

   Dry-run in ba đối tượng JSON. Mỗi trường `comparison_request` có thể dùng trực tiếp trong Swagger UI.

4. Nạp sáu snapshot và 36 cầu thủ demo:

   ```powershell
   python scripts/seed_demo_scenarios.py
   ```

   Chạy lại lệnh sẽ cập nhật các hàng trong vùng ID demo và các share code đã dành riêng. Không trỏ lệnh này đến RDS hoặc database có dữ liệu người dùng.

## Thử endpoint so sánh

Khởi động backend, mở `http://localhost:8000/docs`, chọn `POST /api/v1/lineups/compare`, rồi dán phần `comparison_request` tương ứng từ kết quả dry-run. API trả về cost, xP, Attack, Defense, Form, Value, chênh lệch A − B, số cầu thủ chung và differentials của đội B.

Có thể kiểm tra snapshot đã nạp qua `GET /api/v1/lineups/share/P3S001` đến `P3S006`.

## Số liệu trình bày

Các số dưới đây được tính từ chính dữ liệu demo qua cùng công thức của comparison API. Chỉ số radar dùng 5 trục Attack, Defense, xP, Form và Value; các delta là A − B.

| Kịch bản | Đội | Cost (£m) | xP | Attack | Defense | Form | Value |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Siêu sao xP vs Cân bằng giá trị | A — Siêu sao | 94.2 | 73.0 | 57 | 52 | 54 | 93 |
|  | B — Cân bằng | 90.0 | 70.3 | 57 | 48 | 52 | 94 |
| Ưu tiên tấn công vs Ưu tiên phòng thủ | A — Tấn công | 91.2 | 71.1 | 58 | 47 | 53 | 94 |
|  | B — Phòng thủ | 88.8 | 70.3 | 54 | 52 | 52 | 95 |
| Đội hình tiết kiệm vs Đội hình cao cấp | A — Tiết kiệm | 88.3 | 68.8 | 55 | 47 | 51 | 93 |
|  | B — Cao cấp | 94.2 | 73.0 | 57 | 52 | 54 | 93 |

| Kịch bản | Cost A − B (£m) | xP A − B | Điểm nhấn |
| --- | ---: | ---: | --- |
| Siêu sao vs Cân bằng | +4.2 | +2.7 | Đội A đạt xP cao hơn; đội B có Value cao hơn. |
| Tấn công vs Phòng thủ | +2.4 | +0.8 | Attack A cao hơn 4 điểm; Defense B cao hơn 5 điểm. |
| Tiết kiệm vs Cao cấp | −5.9 | −4.2 | Đội B đắt hơn £5.9m và đạt thêm 4.2 xP. |

## Kịch bản nói khi trình bày

- Bắt đầu với đội siêu sao và đội cân bằng: so sánh đường xP/Attack với Value trên radar.
- Chuyển sang cặp tấn công/phòng thủ: chỉ ra Attack và Defense đổi chiều, trong khi tổng xP gần nhau.
- Kết thúc với cặp tiết kiệm/cao cấp: nêu phần chênh lệch chi phí để đổi lấy xP.
- Nhắc người xem rằng số liệu là dữ liệu demo cố định; khi chạy với dữ liệu FPL thật, kết quả sẽ khác.

**Giới hạn tích hợp:** trang Compare hiện lấy đội của người dùng và đội tối ưu/mẫu từ trạng thái frontend; chưa có bộ chọn tự nạp sáu share code demo. Các payload và snapshot ở đây dùng để kiểm tra API và làm kịch bản số liệu. Muốn chọn trực tiếp ba cặp trong giao diện cần một thay đổi frontend riêng.
