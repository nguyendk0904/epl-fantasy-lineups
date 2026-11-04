# 🪣 P2-Q04 — AWS S3 STATIC-HOSTING BUCKET (PRIVATE ORIGIN + CLOUDFRONT OAC) · RUNBOOK & HANDOFF

> **Task:** `P2-Q04` *(`TODO.md`: Level 3 — `AI_GUIDELINES.md` xếp hạ tầng AWS là Level 4 → xử lý như Level 4)* · **Owner:** Quang (DevOps & AWS Lead)
> **Branch:** `feature/P2-Q04-s3-bucket-setup` · **Files:** `infra/aws/s3_setup.md` (tài liệu này) + `infra/aws/s3_bucket_policy.json` (policy + guardrails)
> **Nguồn chuẩn:** [`PROJECT_SSOT`](../../docs/PROJECT_SSOT.md) · [`PROJECT_ROADMAP`](../../docs/PROJECT_ROADMAP.md) · [`TODO`](../../docs/TODO.md) · [`AI_GUIDELINES`](../../docs/AI_GUIDELINES.md)
>
> **🚦 Trạng thái 04/11/2026:** ✅ Bucket + policy **hoàn tất**, đã **kiểm chứng lại toàn bộ** trên tài khoản thật (BPA 4/4 · `IsPublic: false` · nặc danh `403` · SigV4 `200` · website hosting OFF · policy trên AWS **khớp 100 %** `PolicyDocument` trong repo). ⏳ 2 việc còn lại **thuộc `P3-Q01`**: gắn OAC vào distribution + siết `AWS:SourceAccount` → `AWS:SourceArn`. **P2-Q04 không còn đầu việc mở.**

---

## 1. ⚡ TL;DR

| Hạng mục | Giá trị thực tế |
| :--- | :--- |
| Bucket / Region | `fpl-lineup-frontend-prod` · `ap-southeast-1` · `arn:aws:s3:::fpl-lineup-frontend-prod` |
| Object hiện có | `index.html` · 3060 B · `text/html; charset=utf-8` · version `g8VguxnTn2yhVFJXM3xdiEswkO.cP0Tq` |
| Riêng tư | Block Public Access **4/4 true** · ACL **tắt** (`BucketOwnerEnforced`) · `PolicyStatus.IsPublic = false` |
| CloudFront | **OAC** `E2IX1YDEAHD87E` (`sigv4` / `always` / `s3`) — **chưa gắn distribution** (`P3-Q01`) |
| Bucket policy (3 statement) | deny HTTP thường · deny upload thiếu SSE · allow `cloudfront.amazonaws.com` đọc `s3:GetObject` với `AWS:SourceAccount` |
| Mã hoá | SSE-S3 `AES256` + `BucketKeyEnabled=true` (**không** dùng KMS CMK → $0) |
| Versioning / Lifecycle | `Enabled` · abort multipart 7d · xoá noncurrent 30d · xoá delete-marker mồ côi |
| Static Website Hosting | **OFF** (cố ý — OAC không dùng được với website endpoint) |
| Kiểm chứng AC | SigV4 `GET` → **200** (3060 B) · nặc danh → **403** · lint **16/16 PASS** |
| Chi phí | **$0.00** (Free Tier) · Budget guard `P2-Q03` ($1.00) đang bật |

### 1.1. Ba mâu thuẫn của đề bài và cách xử lý

| # | Nội dung lệch | Cách xử lý |
| :--- | :--- | :--- |
| 0.1 | Phần *“Mô tả”* ghi *“Inbound/Outbound Rules cho Security Group port 5432”* — nội dung của `P2-Q02`, không liên quan S3 | Bám `docs/TODO.md` + AC của task (bucket `ap-southeast-1` + CloudFront OAC). SG 5432 nằm ở `infra/aws/security_groups.md`, **không** sửa ở đây |
| 0.2 | `TODO.md` ghi *“bật Static Website Hosting”* **mâu thuẫn** AC *“truy cập qua CloudFront OAC”* | **Chọn OAC** — AWS docs: origin là website endpoint thì phải dùng custom origin ⇒ **không** dùng được OAC. AC là tiêu chí nghiệm thu ⇒ website hosting **OFF** |
| 0.3 | AC ghi *“HTTP 200 qua S3 API”* nhưng bucket private | `200` = **S3 API có SigV4** (`curl --aws-sigv4` / `get-object`); nặc danh **phải** `403`; `200` cho người dùng cuối đến từ CloudFront (`P3-Q01`) |

---

## 2. 📈 TIẾN ĐỘ

### 2.1. Đã xong — đóng bằng bằng chứng thật

| # | Hạng mục | ✓ | Bằng chứng |
| :--- | :--- | :--- | :--- |
| 1 | Bucket `fpl-lineup-frontend-prod` @ `ap-southeast-1` | ✅ | §8 V0 (`LocationConstraint: ap-southeast-1`) |
| 2 | 6 lớp cấu hình: BPA 4/4 · ACL off · SSE-S3 · Versioning · Lifecycle · Tags | ✅ | §8 V1/V7 · §9.1 |
| 3 | Bucket policy private (`IsPublic: false`) áp từ envelope JSON | ✅ | §8 V2 · policy AWS **khớp 100 %** `PolicyDocument` trong repo |
| 4 | OAC `E2IX1YDEAHD87E` (`sigv4` / `always` / `s3`) | ✅ | §8 V6 |
| 5 | Upload `index.html` + AC “HTTP 200 qua S3 API” | ✅ | §8 V4 · `sigv4_get=200 size=3060` |
| 6 | Guard tests: thiếu SSE bị deny · HTTP thường bị deny · policy public bị BPA chặn | ✅ | §9.2 (G1–G3) |
| 7 | Policy lint 16/16 · runbook · rollback · guardian routine | ✅ | §7 · §10 · §11 |

### 2.2. Còn lại — **không thuộc P2-Q04** (chuyển `P3-Q01`)

| # | Việc | Vì sao chưa làm ở Phase 2 |
| :--- | :--- | :--- |
| 1 | Tạo distribution + gắn `OriginAccessControlId` | Phase 2 chưa có CloudFront (§13.1) |
| 2 | Siết `AWS:SourceAccount` → `AWS:SourceArn` | ARN distribution chưa tồn tại ⇒ policy sẽ vô dụng |
| 3 | `CustomErrorResponse` 403/404 → `/index.html` (SPA routing) | Thuộc cấu hình distribution |
| 4 | ACM cert (`us-east-1`) + `redirect-to-https` | Thuộc cấu hình distribution |
| 5 | Tick `P2-Q04` trong `TODO.md` | `docs/TODO.md` **đã** `[x]` + ghi chú 02/11 (commit khác) — không sửa trong commit này (ràng buộc phạm vi 2 file) |

---

## 3. 🏗️ KIẾN TRÚC & 3 ĐƯỜNG TRUY CẬP

```text
Người dùng ──HTTPS──▶ CloudFront (P3-Q01) ──SigV4 GET (private)──▶ S3 bucket
                      ACM cert · CustomError 403/404 → /index.html   BPA 4/4 · ACL off · SSE-S3
Dev / CI ──SigV4 (IAM quang-devops | CI role)──▶ aws s3api · s3 sync --sse AES256
Nặc danh ──▶ .../fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com/index.html → 403 AccessDenied
```

| Đường | Danh tính | Kết quả | Dùng cho |
| :--- | :--- | :--- | :--- |
| **A. Nặc danh** | Không | **403 AccessDenied** | Bị chặn vĩnh viễn — đúng thiết kế |
| **B. CloudFront (OAC)** | `cloudfront.amazonaws.com` + `AWS:SourceAccount`/`SourceArn` | **200** (sau `P3-Q01`) | Người dùng cuối |
| **C. S3 API có xác thực** | IAM user `quang-devops` / CI role | **200** | Deploy, kiểm chứng AC |

> “Static hosting” ở kiến trúc này = **S3 lưu object + CloudFront phục vụ + OAC ký request**; bucket **không** cần public, nhưng vẫn có HTTPS + CDN + SPA fallback.

---

## 4. 💰 FREE TIER & HÀNG RÀO CHI PHÍ

| Tài nguyên | Free Tier | Cấu hình này |
| :--- | :--- | :--- |
| S3 Standard storage | **5 GB** | build ~2–5 MB (versioning ×2 ≈ 10 MB) ✅ |
| S3 GET / PUT | **20.000 / 2.000** mỗi tháng | demo + test thủ công ✅ |
| Data transfer out | **100 GB**/tháng (toàn account) | đi qua CloudFront ✅ |
| SSE-S3 (AES256) | Miễn phí | đang bật ✅ · **không** dùng KMS CMK ($1/CMK/tháng) ✅ |
| CloudFront invalidation | 1.000 path/tháng, sau đó $0.005/path | `P3-Q01` chỉ invalidate `/index.html` hoặc dùng versioned filename ⚠️ |

**4 cạm bẫy “Free Tier thành có phí” đã chặn:** versioning phình → lifecycle 30d · multipart bỏ dở → abort 7d · KMS CMK → chỉ SSE-S3 · website endpoint + policy public → BPA 4/4 + website OFF.

> 🛡️ Tiền đề: `P2-Q03` — Budgets Alert **$1.00** (80 % · 100 % ACTUAL · 100 % FORECASTED) đang ACTIVE.

---

## 5. 🧰 PREREQUISITES

| Công cụ | Phiên bản đã dùng | Ghi chú |
| :--- | :--- | :--- |
| AWS CLI v2 | `2.39.3` | ≥ 2.15 (có `--aws-sigv4`); **luôn** `--no-cli-pager` |
| Python | 3.x | trích `PolicyDocument` + chạy lint |
| curl | `8.21.0` | đo HTTP status thật |
| Terraform | `1.16.6` | **không dùng** ở task này (§13.2) |

**IAM tối thiểu:** `s3:CreateBucket, s3:PutBucket{Policy,PublicAccessBlock,OwnershipControls,Encryption,Versioning,LifecycleConfiguration,Tagging}, s3:GetBucket{Policy,PolicyStatus,PublicAccessBlock}, s3:PutObject, s3:GetObject, s3:ListBucket` + `cloudfront:CreateOriginAccessControl, cloudfront:GetOriginAccessControl`.

**Bẫy môi trường Windows đã gặp thật:** (1) AWS CLI native **không** đọc `/tmp/...` → dùng `cygpath -m /tmp`; (2) `python` trên MSYS hiểu `/tmp` = `C:\tmp` → `FileNotFoundError` ⇒ dùng đường dẫn Windows; (3) pager `-- More --` treo lệnh CloudFront → `--no-cli-pager`; (4) `--query` **không** trả `ResponseMetadata.HTTPStatusCode` của `get-object` → dùng `curl --aws-sigv4`; (5) heredoc `python - <<'PY'` treo terminal VS Code → ghi script ra file tạm rồi chạy.

---

## 6. 🚀 TRIỂN KHAI BẰNG AWS CLI (IDEMPOTENT)

> Chạy từ root repo. `export AWS_REGION=ap-southeast-1 BUCKET=fpl-lineup-frontend-prod`

### 6.1. Tiền kiểm + tạo bucket

```bash
aws sts get-caller-identity --no-cli-pager     # KY VONG arn:aws:iam::711695043505:user/quang-devops
aws s3api head-bucket --bucket "$BUCKET" --no-cli-pager   # 404 luc dau = ten con trong
aws s3api create-bucket --bucket "$BUCKET" --region ap-southeast-1 --no-cli-pager \
  --create-bucket-configuration LocationConstraint=ap-southeast-1
# Thieu LocationConstraint -> IllegalLocationConstraintException (moi region khac us-east-1)
```

### 6.2. Sáu lớp cấu hình bảo mật / chi phí

```bash
# (1) Block Public Access 4/4 - lop chan cung
aws s3api put-public-access-block --bucket "$BUCKET" --no-cli-pager \
  --public-access-block-configuration '{"BlockPublicAcls":true,"IgnorePublicAcls":true,"BlockPublicPolicy":true,"RestrictPublicBuckets":true}'

# (2) Tat ACL - bat buoc de dung OAC
aws s3api put-bucket-ownership-controls --bucket "$BUCKET" --no-cli-pager \
  --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'

# (3) SSE-S3 + bucket key (mien phi)
aws s3api put-bucket-encryption --bucket "$BUCKET" --no-cli-pager \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'

# (4) Versioning
aws s3api put-bucket-versioning --bucket "$BUCKET" --no-cli-pager --versioning-configuration Status=Enabled

# (5) Lifecycle - 3 rule
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --no-cli-pager \
  --lifecycle-configuration '{"Rules":[{"ID":"abort-incomplete-multipart-7d","Status":"Enabled","Filter":{"Prefix":""},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}},{"ID":"expire-noncurrent-versions-30d","Status":"Enabled","Filter":{"Prefix":""},"NoncurrentVersionExpiration":{"NoncurrentDays":30}},{"ID":"expire-old-delete-markers-7d","Status":"Enabled","Filter":{"Prefix":""},"Expiration":{"ExpiredObjectDeleteMarker":true}}]}'

# (6) Tags - truy vet chi phi
aws s3api put-bucket-tagging --bucket "$BUCKET" --no-cli-pager \
  --tagging '{"TagSet":[{"Key":"Project","Value":"epl-fantasy-lineups"},{"Key":"Environment","Value":"prod"},{"Key":"Owner","Value":"Quang"},{"Key":"Task","Value":"P2-Q04"},{"Key":"ManagedBy","Value":"aws-cli"},{"Key":"CostControl","Value":"aws-free-tier"},{"Key":"DataClass","Value":"public-static-assets"}]}'
```

> PowerShell: thay `\` cuối dòng bằng `` ` `` và giữ JSON trong nháy đơn.

### 6.3. Áp bucket policy (trích từ envelope)

`s3_bucket_policy.json` là **envelope kiểm toán** (`Metadata` + `BucketIdentity` + `PolicyDocument` + guardrails) → S3 **chỉ nhận policy document thuần**:

```bash
OUT="$(cygpath -m /tmp)/p2q04_applied_policy.json"
python -c "import json,sys;d=json.load(open(sys.argv[1],encoding='utf-8'));json.dump(d['PolicyDocument'],open(sys.argv[2],'w',encoding='utf-8'),indent=2)" \
  infra/aws/s3_bucket_policy.json "$OUT"
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "file://$OUT" --no-cli-pager
aws s3api get-bucket-policy-status --bucket "$BUCKET" --no-cli-pager   # {"IsPublic": false}
```

### 6.4. Tạo CloudFront Origin Access Control (**chạy 1 lần**)

```bash
aws cloudfront create-origin-access-control --no-cli-pager \
  --origin-access-control-config '{"Name":"fpl-frontend-oac","Description":"P2-Q04 - SigV4 OAC for fpl-lineup-frontend-prod (attached to distribution in P3-Q01)","SigningProtocol":"sigv4","SigningBehavior":"always","OriginAccessControlOriginType":"s3"}'
# Ket qua THAT: Id = E2IX1YDEAHD87E
```

> ⚠️ **Không idempotent** — kiểm tra trước: `aws cloudfront list-origin-access-controls --no-cli-pager --query "OriginAccessControlList.Items[?Name=='fpl-frontend-oac'].Id" --output text`. Có ID → **dùng lại**, không tạo mới.

### 6.5. Upload frontend (**BẮT BUỘC** `--sse AES256`)

```bash
aws s3 sync frontend/dist/ "s3://$BUCKET/" --delete --no-cli-pager --sse AES256 \
  --exclude "index.html" --cache-control "public, max-age=31536000, immutable"
aws s3 cp frontend/dist/index.html "s3://$BUCKET/index.html" --no-cli-pager --sse AES256 \
  --content-type "text/html; charset=utf-8" --cache-control "public, max-age=0, must-revalidate"
```

> Thiếu `--sse` → `AccessDenied` (`DenyUnencryptedObjectUploads`). `--delete` **chỉ** dùng trên prefix frontend, không bao giờ trên prefix rỗng của bucket dùng chung.

### 6.6. Idempotency

`put-*` chạy lại an toàn; `put-bucket-lifecycle-configuration` và `put-bucket-tagging` **thay thế toàn bộ** (giữ đúng 3 rule / 7 tag); `create-bucket` → `BucketAlreadyOwnedByYou` (bỏ qua); `create-origin-access-control` → **tạo bản trùng** ⇒ luôn kiểm tra trước.

### 6.7. Phương án B — Console

1. S3 → *Create bucket*: `fpl-lineup-frontend-prod`, **Asia Pacific (Singapore) ap-southeast-1**, **giữ tick** cả 4 ô Block public access.
2. *Permissions* → Object Ownership = **ACLs disabled (Bucket owner enforced)**.
3. *Properties* → Default encryption = **SSE-S3**, Bucket Key **Enable** (không chọn KMS) · Versioning **Enable** · *Static website hosting* **Disable**.
4. *Management* → Lifecycle: 3 rule như §6.2 · *Permissions* → Bucket policy: dán **`PolicyDocument`** đã trích (không dán cả envelope).
5. CloudFront → *Origin access* → *Create control setting*: `fpl-frontend-oac`, **Sign requests (recommended)**, Origin type **S3**.

> 🚫 Thấy nút **Make public** hoặc policy gợi ý `Principal: *` → **không bấm** (đó là ví dụ bị cấm trong `ForbiddenPolicyExamples_DO_NOT_APPLY`).

---

## 7. 🧪 POLICY LINT — 16 TEST CASES (chạy trước mỗi lần apply)

| ID | Test case | Bắt lỗi gì |
| :--- | :--- | :--- |
| L01 | Envelope đủ 7 section | ai đó xoá mất khối guardrails |
| L02 | `PolicyDocument.Version = 2012-10-17` | version sai/thiếu |
| L03 | Đúng 3 statement | thêm statement lạ |
| L04 | Không `Allow` nào dùng `Principal: "*"` | bucket bị public |
| L05 | Không principal wildcard nào đọc được object | public read lén |
| L06 | `DenyInsecureTransport` trên bucket + object | cho phép HTTP thường |
| L07 | `PutObject` thiếu header SSE bị deny | upload object không mã hoá |
| L08 | Principal CloudFront = `cloudfront.amazonaws.com` | gõ sai service |
| L09 | CloudFront **chỉ** `s3:GetObject` | cấp `s3:*` |
| L10 | Statement CloudFront có `SourceAccount`/`SourceArn` | confused deputy |
| L11 | Mọi `Resource` thuộc bucket này | policy trỏ nhầm bucket |
| L12 | Block Public Access 4/4 true | tắt nhầm 1 ô |
| L13 | Object Ownership = `BucketOwnerEnforced` | bật lại ACL → OAC hỏng |
| L14 | Website endpoint **không** phải đường truy cập | ai đó bật website hosting |
| L15 | Đủ 5 ví dụ policy bị cấm | mất tài liệu cảnh báo |
| L16 | Đã ghi nhận OAC Id | quên tạo/chưa gắn OAC |

Script dưới đây đặt ở `%TEMP%` (**không commit** vào repo), chạy từ root repo:

```python
# p2q04_lint.py - python "%TEMP%/p2q04_lint.py"
import json, sys
d = json.load(open('infra/aws/s3_bucket_policy.json', encoding='utf-8'))
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

**Kết quả thật (04/11/2026):** `RESULT: 16/16 PASS` · `exit_code=0`.

---

## 8. ✅ KIỂM CHỨNG V0 → V8

| ID | Kỳ vọng | Lệnh |
| :--- | :--- | :--- |
| **V0** | `ap-southeast-1` | `aws s3api get-bucket-location --bucket $BUCKET --no-cli-pager` |
| **V1** | 4 field `true` | `aws s3api get-public-access-block --bucket $BUCKET --no-cli-pager` |
| **V2** | `IsPublic: false` | `aws s3api get-bucket-policy-status --bucket $BUCKET --no-cli-pager` |
| **V3** | **403** | `curl -s -o /dev/null -w '%{http_code}' https://fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com/index.html` |
| **V4** | **AC: 200** qua S3 API | `curl --aws-sigv4` (§8.1) hoặc `aws s3api head-object --bucket $BUCKET --key index.html` |
| **V5** | `AccessDenied` | `aws s3api put-object --bucket $BUCKET --key x.html --body <file>` (**không** `--sse`) |
| **V6** | `403 Forbidden` | `aws s3api head-object --bucket $BUCKET --key index.html --endpoint-url http://<rest>` |
| **V7** | `sigv4` / `always` / `s3` | `aws cloudfront get-origin-access-control --id E2IX1YDEAHD87E --no-cli-pager` |
| **V8** | `404` / không `200` | `curl http://fpl-lineup-frontend-prod.s3-website-ap-southeast-1.amazonaws.com/index.html` |

### 8.1. “HTTP 200 thật” bằng SigV4 (không in secret ra log)

```bash
eval "$(aws configure export-credentials --format env)"   # nap AWS_ACCESS_KEY_ID / SECRET / SESSION_TOKEN
URL="https://fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com/index.html"
curl -s -o /dev/null -w 'sigv4_get=%{http_code} size=%{size_download}\n' \
  --aws-sigv4 'aws:amz:ap-southeast-1:s3' --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  --header "x-amz-security-token: $AWS_SESSION_TOKEN" "$URL"
curl -s -o /dev/null -w 'anonymous_get=%{http_code}\n' "$URL"
```

> ⚠️ **Không** `echo $AWS_SECRET_ACCESS_KEY` trong CI/log. Sau `P3-Q01` thêm: `curl -s -o /dev/null -w 'cloudfront=%{http_code} ssl=%{ssl_verify_result}\n' https://<dist>.cloudfront.net/index.html` → `200` / `0`.

---

## 9. 📌 BẰNG CHỨNG THẬT

### 9.1. Giá trị thực tế (áp dụng 02/11/2026 · **re-verify 04/11/2026**, mọi mục không đổi)

| Mốc | Giá trị |
| :--- | :--- |
| Danh tính | `711695043505` · `arn:aws:iam::711695043505:user/quang-devops` |
| Bucket | `arn:aws:s3:::fpl-lineup-frontend-prod` · `ap-southeast-1` · REST `fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com` |
| BPA / Ownership | 4/4 `true` · `BucketOwnerEnforced` · ACL chỉ còn owner `FULL_CONTROL` (không có `URI=AllUsers`) |
| Encryption / Versioning | `AES256` + `BucketKeyEnabled=true` (SSE-C bị từ chối) · `Enabled` |
| Lifecycle / Tags | 3 rule đều `Enabled` · 7 tag (`Project`, `Environment=prod`, `Owner=Quang`, `Task=P2-Q04`, `ManagedBy=aws-cli`, `CostControl=aws-free-tier`, `DataClass=public-static-assets`) |
| Object | `index.html` · 3060 B · `ETag 4a5bd55b6fc7f29e6364490b6213df8c` · version `g8VguxnTn2yhVFJXM3xdiEswkO.cP0Tq` · `Last-Modified 2026-11-02T15:31:55Z` |
| Policy | `IsPublic: false` · 3 Sid · **giống 100 %** `PolicyDocument` trong repo (`live==repo: True`) |
| Nặc danh | `anonymous_get=403` · `anonymous_head=403` |
| Website endpoint | `NoSuchWebsiteConfiguration` (HTTP `404`) |
| OAC | `E2IX1YDEAHD87E` · `sigv4` / `always` / `s3` · ETag `ETVPDKIKX0DER` |
| Toàn vẹn | `md5(frontend/dist/index.html) = md5(download) = 4a5bd55b6fc7f29e6364490b6213df8c` |

### 9.2. Guard tests (chứng minh hàng rào hoạt động)

```text
G1 upload thieu SSE  -> AccessDenied ... with an explicit deny in a resource-based policy
G2 goi qua HTTP      -> 403 Forbidden (DenyInsecureTransport)
G3 ap policy public  -> AccessDenied ... public policies are prevented by the BlockPublicPolicy setting
```

> **Tổng kết:** lint **16/16 PASS** · live evidence **V0–V8 = 9/9** · guard tests **3/3** · policy trên AWS khớp repo.

---

## 10. 🚑 TROUBLESHOOTING

| Triệu chứng | Nguyên nhân | Cách xử lý |
| :--- | :--- | :--- |
| `403 AccessDenied` khi mở URL S3 bằng trình duyệt | **Đúng thiết kế** — bucket private | Không sửa; truy cập qua CloudFront (`P3-Q01`) |
| `AccessDenied ... explicit deny` khi **upload** | Thiếu `--sse AES256` | Thêm `--sse AES256` vào mọi `put-object` / `sync` / `cp` |
| `AccessDenied ... prevented by BlockPublicPolicy` khi `put-bucket-policy` | Đang cố áp policy public | Xoá `Principal: "*"`; dùng đúng `PolicyDocument` trong repo |
| CloudFront `403` dù đã gắn OAC | Statement `AllowCloudFrontOACReadOnly` không được áp, hoặc OAC chưa gắn vào origin | `get-bucket-policy` kiểm 3 Sid; kiểm `Origin.OriginAccessControlId` |
| CloudFront `403` sau khi siết `AWS:SourceArn` | ARN distribution sai (sai account/region) | `aws cloudfront get-distribution --id <ID> --query Distribution.ARN` rồi dán lại |
| `404 NoSuchWebsiteConfiguration` | Website hosting **OFF** (đúng thiết kế) | Không bật; dùng REST endpoint + OAC |
| `301` / `PermanentRedirect` | Gọi sai region endpoint (`s3.amazonaws.com`) | Luôn dùng `s3.ap-southeast-1.amazonaws.com` |
| `SignatureDoesNotMatch` | Lệch giờ hoặc proxy sửa header | Đồng bộ NTP/timezone |
| `NoSuchBucket` dù bucket tồn tại | Trỏ sai region | `--region ap-southeast-1` |
| Deploy xong vẫn thấy bản cũ | `index.html` bị cache ở edge/browser | `max-age=0, must-revalidate` (đã set) + invalidation `/index.html` |
| `DependencyError` / `InvalidBucketState` khi xoá bucket | Bucket còn object/version | Xem §11.2 |

> Vì sao object không tồn tại trả **403** chứ không **404**: caller không có `s3:ListBucket` ⇒ S3 ẩn sự tồn tại của object (chống enumeration) — hành vi **mong muốn**; `P3-Q01` phải map **cả 403 và 404** về `/index.html`.

---

## 11. 🔁 ROLLBACK / DESTROY

### 11.1. Rollback một lần deploy hỏng

```bash
aws s3api list-object-versions --bucket fpl-lineup-frontend-prod --prefix index.html --no-cli-pager \
  --query 'Versions[].[VersionId,LastModified,Size]' --output table
aws s3api copy-object --bucket fpl-lineup-frontend-prod --key index.html --no-cli-pager \
  --copy-source "fpl-lineup-frontend-prod/index.html?versionId=<VERSION_ID_CU>" \
  --server-side-encryption AES256 --metadata-directive REPLACE \
  --content-type "text/html; charset=utf-8" --cache-control "public, max-age=0, must-revalidate"
```

### 11.2. Xoá toàn bộ object (kể cả version) rồi xoá bucket

```bash
B=fpl-lineup-frontend-prod; TMPW=$(cygpath -m /tmp)
aws s3api list-object-versions --bucket $B --no-cli-pager \
  --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json > "$TMPW/p2q04_versions.json"
aws s3api delete-objects --bucket $B --no-cli-pager --delete "file://$TMPW/p2q04_versions.json"
aws s3api list-object-versions --bucket $B --no-cli-pager \
  --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json > "$TMPW/p2q04_markers.json"
aws s3api delete-objects --bucket $B --no-cli-pager --delete "file://$TMPW/p2q04_markers.json"
aws s3api delete-bucket --bucket $B --region ap-southeast-1 --no-cli-pager
```

> Nếu `list-object-versions` trả `"Objects": null` (bucket rỗng) → **bỏ qua** `delete-objects` tương ứng (`MalformedXML`).

### 11.3. Thu hồi OAC (chỉ sau khi đã xoá distribution ở `P3-Q01`)

```bash
aws cloudfront delete-origin-access-control --id E2IX1YDEAHD87E --no-cli-pager \
  --if-match "$(aws cloudfront get-origin-access-control --id E2IX1YDEAHD87E --query ETag --output text --no-cli-pager)"
```

**Thứ tự destroy đúng:** CloudFront distribution → Route53 record (nếu có) → OAC → S3 objects + versions → bucket → kiểm tra Billing = `$0`.

---

## 12. 🛡️ VẬN HÀNH ĐỊNH KỲ (GUARDIAN — hằng tuần)

| # | Việc | Lệnh | Kỳ vọng |
| :--- | :--- | :--- | :--- |
| 1 | BPA vẫn 4/4 | `aws s3api get-public-access-block --bucket fpl-lineup-frontend-prod` | 4 × `true` |
| 2 | Policy không bị làm public | `aws s3api get-bucket-policy-status --bucket fpl-lineup-frontend-prod` | `IsPublic: false` |
| 3 | ACL không có grant công khai | `aws s3api get-bucket-acl --bucket fpl-lineup-frontend-prod` | chỉ owner `FULL_CONTROL` |
| 4 | Nặc danh vẫn bị chặn | `curl -s -o /dev/null -w '%{http_code}' https://fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com/index.html` | `403` |
| 5 | Policy còn đúng 3 statement | `get-bucket-policy` + lint §7 | `16/16 PASS` |
| 6 | Website hosting vẫn OFF | `aws s3api get-bucket-website --bucket fpl-lineup-frontend-prod` | `NoSuchWebsiteConfiguration` |
| 7 | Dung lượng trong Free Tier | `aws s3api list-objects-v2 --bucket ... --query 'sum(Contents[].Size)'` | < 5 GB |
| 8 | Chi phí | AWS Billing → Cost Explorer tháng hiện tại | `$0.00` |

> 📅 Gắn routine này vào đầu mỗi buổi họp nhóm. Mục nào lệch → mở issue gắn nhãn `security` + `P2-Q04`.

---

## 13. 🤝 BÀN GIAO `P3-Q01` & RANH GIỚI

### 13.1. `P3-Q01` PHẢI làm tiếp (điều kiện để web chạy HTTPS)

1. Tạo distribution với origin = **REST endpoint** `fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com` (**không** phải website endpoint).
2. Gắn `OriginAccessControlId = E2IX1YDEAHD87E`, `OriginProtocolPolicy = https-only`.
3. `ViewerProtocolPolicy = redirect-to-https` + **ACM cert** ở `us-east-1`.
4. `CustomErrorResponse`: **403 và 404 → `/index.html`** với response code `200` (SPA routing).
5. **Siết policy**: thay `AWS:SourceAccount` bằng block `PolicyDocumentDeferredStatement_P3Q01` trong `s3_bucket_policy.json` → `grep -c 'distribution/'` = `1`; chạy lại lint §7 vẫn `16/16 PASS`.
6. Nghiệm thu: `curl https://<dist>.cloudfront.net/index.html` → **200**, URL S3 trực tiếp vẫn **403**.

### 13.2. Vì sao dùng AWS CLI thay vì Terraform?

- Giới hạn task: **tối đa 2 file** (`s3_setup.md`, `s3_bucket_policy.json`) → **không** thêm `terraform_s3.tf`.
- `terraform_rds.tf` (`P2-Q01`) đã “own” provider + `local.common_tags`; thêm resource S3 vào đó là **vượt phạm vi** và rủi ro cho state RDS đang chạy.
- **Backlog (không làm ở task này):** tách `providers.tf` / `main.tf` + `terraform import` bucket & OAC (state hiện tại `infra/aws/terraform.tfstate` chỉ chứa RDS).

### 13.3. Tuyệt đối KHÔNG làm ở các task sau

| Cấm | Lý do |
| :--- | :--- |
| Bật public read / `Principal: *` | Vi phạm AC; bot quét + phát tán nội dung |
| Bật Static Website Hosting khi vẫn dùng OAC | OAC không hỗ trợ website endpoint → `403` toàn bộ |
| Cấp `s3:*` / `PutObject` cho CloudFront | CDN có thể ghi/xoá dữ liệu |
| Upload không `--sse AES256` | Bị deny, hoặc tệ hơn: nếu policy bị nới → object không mã hoá |
| Dùng KMS CMK cho bucket static | $1/CMK/tháng, không cần cho nội dung công khai |
| Xoá `infra/aws/terraform.tfstate` | Chứa state RDS của `P2-Q01` |

---

## 14. ☑️ CHECKLIST NGHIỆM THU & BÀN GIAO

### 14.1. Acceptance Criteria của task

| AC | Nội dung | ✓ | Bằng chứng |
| :--- | :--- | :--- | :--- |
| AC-1 | Bucket S3 ở region `ap-southeast-1` | ✅ | §8 V0 · §9.1 |
| AC-2 | Cấu hình quyền truy cập qua CloudFront **OAC** | ✅ | OAC `E2IX1YDEAHD87E` + statement `AllowCloudFrontOACReadOnly` · `IsPublic: false` (§8 V2/V6) |
| AC-3 | Upload thử `index.html` | ✅ | 3060 B · `ETag 4a5bd55b…` · version `g8Vguxn…` (§9.1) |
| AC-4 | Phản hồi `HTTP 200` qua S3 API | ✅ | `sigv4_get=200 size=3060` (§8.1) |
| AC-5 | Không có `Allow` + `Principal: "*"` nào | ✅ | lint L04/L05 |
| AC-6 | Chi phí `$0.00`, Budget Alert đang bật | ✅ | §1 · §4 |
| AC-7 | Không có credential/secret trong repo | ✅ | chỉ 2 file tài liệu + policy, không chứa khoá |

### 14.2. ✅ CHECKLIST CHO DEV (làm theo thứ tự, tick từng ô)

**A. Trước khi review diff**

- [ ] **A1.** `git branch --show-current` → `feature/P2-Q04-s3-bucket-setup`.
- [ ] **A2.** `git status --short` → **đúng 2 file**: `infra/aws/s3_setup.md`, `infra/aws/s3_bucket_policy.json` (không file rác, **không** `terraform.tfstate`).
- [ ] **A3.** `python -c "import json;d=json.load(open('infra/aws/s3_bucket_policy.json',encoding='utf-8'));print(len(d), len(d['PolicyDocument']['Statement']))"` → `7 3` (đủ 7 section, đúng 3 statement).
- [ ] **A4.** Chạy lint §7 (`python "%TEMP%/p2q04_lint.py"`, script **không** commit) → `RESULT: 16/16 PASS`, exit code `0`.
- [ ] **A5.** `grep -nE 'AKIA[0-9A-Z]{16}|X-Amz-Signature=[0-9a-f]|aws_secret_access_key *= *[A-Za-z0-9/+=]{10}' infra/aws/s3_setup.md infra/aws/s3_bucket_policy.json` → **rỗng** (không lộ access key / chữ ký / secret).

**B. Đối chiếu AWS thật (read-only, ~1 phút)**

- [ ] **B1.** `aws s3api get-bucket-location --bucket fpl-lineup-frontend-prod --no-cli-pager` → `ap-southeast-1`.
- [ ] **B2.** `aws s3api get-public-access-block --bucket fpl-lineup-frontend-prod --no-cli-pager` → 4 × `true`.
- [ ] **B3.** `aws s3api get-bucket-policy-status --bucket fpl-lineup-frontend-prod --no-cli-pager` → `IsPublic: false`.
- [ ] **B4.** `curl -s -o /dev/null -w '%{http_code}' https://fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com/index.html` → `403`.
- [ ] **B5.** `aws s3api head-object --bucket fpl-lineup-frontend-prod --key index.html --no-cli-pager --query '[ContentLength,ServerSideEncryption]'` → `[3060,"AES256"]` (chứng minh AC-3/AC-4).
- [ ] **B6.** `aws s3api get-bucket-website --bucket fpl-lineup-frontend-prod --no-cli-pager` → `NoSuchWebsiteConfiguration` (website hosting OFF đúng thiết kế).
- [ ] **B7.** `aws cloudfront get-origin-access-control --id E2IX1YDEAHD87E --no-cli-pager --query OriginAccessControl.OriginAccessControlConfig.SigningBehavior` → `always`.
- [ ] **B8.** So policy AWS với repo: `aws s3api get-bucket-policy --bucket fpl-lineup-frontend-prod --no-cli-pager --query Policy --output text > "%TEMP%/live_policy.json"` rồi so với `PolicyDocument` → **khớp 100 %** (`live==repo: True`).

---

**C. Trước khi commit / merge**

- [ ] **C1.** Đọc lại §1.1 (3 mâu thuẫn) + §13.1 (bàn giao `P3-Q01`) — **không** tự bật lại Static Website Hosting.
- [ ] **C2.** Commit message theo convention: `docs(devops): [P2-Q04] trim runbook, record 04/11 re-verification, dev checklist`.
- [ ] **C3.** Commit **chỉ trên nhánh** `feature/P2-Q04-s3-bucket-setup`, **không push** (chờ Dev/Tech Lead duyệt diff).
- [ ] **C4.** `TODO.md`: `docs/TODO.md` đã có `[x] P2-Q04` + ghi chú 02/11 → **không sửa** trong commit này (ràng buộc phạm vi 2 file); nếu cần bổ sung thì mở commit riêng.
- [ ] **C5.** Tạo PR → nhãn `infra` + `security`, mô tả PR = §14.1 + §9.1.

**D. Bàn giao `P3-Q01` (điều kiện web chạy HTTPS)**

- [ ] **D1.** Distribution với origin **REST endpoint** `fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com`.
- [ ] **D2.** `OriginAccessControlId = E2IX1YDEAHD87E` · `OriginProtocolPolicy = https-only`.
- [ ] **D3.** `ViewerProtocolPolicy = redirect-to-https` + ACM cert ở `us-east-1`.
- [ ] **D4.** `CustomErrorResponse`: **403 và 404** → `/index.html`, response code `200`.
- [ ] **D5.** Siết policy bằng `PolicyDocumentDeferredStatement_P3Q01` → `grep -c 'distribution/'` = `1`; lint vẫn `16/16`.
- [ ] **D6.** Nghiệm thu: `curl https://<dist>.cloudfront.net/index.html` → `200`, URL S3 trực tiếp → `403`.

### 14.3. Ghi chú cho Tech Lead khi review

1. Task **đã chạy thật** trên account `711695043505`; bằng chứng §9, tái lập bằng §8.
2. Điểm cần review kỹ nhất: **quyết định KHÔNG bật Static Website Hosting** (§1.1 — 0.2) và **`AWS:SourceAccount` tạm thời** thay `AWS:SourceArn` (§13.1 — bước 5).
3. Mọi thay đổi `bucket policy` / `BlockPublicPolicy` = **Level 4** → Tech Lead review + chạy lint trước khi apply.

---

<p align="center"><em>P2-Q04 · Fantasy Football Lineup Builder & Optimizer · AWS Free Tier ($0.00) · Quang (DevOps & AWS Lead)</em></p>








