# 🪣 P2-Q04 — AWS S3 STATIC-HOSTING BUCKET (PRIVATE ORIGIN + CLOUDFRONT OAC) RUNBOOK

> **Task:** `P2-Q04` — *Risk Level 3 (High) theo `TODO.md`; ma trận `AI_GUIDELINES.md` xếp hạ tầng AWS là Level 4 (Critical) → xử lý như Level 4* | **Owner:** Quang (DevOps & Cloud Infrastructure Lead)
> **Git Branch:** `feature/P2-Q04-s3-bucket-setup`
> **Thư mục:** `infra/aws/` | **Files:** `s3_setup.md` (tài liệu này), `s3_bucket_policy.json` (policy + guardrails)
> **Nguồn chuẩn:** [`docs/PROJECT_SSOT.md`](../../docs/PROJECT_SSOT.md) · [`docs/PROJECT_ROADMAP.md`](../../docs/PROJECT_ROADMAP.md) · [`docs/TODO.md`](../../docs/TODO.md) · [`docs/AI_GUIDELINES.md`](../../docs/AI_GUIDELINES.md)
>
> **Mục tiêu:** Tạo bucket S3 `fpl-lineup-frontend-prod` tại `ap-southeast-1` làm **origin private 100%** cho frontend React/Vite, cấp quyền đọc **duy nhất** cho CloudFront qua **Origin Access Control (OAC)** `E2IX1YDEAHD87E`, và chứng minh bằng lệnh thật: **upload `index.html` → `GET` qua S3 API trả `HTTP 200`**, còn truy cập nặc danh trả **`403 AccessDenied`**.
>
> ℹ️ **Nguyên tắc thiết kế:** *private by default*. Bucket **không** phục vụ trực tiếp Internet; toàn bộ traffic người dùng đi qua CloudFront (P3-Q01) bằng chữ ký SigV4 của OAC.

---

## ⚠️ 0. BA MÂU THUẪN TRONG ĐỀ BÀI ĐÃ ĐƯỢC XỬ LÝ (đọc trước khi review)

| # | Nội dung lệch | Cách xử lý & lý do |
| :--- | :--- | :--- |
| **0.1** | Phần **“Mô tả”** của prompt task ghi *“Thiết lập Inbound/Outbound Rules cho Security Group: chỉ cho phép port 5432…”* — đây là nội dung của **P2-Q02** (RDS Security Group), không liên quan S3. | Bám theo **`docs/TODO.md` (P2-Q04)** + **Acceptance Criteria** của chính prompt: *bucket S3 ở `ap-southeast-1`, truy cập qua CloudFront OAC*. Security Group 5432 đã hoàn thành ở `P2-Q02` (`infra/aws/security_groups.md`) và **không được sửa lại** ở task này. |
| **0.2** | `TODO.md` mô tả *“bật Static Website Hosting, cấu hình index.html/error.html”* **mâu thuẫn** với AC *“cấu hình quyền truy cập qua CloudFront OAC”*. | **Chọn OAC.** AWS CloudFront Developer Guide: *“If your origin is an Amazon S3 bucket configured as a website endpoint, you must set it up with CloudFront as a custom origin. That means you can't use OAC”* → website endpoint **không thể** đi cùng OAC. AC là tiêu chí nghiệm thu nên được ưu tiên; **Static Website Hosting để OFF** (xem §1.2 và §10.6 để biết cách bật lại nếu nhóm đổi kiến trúc). |
| **0.3** | AC ghi *“kiểm tra phản hồi HTTP 200 qua S3 API”* nhưng bucket lại private (không thể 200 nặc danh). | `HTTP 200` đạt được bằng **S3 API có xác thực SigV4** (`aws s3api get-object` / `curl --aws-sigv4`) — đã chạy thật trong §9. Truy cập nặc danh **phải** là `403`; `HTTP 200` cho người dùng cuối sẽ đến từ **CloudFront** ở `P3-Q01`. |

> 📌 **Risk level:** `TODO.md` ghi Level 3, nhưng `AI_GUIDELINES.md` xếp *“Hạ tầng AWS, S3/CloudFront, IAM roles”* vào **LEVEL 4 (Critical)**. Task này được xử lý theo mức cao hơn: cần **Dev + Tech Lead review**, kiểm tra **AWS Budgets Alert $1.00** (`P2-Q03`) và **local dry-run**.

---

## 🧭 MỤC LỤC

| # | Nội dung | # | Nội dung |
| :--- | :--- | :--- | :--- |
| 1 | Tóm tắt quyết định kỹ thuật | 8 | Kiểm chứng (Verification) V0 → V8 |
| 2 | AWS Free Tier & hàng rào chi phí | 9 | Nhật ký bằng chứng thật (02/11/2026) |
| 3 | Kiến trúc & 3 đường truy cập | 10 | Troubleshooting |
| 4 | Yêu cầu môi trường (Prerequisites) | 11 | Rollback / Destroy |
| 5 | Triển khai bằng AWS CLI (idempotent) | 12 | Vận hành định kỳ (Guardian routine) |
| 6 | Phương án B: cấu hình bằng Console | 13 | Ranh giới task & bàn giao cho P3-Q01 |
| 7 | Policy lint 16 test cases | 14 | Checklist nghiệm thu (Acceptance Criteria) |

---

## ⚡ 1. TÓM TẮT QUYẾT ĐỊNH KỸ THUẬT

### 1.1. Bảng quyết định

| Hạng mục | Giá trị đã áp dụng | Lý do (Security / Cost) |
| :--- | :--- | :--- |
| **Bucket name** | `fpl-lineup-frontend-prod` | Đúng `S3_BUCKET_NAME` trong `PROJECT_SSOT.md` §5; đã kiểm tra trống (`head-bucket` → 404) trước khi tạo. |
| **Region** | `ap-southeast-1` (Singapore) | Chuẩn hoá theo SSOT; cùng region với RDS `P2-Q01` → không phát sinh phí cross-region. |
| **Object Ownership** | `BucketOwnerEnforced` (ACL **tắt**) | **Bắt buộc** để dùng OAC (AWS docs); triệt tiêu nguy cơ “object ACL public”. |
| **Block Public Access** | **4/4 = true** | Lớp chặn cứng: dù có người dán policy public, S3 **từ chối** (§9 – G3). |
| **Bucket policy** | 3 statement: deny HTTP thường, deny upload thiếu SSE, allow CloudFront `s3:GetObject` **có điều kiện** | Không tồn tại `Allow` nào cho `Principal: *`. |
| **CloudFront access** | **Origin Access Control** `E2IX1YDEAHD87E` (SigV4, `SigningBehavior: always`) | Thay OAI (legacy). OAC hỗ trợ SSE-KMS, mọi region. |
| **Điều kiện policy hiện tại** | `AWS:SourceAccount = 711695043505` | Distribution chưa tồn tại ở Phase 2 → **P3-Q01 siết thành `AWS:SourceArn`** (§13.2). |
| **Static Website Hosting** | **OFF** (cố ý) | Xung đột với OAC (§0.2). SPA được phục vụ qua CloudFront + custom error 403/404 → `/index.html`. |
| **Encryption at rest** | SSE-S3 `AES256`, `BucketKeyEnabled = true` | Miễn phí; không dùng KMS CMK → **không phí request KMS**. |
| **Encryption in transit** | `DenyInsecureTransport` (`aws:SecureTransport = false` → deny `s3:*`) | Không ai đọc/ghi qua HTTP thường (§9 – G2). |
| **Upload an toàn** | `DenyUnencryptedObjectUploads` (bắt buộc header SSE) | **Mọi lệnh upload phải có `--sse AES256`**, thiếu sẽ `AccessDenied` (§10). |
| **Versioning** | `Enabled` | Cứu hộ khi deploy ghi đè hỏng; rollback = copy lại version cũ. |
| **Lifecycle** | abort multipart 7 ngày · xoá noncurrent version 30 ngày · xoá delete-marker mồ côi | Versioning **không** phình vô hạn → giữ trong 5 GB Free Tier. |
| **Tags** | `Project`, `Environment=prod`, `Owner=Quang`, `Task=P2-Q04`, `ManagedBy=aws-cli`, `CostControl=aws-free-tier`, `DataClass=public-static-assets` | Truy vết chi phí trên Billing/Cost Explorer. |
| **Chi phí** | **$0.00** | Xem §2. |

### 1.2. Vì sao **không** bật Static Website Hosting (để Tech Lead đối chiếu)

| Tiêu chí | S3 website endpoint | CloudFront + OAC (đã chọn) |
| :--- | :--- | :--- |
| Bảo mật | Phải mở `s3:GetObject` cho `Principal: *` → bucket **public** | Bucket **private**, chỉ CloudFront ký SigV4 được đọc |
| HTTPS | Không có TLS, không gắn được ACM | HTTPS + ACM miễn phí (`P3-Q01`) |
| SPA routing (F5 không 404) | Không hỗ trợ tốt | `CustomErrorResponse 403/404 → /index.html (200)` |
| Cache toàn cầu | Không | CloudFront edge + `Cache-Control` |
| CDN / DDoS / WAF | Không | Có (Shield Standard; WAF tuỳ chọn) |
| Tương thích OAC | **Không** (AWS docs khẳng định) | **Có** |

> 🔁 Muốn quay lại website endpoint: xem §10.6 (quy trình bật có kiểm soát + hậu quả bảo mật phải chấp nhận).

---

## 💰 2. AWS FREE TIER & HÀNG RÀO CHI PHÍ

### 2.1. Hạn mức áp dụng

| Tài nguyên | Hạn mức Free Tier | Cấu hình này | Trạng thái |
| :--- | :--- | :--- | :--- |
| S3 Standard storage | **5 GB** | Frontend build ~2–5 MB (versioning × 2 bản ≈ 10 MB) | ✅ Rất xa trần |
| S3 `GET` requests | **20.000 / tháng** | Demo + test thủ công | ✅ |
| S3 `PUT` requests | **2.000 / tháng** | Mỗi lần deploy = vài chục object | ✅ |
| Data transfer out (Internet) | **100 GB / tháng** (toàn tài khoản) | Đi qua CloudFront → không tính từ S3 | ✅ |
| CloudFront | **1 TB** transfer + **10 triệu** request / tháng | Chưa tạo distribution (P3-Q01) | ✅ |
| SSE-S3 (AES256) | **Miễn phí** | Đang bật | ✅ |
| KMS CMK | **$1/tháng + phí request** | **Không dùng** | ✅ |
| CloudFront invalidation | 1.000 path/tháng miễn phí, sau đó **$0.005/path** | P3-Q01 chỉ invalidate `/index.html` hoặc dùng versioned filenames | ⚠️ Cần kỷ luật |
| S3 website hosting feature | Miễn phí (nhưng **không** dùng) | OFF | — |

### 2.2. 4 cạm bẫy khiến “Free Tier” thành **có phí** (đã chặn)

1. **Versioning không giới hạn** → mỗi deploy giữ mọi bản cũ. → Đã có lifecycle `expire-noncurrent-versions-30d`.
2. **Multipart upload bị bỏ dở** (CI kill giữa chừng) → phần đã upload vẫn tính tiền. → `abort-incomplete-multipart-7d`.
3. **Dùng KMS CMK** thay SSE-S3 → $1/CMK/tháng + request. → Policy chỉ cho `AES256`/`aws:kms` nhưng **bucket dùng AES256**; không tạo CMK nào.
4. **Bật website endpoint + policy public** → bot quét, phát tán file, **hoá đơn CDN**. → BPA 4/4 + không website config.

> 🛡️ **Điều kiện tiên quyết:** `P2-Q03` — AWS Budgets Alert **$1.00** (`infra/aws/budget_policy.json`) phải đang ACTIVE với 3 ngưỡng (80%, 100% ACTUAL, 100% FORECASTED). Task này đã chạy khi budget guard đang bật.


---

## 🏗️ 3. KIẾN TRÚC & 3 ĐƯỜNG TRUY CẬP

```
        Người dùng (browser)
              │  HTTPS  (P3-Q01)
              ▼
   ┌──────────────────────────────────────┐
   │ CloudFront distribution (P3-Q01)     │
   │  - ACM certificate (HTTPS)           │
   │  - CustomError 403/404 → /index.html │
   │  - OriginAccessControlId =           │
   │    E2IX1YDEAHD87E  (sigv4, always)   │
   └───────────────┬──────────────────────┘
                   │  SigV4 signed GET (HTTPS, private)
                   ▼
   ┌───────────────────────────────────────────────────────────┐
   │ S3 bucket: fpl-lineup-frontend-prod  (ap-southeast-1)     │
   │  Block Public Access 4/4 ✔   ACL OFF ✔   SSE-S3 ✔        │
   │  Versioning ✔   Lifecycle ✔   Website hosting OFF ✘       │
   │  Policy: deny HTTP · deny upload thiếu SSE · allow OAC     │
   └───────────────▲───────────────────────────────────────────┘
                   │  SigV4 (IAM user quang-devops / CI role)
                   │  aws s3api / aws s3 sync --sse AES256
        Dev & CI (deploy, verify)

   ✘ Anonymous  https://fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com/index.html  →  403 AccessDenied
```

### 3.1. Ba đường truy cập và kết quả mong đợi

| Đường | Danh tính | Kết quả | Dùng cho |
| :--- | :--- | :--- | :--- |
| **A. Nặc danh (Internet)** | Không | **403 AccessDenied** | Bị chặn vĩnh viễn — đúng thiết kế |
| **B. CloudFront (OAC)** | Service principal `cloudfront.amazonaws.com` + `AWS:SourceAccount`/`SourceArn` | **200** (sau `P3-Q01`) | Người dùng cuối |
| **C. S3 API có xác thực** | IAM user `quang-devops` / role CI | **200** | Deploy, kiểm chứng AC |

### 3.2. Vì sao bucket private mà vẫn “static hosting” được?

S3 **không cần** public để host file. “Static hosting” ở kiến trúc này = **(S3 lưu object) + (CloudFront phục vụ) + (OAC ký request)**. Lợi ích: bucket không có bề mặt tấn công công khai, nhưng vẫn có CDN toàn cầu + HTTPS + SPA fallback.

---

## 🧰 4. YÊU CẦU MÔI TRƯỜNG (PREREQUISITES)

### 4.1. Công cụ

| Công cụ | Phiên bản đã dùng | Ghi chú |
| :--- | :--- | :--- |
| AWS CLI v2 | `2.39.3` | Bắt buộc ≥ 2.15 (có `--aws-sigv4` khi test bằng curl) |
| Python | 3.x | Chỉ dùng để **trích `PolicyDocument`** từ envelope JSON |
| curl | `8.21.0` | Kiểm tra HTTP status thật (`--aws-sigv4`) |
| Terraform | `1.16.6` | **Không dùng ở task này** (giới hạn 2 file, xem §13.3) |

### 4.2. Quyền IAM tối thiểu cần có

```
s3:CreateBucket, s3:PutBucketPolicy, s3:GetBucketPolicy, s3:GetBucketPolicyStatus,
s3:PutBucketPublicAccessBlock, s3:GetBucketPublicAccessBlock,
s3:PutBucketOwnershipControls, s3:PutBucketEncryption, s3:PutBucketVersioning,
s3:PutBucketLifecycleConfiguration, s3:PutBucketTagging,
s3:PutObject, s3:GetObject, s3:ListBucket
cloudfront:CreateOriginAccessControl, cloudfront:GetOriginAccessControl
```

### 4.3. ⚠️ Bẫy môi trường Windows đã gặp thật (ghi lại để người sau không mất thời gian)

1. **AWS CLI là binary Windows native** → nó **không đọc được** đường dẫn kiểu MSYS `/tmp/policy.json`. Phải dùng đường dẫn Windows, ví dụ `C:/Users/<user>/AppData/Local/Temp/policy.json` (`cygpath -m /tmp` để đổi).
2. **`python` trên MSYS** hiểu `/tmp` là `C:\tmp` (không tồn tại) → `FileNotFoundError`. Dùng đường dẫn tuyệt đối Windows.
3. **Pager `-- More --`** làm lệnh CloudFront treo. → **Luôn thêm `--no-cli-pager`** cho mọi lệnh `aws`.
4. **`--query` không trả `ResponseMetadata.HTTPStatusCode`** với `get-object` → muốn thấy HTTP code thật, dùng `curl --aws-sigv4` (§8 – V4) hoặc `--debug`.
5. **Heredoc `python - <<'PY'`** có thể treo shell trong VS Code terminal → viết script ra file tạm rồi chạy.


---

## 🚀 5. TRIỂN KHAI BẰNG AWS CLI (IDEMPOTENT)

> Chạy từ **root repo** (`d:\VScode\Projects\epl-fantasy-lineups`). Các lệnh dưới đây **idempotent** — chạy lại không tạo tài nguyên trùng (xem §5.7).

### 5.1. Biến môi trường & tiền kiểm

```bash
export AWS_REGION=ap-southeast-1
export BUCKET=fpl-lineup-frontend-prod

aws sts get-caller-identity --no-cli-pager
# KY VONG: arn:aws:iam::711695043505:user/quang-devops

aws s3api head-bucket --bucket "$BUCKET" --no-cli-pager
# KY VONG lan dau: An error occurred (404) ... Not Found   -> ten bucket con trong
# Sau khi da tao: lenh tra ve rong (exit 0)
```

### 5.2. Tạo bucket đúng region

```bash
aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1 \
  --no-cli-pager
```

> ❗ Thiếu `--create-bucket-configuration LocationConstraint=ap-southeast-1` → `IllegalLocationConstraintException` (mọi region khác `us-east-1` đều bắt buộc tham số này).
> Kết quả thật: `"BucketArn": "arn:aws:s3:::fpl-lineup-frontend-prod"`.


### 5.3. Bật 6 lớp cấu hình bảo mật / chi phí

```bash
# (1) Block Public Access 4/4 - lop chan cung, khong the vo tinh mo public
aws s3api put-public-access-block --bucket "$BUCKET" --no-cli-pager \
  --public-access-block-configuration '{"BlockPublicAcls":true,"IgnorePublicAcls":true,"BlockPublicPolicy":true,"RestrictPublicBuckets":true}'

# (2) Tat ACL - bat buoc de dung OAC
aws s3api put-bucket-ownership-controls --bucket "$BUCKET" --no-cli-pager \
  --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'

# (3) Ma hoa mac dinh SSE-S3 (mien phi) + bucket key
aws s3api put-bucket-encryption --bucket "$BUCKET" --no-cli-pager \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'

# (4) Versioning - rollback khi deploy hong
aws s3api put-bucket-versioning --bucket "$BUCKET" --no-cli-pager \
  --versioning-configuration Status=Enabled

# (5) Lifecycle - chan versioning phinh to + don multipart bo do
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --no-cli-pager \
  --lifecycle-configuration '{"Rules":[{"ID":"abort-incomplete-multipart-7d","Status":"Enabled","Filter":{"Prefix":""},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}},{"ID":"expire-noncurrent-versions-30d","Status":"Enabled","Filter":{"Prefix":""},"NoncurrentVersionExpiration":{"NoncurrentDays":30}},{"ID":"expire-old-delete-markers-7d","Status":"Enabled","Filter":{"Prefix":""},"Expiration":{"ExpiredObjectDeleteMarker":true}}]}'

# (6) Tags - truy vet chi phi
aws s3api put-bucket-tagging --bucket "$BUCKET" --no-cli-pager \
  --tagging '{"TagSet":[{"Key":"Project","Value":"epl-fantasy-lineups"},{"Key":"Environment","Value":"prod"},{"Key":"Owner","Value":"Quang"},{"Key":"Task","Value":"P2-Q04"},{"Key":"ManagedBy","Value":"aws-cli"},{"Key":"CostControl","Value":"aws-free-tier"},{"Key":"DataClass","Value":"public-static-assets"}]}'
```

> 💡 **PowerShell:** thay `\` cuối dòng bằng `` ` `` và giữ nguyên khối JSON trong **nháy đơn** `'...'` (PowerShell coi là literal string, không cần escape `"`).

### 5.4. Áp bucket policy (từ envelope JSON)

`s3_bucket_policy.json` là **envelope kiểm toán** (`Metadata` + `BucketIdentity` + `PolicyDocument` + guardrails). S3 **chỉ nhận policy document thuần** → phải trích `PolicyDocument` ra file tạm **không commit**:

```bash
# Git Bash / WSL tren Windows: AWS CLI khong doc duoc /tmp -> phai dung duong dan Windows
OUT="$(cygpath -m /tmp)/p2q04_applied_policy.json"
python -c "import json,sys;d=json.load(open(sys.argv[1],encoding='utf-8'));json.dump(d['PolicyDocument'],open(sys.argv[2],'w',encoding='utf-8'),indent=2)" \
  infra/aws/s3_bucket_policy.json "$OUT"

aws s3api put-bucket-policy --bucket "$BUCKET" --policy "file://$OUT" --no-cli-pager
aws s3api get-bucket-policy-status --bucket "$BUCKET" --no-cli-pager
# KY VONG: {"PolicyStatus": {"IsPublic": false}}
```

```powershell
# PowerShell
$out = Join-Path $env:TEMP 'p2q04_applied_policy.json'
python -c "import json,sys;d=json.load(open(sys.argv[1],encoding='utf-8'));json.dump(d['PolicyDocument'],open(sys.argv[2],'w',encoding='utf-8'),indent=2)" infra/aws/s3_bucket_policy.json $out
aws s3api put-bucket-policy --bucket fpl-lineup-frontend-prod --policy "file://$out" --no-cli-pager
```


### 5.5. Tạo CloudFront Origin Access Control

```bash
aws cloudfront create-origin-access-control --no-cli-pager \
  --origin-access-control-config '{"Name":"fpl-frontend-oac","Description":"P2-Q04 - SigV4 OAC for fpl-lineup-frontend-prod (attached to distribution in P3-Q01)","SigningProtocol":"sigv4","SigningBehavior":"always","OriginAccessControlOriginType":"s3"}'
```

> ✅ Đã tạo: **`Id = E2IX1YDEAHD87E`** — `arn:aws:cloudfront::711695043505:origin-access-control/E2IX1YDEAHD87E`.
> ⚠️ Lệnh này **không idempotent**: chạy lại tạo OAC thứ 2 (miễn phí nhưng gây rác). Kiểm tra trước:
> ```bash
> aws cloudfront list-origin-access-controls --no-cli-pager \
>   --query "OriginAccessControlList.Items[?Name=='fpl-frontend-oac'].Id" --output text
> ```
> Có ID → **dùng lại**, không tạo mới.

### 5.6. Upload frontend (BẮT BUỘC `--sse AES256`)

Policy có `DenyUnencryptedObjectUploads` → **mọi** lệnh ghi phải khai báo SSE, nếu không sẽ `AccessDenied` (§9 – G1).

```bash
# 1) Asset co hash (Vite: assets/index-<hash>.js|css) -> cache 1 nam
aws s3 sync frontend/dist/ "s3://$BUCKET/" --delete --no-cli-pager \
  --sse AES256 --exclude "index.html" \
  --cache-control "public, max-age=31536000, immutable"

# 2) index.html -> KHONG cache, de ban deploy moi duoc nhan ngay
aws s3 cp frontend/dist/index.html "s3://$BUCKET/index.html" --no-cli-pager \
  --sse AES256 --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=0, must-revalidate"
```

> ⚠️ `--delete` **chỉ** dùng với prefix của frontend. Không bao giờ chạy `s3 sync --delete` trên prefix rỗng của một bucket dùng chung.

### 5.7. Bảng idempotency (chạy lại thì sao?)

| Lệnh | Chạy lần 2 | Xử lý |
| :--- | :--- | :--- |
| `create-bucket` | `BucketAlreadyOwnedByYou` | Bỏ qua — bucket đã là của mình |
| `put-public-access-block` | Thành công, ghi đè cùng giá trị | An toàn |
| `put-bucket-ownership-controls` | Thành công | An toàn |
| `put-bucket-encryption` | Thành công | An toàn |
| `put-bucket-versioning` | Thành công | An toàn |
| `put-bucket-lifecycle-configuration` | Thành công, **thay thế toàn bộ** lifecycle | Giữ nguyên 3 rule như trên |
| `put-bucket-tagging` | Thành công, **thay thế toàn bộ** tag | Giữ nguyên 7 tag |
| `put-bucket-policy` | Thành công, thay thế policy | An toàn |
| `create-origin-access-control` | **Tạo bản trùng** | Phải `list-origin-access-controls` trước |
| `put-object` / `s3 sync` | Tạo **version mới** | Bình thường (versioning bật) |

---

## 🖱️ 6. PHƯƠNG ÁN B: CẤU HÌNH BẰNG CONSOLE

| Bước | Thao tác | Lưu ý bắt buộc |
| :--- | :--- | :--- |
| 1 | S3 → **Create bucket** → name `fpl-lineup-frontend-prod`, region **Asia Pacific (Singapore) ap-southeast-1** | Bỏ tick “Block all public access”? → **KHÔNG**, phải **giữ tick** cả 4 ô |
| 2 | Tab **Permissions** → **Block public access** → **Edit** → tick đủ 4 → Save | `BlockPublicPolicy` phải bật, nếu không policy public có thể lọt |
| 3 | Tab **Permissions** → **Object Ownership** → **Edit** → **ACLs disabled (Bucket owner enforced)** | Bắt buộc cho OAC |
| 4 | Tab **Properties** → **Default encryption** → **Server-side encryption with Amazon S3 managed keys (SSE-S3)**, Bucket Key **Enable** | Không chọn AWS KMS (tốn phí) |
| 5 | Tab **Properties** → **Bucket Versioning** → **Enable** | |
| 6 | Tab **Management** → **Lifecycle configuration** → tạo 3 rule như §5.3 | |
| 7 | Tab **Properties** → **Static website hosting** → **Disable** | OAC không dùng website endpoint |
| 8 | Tab **Permissions** → **Bucket policy** → dán nội dung `PolicyDocument` (đã trích) | Không dán cả envelope |
| 9 | CloudFront → **Origin access** → **Create control setting**: Name `fpl-frontend-oac`, **Sign requests (recommended)**, Origin type **S3** | Tương đương §5.5 |

> 🚫 Trên Console, nếu thấy nút **“Make public”** hoặc policy gợi ý `Principal: *` → **không bấm**. Đó chính là cấu hình bị cấm trong `ForbiddenPolicyExamples_DO_NOT_APPLY`.


---

## 🧪 7. POLICY LINT — 16 TEST CASES (CHẠY TRƯỚC MỖI LẦN APPLY)

Mục đích: **cấu hình bảo mật chỉ có giá trị khi được kiểm tra tự động**, không phải “đã từng đúng”. Lint đọc `infra/aws/s3_bucket_policy.json` và fail (exit code 1) nếu ai đó vô tình làm yếu policy.

### 7.1. Danh sách test case

| ID | Test case | Bắt lỗi gì |
| :--- | :--- | :--- |
| L01 | Envelope có đủ 7 section | Ai đó xoá mất khối guardrails |
| L02 | `PolicyDocument.Version = 2012-10-17` | Version sai/thiếu |
| L03 | Đúng 3 statement | Thêm statement lạ (vd. public read) |
| L04 | Không `Allow` nào dùng `Principal: "*"` | Bucket bị public |
| L05 | Không principal wildcard nào đọc được object | Public read lén |
| L06 | `DenyInsecureTransport` active trên bucket + object | Cho phép HTTP thường |
| L07 | `PutObject` thiếu header SSE bị deny | Upload object không mã hoá |
| L08 | Principal CloudFront đúng là `cloudfront.amazonaws.com` | Gõ sai service → hở hoặc hỏng |
| L09 | Quyền CloudFront **chỉ** `s3:GetObject` | Cấp `s3:*` (ghi/xoá) |
| L10 | Statement CloudFront có điều kiện `SourceAccount`/`SourceArn` | Confused deputy |
| L11 | Mọi `Resource` thuộc bucket này | Policy trỏ nhầm bucket |
| L12 | Block Public Access 4/4 true | Tắt nhầm 1 ô |
| L13 | Object Ownership = `BucketOwnerEnforced` | Bật lại ACL → OAC hỏng |
| L14 | Website endpoint **không** phải đường truy cập | Ai đó bật website hosting |
| L15 | Đủ 5 ví dụ policy bị cấm | Mất tài liệu cảnh báo |
| L16 | Đã ghi nhận OAC Id | Quên tạo/chưa gắn OAC |

### 7.2. Script lint (đặt ở `%TEMP%`, **không** commit vào repo)

```python
# p2q04_lint.py - chay tu ROOT repo: python p2q04_lint.py
import json, sys
p = 'infra/aws/s3_bucket_policy.json'
d = json.load(open(p, encoding='utf-8'))
doc = d['PolicyDocument']; st = doc['Statement']; B = 'fpl-lineup-frontend-prod'
fails = []


def chk(name, cond):
    print(('PASS  ' if cond else 'FAIL  ') + name)
    if not cond:
        fails.append(name)


chk('L01 envelope has 7 sections', len(d) == 7)
chk('L02 policy version is 2012-10-17', doc['Version'] == '2012-10-17')
chk('L03 exactly 3 statements', len(st) == 3)
allow = [s for s in st if s['Effect'] == 'Allow']
chk('L04 no Allow statement uses Principal "*"', all(s['Principal'] != '*' for s in allow))
chk('L05 no wildcard principal can read objects',
    not any(s.get('Principal') == '*' and 'GetObject' in str(s.get('Action')) for s in st))
tls = [s for s in st if s['Sid'] == 'DenyInsecureTransport'][0]
chk('L06 DenyInsecureTransport on bucket + objects',
    tls['Principal'] == '*' and tls['Condition']['Bool']['aws:SecureTransport'] == 'false')
sse = [s for s in st if s['Sid'] == 'DenyUnencryptedObjectUploads'][0]
chk('L07 PutObject without SSE header is denied',
    sse['Action'] == 's3:PutObject' and 'StringNotEqualsIfExists' in sse['Condition'])
cf = [s for s in st if s['Sid'] == 'AllowCloudFrontOACReadOnly'][0]
chk('L08 CloudFront principal is the AWS service',
    cf['Principal'] == {'Service': 'cloudfront.amazonaws.com'})
chk('L09 CloudFront permission is read-only', cf['Action'] == 's3:GetObject')
chk('L10 CloudFront statement scoped by SourceAccount/SourceArn',
    any(k in cf['Condition']['StringEquals'] for k in ('AWS:SourceAccount', 'AWS:SourceArn')))
arns = set()
for s in st:
    r = s['Resource']
    arns |= set([r] if isinstance(r, str) else r)
chk('L11 every Resource points to this bucket',
    all(a.startswith('arn:aws:s3:::' + B) for a in arns))
bi = d['BucketIdentity']['BlockPublicAccess']
chk('L12 Block Public Access 4/4 true', len(bi) == 4 and all(bi.values()))
chk('L13 ObjectOwnership is BucketOwnerEnforced',
    d['BucketIdentity']['ObjectOwnership'].startswith('BucketOwnerEnforced'))
chk('L14 S3 website endpoint is NOT the access path',
    'NOT ENABLED' in d['BucketIdentity']['WebsiteEndpoint'])
chk('L15 5 forbidden examples documented',
    len(d['ForbiddenPolicyExamples_DO_NOT_APPLY']) == 5)
chk('L16 OAC id recorded',
    bool(d['BucketIdentity']['CloudFrontOriginAccessControl']['Id']))
print()
print('RESULT: %d/16 PASS' % (16 - len(fails)))
sys.exit(1 if fails else 0)
```

### 7.3. Kết quả thật (02/11/2026)

```text
PASS  L01 envelope has 7 sections
PASS  L02 policy version is 2012-10-17
PASS  L03 exactly 3 statements
PASS  L04 no Allow statement uses Principal "*"
PASS  L05 no wildcard principal can read objects
PASS  L06 DenyInsecureTransport on bucket + objects
PASS  L07 PutObject without SSE header is denied
PASS  L08 CloudFront principal is the AWS service
PASS  L09 CloudFront permission is read-only
PASS  L10 CloudFront statement scoped by SourceAccount/SourceArn
PASS  L11 every Resource points to this bucket
PASS  L12 Block Public Access 4/4 true
PASS  L13 ObjectOwnership is BucketOwnerEnforced
PASS  L14 S3 website endpoint is NOT the access path
PASS  L15 5 forbidden examples documented
PASS  L16 OAC id recorded

RESULT: 16/16 PASS
exit_code=0
```


---

## ✅ 8. KIỂM CHỨNG (VERIFICATION) V0 → V8

### 8.1. Bảng kiểm chứng

| ID | Mục tiêu | Lệnh | Kỳ vọng |
| :--- | :--- | :--- | :--- |
| **V0** | Bucket đúng region | `aws s3api get-bucket-location --bucket $BUCKET --output text` | `ap-southeast-1` |
| **V1** | BPA 4/4 | `aws s3api get-public-access-block --bucket $BUCKET` | 4 field `true` |
| **V2** | Policy không public | `aws s3api get-bucket-policy-status --bucket $BUCKET` | `IsPublic: false` |
| **V3** | Nặc danh bị chặn | `curl -s -o /dev/null -w '%{http_code}' https://fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com/index.html` | **403** |
| **V4** | **AC: upload `index.html` + `HTTP 200` qua S3 API** | `curl --aws-sigv4 ... https://<rest>/index.html` hoặc `aws s3api get-object` | **200**, size = 3060 |
| **V5** | Upload thiếu SSE bị chặn | `aws s3api put-object --key x.html --body ...` (không `--sse`) | `AccessDenied` (explicit deny) |
| **V6** | HTTP thường bị chặn | `aws s3api head-object --endpoint-url http://<rest>` | `403 Forbidden` |
| **V7** | OAC tồn tại & đúng cấu hình | `aws cloudfront get-origin-access-control --id E2IX1YDEAHD87E` | `sigv4` / `always` / `s3` |
| **V8** | Website endpoint không phục vụ | `curl http://fpl-lineup-frontend-prod.s3-website-ap-southeast-1.amazonaws.com/index.html` | **404** / không 200 |

### 8.2. Lệnh kiểm chứng “HTTP 200 thật” bằng SigV4 (không in secret ra log)

```bash
export BUCKET=fpl-lineup-frontend-prod
eval "$(aws configure export-credentials --format env)"   # nap AWS_ACCESS_KEY_ID / SECRET / SESSION_TOKEN
URL="https://$BUCKET.s3.ap-southeast-1.amazonaws.com/index.html"

curl -s -o /dev/null -w 'sigv4_get=%{http_code} size=%{size_download}\n' \
  --aws-sigv4 'aws:amz:ap-southeast-1:s3' \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  --header "x-amz-security-token: $AWS_SESSION_TOKEN" "$URL"

curl -s -o /dev/null -w 'anonymous_get=%{http_code}\n' "$URL"
```

> ⚠️ **Không** chạy `echo $AWS_SECRET_ACCESS_KEY` trong CI/log. `export-credentials` chỉ để nạp biến môi trường trong phiên shell hiện tại.

### 8.3. Kiểm chứng tương đương bằng AWS CLI (nếu không có curl)

```bash
OUT="$(cygpath -m /tmp)/verify_index.html"
aws s3api head-object --bucket "$BUCKET" --key index.html --no-cli-pager \
  --query '{ContentType:ContentType,ContentLength:ContentLength,ServerSideEncryption:ServerSideEncryption,ETag:ETag}'
# 200 -> lenh khong loi; muon thay status line thi them --debug va grep 'Response headers'
aws s3api get-object --bucket "$BUCKET" --key index.html "$OUT" --debug 2>&1 | grep -m1 'Response headers'
md5sum frontend/dist/index.html "$OUT"    # 2 hash phai giong nhau
```

### 8.4. Kiểm chứng sau `P3-Q01` (bổ sung, chưa làm được ở Phase 2)

```bash
# chi chay khi distribution da ton tai
curl -s -o /dev/null -w 'cloudfront=%{http_code} ssl=%{ssl_verify_result}\n' https://<dist>.cloudfront.net/index.html
# ky vong: cloudfront=200 ssl=0
```


---

## 📌 9. NHẬT KÝ BẰNG CHỨNG THẬT (`02/11/2026`, ~22:27–22:35 ICT / 15:27–15:35 UTC)

### 9.1. Bảng giá trị thật

| Mốc | Giá trị thật |
| :--- | :--- |
| Tài khoản / danh tính | `711695043505` · `arn:aws:iam::711695043505:user/quang-devops` |
| Bucket ARN | `arn:aws:s3:::fpl-lineup-frontend-prod` |
| Region | `ap-southeast-1` |
| REST endpoint | `https://fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com` |
| Block Public Access | `BlockPublicAcls=true` · `IgnorePublicAcls=true` · `BlockPublicPolicy=true` · `RestrictPublicBuckets=true` |
| Object Ownership | `BucketOwnerEnforced` |
| Encryption | `AES256` · `BucketKeyEnabled=True` |
| Versioning | `Enabled` |
| Lifecycle | `abort-incomplete-multipart-7d` · `expire-noncurrent-versions-30d` · `expire-old-delete-markers-7d` (đều `Enabled`) |
| Tags | `Project=epl-fantasy-lineups` · `Environment=prod` · `Owner=Quang` · `Task=P2-Q04` · `ManagedBy=aws-cli` · `CostControl=aws-free-tier` · `DataClass=public-static-assets` |
| Policy status | `IsPublic: false` |
| Object đã upload | `index.html` · 3060 bytes · `ETag "4a5bd55b6fc7f29e6364490b6213df8c"` · `VersionId g8VguxnTn2yhVFJXM3xdiEswkO.cP0Tq` · `SSE AES256` · `Last-Modified 2026-11-02T15:31:55Z` |
| **HTTP 200 qua S3 API (SigV4)** | **`sigv4_get=200 size=3060`** ✅ (đúng AC) |
| Truy cập nặc danh | `anonymous_get=403` · `anonymous_head=403` ✅ |
| Website endpoint | `website_endpoint_http_code=404` (không có config) ✅ |
| Upload thiếu SSE | `AccessDenied ... with an explicit deny in a resource-based policy` ✅ |
| Gọi qua HTTP thường | `403 Forbidden` ✅ |
| Áp policy public | `AccessDenied ... because public policies are prevented by the BlockPublicPolicy setting` ✅ |
| OAC | `E2IX1YDEAHD87E` · `sigv4` / `always` / `s3` · ETag `ETVPDKIKX0DER` |
| Toàn vẹn dữ liệu | `md5(frontend/dist/index.html) = md5(download) = 4a5bd55b6fc7f29e6364490b6213df8c` |

### 9.2. Output thật (rút gọn)

```text
=== sts get-caller-identity ===
{"UserId":"AIDA2LNCUROYSDJH6ZH6D","Account":"711695043505",
 "Arn":"arn:aws:iam::711695043505:user/quang-devops"}

=== head-bucket (truoc khi tao) ===
aws: [ERROR]: An error occurred (404) when calling the HeadBucket operation: Not Found

=== create-bucket ===
{"Location":"http://fpl-lineup-frontend-prod.s3.amazonaws.com/",
 "BucketArn":"arn:aws:s3:::fpl-lineup-frontend-prod"}

=== get-bucket-location ===
ap-southeast-1

=== get-public-access-block ===
{"PublicAccessBlockConfiguration":{"BlockPublicAcls":true,"IgnorePublicAcls":true,
 "BlockPublicPolicy":true,"RestrictPublicBuckets":true}}

=== get-bucket-ownership-controls ===
RULES   BucketOwnerEnforced

=== get-bucket-encryption ===
{"ServerSideEncryptionConfiguration":{"Rules":[{"ApplyServerSideEncryptionByDefault":
 {"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true, ...}]}}

=== get-bucket-versioning ===
{"Status":"Enabled"}

=== get-bucket-lifecycle-configuration (IDs) ===
abort-incomplete-multipart-7d   expire-noncurrent-versions-30d   expire-old-delete-markers-7d
```

```text
=== put-bucket-policy + status ===
{"PolicyStatus":{"IsPublic":false}}

=== put-object index.html (co --server-side-encryption AES256) ===
{"ETag":"\"4a5bd55b6fc7f29e6364490b6213df8c\"","ChecksumCRC64NVME":"bThb5TJFfRo=",
 "ChecksumType":"FULL_OBJECT","ServerSideEncryption":"AES256",
 "VersionId":"g8VguxnTn2yhVFJXM3xdiEswkO.cP0Tq"}

=== V4: SigV4 authenticated GET (AC) ===
sigv4_get_http_code=200 size=3060 bytes

=== V3: cung URL, nac danh ===
anonymous_http_code=403
anonymous_head_http_code=403
<?xml version="1.0" encoding="UTF-8"?>
<Error><Code>AccessDenied</Code><Message>Access Denied</Message><RequestId>QZP5DVEPA1QH17SC</RequestId>...

=== V8: website endpoint ===
website_endpoint_http_code=404

=== G1: upload KHONG co --sse (bi tu choi) ===
AccessDenied ... s3:PutObject on resource: "arn:aws:s3:::fpl-lineup-frontend-prod/deny-test.html"
with an explicit deny in a resource-based policy

=== G2: HTTP thuong (DenyInsecureTransport) ===
An error occurred (403) when calling the HeadObject operation: Forbidden

=== G3: ap policy public (bi BlockPublicPolicy chan) ===
AccessDenied ... because public policies are prevented by the BlockPublicPolicy setting in S3 Block Public Access.

=== V7: OAC ===
{"Name":"fpl-frontend-oac","SigningProtocol":"sigv4","SigningBehavior":"always",
 "OriginAccessControlOriginType":"s3"}

=== danh sach object ===
index.html
```

**Tổng kết bằng chứng:** policy lint **16/16 PASS** · live AWS evidence **V0–V8 đạt 9/9** · guard tests **3/3 chặn đúng** · upload/download toàn vẹn md5.


---

## 🚑 10. TROUBLESHOOTING

### 10.1. Bảng chẩn đoán nhanh

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
| :--- | :--- | :--- |
| `403 AccessDenied` khi mở URL S3 bằng trình duyệt | **Đúng thiết kế** — bucket private, không có public read | Không sửa. Truy cập qua CloudFront (P3-Q01) |
| `AccessDenied ... explicit deny in a resource-based policy` khi **upload** | Thiếu `--sse AES256` (statement `DenyUnencryptedObjectUploads`) | Thêm `--sse AES256` vào mọi lệnh `put-object`/`sync`/`cp` |
| `AccessDenied ... public policies are prevented by BlockPublicPolicy` khi **put-bucket-policy** | Đang cố áp policy public | Xoá `Principal: "*"` + `Allow`; dùng policy trong `s3_bucket_policy.json` |
| CloudFront trả `403` dù đã gắn OAC | `AWS:SourceAccount` đúng nhưng statement cloudfront **không** được áp / OAC chưa gắn vào origin | `get-bucket-policy` kiểm statement `AllowCloudFrontOACReadOnly`; kiểm `Origin.OriginAccessControlId` |
| CloudFront trả `403` sau khi đã siết `AWS:SourceArn` | ARN distribution sai (copy nhầm, sai account/region) | `aws cloudfront get-distribution --id <ID> --query Distribution.ARN` rồi dán lại chính xác |
| `404 NoSuchWebsiteConfiguration` khi gọi website endpoint | Website hosting **đang OFF** (đúng thiết kế) | Không bật. Dùng REST endpoint + OAC |
| `301 Moved Permanently` / `PermanentRedirect` | Gọi sai region endpoint (vd. `s3.amazonaws.com`) | Luôn dùng `s3.ap-southeast-1.amazonaws.com` |
| `SignatureDoesNotMatch` | Lệch giờ hệ thống, hoặc proxy sửa header | Đồng bộ NTP/timezone |
| `NoSuchBucket` dù bucket tồn tại | Đang trỏ region khác | `--region ap-southeast-1` |
| Deploy xong vẫn thấy bản cũ | `index.html` bị cache ở edge/browser | `max-age=0, must-revalidate` (đã set) + invalidation `/index.html` |
| `AccessDenied` khi `s3 sync` trên CI | Role CI thiếu quyền hoặc thiếu `--sse` | Gắn policy ở §4.2 + luôn `--sse AES256` |

### 10.2. Vì sao `403` mà không phải `404` cho object không tồn tại?

Khi caller **không có** `s3:ListBucket`, S3 trả `403 AccessDenied` thay vì `404` để không tiết lộ object có tồn tại hay không (chống enumeration). Đây là hành vi **mong muốn**; CloudFront phải map **cả 403 và 404** về `/index.html` (P3-Q01).

### 10.3. Kiểm tra nhanh “policy có bị ai sửa không”

```bash
aws s3api get-bucket-policy --bucket fpl-lineup-frontend-prod --query Policy --output text --no-cli-pager | python -m json.tool | grep -E '"Sid"|"Principal"|"Effect"'
# KY VONG dung 3 Sid: DenyInsecureTransport / DenyUnencryptedObjectUploads / AllowCloudFrontOACReadOnly
```

### 10.4. `DependencyError`/`InvalidBucketState` khi xoá bucket

Bucket còn object hoặc version → xem §11.

### 10.5. OAC tạo nhầm 2 lần

```bash
aws cloudfront list-origin-access-controls --no-cli-pager \
  --query "OriginAccessControlList.Items[].[Id,Name]" --output text
aws cloudfront delete-origin-access-control --id <OAC_ID_DU> --if-match <ETag> --no-cli-pager
# Chi xoa duoc khi OAC chua duoc gan vao distribution nao
```

### 10.6. (CHỈ KHI TECH LEAD ĐỔI KIẾN TRÚC) Bật lại Static Website Hosting

> ⚠️ **Hậu quả bảo mật:** muốn website endpoint phục vụ được, bucket **buộc phải public** (`s3:GetObject` cho `Principal: *`) → **phá vỡ AC của P2-Q04**, mất OAC, mất HTTPS, và phải tắt `BlockPublicPolicy`. Chỉ làm khi có quyết định bằng văn bản của Tech Lead.

```bash
# 1) Bat website hosting (index + SPA fallback)
aws s3api put-bucket-website --bucket fpl-lineup-frontend-prod --no-cli-pager \
  --website-configuration '{"IndexDocument":{"Suffix":"index.html"},"ErrorDocument":{"Key":"index.html"}}'
# 2) Phai tat BlockPublicPolicy va bat lai ACL/public policy -> CAN NHAC KY
# 3) Khi do CloudFront phai dung CUSTOM ORIGIN (website endpoint) va KHONG con OAC
```

Nếu chỉ cần **SPA fallback** mà vẫn giữ bảo mật → giữ nguyên kiến trúc OAC và cấu hình `CustomErrorResponse` ở CloudFront (`P3-Q01`).


---

## 🔁 11. ROLLBACK / DESTROY (TRÁNH PHÁT SINH CHI PHÍ)

> S3 **không tính phí** khi bucket tồn tại, chỉ tính theo dung lượng/request. Tuy vậy, khi kết thúc đồ án vẫn nên dọn sạch để chắc chắn $0.00.

### 11.1. Rollback một lần deploy hỏng (nhanh nhất)

```bash
# Liet ke version cua index.html
aws s3api list-object-versions --bucket fpl-lineup-frontend-prod --prefix index.html --no-cli-pager \
  --query 'Versions[].[VersionId,LastModified,Size]' --output table

# Copy version cu thanh ban hien hanh (khong can invalidation neu dung versioned filename)
aws s3api copy-object --bucket fpl-lineup-frontend-prod --key index.html --no-cli-pager \
  --copy-source "fpl-lineup-frontend-prod/index.html?versionId=<VERSION_ID_CU>" \
  --server-side-encryption AES256 --metadata-directive REPLACE \
  --content-type "text/html; charset=utf-8" --cache-control "public, max-age=0, must-revalidate"
```

### 11.2. Xoá toàn bộ object (kể cả version)

```bash
B=fpl-lineup-frontend-prod
TMPW=$(cygpath -m /tmp)

# 1) Xoa toan bo VERSION (gom ca object dang la current)
aws s3api list-object-versions --bucket $B --no-cli-pager \
  --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json > "$TMPW/p2q04_versions.json"
aws s3api delete-objects --bucket $B --no-cli-pager --delete "file://$TMPW/p2q04_versions.json"

# 2) Xoa cac DELETE MARKER con lai (versioning bat -> bat buoc phai xoa)
aws s3api list-object-versions --bucket $B --no-cli-pager \
  --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json > "$TMPW/p2q04_markers.json"
aws s3api delete-objects --bucket $B --no-cli-pager --delete "file://$TMPW/p2q04_markers.json"

# 3) Kiem tra rong roi moi xoa bucket
aws s3api list-object-versions --bucket $B --no-cli-pager --output json
aws s3api delete-bucket --bucket $B --region ap-southeast-1 --no-cli-pager
```

> ⚠️ Nếu `list-object-versions` trả `"Objects": null` (bucket đã rỗng) thì **bỏ qua** lệnh `delete-objects` tương ứng — `delete-objects` với danh sách rỗng sẽ báo `MalformedXML`.

### 11.3. Thu hồi OAC (sau khi đã xoá distribution ở `P3-Q01`)

```bash
aws cloudfront delete-origin-access-control --id E2IX1YDEAHD87E \
  --if-match "$(aws cloudfront get-origin-access-control --id E2IX1YDEAHD87E --query ETag --output text --no-cli-pager)" \
  --no-cli-pager
```

### 11.4. Thứ tự destroy đúng (tránh DependencyViolation)

```
CloudFront distribution (P3-Q01)  ->  Route53 record (nếu có)  ->  OAC
    ->  S3 objects + versions  ->  S3 bucket  ->  kiểm tra Billing = $0
```

---

## 🛡️ 12. VẬN HÀNH ĐỊNH KỲ (SECURITY GUARDIAN ROUTINE — hằng tuần)

| # | Việc cần làm | Lệnh | Kỳ vọng |
| :--- | :--- | :--- | :--- |
| 1 | BPA vẫn 4/4 | `aws s3api get-public-access-block --bucket fpl-lineup-frontend-prod` | 4 × `true` |
| 2 | Policy không bị làm public | `aws s3api get-bucket-policy-status --bucket fpl-lineup-frontend-prod` | `IsPublic: false` |
| 3 | ACL không có grant công khai | `aws s3api get-bucket-acl --bucket fpl-lineup-frontend-prod` | `Grants` rỗng |
| 4 | Nặc danh vẫn bị chặn | `curl -s -o /dev/null -w '%{http_code}' https://fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com/index.html` | `403` |
| 5 | Policy còn đúng 3 statement | `get-bucket-policy` + lint §7 | `16/16 PASS` |
| 6 | Website hosting vẫn OFF | `aws s3api get-bucket-website --bucket fpl-lineup-frontend-prod` | `NoSuchWebsiteConfiguration` |
| 7 | Dung lượng trong Free Tier | `aws s3api list-objects-v2 --bucket ... --query 'sum(Contents[].Size)'` | < 5 GB |
| 8 | Chi phí | AWS Billing → Cost Explorer tháng hiện tại | `$0.00` |

> 📅 Nhắc lịch: gắn routine này vào đầu mỗi buổi họp nhóm. Bất kỳ mục nào lệch → mở issue gắn nhãn `security` + `P2-Q04`.

---

## 🤝 13. RANH GIỚI TASK & BÀN GIAO

### 13.1. P2-Q04 đã bàn giao

| Hạng mục | Trạng thái |
| :--- | :--- |
| Bucket `fpl-lineup-frontend-prod` @ `ap-southeast-1` | ✅ |
| Block Public Access 4/4 + ACL off + SSE-S3 + Versioning + Lifecycle + Tags | ✅ |
| Bucket policy private + deny HTTP + deny upload thiếu SSE + allow OAC | ✅ (`IsPublic: false`) |
| OAC `E2IX1YDEAHD87E` (sigv4, always, s3) | ✅ (chưa gắn distribution — thuộc P3-Q01) |
| Upload `index.html` + `HTTP 200` qua S3 API | ✅ |
| Policy lint 16/16 + runbook + rollback | ✅ |

### 13.2. Việc **P3-Q01** PHẢI làm tiếp (điều kiện để web chạy HTTPS)

1. Tạo distribution với **origin = REST endpoint**, **không** phải website endpoint:
   `fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com`
2. Gắn **`OriginAccessControlId = E2IX1YDEAHD87E`**, `OriginProtocolPolicy = https-only`.
3. `ViewerProtocolPolicy = redirect-to-https` + **ACM cert** (region `us-east-1` cho CloudFront).
4. `CustomErrorResponse`: **403 và 404 → `/index.html` với response code 200** (SPA routing).
5. **Siết policy**: thay `AWS:SourceAccount` bằng `AWS:SourceArn` (lấy đúng block trong `s3_bucket_policy.json` → `PolicyDocumentDeferredStatement_P3Q01`), rồi kiểm `grep -c 'distribution/'` = 1.
6. Kiểm chứng cuối: `curl https://<dist>.cloudfront.net/index.html` → **200**, và gọi URL S3 trực tiếp vẫn **403**.

### 13.3. Vì sao task này dùng **AWS CLI** thay vì Terraform?

- Giới hạn task: **tối đa 2 file mới** (`s3_setup.md`, `s3_bucket_policy.json`) → **không** được thêm `terraform_s3.tf`.
- `terraform_rds.tf` (P2-Q01) đã “own” provider + `local.common_tags`; thêm resource S3 vào file đó là **vượt phạm vi** (và làm rối state RDS đang chạy).
- **Đề xuất (backlog, không làm ở task này):** khi có ngân sách file, tách `providers.tf` / `main.tf` và **`terraform import`** bucket + OAC để quản lý bằng IaC (state hiện tại: `infra/aws/terraform.tfstate` chỉ chứa RDS).

### 13.4. Tuyệt đối KHÔNG làm ở các task sau

| Cấm | Lý do |
| :--- | :--- |
| Bật public read / `Principal: *` | Vi phạm AC, bot quét + phát tán nội dung |
| Bật Static Website Hosting khi vẫn dùng OAC | OAC không hỗ trợ website endpoint → 403 toàn bộ |
| Cấp `s3:*`/`PutObject` cho CloudFront | CDN có thể ghi/xoá dữ liệu |
| Upload không `--sse AES256` | Bị deny, hoặc tệ hơn: nếu policy bị nới → object không mã hoá |
| Dùng KMS CMK cho bucket static | $1/CMK/tháng, không cần thiết với nội dung công khai |
| Xoá `infra/aws/terraform.tfstate` | Chứa state RDS của P2-Q01 |


---

## ☑️ 14. CHECKLIST NGHIỆM THU (ACCEPTANCE CRITERIA)

### 14.1. Đối chiếu Acceptance Criteria của task

- [x] **Bucket S3 được tạo ở region `ap-southeast-1`** — `get-bucket-location` → `ap-southeast-1`; ARN `arn:aws:s3:::fpl-lineup-frontend-prod`.
- [x] **Cấu hình quyền truy cập qua CloudFront Origin Access Control** — OAC `E2IX1YDEAHD87E` (sigv4 / always / s3) + policy `AllowCloudFrontOACReadOnly` (`IsPublic: false`).
- [x] **Upload thử `index.html`** — 3060 bytes, `ETag 4a5bd55b6fc7f29e6364490b6213df8c`.
- [x] **Kiểm tra phản hồi `HTTP 200` qua S3 API** — `sigv4_get_http_code=200 size=3060`; nặc danh `403` (đúng thiết kế private).
- [x] Không có bất kỳ rule/policy `0.0.0.0/0` hay `Principal: *` dạng `Allow` nào (lint L04/L05).
- [x] Chi phí `$0.00`, nằm trong Free Tier; Budget Alert `P2-Q03` đang bật.
- [x] Không commit (chờ Dev review `git diff` và cho phép).

### 14.2. Checklist bàn giao cho Dev (Quang)

- [ ] Chạy lại lint §7 trên máy mình: `python p2q04_lint.py` → `16/16 PASS`.
- [ ] Kiểm tra trạng thái thật: `aws s3api get-bucket-policy-status --bucket fpl-lineup-frontend-prod` → `IsPublic: false`.
- [ ] `git diff` / `git status`: chỉ có **2 file mới** trong `infra/aws/`.
- [ ] Tick `[x]` cho `P2-Q04` trong `docs/TODO.md` (và bản `TODO.md` ở root nếu nhóm giữ đồng bộ).
- [ ] Xác nhận trước khi commit: `feature/P2-Q04-s3-bucket-setup`.

### 14.3. Ghi chú cho Tech Lead khi review

1. Task này **đã chạy thật** trên tài khoản `711695043505` — bằng chứng ở §9, có thể tái lập bằng §8.
2. Điểm cần review kỹ nhất: **quyết định KHÔNG bật Static Website Hosting** (§0.2, §1.2) và **điều kiện `AWS:SourceAccount` tạm thời** thay cho `AWS:SourceArn` (§13.2 bước 5).
3. Ngưỡng rủi ro: mọi thay đổi policy/`BlockPublicPolicy` đều cần review của Tech Lead + chạy lint trước khi apply.

---

<p align="center"><em>P2-Q04 · Fantasy Football Lineup Builder & Optimizer · AWS Free Tier ($0.00) · Quang (DevOps & AWS Lead)</em></p>

