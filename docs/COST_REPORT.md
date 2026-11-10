# 💸 P3-Q04 — BÁO CÁO ĐỐI SOÁT CHI PHÍ AWS ($0.00) · COST RECONCILIATION REPORT

> **Task:** `P3-Q04` *(Level 1 — Low, theo `AI_GUIDELINES.md` §Risk Matrix; hạ tầng AWS liên quan đã hoàn tất ở `P3-Q01..Q03`)* · **Owner:** Quang (DevOps & AWS Lead)
> **Branch:** `feature/P3-Q04-cloud-architecture-doc` · **Files:** `docs/COST_REPORT.md` (tài liệu này) + `docs/CLOUD_ARCHITECTURE.md`
> **Phụ thuộc:** `P3-Q01` ✅ · `P3-Q02` ✅ · `P3-Q03` ✅ *(đã tick `[x]` trong `docs/TODO.md`)*
> **Nguồn chuẩn:** [`PROJECT_SSOT`](PROJECT_SSOT.md) · [`PROJECT_ROADMAP`](PROJECT_ROADMAP.md) · [`TODO`](TODO.md) · [`AI_GUIDELINES`](AI_GUIDELINES.md)
> **Ngày chốt số liệu:** **10/11/2026 21:21 (GMT+7)** · **Account:** `711695043505` · **IAM user:** `quang-devops` · **Region:** `ap-southeast-1`

---

## 1. ⚡ TL;DR — KẾT LUẬN ĐỐI SOÁT

| Câu hỏi của Acceptance Criteria | Kết quả đo được | Kết luận |
| :--- | :--- | :---: |
| **AWS Billing có hiển thị `$0.00`?** | Net **`$0.000000`** (chính xác `-0.0000000616` USD) từ **06/2026 → 10/11/2026**; Budget `ACTUAL = $0.00` | ✅ **ĐẠT** |
| **Chi phí có nằm trong Free Tier?** | Free Tier **Always Free** dùng **≤ 0.40 %** hạn mức. **Nhưng** EC2/RDS **không** thuộc 12-month Free Tier của account này | ⚠️ **ĐẠT nhưng khác bản chất** (xem §2) |
| **Vì sao vẫn `$0.00` dù EC2 + RDS chạy 24/7?** | Account đang ở **AWS Free plan**: **còn `$195.98` credit**, hết hạn **15/03/2027** — credit bù **100 %** gross usage (`$3.231296` trong 10 ngày 11/2026) | ⚠️ **Ràng buộc có thời hạn** |
| **Có tài liệu kiến trúc Cloud để nộp?** | [`CLOUD_ARCHITECTURE.md`](CLOUD_ARCHITECTURE.md) — **5 sơ đồ Mermaid** (4 sơ đồ chính + 1 định hướng Phase 4) + inventory **14 tài nguyên thật** (§6.1) + ma trận bảo mật | ✅ **ĐẠT** |

> ### 🎯 Một câu chốt cho báo cáo đồ án
> *"Tài khoản AWS của nhóm trong suốt thời gian làm đồ án (06/2026 → 11/2026) có **hoá đơn thực trả `$0.00`**, đã đối soát từng dòng usage; toàn bộ hạ tầng production (CloudFront + S3 + EC2 + RDS + ECR) vận hành **24/7** và được **credit của AWS Free plan** chi trả. Ngân sách còn lại **`$195.98`**, thời hạn gói **15/03/2027**, kèm **Budget guard** và **kịch bản teardown** trước mốc đó."*

### 1.1. Ba điều **phải** nói thật trong buổi bảo vệ (không giấu)

| # | Sự thật đo được | Hệ quả | Xử lý trong tài liệu |
| :--- | :--- | :--- | :--- |
| **T1** | `$0.00` đến từ **credit `$195.98`** (AWS Free plan, hết hạn **15/03/2027**), **không** phải từ 12-month Free Tier (account này **không có** hạn mức 750 h EC2/RDS — `aws freetier` chỉ trả về các meter *Always Free*) | Sau 15/03/2027 (hoặc khi cạn credit) bill sẽ bắt đầu **tăng thật** | §2.4 · §6 · §8 |
| **T2** | **Gross usage thật** của 11/2026 (01→10) là **`$3.231296`**, dự báo cả tháng **`$10.34`**; trạng thái 24/7 ổn định **≈ `$36.62`/tháng** | Nếu chỉ nhìn `$0.00` sẽ **không thấy** quy mô chi phí thật ⇒ không lập kế hoạch teardown | §3 · §5 · §6 |
| **T3** | Budget guard đang là **`$100.00`** — **Dev + Tech Lead đã chốt có chủ đích** (10/11/2026) để tránh cảnh báo nhiễu; **không** phải sự cố. Chỉ còn **lệch tài liệu**: `P2-Q03` ghi `$1.00`, `P3-Q02` §2.3 ghi `$10.00`, tên budget còn `…-1usd` | Không ảnh hưởng vận hành; chỉ dễ bị hỏi khi giảng viên đọc tài liệu cũ | §4 · §7 (**R4 — đã chốt**) |

---

## 2. 🔬 PHƯƠNG PHÁP & PHẠM VI ĐỐI SOÁT

### 2.1. Nguyên tắc

1. **Chỉ dùng lệnh read-only** (`sts`, `ce`, `budgets`, `freetier`, `ec2 describe-*`, `rds describe-*`, `s3api get-*`, `ecr describe-*`, `cloudfront list-*`) — task này **không** thay đổi tài nguyên AWS nào.
2. **Không tính nhẩm:** mọi phép cộng/trừ/tỷ lệ được thực hiện bằng script (`Decimal`), in ra bảng rồi dán vào tài liệu → tránh sai số.
3. **Đối soát 2 chiều:** *gross usage* (Usage record) ⟷ *credit* ⟷ *net* (Billing). Chỉ báo `$0.00` khi **ba cột khớp**.
4. **Mọi con số đều tái lập được** — lệnh đầy đủ ở **§10 Phụ lục A**.

### 2.2. Nguồn dữ liệu (đã chạy thật)

| Nguồn | API / lệnh | Dùng để chứng minh |
| :--- | :--- | :--- |
| **AWS Cost Explorer** | `ce get-cost-and-usage` (nhóm theo `RECORD_TYPE`, `SERVICE`, `USAGE_TYPE`) | Gross usage, credit, net theo tháng/ngày/dịch vụ |
| **AWS Cost Explorer forecast** | `ce get-cost-forecast` | Dự báo phần còn lại của tháng |
| **AWS Budgets** | `budgets describe-budget(s)`, `describe-notifications-for-budget` | Ngưỡng cảnh báo + `ACTUAL`/`FORECASTED` spend |
| **AWS Free Tier API** | `freetier get-account-plan-state`, `get-free-tier-usage` | Loại gói, **credit còn lại**, ngày hết hạn, % hạn mức free tier |
| **Resource APIs** | `ec2/rds/s3api/ecr/cloudfront/secretsmanager/logs describe-*` | Inventory để **quy mọi dòng tiền về một tài nguyên cụ thể** (§5) |

### 2.3. Chi phí của chính việc đối soát (minh bạch)

> 🔎 **Cost Explorer API tính `$0.01`/request.** Đợt audit này dùng **6 request** (`USE1-APIRequest = 6` trong CE) ⇒ **`$0.06`** gross trong tháng 11 — **đã được credit bù 100 %**. Đây là khoản **lớn thứ 3** trong tháng, lớn hơn cả EC2 compute (`$0.1056`).
> ⇒ Quy tắc vận hành: **không gọi CE API bằng vòng lặp/script định kỳ dày**; dùng **Billing Console** (miễn phí) cho việc xem hằng ngày, CE API chỉ dùng khi cần số liệu máy đọc được (§9).

### 2.4. Bản chất gói tài khoản (bằng chứng gốc)

```bash
aws freetier get-account-plan-state --region us-east-1 --no-cli-pager
```
```json
{
  "accountId": "711695043505",
  "accountPlanType": "FREE",
  "accountPlanStatus": "ACTIVE",
  "accountPlanRemainingCredits": { "amount": 195.98, "unit": "USD" },
  "accountPlanExpirationDate": "2027-03-15T16:30:06.998000+00:00"
}
```

**Đọc đúng kết quả này:**

| Trường | Giá trị | Ý nghĩa |
| :--- | :--- | :--- |
| `accountPlanType = FREE` | Gói **AWS Free plan** (cơ chế credit), **không** phải "12-month Free Tier" cổ điển | EC2/RDS/S3 **không** có hạn mức 750 h / 5 GB; chúng **tính tiền** rồi được credit trừ |
| `accountPlanRemainingCredits` | **`$195.98`** | "Nhiên liệu" còn lại — đây là lý do **duy nhất** bill = `$0.00` |
| `accountPlanExpirationDate` | **`2027-03-15`** | Mốc **cứng**: sau ngày này credit hết hiệu lực ⇒ phải **upgrade** hoặc **teardown** |
| `get-free-tier-usage` | chỉ trả về **9 meter "Always Free"** | Xác nhận **không tồn tại** meter 12-month cho EC2/RDS/S3 ⇒ không thể viện lý do "nằm trong Free Tier 12 tháng" |

> ⚠️ **Ghi chú kỹ thuật:** `aws billing get-credits` trả về `AccessDeniedException: IAM user access not activated` — API credit **chỉ cho root/đã kích hoạt**. Vì vậy số dư credit được lấy qua **Free Tier `get-account-plan-state`** (đọc được bằng IAM user) + đối chiếu dòng `Credit` trong Cost Explorer. Không cần mở quyền root cho task này.


---

## 3. 📊 BẰNG CHỨNG 1 — HOÁ ĐƠN NET `$0.00` & GROSS USAGE THẬT

### 3.1. Net theo tháng — đúng thứ AWS Billing hiển thị

*(`ce get-cost-and-usage`, `UnblendedCost`, 06/2026 → 10/11/2026)*

| Tháng | Usage (gross) | Credit | Tax | **NET (Billing)** |
| :--- | ---: | ---: | ---: | ---: |
| 2026-06 | 0.000000 | 0.000000 | 0.000000 | **0.000000** |
| 2026-07 | 0.000000 | 0.000000 | 0.000000 | **0.000000** |
| 2026-08 | 0.000000 | 0.000000 | 0.000000 | **0.000000** |
| 2026-09 | 0.003947 | −0.003947 | 0.000000 | **−0.000000** |
| 2026-10 | 0.017933 | −0.017933 | 0.000000 | **−0.000000** |
| 2026-11 *(01→10)* | 3.231296 | −3.231297 | 0.000000 | **−0.000000** |
| **TỔNG** | **3.253176** | **−3.253176** | **0.000000** | **−0.000000** |

> ✅ **Cột NET = `$0.00`** ở **mọi tháng**. Giá trị âm `-0.0000000616` USD là **sai số làm tròn của credit** (credit tính theo giờ, usage tính theo tháng) — **không phải** hoàn tiền, **không phải** nợ.
> ✅ **Tax = `$0.00`** ⇒ không có thuế phát sinh.

### 3.2. Chi tiết theo ngày (11/2026) — không có khoản "nổ" bất thường

| Ngày | NET | Ngày | NET |
| :--- | ---: | :--- | ---: |
| 01/11 | 0.000000 | 06/11 | −0.0000000077 |
| 02/11 | −0.0000000034 | 07/11 | −0.0000000083 |
| 03/11 | −0.0000000083 | 08/11 | −0.0000000083 |
| 04/11 | −0.0000000083 | 09/11 | −0.0000000090 |
| 05/11 | −0.0000000083 | 10/11 | 0.000000 |

> Ngày **09/11** là lúc EC2 `t3.micro` được launch (`LaunchTime = 2026-11-09T04:23:05Z`) — net **vẫn** không dương.

### 3.3. Gross theo dịch vụ — 11/2026 (01→10)

| Dịch vụ | Usage (gross) | Credit bù | NET |
| :--- | ---: | ---: | ---: |
| Amazon Relational Database Service | **2.981227** | −2.981223 | 0.000004 |
| Amazon Elastic Compute Cloud – Compute | 0.105600 | −0.105600 | 0.000000 |
| AWS Cost Explorer *(audit này)* | 0.060000 | −0.060000 | 0.000000 |
| Amazon Virtual Private Cloud *(public IPv4)* | 0.057346 | −0.057346 | 0.000000 |
| EC2 – Other *(EBS gp3)* | 0.021345 | −0.021333 | 0.000012 |
| AWS Secrets Manager | 0.004948 | −0.004948 | −0.000000 |
| Amazon Simple Storage Service | 0.000487 | −0.000487 | −0.000000 |
| Amazon EC2 Container Registry (ECR) | 0.000344 | −0.000344 | 0.000000 |
| AWS Data Transfer | 0.000000 | −0.000016 | −0.000016 |
| Amazon CloudFront · SNS · CloudWatch · KMS · Glue | 0.000000 | 0.000000 | 0.000000 |
| **TỔNG** | **3.231296** | **−3.231297** | **−0.000000** |

> 🔍 **RDS chiếm `92.3 %`** gross usage (2.981227 / 3.231296) — **chi phí ẩn lớn nhất** mà bảng chi phí của `P3-Q02` chưa tính (xem R2, §7).
> 🔍 CloudFront + S3 + SNS + CloudWatch + KMS + Glue = **`$0.000000`** đúng nghĩa, **không** nhờ credit ⇒ phần "Always Free" **thực sự** đang gánh các dịch vụ này.

### 3.4. Đơn giá thực đo (unit economics) — dùng cho mọi dự báo ở §6

| Usage type | Số lượng (11/2026, 01→10) | Gross USD | **Đơn giá suy ra** |
| :--- | ---: | ---: | ---: |
| `APS1-InstanceUsage:db.t4g.micro` | 93.6739 h | 2.341847 | **$0.025000/h** |
| `APS1-RDS:GP3-Storage` | 4.6332 GB-tháng | 0.639376 | **$0.138000/GB-tháng** |
| `APS1-BoxUsage:t3.micro` | 8.0000 h | 0.105600 | **$0.013200/h** |
| `USE1-APIRequest` *(Cost Explorer)* | 6 request | 0.060000 | **$0.010000/request** |
| `APS1-PublicIPv4:InUseAddress` | 11.3858 h | 0.056929 | **$0.005000/h** |
| `APS1-EBS:VolumeUsage.gp3` | 0.2222 GB-tháng | 0.021333 | **$0.096000/GB-tháng** |
| `APS1-AWSSecretsManager-Secret` | 0.0123 secret-tháng | 0.004928 | **$0.400000/secret-tháng** |
| `APS1-PublicIPv4:IdleAddress` | 0.0833 h | 0.000417 | $0.005000/h |
| `APS1-TimedStorage-ByteHrs` *(CloudWatch Logs)* | 0.0035 GB-tháng | 0.000345 | $0.099113/GB-tháng |
| `APS1-Requests-Tier1` / `Tier2` *(S3)* | 115 / 239 request | 0.000225 / 0.000096 | ~$0.000002 / $0.0000004 |

> 💡 Đây là **"sự thật đo được"** thay cho các con số *"ước tính"* trong `P3-Q02` §8.1. So sánh: EC2 thực **`$0.0132/h`** (ước tính cũ `$0.0128/h`, lệch ~3 %), EBS gp3 thực **`$0.096/GB-tháng`** (ước tính cũ `$0.0027/GB-tháng` → **sai ~35 lần**).


---

## 4. 🛡️ BẰNG CHỨNG 2 — BUDGET GUARD & FREE TIER HEAD-ROOM

### 4.1. AWS Budgets (thực trạng 10/11/2026)

| Thuộc tính | Giá trị thật | Ghi chú |
| :--- | :--- | :--- |
| `BudgetName` | **`fpl-freetier-guard-1usd`** | ⚠️ Tên còn "1usd" trong khi limit là `$100` — chỉ là **tên cũ**, không phải lỗi cấu hình (xem **R4** §7) |
| `BudgetType` / `TimeUnit` | `COST` / `MONTHLY` | Đúng thiết kế `P2-Q03` |
| `BudgetLimit` | **`$100.00`** | ✅ **Đã được Dev + Tech Lead chốt** (10/11/2026) thay cho `$1.00`, để tránh cảnh báo nhiễu khi EC2+RDS chạy 24/7 |
| `ActualSpend` | **`$0.00`** → **0.00 %** limit | ✅ Khớp hoá đơn net |
| `ForecastedSpend` | `$2.024` → **2.02 %** limit | Mô hình Budgets **có tính credit** |
| `CostFilters` | `null` (toàn tài khoản) | ✅ Không lọc service ⇒ không "lọt lưới" |
| `CostTypes` | `null` = mặc định AWS (**include credit/refund/tax/discount**) | ✅ `ACTUAL` nhìn theo **net** |

**Ngưỡng cảnh báo đang bật** (`describe-notifications-for-budget`):

| Loại | Điều kiện | Quy ra tiền | Trạng thái |
| :--- | :--- | ---: | :---: |
| `ACTUAL` | `GREATER_THAN 80 %` | **$80.00** | `OK` |
| `ACTUAL` | `GREATER_THAN 100 %` | **$100.00** | `OK` |
| `FORECASTED` | `GREATER_THAN 100 %` | **$100.00** | `OK` |

> Kênh nhận cảnh báo: SNS topic **`fpl-budget-alert-topic`** → email `phanhuyquang1101@gmail.com` (đã `Confirmed` từ `P2-Q03`; minh chứng trong `infra/aws/budget_alert_setup.md` §10–§11).
> 📌 Tài khoản đang dùng **1/2 budget miễn phí** — **không tạo budget thứ 3** (bị tính `$0.02/ngày/budget`).

### 4.2. Free Tier head-room (`aws freetier get-free-tier-usage`)

| Dịch vụ | Meter | Đã dùng | Hạn mức | **% đã dùng** | Loại |
| :--- | :--- | ---: | ---: | ---: | :--- |
| Amazon SNS | `APS1-DeliveryAttempts-SMTP` | 4 | 1 000 | **0.4000 %** | Always Free |
| AWS KMS | `KMS-Requests` | 72 | 20 000 | **0.3600 %** | Always Free |
| Amazon SNS | `APS1-Requests-Tier1` | 70 | 1 000 000 | 0.0070 % | Always Free |
| AWS Glue | `Catalog-Request` | 61 | 1 000 000 | 0.0061 % | Always Free |
| AmazonCloudWatch | `CW:Requests` | 25 | 1 000 000 | 0.0025 % | Always Free |
| Amazon CloudFront | `Requests-Tier1` | 59 | 10 000 000 | 0.0006 % | Always Free |
| Amazon SNS | `Requests-Tier1` *(us-east-1)* | 3 | 1 000 000 | 0.0003 % | Always Free |
| Amazon CloudFront | `DataTransfer-Out-Bytes` | 0.0017 GB | 1 024 GB | 0.0002 % | Always Free |
| AmazonCloudWatch | `TimedStorage-ByteHrs` | ≈0 GB | 5 GB | 0.0000 % | Always Free |

> ✅ **Meter cao nhất mới dùng `0.40 %`** hạn mức ⇒ dư địa Free Tier rất lớn.
> ❗ **Không có dòng nào thuộc loại "12 Months Free"** (EC2 750 h, RDS 750 h, S3 5 GB) ⇒ khẳng định ở §1.1–**T1** là **có bằng chứng**, không phải suy đoán.

---

## 5. 🧾 BẢNG ĐỐI SOÁT TÀI NGUYÊN ↔ CHI PHÍ (RECONCILIATION MATRIX)

> Mỗi tài nguyên **đang tồn tại thật** trên account, đối chiếu chéo với dòng usage/chi phí tương ứng.
> Chi phí ghi theo **gross** (trước credit) — cột **Net** luôn `$0.00` nhờ credit.

| # | Tài nguyên (ID thật) | Cấu hình | Meter/usage type | Gross 11/2026 | Δ nếu để 24/7 (tháng) |
| :-: | :--- | :--- | :--- | ---: | ---: |
| 1 | **RDS** `fpl-fantasy-db` | `db.t4g.micro`, PG 15.17, Single-AZ `ap-southeast-1b` | `APS1-InstanceUsage:db.t4g.micro` | **2.341847** | **$18.25** |
| 2 | **RDS storage** | 20 GB `gp3`, backup retention 1 ngày | `APS1-RDS:GP3-Storage` | 0.639376 | $2.76 |
| 3 | **EC2** `i-0f1e71fa1a78b0013` | `t3.micro`, AL2023, launch 09/11 | `APS1-BoxUsage:t3.micro` | 0.105600 | **$9.64** |
| 4 | **EBS** `vol-026e3b02755b1e86e` | 20 GB `gp3`, `ap-southeast-1a` | `APS1-EBS:VolumeUsage.gp3` | 0.021333 | $1.92 |
| 5 | **Public IPv4** | `54.255.194.74` (auto-assign, **không** EIP) | `APS1-PublicIPv4:InUseAddress` | 0.056929 | **$3.65** |
| 6 | **Secrets Manager** `fpl/backend/rds` | 1 secret, rotation **off** | `APS1-AWSSecretsManager-Secret` | 0.004928 | $0.40 |
| 7 | **ECR** `fpl-backend` | 10 tag, scan-on-push bật | `APS1-TimedStorage-ByteHrs` (ECR) | 0.000345 | *ước tính* ~$0.13–0.20 |
| 8 | **S3** `fpl-lineup-frontend-prod` | private 100 % + SSE-S3 + versioning | `APS1-Requests-Tier1/2` | 0.000321 | *ước tính* ~$0.01 |
| 9 | **CloudFront** `E3N44ZRJO1UZ2C` | `PriceClass_All`, HTTP/2+3 | `APS1-CloudFront-*` | **0.000000** | **$0.00** (1 TB free) |
| 10 | **SNS** `fpl-budget-alert-topic` | 1 email sub `Confirmed` | `APS1-Requests-Tier1` (SNS) | 0.000000 | $0.00 |
| 11 | **Budgets** `fpl-freetier-guard-1usd` | 3 notification | — | 0.000000 | $0.00 (2 budget free) |
| 12 | **Cost Explorer API** | *chính đợt audit này* | `USE1-APIRequest` | **0.060000** | biến thiên theo số request |
| — | *(không tồn tại)* NAT GW · ALB · WAF · CloudWatch Logs · EIP · KMS CMK · Route 53 · ACM | — | — | **0.000000** | **$0.00** |
| | **TỔNG GROSS** | | | **3.231296** | **$36.616** *(dòng 1–6, tính bằng script ở §6.3)* + ~$0.15 *(dòng 7–8, ước tính)* |

**Kết luận đối soát:** 12 nhóm tài nguyên **có thật** đều tìm được **đúng dòng chi phí** tương ứng (không có khoản "mồ côi"); 8 hạng mục **không tồn tại** và cũng **không** phát sinh chi phí (`$0.000000`). Không có tài nguyên nào ở region khác (inventory quét `ap-southeast-1` + `global`) ⇒ **không có chi phí ẩn ngoài region chuẩn**.


---

## 6. 📈 DỰ BÁO & "ĐỒNG HỒ NHIÊN LIỆU" (RUNWAY)

### 6.1. Dự báo phần còn lại của 11/2026

| Chỉ số | Giá trị | Nguồn |
| :--- | ---: | :--- |
| Gross usage 01→10/11 (thực) | **$3.231296** | Cost Explorer |
| Forecast 11/11 → 30/11 (CE) | **$7.106782** | `ce get-cost-forecast` |
| **Gross dự kiến cả tháng 11** | **$10.338078** | Script (tổng 2 dòng trên) |
| Trung bình gross/ngày | **$0.323130** | Script (`3.231296 / 10`) |
| **NET dự kiến cả tháng 11** | **$0.00** | Credit bù |

> ⚠️ Hai mô hình dự báo **khác nhau có chủ đích**: CE forecast **không** trừ credit (`$7.11`), còn Budgets forecast **có** trừ credit (`$2.024`). Khi trích dẫn, phải ghi rõ đang nói mô hình nào — **đây là bẫy hay gặp khi bảo vệ đồ án**.

### 6.2. Vì sao gross nhảy từ `$0.018` (10/2026) lên `$10.34` (11/2026)?

| Nguyên nhân | Bằng chứng |
| :--- | :--- |
| RDS chạy **đủ 30 ngày** (10/2026 mới có từ ~25/10) | `APS1-InstanceUsage:db.t4g.micro` = 93.67 h chỉ trong 10 ngày |
| **EC2 `t3.micro` + 20 GB EBS + public IPv4** mới xuất hiện từ **09/11** (`P3-Q02`) | `LaunchTime = 2026-11-09T04:23:05Z`; `APS1-BoxUsage:t3.micro` = 8 h |
| **ECR** bắt đầu tích luỹ image từ `P3-Q03` (từ 09/11) | 10 tag, mỗi image ~316–335 MB (uncompressed) |
| Chi phí audit Cost Explorer `$0.06` | 6 request × $0.01 |

### 6.3. Trạng thái 24/7 ổn định (steady state) — tính từ **đơn giá thực đo** §3.4

| Hạng mục | Công thức | USD/tháng |
| :--- | :--- | ---: |
| RDS `db.t4g.micro` | `$0.025000 × 730 h` | 18.250000 |
| RDS storage 20 GB gp3 | `$0.138000 × 20 GB` | 2.760000 |
| EC2 `t3.micro` | `$0.013200 × 730 h` | 9.636000 |
| EBS 20 GB gp3 | `$0.096000 × 20 GB` | 1.920000 |
| Public IPv4 in-use | `$0.005000 × 730 h` | 3.650000 |
| Secrets Manager 1 secret | `$0.400000 × 1` | 0.400000 |
| **TỔNG (dòng 1–6)** | | **36.616000** |

### 6.4. Runway — khi nào "bom" nổ?

| Kịch bản | Số học | Kết quả |
| :--- | :--- | :--- |
| Giữ nguyên hạ tầng 24/7 | `$195.98 ÷ $36.616/tháng` | **5.35 tháng** credit (≈ **606 ngày** nếu tính theo burn tháng 11 `$0.32313/ngày`) |
| **Mốc cứng của gói Free plan** | `accountPlanExpirationDate` | **15/03/2027** ← **ràng buộc thật, đến trước khi cạn credit** |
| Ngưỡng cảnh báo Budget (80 %) | `$100.00 × 0.8` | **$80.00** — còn cách **$63.38** so với steady state 24/7 |
| Kế hoạch teardown đã duyệt (`P3-Q02` §2.2) | — | **≤ 06/12/2026** (trước mốc 15/03/2027 ⇒ **an toàn**) |

> ✅ **Kết luận:** với hạ tầng hiện tại + kế hoạch teardown **06/12/2026**, tài khoản **không thể** phát sinh hoá đơn thực trong thời gian làm đồ án. Nếu ai đó **quên teardown**, mốc nguy hiểm là **15/03/2027** (hết gói) chứ không phải lúc cạn credit.

---

## 7. 🚨 PHÁT HIỆN & RỦI RO (RISK REGISTER — cần xử lý ngoài task này)

> Task `P3-Q04` là **Level 1 – chỉ viết tài liệu**. Mọi thay đổi hạ tầng dưới đây **KHÔNG** được thực hiện ở đây; ghi lại để Tech Lead quyết định.

| # | Mức | Phát hiện (đo được) | Tác động | Đề xuất |
| :-: | :--- | :--- | :--- | :--- |
| **R1** | 🔴 Cao | **Gói Free plan hết hạn `15/03/2027`**; credit còn `$195.98` | Sau mốc này bill sẽ **tính tiền thật** (~$36.6/tháng) | Teardown **≤ 06/12/2026** theo `P3-Q02` §8.3; nếu cần giữ, lập kế hoạch **upgrade + ngân sách** |
| **R2** | 🟠 TB | Bảng chi phí `P3-Q02` §8.1 **bỏ sót RDS** (thực tế **92.3 %** gross usage) và **sai đơn giá EBS ~35 lần** | Ước tính "$11–12/tháng" thấp hơn thực tế (**$36.6/tháng**) ~3 lần | Khi trích dẫn trong báo cáo, dùng **số đo được** của tài liệu này (§3.4), không dùng bảng cũ |
| **R3** | 🟠 TB | **ECR `fpl-backend` đã có 10 tag**, mỗi image ~316–335 MB (uncompressed), `MUTABLE`, **chưa có lifecycle policy** | Tăng dần $0.10/GB-tháng; mỗi lần CI/CD push thêm image `latest` + `sha` | Thêm **lifecycle policy** (giữ 3 image gần nhất) — Level 4, task riêng |
| **R4** | 🟢 **ĐÃ CHỐT** | **Budget limit thực = `$100.00`** — **quyết định có chủ đích của Dev (Quang) + Tech Lead (10/11/2026)** để tránh cảnh báo nhiễu (`$1` bị vượt ngay khi EC2+RDS chạy). Tồn đọng **chỉ còn là đồng bộ tài liệu**: `P2-Q03` ghi `$1.00`, `P3-Q02` §2.3 ghi `$10.00`, tên budget `fpl-freetier-guard-1usd` | Không còn rủi ro vận hành; chỉ rủi ro **hiểu sai khi đọc tài liệu cũ** | **Không đổi lại `$1.00`.** Việc cần làm: cập nhật `infra/aws/budget_policy.json` (`Amount: "100.0"`) + ghi chú vào `P2-Q03`/`P3-Q02` (**Level 4**, task riêng). Cân nhắc đổi tên `…-1usd` → `…-100usd` ở lần sửa tới |
| **R5** | 🟡 Thấp | **RDS SG** `sg-0f5970a2c3b47878a` còn rule `5432` từ **`14.191.166.167/32`** (IP dev) bên cạnh rule `SG→SG` | RDS `PubliclyAccessible=false` nên hiện **không khai thác được**, nhưng là **drift** so với `security_groups.md` | Revoke rule CIDR khi không cần truy cập DB từ máy cá nhân |
| **R6** | 🟡 Thấp | **SG mồ côi** `launch-wizard-1` (`sg-0cc107941e7bebe43`) còn mở **22/80/443/8080 = 0.0.0.0/0**, **không gắn** ENI/instance nào | Rủi ro tiềm ẩn nếu ai đó gắn nhầm SG này vào instance mới | Xoá SG mồ côi (miễn phí, giảm bề mặt tấn công) |
| **R7** | 🟡 Thấp | 4 snapshot RDS `fpl-fantasy-db-*` (mỗi cái khai báo 20 GB) tích luỹ từ `P2-Q01` | Snapshot vượt hạn mức free ⇒ $0.095/GB-tháng | Rà soát, xoá snapshot cũ không cần (Level 3/4 — thao tác dữ liệu) |
| **R8** | 🟡 Thấp | `aws billing get-credits` **bị chặn** với IAM user (`IAM user access not activated`) | Không đọc được số dư credit bằng CLI chuẩn | Dùng `freetier get-account-plan-state`; hoặc root kích hoạt quyền credit nếu cần |


---

## 8. 🧯 KỊCH BẢN GIẢM/TẮT CHI PHÍ (3 mức)

> ⚠️ Đây là **runbook tham chiếu** — `P3-Q04` **không thực thi** lệnh nào trong mục này. Người thực hiện phải là **Quang (owner tài khoản)** sau khi Tech Lead duyệt (Level 4).

### 8.1. Mức 1 — Giảm ngay `$18.25/tháng` (không mất dữ liệu)

```bash
# Dừng EC2 (giữ EBS + dữ liệu). Vẫn tốn EBS ~$1.92 + public IPv4 nhả ra
aws ec2 stop-instances --region ap-southeast-1 --instance-ids i-0f1e71fa1a78b0013
# Dừng RDS tạm thời (auto-restart sau 7 ngày nếu chỉ stop)
aws rds stop-db-instance --region ap-southeast-1 --db-instance-identifier fpl-fantasy-db
```
> Mất: backend offline ngay; URL `54.255.194.74.sslip.io` **đổi IP** khi start lại ⇒ phải cập nhật `Caddyfile` + `CORS_ORIGINS` (`P3-Q02` §7.4).

### 8.2. Mức 2 — Teardown backend (đúng thứ tự, giữ RDS cho Phase 4)

Theo `infra/aws/app_runner_setup.md` **§8.3** (đã kiểm chứng): terminate EC2 → hoàn nguyên SG→SG → xoá SG/instance-profile/role → *(tuỳ chọn)* xoá secret, xoá ECR repo → kiểm tra `volumes available` + `instances` rỗng.

### 8.3. Mức 3 — Teardown toàn bộ (kết thúc đồ án)

| Thứ tự | Tài nguyên | Lệnh rút gọn | Ghi chú |
| :-: | :--- | :--- | :--- |
| 1 | CloudFront `E3N44ZRJO1UZ2C` | `aws cloudfront update-distribution --id … --if-match … --distribution-config …` (tắt `Enabled`) rồi `delete-distribution` | **Không** hoàn nguyên được |
| 2 | S3 `fpl-lineup-frontend-prod` | `aws s3 rb s3://fpl-lineup-frontend-prod --force` | Versioning bật ⇒ phải xoá **từng version** trước |
| 3 | EC2 / EBS / SG / IAM | xem §8.2 | — |
| 4 | ECR `fpl-backend` | `aws ecr delete-repository --repository-name fpl-backend --force` | Xoá cả 10 tag |
| 5 | RDS `fpl-fantasy-db` + snapshots | `aws rds delete-db-instance --db-instance-identifier fpl-fantasy-db --skip-final-snapshot` + `delete-db-snapshot` | **Mất dữ liệu vĩnh viễn** |
| 6 | Secret `fpl/backend/rds` | `aws secretsmanager delete-secret --secret-id fpl/backend/rds --force-delete-without-recovery` | — |
| 7 | **Giữ lại** Budget + SNS | — | Dùng tiếp cho đồ án sau; vẫn miễn phí |

**Kiểm tra "sạch bill" sau teardown:**
```bash
aws ec2 describe-instances --region ap-southeast-1 --query 'Reservations[].Instances[].[InstanceId,State.Name]' --output text
aws ec2 describe-volumes   --region ap-southeast-1 --query 'Volumes[].VolumeId' --output text
aws rds describe-db-instances --region ap-southeast-1 --query 'DBInstances[].DBInstanceIdentifier' --output text
aws ecr describe-repositories --region ap-southeast-1 --query 'repositories[].repositoryName' --output text
```
> Sau ~24 h, `ce get-cost-and-usage` phải về **`0.000000`** ở mọi dòng — đó là **bằng chứng tan băng** cuối cùng.

---

## 9. 🔁 QUY TRÌNH "COST GUARDIAN" HẰNG THÁNG (bàn giao vận hành)

### 9.1. Checklist 5 phút/tháng (Console — **miễn phí**)

| Bước | Đường dẫn trên AWS Management Console | Xác nhận |
| :-: | :--- | :--- |
| 1 | **Billing and Cost Management → Bills** | *Total* tháng hiện tại = **`$0.00`** |
| 2 | **Billing → Credits** | Số dư **> $100** và ngày hết hạn **15/03/2027** |
| 3 | **Billing → Budgets → `fpl-freetier-guard-1usd`** | `ACTUAL` ≈ `$0.00`, thanh tiến độ nằm trong vùng xanh |
| 4 | **Cost Explorer → Group by Service** (tháng hiện tại) | Không có dịch vụ lạ; RDS/EC2 chiếm phần lớn |
| 5 | **AWS Free Tier page** | % dùng các meter *Always Free* vẫn < 5 % |

### 9.2. Checklist 1 phút/tháng (CLI — chỉ 3 request CE = `$0.03`)

```bash
aws freetier get-account-plan-state --region us-east-1 \
  --query 'accountPlanRemainingCredits.amount' --output text
aws budgets describe-budgets --account-id 711695043505 --region us-east-1 \
  --query 'Budgets[].[BudgetName,BudgetLimit.Amount,CalculatedSpend.ActualSpend.Amount]' --output text
aws ce get-cost-and-usage --time-period Start=$(date -u +%Y-%m-01),End=$(date -u -d '+1 month' +%Y-%m-01) \
  --granularity MONTHLY --metrics UnblendedCost --region us-east-1 \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' --output text
```

### 9.3. Ảnh chụp cần đính kèm khi nộp đồ án — ✅ **Dev đã chụp 10/11/2026** (lưu **ngoài repo**, không commit binary)

| # | Ảnh | Màn hình |
| :-: | :--- | :--- |
| A1 | Hoá đơn `$0.00` | **Billing → Bills** (chọn tháng 11/2026) |
| A2 | Ngân sách | **Billing → Budgets → fpl-freetier-guard-1usd** |
| A3 | Credit & ngày hết hạn | **Billing → Credits** |
| A4 | Chi phí theo dịch vụ | **Cost Explorer** (Group by: Service) |
| A5 | Hạ tầng đang chạy | **EC2 → Instances**, **RDS → Databases**, **CloudFront → Distributions** |
| A6 | Sơ đồ kiến trúc | `docs/CLOUD_ARCHITECTURE.md` §2 (render Mermaid) |

> 🔒 Ảnh **không được** lộ: Access key, ARN có account id nếu giảng viên yêu cầu ẩn, email cá nhân, hay màn hình có tab khác chứa secret.

---

## 10. ✅ ĐỐI CHIẾU ACCEPTANCE CRITERIA `P3-Q04`

### 10.1. AC gốc trong `docs/TODO.md`

| AC | Nội dung | Trạng thái | Bằng chứng |
| :-: | :--- | :---: | :--- |
| AC-1 | *"Báo cáo chi phí trên AWS Billing hiển thị `$0.00`"* | ✅ **ĐẠT** | NET `$0.000000` mọi tháng 06→11/2026 (§3.1); Budget `ACTUAL = $0.00` (§4.1) |
| AC-2 | *"Tài liệu kiến trúc đám mây hoàn chỉnh sơ đồ hệ thống nộp giảng viên"* | ✅ **ĐẠT** | [`CLOUD_ARCHITECTURE.md`](CLOUD_ARCHITECTURE.md): 4 sơ đồ Mermaid + inventory + ma trận bảo mật |
| AC-3 *(cách kiểm chứng trong TODO)* | *"Chụp ảnh màn hình trang AWS Billing xác nhận số dư `$0.00`"* | ✅ **ĐẠT** | **Dev (Quang) đã chụp ảnh Console ngày 10/11/2026** (xác nhận trực tiếp). Ảnh lưu **ngoài repo**; danh mục A1–A6 ở §9.3 |

### 10.2. AC **đã được duyệt sửa** (theo `P3-Q02` §2.3)

> `P3-Q02` §2.3 ghi: *"Chi phí AWS **≤ ngân sách đã duyệt**; có báo cáo đối soát số thực tế + giải trình các hạng mục phát sinh"*.

| Yêu cầu của AC sửa | Kết quả | Bằng chứng |
| :--- | :--- | :--- |
| Chi phí **≤ ngân sách đã duyệt** | NET `$0.00` ≤ `$100.00` (0.00 %); dự báo tháng `$2.024` (2.02 %) | §4.1 |
| Có **báo cáo đối soát số thực tế** | Tài liệu này — gross vs credit vs net từng dòng | §3 |
| **Giải trình các hạng mục phát sinh** | RDS 92.3 %; EC2 3.3 %; CE API 1.9 %; IPv4 1.8 %; EBS/Secret/S3/ECR phần còn lại | §3.3–§3.4 |

> 📌 **Chưa tick `[x]`** cho `P3-Q04` trong `docs/TODO.md` — file theo dõi của nhóm **ngoài phạm vi 2 file** của task; Dev tự cập nhật sau khi review (xem §11).

---

## 11. ☑️ CHECKLIST BÀN GIAO CHO DEV

| # | Việc | Ai làm |
| :-: | :--- | :--- |
| 1 | Review `git diff` 2 file mới trong `docs/` | Dev (Quang) |
| 2 | Tick **`[x]`** `P3-Q04` trong `docs/TODO.md` | ✅ **Đã xong (Dev, 10/11/2026)** |
| 2b | Cập nhật 3 bộ đếm trong `docs/TODO.md` sau khi tick: `Phase 3 → **7/14** (50%)` · `TỔNG → **37/59** (62%)` · `Quang → **[4/4]**` | ✅ **Đã xong (Dev, 10/11/2026)** |
| 3 | *(AC-3)* Chụp ảnh A1–A6 theo §9.3, lưu **ngoài repo** | ✅ **Đã xong (Dev, 10/11/2026)** |
| 4 | ~~Quyết định **R4** (con số budget chuẩn)~~ → **Đã chốt `$100.00`** (Dev + Tech Lead). Việc còn lại: đồng bộ `budget_policy.json` + `P2-Q03`/`P3-Q02` | ✅ **Đã chốt** · đồng bộ tài liệu = task riêng (Level 4) |
| 5 | Lên lịch **teardown ≤ 06/12/2026** (R1) | Tech Lead + Quang |
| 6 | Xoá SG mồ côi `launch-wizard-1` + revoke CIDR `14.191.166.167/32` (R5, R6) | Quang (task riêng) |
| 7 | Thêm **ECR lifecycle policy** (R3) | Quang (task riêng) |



---

## 📚 PHỤ LỤC A — LỆNH TÁI LẬP TOÀN BỘ SỐ LIỆU

> Chạy trên máy có AWS CLI v2 + quyền `quang-devops`. **Tất cả đều read-only.** Mỗi lệnh `ce get-cost-and-usage` tốn `$0.01` ⇒ một lần đối soát đầy đủ như dưới đây ≈ **`$0.05`**.

```bash
# 0) Đúng tài khoản & đúng người dùng
aws sts get-caller-identity --output json --no-cli-pager

# 1) NET theo tháng (đúng số Billing) + tách Usage/Credit/Tax
aws ce get-cost-and-usage --time-period Start=2026-06-01,End=2026-12-01 \
  --granularity MONTHLY --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=RECORD_TYPE --region us-east-1 \
  --query 'ResultsByTime[].[TimePeriod.Start,Groups[].[Keys[0],Metrics.UnblendedCost.Amount]]' \
  --output json --no-cli-pager

# 2) Gross vs Credit theo DỊCH VỤ trong tháng hiện tại
#    ⚠️ BẪY: --group-by là nargs='+' ⇒ 2 dimension phải nằm trong MỘT flag
aws ce get-cost-and-usage --time-period Start=2026-11-01,End=2026-11-11 \
  --granularity MONTHLY --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=RECORD_TYPE Type=DIMENSION,Key=SERVICE \
  --region us-east-1 \
  --query 'ResultsByTime[].Groups[].[Keys[0],Keys[1],Metrics.UnblendedCost.Amount]' \
  --output text --no-cli-pager

# 3) Đơn giá thực đo theo usage type (chỉ phần Usage, bỏ credit)
aws ce get-cost-and-usage --time-period Start=2026-11-01,End=2026-11-11 \
  --granularity MONTHLY --metrics UnblendedCost UsageQuantity \
  --group-by Type=DIMENSION,Key=USAGE_TYPE \
  --filter '{"Dimensions":{"Key":"RECORD_TYPE","Values":["Usage"]}}' \
  --region us-east-1 \
  --query 'ResultsByTime[].Groups[].[Keys[0],Metrics.UsageQuantity.Amount,Metrics.UnblendedCost.Amount]' \
  --output text --no-cli-pager

# 4) Gói tài khoản + credit còn lại + ngày hết hạn  (KHÔNG cần root)
aws freetier get-account-plan-state --region us-east-1 --no-cli-pager

# 5) Forecast phần còn lại của tháng (CE — không trừ credit)
aws ce get-cost-forecast --time-period Start=2026-11-11,End=2026-12-01 \
  --granularity MONTHLY --metric UNBLENDED_COST --region us-east-1 --no-cli-pager

# 6) Budget + ngưỡng cảnh báo (Budgets API chỉ chạy ở us-east-1)
aws budgets describe-budgets --account-id 711695043505 --region us-east-1 \
  --query 'Budgets[].[BudgetName,BudgetLimit.Amount,CalculatedSpend.ActualSpend.Amount,CalculatedSpend.ForecastedSpend.Amount]' \
  --output text --no-cli-pager
aws budgets describe-notifications-for-budget --account-id 711695043505 \
  --budget-name fpl-freetier-guard-1usd --region us-east-1 \
  --query 'Notifications[].[NotificationType,Threshold,NotificationState]' \
  --output text --no-cli-pager
```

**Bốn cái bẫy đã gặp thật khi làm task này (ghi lại để lần sau không mất thời gian):**

| # | Bẫy | Triệu chứng | Cách đúng |
| :-: | :--- | :--- | :--- |
| B1 | `--group-by` là `nargs='+'` | Truyền 2 flag `--group-by` ⇒ **chỉ dimension cuối** được áp dụng, bảng thiếu cột | Gộp: `--group-by Type=DIMENSION,Key=A Type=DIMENSION,Key=B` |
| B2 | `UnblendedCost` khi **group theo SERVICE** đã **trừ credit** | Thấy EC2/RDS = `$0.000000` ⇒ **tưởng** không tốn tiền | Lấy **gross** bằng cách group theo `RECORD_TYPE` **và** `SERVICE` |
| B3 | CE forecast **không trừ credit**, Budgets forecast **có** trừ | Hai số `$7.11` vs `$2.024` trông "mâu thuẫn" | Ghi rõ đang nói mô hình nào; cả hai đều đúng |
| B4 | `billing get-credits` cần quyền đặc biệt | `AccessDeniedException: IAM user access not activated` | Dùng `freetier get-account-plan-state` |

---

## 📚 PHỤ LỤC B — LIÊN KẾT NHANH

| Tài nguyên | Đường dẫn |
| :--- | :--- |
| Tài liệu kiến trúc Cloud (nộp đồ án) | [`CLOUD_ARCHITECTURE.md`](CLOUD_ARCHITECTURE.md) |
| Runbook Budget guard gốc | [`infra/aws/budget_alert_setup.md`](../infra/aws/budget_alert_setup.md) · [`budget_policy.json`](../infra/aws/budget_policy.json) |
| Runbook RDS | [`infra/aws/rds_setup.md`](../infra/aws/rds_setup.md) |
| Runbook S3 + OAC | [`infra/aws/s3_setup.md`](../infra/aws/s3_setup.md) |
| Runbook CloudFront | [`infra/aws/cloudfront_setup.md`](../infra/aws/cloudfront_setup.md) |
| Runbook backend EC2 + chi phí + teardown | [`infra/aws/app_runner_setup.md`](../infra/aws/app_runner_setup.md) |
| Pipeline CI/CD | [`.github/workflows/ci_cd.yml`](../.github/workflows/ci_cd.yml) |
| AWS — Free plan & credits | <https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html> |
| AWS — Cost Explorer API pricing ($0.01/request) | <https://aws.amazon.com/aws-cost-management/aws-cost-explorer/pricing/> |
| AWS — Budgets pricing (2 budget miễn phí) | <https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/> |

---

<p align="center"><em>P3-Q04 · Fantasy Football Lineup Builder & Optimizer · AWS Free plan ($0.00 net / $36.62 steady-state gross) · Quang (DevOps & AWS Lead)</em></p>

