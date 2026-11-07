# 🚀 P3-Q01 — FRONTEND LÊN AWS S3 + CLOUDFRONT (HTTPS · CDN · SPA ROUTING) · RUNBOOK & HANDOFF

> **Task:** `P3-Q01` *(Level 4 — Critical)* · **Owner:** Quang (DevOps & AWS Lead)
> **Branch:** `feature/P3-Q01-s3-cloudfront-deploy` · **Files:** `infra/aws/cloudfront_setup.md` (tài liệu này) + `infra/aws/cloudfront_distribution.json` (config + guardrails)
> **Nguồn chuẩn:** [`PROJECT_SSOT`](../../docs/PROJECT_SSOT.md) · [`PROJECT_ROADMAP`](../../docs/PROJECT_ROADMAP.md) · [`TODO`](../../TODO.md) · [`AI_GUIDELINES`](../../docs/AI_GUIDELINES.md)
> **Phụ thuộc:** `P2-Q04` *(bucket `fpl-lineup-frontend-prod` + OAC `E2IX1YDEAHD87E`)* ✅ · `P2-Q03` *(Budget Alert $1.00)* ✅
>
> **🚦 Trạng thái 07/11/2026:** ✅ Distribution **đã tạo thật & đã deploy frontend**; HTTPS + SPA fallback + TLS/security headers đã kiểm bằng `curl` (xem §9). ✅ **Dev đã nghiệm thu bằng trình duyệt** tại https://d24f3bc3qfp5xf.cloudfront.net (frontend hiển thị, ổ khóa HTTPS hợp lệ) và đã tick `[x]` cho `P3-Q01` trong `docs/TODO.md`. ⏳ 2 việc **cố ý để mở** (cần Tech Lead quyết): siết bucket policy `AWS:SourceAccount` → `AWS:SourceArn` (D-1) và custom domain + ACM (D-2) — xem §13.2.

---

## 1. ⚡ TL;DR

| Hạng mục | Giá trị thực tế |
| :--- | :--- |
| Distribution ID / Domain | `E3N44ZRJO1UZ2C` · **https://d24f3bc3qfp5xf.cloudfront.net** |
| ARN | `arn:aws:cloudfront::711695043505:distribution/E3N44ZRJO1UZ2C` |
| Origin | `fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com` (**REST** endpoint, không phải website endpoint) |
| OAC | `E2IX1YDEAHD87E` (`sigv4` / `always` / `s3`) — kế thừa từ `P2-Q04` |
| HTTPS | `ViewerProtocolPolicy = redirect-to-https` · `MinimumProtocolVersion = TLSv1.2_2021` · cert `*.cloudfront.net` (miễn phí, tự xoay vòng) |
| HTTP/2 + HTTP/3 | `HttpVersion = http2and3` · IPv6 bật |
| SPA routing | `CustomErrorResponses`: **403 và 404 → `/index.html` (response code 200, TTL 10s)** |
| Cache | `Managed-CachingOptimized` (`658327ea-…`) + `Managed-SecurityHeadersPolicy` (`67f7725c-…`) |
| Object trên S3 | `index.html` 3060 B (`text/html`, `max-age=0, must-revalidate`) · `assets/index-BWgD_5aR.js` 649 209 B (`text/javascript`, `max-age=31536000, immutable`) · cả hai `SSE=AES256` |
| Riêng tư | Bucket vẫn `IsPublic: false` · nặc danh vào S3 trực tiếp = **403** (không đổi so với `P2-Q04`) |
| Chi phí | **$0.00** trong Free Tier (1 TB transfer + 10 M request/tháng) · Budget guard $1.00 đang bật |
| WAF / Logging / Origin Shield | **TẮT có chủ đích** (WAF $5/tháng = 5× ngân sách; logging tốn S3 PUT; Shield không cần) |

### 1.1. Bốn mâu thuẫn của đề bài và cách xử lý

| # | Nội dung lệch | Cách xử lý |
| :--- | :--- | :--- |
| 0.1 | Đề bài ghi *“origin S3 static website”* — nhưng `P2-Q04` **cố ý tắt** Static Website Hosting vì OAC **không ký được** request tới website endpoint (AWS docs: *“If your origin is an Amazon S3 bucket configured as a website endpoint … you can't use OAC”*) | Origin = **REST endpoint** + OAC. Tắt website hosting là **đúng thiết kế**, không phải lỗi cần “sửa”. SPA routing do **CustomErrorResponses** đảm nhiệm thay vì `IndexDocument` của website endpoint |
| 0.2 | Đề bài ghi *“SSL/TLS miễn phí qua AWS Certificate Manager (ACM)”* | Với domain mặc định `*.cloudfront.net`, CloudFront **đã có sẵn chứng chỉ công khai miễn phí** — **không cần và không thể** tạo ACM cert (ACM chỉ cấp cho domain bạn sở hữu và phải xác thực DNS/email). Tạo ACM cert cho domain không sở hữu = **bắt buộc fail**. ⇒ AC “SSL hợp lệ” đạt bằng cert mặc định; đường ACM (**bắt buộc region `us-east-1`**) được đóng gói sẵn ở §6.6 cho ngày có custom domain |
| 0.3 | AC *“F5 trang không lỗi 404”* — nhưng app hiện tại dùng **tab state** (`useState`, chưa có `react-router`), nên chưa có URL con nào để F5 | Vẫn cấu hình fallback 403+404 → `/index.html` (đúng chuẩn SPA). Kiểm chứng bằng URL sâu giả lập `/players`, `/deep/link/route` → **200** + trả về chính `index.html`. Khi `P4` thêm router, fallback này hoạt động ngay, không phải sửa hạ tầng |
| 0.4 | Đề bài không nhắc **base path**: `frontend/vite.config.ts` đặt `base = '/epl-fantasy-lineups/'` khi `NODE_ENV=production` (di sản kiểu GitHub Pages) | Nếu build bằng `npm run build` thường, `index.html` sẽ trỏ `/epl-fantasy-lineups/assets/…` ⇒ **trắng trang** trên CloudFront. Build **bắt buộc** `vite build --base=/` (§6.1). `vite.config.ts` thuộc `frontend/` của **Nguyên** ⇒ **không sửa**, chỉ override lúc build và ghi handoff (§13.1) |

---

## 2. 🏗️ KIẾN TRÚC & LUỒNG REQUEST

```text
Người dùng (trình duyệt)
   │  https://d24f3bc3qfp5xf.cloudfront.net/players        (F5 / deep link)
   ▼
CloudFront edge (HTTPS, TLS1.2+, HSTS, gzip/brotli, IPv6/HTTP3)
   │  cache MISS → ký SigV4 bằng OAC E2IX1YDEAHD87E
   ▼
S3 REST endpoint  fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com   (BPA 4/4, IsPublic=false)
   │  GET /players → 403 AccessDenied (không có ListBucket ⇒ S3 ẩn sự tồn tại của object)
   ▼
CloudFront CustomErrorResponses: 403 → /index.html, trả về 200
   ▼
Trình duyệt nhận index.html → tải /assets/index-<hash>.js (immutable 1 năm)
```

**Vì sao phải map cả 403 *và* 404:** bucket private không cấp `s3:ListBucket` cho OAC, nên S3 trả **403** cho object không tồn tại (chống enumeration) chứ không trả 404. Chỉ cấu hình 404 → `/index.html` là **thiếu**, SPA vẫn gãy. Đây là cái bẫy phổ biến nhất của “S3 + CloudFront + OAC + SPA”.

**Ba lớp chống lỗi “trắng trang” (white screen):**

| Lớp | Cơ chế | Nếu thiếu |
| :--- | :--- | :--- |
| 1 | `DefaultRootObject = index.html` | `https://domain/` trả 403 thay vì trang chủ |
| 2 | `/assets/*` upload với `Content-Type: text/javascript` | Trình duyệt chặn module script (`text/plain`) → trắng trang |
| 3 | `base=/` lúc build | `index.html` trỏ sai prefix `/epl-fantasy-lineups/` → 404 asset |

---

## 3. 💰 FREE TIER & HÀNG RÀO CHI PHÍ

| Dịch vụ / hạng mục | Free Tier | Kỳ vọng dự án | Tiền ngoài Free Tier |
| :--- | :--- | :--- | :--- |
| CloudFront data transfer out | 1 TB / tháng | < 1 GB | $0.085/GB (ap-southeast-1) |
| CloudFront HTTPS requests | 10 000 000 / tháng | < 10 000 | $0.0120/10k request |
| CloudFront invalidation | 1 000 path / tháng | ~10 path mỗi lần deploy | $0.005/path |
| CloudFront Functions / Lambda@Edge | 2 000 000 / 1 000 000 | 0 (không dùng) | – |
| ACM certificate | Miễn phí (mọi region) | 0 (dùng cert mặc định) | $0 |
| **AWS WAF** | **Không có Free Tier** | **0 — không bật** | **$5.00/WebACL/tháng + $1.00/rule** |
| CloudFront standard logging | Không có Free Tier | **0 — không bật** | S3 storage + PUT |
| Origin Shield | Không có Free Tier | **0 — không bật** | phí theo request |
| Route 53 hosted zone (custom domain) | Không có Free Tier | **0 — không bật** | $0.50/zone/tháng |

**Ba hàng rào đang bật:** (1) Budget `fpl-freetier-guard-1usd` (`P2-Q03`) cảnh báo ở 80 % và 100 % của **$1.00**; (2) config JSON **không** chứa WAF/Logging/Shield — muốn bật phải sửa file và sẽ bị bắt ở review; (3) `update-distribution` **bắt buộc** kèm `--if-match <ETag>` ⇒ không thể “lén” đổi cấu hình bằng một lệnh vô tình.

> ⚠️ **Nói thẳng:** sau 12 tháng Free Tier, CloudFront tính phí theo lưu lượng. Với < 1 GB/tháng chi phí vẫn **dưới $0.10** — Budget Alert $1.00 là chốt chặn cuối.

---

## 4. 🧰 PREREQUISITES

```bash
aws --version                      # đã kiểm: aws-cli/2.39.3 (Python 3.14.8, Windows)
aws sts get-caller-identity        # Account 711695043505 · user/quang-devops · region ap-southeast-1
node --version && npm --version    # build frontend (Vite 5)
curl --version                     # kiểm chứng HTTPS/TLS
python --version                   # trích envelope JSON
```

- **Không** cần `--region` cho lệnh CloudFront (global service). Chỉ ACM **bắt buộc** `--region us-east-1`.
- **Git Bash trên Windows:** tham số có dấu `/` đầu (ví dụ `--base=/`) bị MSYS đổi thành `C:/Program Files/Git/…`. Luôn thêm `MSYS_NO_PATHCONV=1` (bài học thật của task này — xem §10).
- `export AWS_PAGER=''` để CLI không treo ở pager khi chạy trong agent/CI.

---

## 5. 📦 HAI FILE CỦA TASK NÀY

| File | Vai trò | Cách dùng |
| :--- | :--- | :--- |
| `infra/aws/cloudfront_distribution.json` | **Envelope audit**: `Metadata` + `DistributionConfig` + `ManagedPoliciesUsed` + `ForbiddenSettings_DO_NOT_APPLY` + `ComplianceGuards` + `VerificationMatrix` | Trích `DistributionConfig` rồi `create-distribution` (§6.2) |
| `infra/aws/cloudfront_setup.md` | Runbook + bằng chứng + handoff | Đọc từ trên xuống |

**Vì sao envelope chứ không phải config trần:** giống `infra/aws/s3_bucket_policy.json` — truy vết task/owner/branch, lý do từng lựa chọn và **danh sách cấm** nằm ngay cạnh cấu hình. `aws cloudfront create-distribution` chỉ nhận config trần ⇒ 1 lệnh trích duy nhất.

---

## 6. 🚀 RUNBOOK TRIỂN KHAI (IDEMPOTENT)

### 6.1. Build frontend (BẮT BUỘC `--base=/`)

```bash
cd frontend
MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' npx vite build --base=/
grep -o 'src="/assets[^"]*"' dist/index.html     # PHẢI ra src="/assets/index-<hash>.js"
```

- **Sai điển hình:** `npx vite build --base=/` trên Git Bash → Vite nhận `--base=C:/Program Files/Git/` ⇒ `index.html` trỏ `/Program Files/Git/assets/…`. Luôn đặt `MSYS_NO_PATHCONV=1` **trước** lệnh.
- **Khi có backend (`P3-Q02`):** build kèm `VITE_API_BASE_URL=https://<backend>/api/v1` (xem `frontend/src/services/apiClient.ts`). Hiện chưa có backend nên bản deploy cố ý dùng mặc định `http://localhost:8000/api/v1`: trang tải được, các call API sẽ fail — đúng phạm vi AC của `P3-Q01` (chỉ yêu cầu tải trang), và là input cho `P3-Q02`/`P3-Q03`.

### 6.2. Tạo distribution từ envelope (`CallerReference` cố định ⇒ idempotent)

```bash
export AWS_PAGER=''
TMPW=$(cygpath -m /tmp)          # Git Bash: đổi /tmp sang đường dẫn Windows cho python
python -c "import json,sys;d=json.load(open('infra/aws/cloudfront_distribution.json',encoding='utf-8'));json.dump(d['DistributionConfig'],open(sys.argv[1],'w',encoding='utf-8'),indent=2)" "$TMPW/cf_config.json"

aws cloudfront create-distribution --distribution-config "file://$TMPW/cf_config.json" \
  --query 'Distribution.{Id:Id,DomainName:DomainName,ARN:ARN,Status:Status}' --output json
```

- Chạy lại với **cùng** `CallerReference` + cùng config ⇒ AWS trả về **distribution đã có** (không tạo trùng). Nếu sửa config thì dùng `update-distribution` (§6.5), **không** đổi `CallerReference`.
- Distribution mới ở trạng thái `InProgress` **3–10 phút**; trong khoảng này `https://…cloudfront.net` trả 403/502 là **bình thường**.

### 6.3. Upload frontend (2 lệnh, header khác nhau — đừng gộp)

```bash
# index.html: KHÔNG cache ở edge/browser để bản mới lên ngay
aws s3 cp frontend/dist/index.html s3://fpl-lineup-frontend-prod/index.html \
  --sse AES256 --content-type 'text/html; charset=utf-8' \
  --cache-control 'public, max-age=0, must-revalidate'

# assets/: hash nằm trong tên file ⇒ cache 1 năm immutable
aws s3 cp frontend/dist/assets s3://fpl-lineup-frontend-prod/assets/ --recursive \
  --exclude '.gitkeep' --sse AES256 \
  --cache-control 'public, max-age=31536000, immutable'
```

`--sse AES256` là **bắt buộc**: bucket policy `P2-Q04` có `DenyInsecureObjectUpload` ⇒ thiếu cờ này là `AccessDenied`.

### 6.4. Invalidate (chỉ `index.html` là đủ)

```bash
aws cloudfront create-invalidation --distribution-id E3N44ZRJO1UZ2C --paths '/index.html' '/'
```

`/assets/*` **không cần** invalidate vì tên file đã chứa hash nội dung; invalidate cả thư mục vừa tốn quota (1 000 path/tháng) vừa vô nghĩa.

### 6.5. Sửa cấu hình distribution (khi cần)

```bash
ETAG=$(aws cloudfront get-distribution-config --id E3N44ZRJO1UZ2C --query ETag --output text)
aws cloudfront get-distribution-config --id E3N44ZRJO1UZ2C --query DistributionConfig > "$TMPW/live_cf.json"
# sửa live_cf.json rồi:
# aws cloudfront update-distribution --id E3N44ZRJO1UZ2C --if-match "$ETAG" --distribution-config "file://$TMPW/live_cf.json"
```

> Luôn cập nhật lại `infra/aws/cloudfront_distribution.json` để **repo == live** (kỷ luật đã áp cho bucket policy ở `P2-Q04`).

### 6.6. Đường Custom domain + ACM (CHƯA làm — cần domain thật)

```bash
# 1) Cert PHẢI ở us-east-1 (yêu cầu của CloudFront), KHÔNG phải ap-southeast-1
aws acm request-certificate --region us-east-1 --domain-name app.example.com \
  --validation-method DNS --query CertificateArn --output text
# 2) Tạo bản ghi DNS CNAME _<token>.app.example.com theo output describe-certificate
# 3) Chờ Status=ISSUED rồi mới gắn vào distribution:
#    ViewerCertificate: {ACMCertificateArn, SSLSupportMethod: sni-only, MinimumProtocolVersion: TLSv1.2_2021}
#    CloudFrontDefaultCertificate: false · Aliases: {Quantity: 1, Items: [app.example.com]}
# 4) DNS trỏ CNAME app.example.com -> d24f3bc3qfp5xf.cloudfront.net (hoặc Route 53 A-alias, $0.50/zone/tháng)
```

**Điều kiện tiên quyết:** nhóm phải **sở hữu** domain và xác thực được DNS. Không có domain ⇒ **không** tạo được cert ⇒ AC vẫn đạt bằng domain `*.cloudfront.net` (miễn phí, cert tự động, không cần bảo trì).

---

## 7. 🧪 CONFIG LINT — 16 TEST CASES (offline, chạy trước mọi apply/update)

Không cần credentials, không tốn tiền, chạy thẳng trên envelope:

```bash
python - <<'PY'
import json
d = json.load(open('infra/aws/cloudfront_distribution.json', encoding='utf-8'))
c = d['DistributionConfig']; o = c['Origins']['Items'][0]; t = []
chk = lambda n, ok: t.append((n, bool(ok)))
chk('L01 origin REST endpoint (không phải .s3-website)', '.s3-website' not in o['DomainName'] and o['DomainName'].endswith('.amazonaws.com'))
chk('L02 OAC đã gắn', o.get('OriginAccessControlId') == 'E2IX1YDEAHD87E')
chk('L03 không dùng OAI', o['S3OriginConfig']['OriginAccessIdentity'] == '')
chk('L04 redirect-to-https', c['DefaultCacheBehavior']['ViewerProtocolPolicy'] == 'redirect-to-https')
chk('L05 DefaultRootObject=index.html', c.get('DefaultRootObject') == 'index.html')
ce = {i['ErrorCode']: i for i in c['CustomErrorResponses']['Items']}
chk('L06 fallback 403 -> /index.html 200', 403 in ce and ce[403]['ResponsePagePath'] == '/index.html' and ce[403]['ResponseCode'] == '200')
chk('L07 fallback 404 -> /index.html 200', 404 in ce and ce[404]['ResponsePagePath'] == '/index.html' and ce[404]['ResponseCode'] == '200')
chk('L08 chỉ GET/HEAD', sorted(c['DefaultCacheBehavior']['AllowedMethods']['Items']) == ['GET', 'HEAD'])
chk('L09 nén bật', c['DefaultCacheBehavior']['Compress'] is True)
chk('L10 security headers policy', c['DefaultCacheBehavior'].get('ResponseHeadersPolicyId') == '67f7725c-6f97-4210-82d7-5512b31e9d03')
chk('L11 TLS >= 1.2', c['ViewerCertificate']['MinimumProtocolVersion'] == 'TLSv1.2_2021')
chk('L12 KHÔNG bật WAF ($5/tháng)', c.get('WebACLId', '') == '')
chk('L13 KHÔNG bật logging', c['Logging']['Enabled'] is False)
chk('L14 KHÔNG bật Origin Shield', o['OriginShield']['Enabled'] is False)
chk('L15 KHÔNG có alias khi chưa có ACM', c['Aliases']['Quantity'] == 0)
chk('L16 CallerReference cố định (idempotent)', c['CallerReference'] == 'fpl-p3q01-frontend-20261107')
for n, ok in t: print('PASS' if ok else 'FAIL', n)
print(f'{sum(ok for _, ok in t)}/{len(t)} PASS')
raise SystemExit(0 if all(ok for _, ok in t) else 1)
PY
```

**Kỳ vọng:** `16/16 PASS`, exit `0`. Mục nào FAIL ⇒ **không** apply.

---

## 8. ✅ KIỂM CHỨNG V0 → V9

```bash
export AWS_PAGER=''
D=d24f3bc3qfp5xf.cloudfront.net; ID=E3N44ZRJO1UZ2C
aws cloudfront get-distribution --id $ID --query 'Distribution.{Status:Status,Enabled:Enabled,Domain:DomainName}' --output json   # V0
aws cloudfront get-distribution-config --id $ID --query 'DistributionConfig.Origins.Items[0].{Domain:DomainName,OAC:OriginAccessControlId,OAI:S3OriginConfig.OriginAccessIdentity}'   # V1
curl -sI https://$D/index.html | head -1                                                    # V2  200
curl -sI http://$D/index.html | grep -Ei '^(HTTP|location)'                                 # V3  301 + https
curl -s -o /dev/null -w 'no-such-file=%{http_code}\n' https://$D/no-such-file.html          # V4  200
curl -s -o /dev/null -w 'deep-link=%{http_code}\n'    https://$D/deep/link/route            # V5  200
openssl s_client -connect $D:443 -servername $D </dev/null 2>/dev/null | grep -Ei 'subject=|issuer=|Protocol  :|Cipher    :'   # V6
curl -s -o /dev/null -w 'verify_result=%{ssl_verify_result}\n' https://$D/index.html                          # V6b  0
curl -sI https://$D/index.html | grep -Ei 'strict-transport|x-content-type|x-frame|content-type|cache-control'  # V7
curl -s -o /dev/null -w 's3-direct=%{http_code}\n' https://fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com/index.html  # V8  403
```

| ID | Kiểm tra | Kỳ vọng | Ý nghĩa |
| :--- | :--- | :--- | :--- |
| V0 | Distribution `Deployed` + `Enabled` | `Deployed` / `true` | CDN đã sẵn sàng ở toàn bộ edge |
| V1 | Origin REST + OAC + không OAI | `s3.ap-southeast-1.amazonaws.com` / `E2IX1YDEAHD87E` / `""` | Không có đường đọc công khai |
| V2 | `https://…/index.html` | `200` (HTTP/2 hoặc HTTP/3 trên trình duyệt; curl Windows chỉ nói HTTP/1.1) | AC-1 |
| V3 | `http://…/index.html` | `301` → `https://` | AC-2 (HTTPS bắt buộc) |
| V4 | File không tồn tại | `200` (nội dung `index.html`) | AC-3 SPA routing |
| V5 | Deep link `/deep/link/route` (F5) | `200` | AC-3 SPA routing |
| V6 | Chứng chỉ TLS | `subject=CN=*.cloudfront.net`, `issuer=Amazon RSA 2048 M04`, `Protocol: TLSv1.3`, `verify_result=0` | AC-4 SSL hợp lệ (xem §8.2 về giới hạn security policy) |
| V7 | Header | `content-type: text/html`, `strict-transport-security`, `nosniff`, `x-frame-options: SAMEORIGIN` | Bảo mật + không trắng trang |
| V8 | S3 trực tiếp | `403` | Bucket **vẫn** private (không nới quyền để “cho chạy”) |
| V9 | Security Group | Không áp dụng | CloudFront không thuộc VPC — đừng “siết” bằng SG |

### 8.1. Phân biệt “200 nhờ fallback” và “200 nhờ trúng object” (chống tự lừa)

```bash
# Nội dung deep link phải GIỐNG HỆT index.html  → chứng minh là fallback, không phải file thật
curl -s https://$D/deep/link/route | md5sum
curl -s https://$D/index.html     | md5sum     # hai md5 PHẢI bằng nhau
md5sum frontend/dist/index.html                 # và PHẢI bằng md5 bản local
```

### 8.2. ⚠️ Sự thật về `MinimumProtocolVersion` (đo được, không đoán)

Bằng chứng đo trên distribution thật:

```text
$ aws cloudfront get-distribution-config --id E3N44ZRJO1UZ2C --query DistributionConfig.ViewerCertificate
{ "CloudFrontDefaultCertificate": true, "SSLSupportMethod": "vip",
  "MinimumProtocolVersion": "TLSv1", "CertificateSource": "cloudfront" }     ← AWS ghi đè TLSv1

$ curl -s -o /dev/null --tls-max 1.0 -w '%{http_code}\n' https://d24f3bc3qfp5xf.cloudfront.net/index.html
200                                                                          ← TLS 1.0 vẫn bắt tay được
```

Trích **AWS CloudFront API Reference — ViewerCertificate.MinimumProtocolVersion**:
> *“If the distribution uses the CloudFront domain name such as d111111abcdef8.cloudfront.net (you set `CloudFrontDefaultCertificate` to true), **CloudFront automatically sets the security policy to TLSv1 regardless of the value that you set here**.”*

| Câu hỏi | Trả lời |
| :--- | :--- |
| AC “certificate SSL hợp lệ” có đạt? | ✅ Đạt — `CN=*.cloudfront.net`, `issuer=Amazon RSA 2048 M04`, `verify_result=0`; Chrome/Edge/Firefox đều hiện ổ khóa xanh |
| Trình duyệt thực tế dùng TLS nào? | **TLS 1.3** (`TLS_AES_128_GCM_SHA256`) — client hiện đại luôn chọn bản cao nhất |
| Có phải lỗi cấu hình của mình? | ❌ Không — AWS **ép** TLSv1 cho mọi distribution dùng cert mặc định. Config gửi `TLSv1.2_2021` nhưng bị normalize |
| Muốn **bắt buộc** TLS ≥ 1.2? | Phải có **custom domain + ACM cert (SNI)** — open item **D-2**, §6.6 và §13 |
| Có rủi ro gì với đồ án? | Thấp: TLS 1.0 chỉ còn dùng được bằng công cụ scan; nội dung là tĩnh, công khai, không cookie, không login |

> **Không** “chữa cháy” bằng cách bật `SSLSupportMethod: vip` + IAM cert tự tạo: `vip` chỉ dành cho cert riêng (tính thêm phí tháng) và vẫn **không** giải quyết khi thiếu domain. Ghi nhận trung thực quan trọng hơn một dòng config đẹp.

---

## 9. 📌 BẰNG CHỨNG THẬT (07/11/2026)

### 9.1. Giá trị live

| Hạng mục | Giá trị |
| :--- | :--- |
| Distribution | `E3N44ZRJO1UZ2C` · `arn:aws:cloudfront::711695043505:distribution/E3N44ZRJO1UZ2C` |
| Domain | `d24f3bc3qfp5xf.cloudfront.net` |
| Status / Enabled | `Deployed` (10 vòng poll, ~2 phút 30 giây) · `Enabled: true` |
| HTTP version / Price class | `http2and3` · `PriceClass_All` |
| Object S3 | `index.html` 3060 B · `assets/index-BWgD_5aR.js` 649 209 B · `SSE=AES256` cả hai |
| md5 `index.html` | `4a5bd55b6fc7f29e6364490b6213df8c` (live == local `frontend/dist/index.html`) |
| Bucket policy status | `IsPublic: false` (không thay đổi gì ở `P2-Q04`) |
| Config lint | `16/16 PASS`, exit `0` |

### 9.2. Ma trận HTTP đo thật

```text
$ curl -sI https://d24f3bc3qfp5xf.cloudfront.net/index.html | head -1
HTTP/1.1 200 OK
$ curl -sI http://d24f3bc3qfp5xf.cloudfront.net/index.html | grep -Ei '^(HTTP|location)'
HTTP/1.1 301 Moved Permanently
Location: https://d24f3bc3qfp5xf.cloudfront.net/index.html

root=200            (https://…/            → DefaultRootObject)
no-such-file=200    (https://…/no-such-file.html → CustomErrorResponse 403 → /index.html)
deep-link=200       (https://…/deep/link/route    → CustomErrorResponse 403 → /index.html)
s3-direct=403       (https://fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com/index.html)

md5(deep-link) = md5(index.html) = md5(frontend/dist/index.html) = 4a5bd55b6fc7f29e6364490b6213df8c
```

> `HTTP/1.1` trong log là do **curl build trên Windows không bật HTTP/2** (`ALPN: curl offers http/1.1`), không phải do CloudFront. Trình duyệt sẽ dùng HTTP/2 hoặc HTTP/3 (`HttpVersion = http2and3`).

### 9.3. Header trả về (V7)

```text
Content-Type: text/html; charset=utf-8
Cache-Control: public, max-age=0, must-revalidate
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000
X-Cache: RefreshHit from cloudfront
Via: 1.1 50e34eb95e2df1a54ef45baf53d8856a.cloudfront.net (CloudFront)
x-amz-server-side-encryption: AES256
```

`/assets/index-BWgD_5aR.js` → `HTTP/1.1 200`, `Content-Type: text/javascript`, `Content-Length: 649209`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`.

### 9.4. TLS (V6)

```text
$ openssl s_client -connect d24f3bc3qfp5xf.cloudfront.net:443 -servername d24f3bc3qfp5xf.cloudfront.net
subject=CN=*.cloudfront.net
issuer=C=US, O=Amazon, CN=Amazon RSA 2048 M04
New, TLSv1.3, Cipher is TLS_AES_128_GCM_SHA256
verify_result=0          curl https://…/index.html → 200
--tlsv1.2 --tls-max 1.2 → 200        --tlsv1.3 → 200        --tls-max 1.0 → 200 (xem §8.2)
```

---

## 10. 🚑 TROUBLESHOOTING (đã gặp thật hoặc đã lường trước)

| Triệu chứng | Nguyên nhân | Cách xử lý |
| :--- | :--- | :--- |
| `403` ngay sau `create-distribution` | Distribution còn `InProgress` | Poll `get-distribution --query Distribution.Status` tới `Deployed` (thực tế ~2,5 phút) |
| Trắng trang, `index.html` tải được nhưng JS `404` | Build sai base ⇒ `src="/Program Files/Git/assets/…"` | Build lại `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' npx vite build --base=/` |
| Trắng trang, JS tải được nhưng console báo *“Expected a JavaScript module”* | Asset upload thiếu `Content-Type` | `aws s3 cp` lần nữa (tự set `text/javascript`) rồi `create-invalidation --paths '/assets/*'` |
| `AccessDenied` khi `aws s3 cp` | Thiếu `--sse AES256` (bucket policy `DenyInsecureObjectUpload`) | Thêm `--sse AES256` |
| F5 ở `/players` → `NoSuchKey`/`403` XML | Thiếu `CustomErrorResponses` hoặc chỉ map 404 | Map **cả 403 và 404** về `/index.html` (S3 private trả 403 cho object không tồn tại) |
| `NoSuchBucket` dù bucket tồn tại | Sai region trong origin | Origin phải là `…s3.ap-southeast-1.amazonaws.com` |
| `502 Bad Gateway` | Origin domain sai/không phân giải được, hoặc OAC không khớp | Kiểm `Origins.Items[0].DomainName` + `OriginAccessControlId` |
| Sửa file mà trình duyệt vẫn thấy bản cũ | Cache `index.html` | Header `max-age=0, must-revalidate` (đã set) + `create-invalidation --paths '/index.html'` |
| `InvalidIfMatchVersion` khi `update-distribution` | ETag cũ | Lấy lại `ETag` mới rồi chạy lại |
| `MinimumProtocolVersion` gửi `TLSv1.2_2021` mà đọc ra `TLSv1` | **Hành vi của AWS** với cert mặc định | Không phải lỗi — xem §8.2 |
| `DistributionAlreadyExists` | Đã có distribution cùng `CallerReference` | Dùng `list-distributions` lấy ID cũ, không tạo mới |

---

## 11. 🔁 ROLLBACK / DESTROY

### 11.1. Disable tạm thời (giữ cấu hình, ngừng phục vụ)

```bash
ETAG=$(aws cloudfront get-distribution-config --id E3N44ZRJO1UZ2C --query ETag --output text)
aws cloudfront get-distribution-config --id E3N44ZRJO1UZ2C --query DistributionConfig > "$TMPW/off.json"
python -c "import json,sys;p=sys.argv[1];d=json.load(open(p,encoding='utf-8'));d['Enabled']=False;json.dump(d,open(p,'w',encoding='utf-8'),indent=2)" "$TMPW/off.json"
aws cloudfront update-distribution --id E3N44ZRJO1UZ2C --if-match "$ETAG" --distribution-config "file://$TMPW/off.json"
```

### 11.2. Rollback nội dung về bản trước (S3 versioning bật)

```bash
aws s3api list-object-versions --bucket fpl-lineup-frontend-prod --prefix index.html \
  --query 'Versions[].[VersionId,LastModified,Size]' --output table
aws s3api copy-object --bucket fpl-lineup-frontend-prod --key index.html \
  --copy-source "fpl-lineup-frontend-prod/index.html?versionId=<VERSION_ID_CU>" \
  --server-side-encryption AES256 --metadata-directive REPLACE \
  --content-type "text/html; charset=utf-8" --cache-control "public, max-age=0, must-revalidate"
aws cloudfront create-invalidation --distribution-id E3N44ZRJO1UZ2C --paths '/index.html'
```

### 11.3. Destroy hoàn toàn (đúng thứ tự, tránh phí treo)

```bash
# 1) Disable rồi chờ Deployed
# 2) Xoá distribution (phải Disabled + lấy ETag mới nhất)
aws cloudfront delete-distribution --id E3N44ZRJO1UZ2C --if-match "$(aws cloudfront get-distribution-config --id E3N44ZRJO1UZ2C --query ETag --output text)"
# 3) Thu hồi OAC (chỉ sau khi distribution đã xoá) - xem s3_setup.md §11.3
# 4) Xoá object + version + bucket - xem s3_setup.md §11.2
# 5) AWS Billing → Cost Explorer: xác nhận $0.00
```

---

## 12. 🛡️ VẬN HÀNH ĐỊNH KỲ (GUARDIAN — hằng tuần)

| # | Việc | Lệnh | Kỳ vọng |
| :--- | :--- | :--- | :--- |
| 1 | Distribution vẫn `Deployed` + `Enabled` | `aws cloudfront get-distribution --id E3N44ZRJO1UZ2C --query 'Distribution.{Status:Status,Enabled:DistributionConfig.Enabled}'` | `Deployed` / `true` |
| 2 | Vẫn HTTPS-only | `get-distribution-config … DefaultCacheBehavior.ViewerProtocolPolicy` | `redirect-to-https` |
| 3 | Fallback SPA còn nguyên | `get-distribution-config … CustomErrorResponses` | 403 + 404 → `/index.html` 200 |
| 4 | OAC còn gắn | `get-distribution-config … Origins.Items[0].OriginAccessControlId` | `E2IX1YDEAHD87E` |
| 5 | Trang chủ trả 200 | `curl -s -o /dev/null -w '%{http_code}' https://d24f3bc3qfp5xf.cloudfront.net/` | `200` |
| 6 | Bucket vẫn private | `curl -s -o /dev/null -w '%{http_code}' https://fpl-lineup-frontend-prod.s3.ap-southeast-1.amazonaws.com/index.html` | `403` |
| 7 | Chứng chỉ còn hạn (tự xoay vòng) | `openssl s_client -connect d24f3bc3qfp5xf.cloudfront.net:443 … \| openssl x509 -noout -dates` | `notAfter` còn > 30 ngày |
| 8 | Không phát sinh WAF/logging | `get-distribution-config … {WebACLId, Logging.Enabled}` | `""` / `false` |
| 9 | Dung lượng & request trong Free Tier | CloudWatch `Requests`, `BytesDownloaded` (miễn phí) | < 10 M req, < 1 TB |
| 10 | Chi phí | AWS Billing → Cost Explorer tháng hiện tại | `$0.00` |

> 📅 Gắn routine này vào đầu mỗi buổi họp nhóm. Mục nào lệch → mở issue gắn nhãn `infra` + `P3-Q01`.

---

## 13. 🤝 BÀN GIAO & RANH GIỚI

### 13.1. Việc CHUYỂN TIẾP (không thuộc `P3-Q01`, phải có người nhận)

| # | Việc | Chủ sở hữu | Vì sao chưa làm ở đây |
| :--- | :--- | :--- | :--- |
| **H-1** | `vite.config.ts`: `base` production đang là `/epl-fantasy-lineups/` (di sản GitHub Pages) → nên đổi mặc định về `/` để `npm run build` không bao giờ tạo ra bản hỏng | **Nguyên** (chủ `frontend/`) | Ngoài phạm vi `infra/`; đã workaround bằng `--base=/` lúc build (§6.1) |
| **H-2** | `VITE_API_BASE_URL` cho bản production (gọi backend HTTPS của `P3-Q02`), kèm `CORS_ORIGINS` thêm `https://d24f3bc3qfp5xf.cloudfront.net` | **Quang** (`P3-Q02`/`P3-Q03`) | Backend chưa tồn tại ⇒ chưa có URL để nhúng |
| **H-3** | Đưa `aws s3 cp` + `create-invalidation` vào `.github/workflows/deploy.yml` (OIDC role, không hardcode key) | **Quang** (`P3-Q03`) | Task này giới hạn 2 file |
| **H-4** | Quy ước tag/version asset & quy trình deploy 1 lệnh cho buổi demo | **Quang** (`P3-Q04`) | Cần chốt cùng sơ đồ kiến trúc cloud |

### 13.2. HAI ĐẦU VIỆC CỐ Ý ĐỂ MỞ (cần Dev + Tech Lead quyết — Level 4)

| # | Đầu việc | Trạng thái hiện tại | Cách làm khi được duyệt |
| :--- | :--- | :--- | :--- |
| **D-1** | Siết bucket policy `AWS:SourceAccount` → `AWS:SourceArn` (cam kết ở `s3_setup.md §13.1` bước 5) | Bucket policy **vẫn** dùng `AWS:SourceAccount` (đã audit `IsPublic: false`, lint `16/16`) | Cần sửa `infra/aws/s3_bucket_policy.json` (**file thứ 3** — vượt giới hạn 2 file của task này) rồi apply lại. Statement đã dựng sẵn ở key `PolicyDocumentDeferredStatement_P3Q01`, ARN thật: `arn:aws:cloudfront::711695043505:distribution/E3N44ZRJO1UZ2C`. Nghiệm thu: `grep -c 'distribution/'` = `1` và lint vẫn `16/16` |
| **D-2** | Custom domain + ACM cert (SNI, `us-east-1`) để **bắt buộc TLS ≥ 1.2** và bỏ domain `*.cloudfront.net` | Dùng cert mặc định; security policy bị AWS ép `TLSv1` (§8.2) | §6.6. **Chặn cứng:** chưa có domain ⇒ không xác thực được cert. Nếu nhóm mua domain (~$10/năm) + Route 53 zone ($0.50/tháng) thì đây là việc 20 phút |

> **Vì sao không tự làm D-1/D-2:** cả hai là thay đổi **Level 4** (policy bảo mật / chứng chỉ) và D-1 vượt giới hạn file của task; `AI_GUIDELINES` yêu cầu Dev + Tech Lead review trước khi áp. Bằng chứng hiện tại **không** phụ thuộc 2 việc này: web đã chạy HTTPS công khai, bucket vẫn private.

### 13.3. Tuyệt đối KHÔNG làm

| Cấm | Lý do |
| :--- | :--- |
| Bật Static Website Hosting để “cho khớp đề bài” | OAC không dùng được với website endpoint ⇒ `403` toàn bộ + bucket thành public |
| `Principal: "*"` trên bucket để “sửa 403” | Vi phạm AC `P2-Q04`, bot quét ngay trong vài giờ |
| Bật WAF / logging / Origin Shield “cho chuyên nghiệp” | $5+/tháng, phá Budget $1.00 |
| `ViewerProtocolPolicy: allow-all` | Mất HTTPS, AC fail |
| Upload bằng `aws s3 sync` không `--sse` / không set `cache-control` | `AccessDenied` hoặc cache sai gây trắng trang |
| Đổi `CallerReference` mỗi lần chạy | Tạo distribution trùng, mỗi cái là một điểm phí + rác |
| Sửa `frontend/` (kể cả `vite.config.ts`) từ task này | Thuộc phạm vi Nguyên — xem H-1 |
| `git commit` / `git push` khi chưa có lệnh của Dev | `AI_GUIDELINES` Mục 4 |

---

## 14. ☑️ CHECKLIST NGHIỆM THU & BÀN GIAO

### 14.1. Acceptance Criteria của task

| AC | Nội dung | ✓ | Bằng chứng |
| :--- | :--- | :--- | :--- |
| AC-1 | Website truy cập công khai qua domain HTTPS của CloudFront | ✅ | `https://d24f3bc3qfp5xf.cloudfront.net/` → `200` (§9.2) **+ Dev đã mở trình duyệt xác nhận frontend hiển thị (07/11/2026)** |
| AC-2 | CDN phân phối toàn cầu | ✅ | `PriceClass_All` · `HttpVersion=http2and3` · `X-Cache: RefreshHit from cloudfront` (§9.1/§9.3) |
| AC-3 | SPA routing — F5 trang không lỗi 404 | ✅ | `/no-such-file.html` → `200`, `/deep/link/route` → `200`, md5 == `index.html` (§8.1/§9.2) |
| AC-4 | Chứng chỉ SSL hợp lệ | ✅ | `CN=*.cloudfront.net`, `issuer=Amazon RSA 2048 M04`, `verify_result=0`, TLS1.3 (§9.4) **+ ổ khóa HTTPS hiển thị đúng trên trình duyệt của Dev**; giới hạn security policy ghi rõ §8.2 |
| AC-5 | Origin là S3 **private** qua OAC | ✅ | `OriginAccessControlId=E2IX1YDEAHD87E`, `IsPublic: false`, S3 trực tiếp `403` (§9.1/§9.2) |
| AC-6 | Chi phí `$0.00`, Budget Alert bật | ✅ | Không WAF/Logging/Shield (§3) · Budget `fpl-freetier-guard-1usd` |
| AC-7 | Không có credential/secret trong repo | ✅ | 2 file tài liệu + config, không chứa khoá/chữ ký |

### 14.2. ✅ CHECKLIST CHO DEV

> Chạy lại bằng lệnh §6/§7/§8. Cột ✓ là kết quả **đã kiểm thật ngày 07/11/2026**.

| Nhóm | Việc | ✓ | Kết quả thực tế |
| :--- | :--- | :--- | :--- |
| A1–A2 | Đúng branch · `git status` chỉ **2 file mới** | ✅ | `feature/P3-Q01-s3-cloudfront-deploy` · `?? infra/aws/cloudfront_setup.md` + `?? infra/aws/cloudfront_distribution.json` |
| A3 | Envelope đủ **6 section** (`Metadata`, `DistributionConfig`, `ManagedPoliciesUsed`, `ForbiddenSettings_DO_NOT_APPLY`, `ComplianceGuards`, `VerificationMatrix`) | ✅ | `sections: [Metadata, DistributionConfig, …]` |
| A4 | Config lint §7 | ✅ | `16/16 PASS`, exit `0` |
| A5 | Không lộ access key / chữ ký / secret | ✅ | grep pattern → rỗng |
| B1–B3 | Distribution `Deployed` · `Enabled` · `http2and3` | ✅ | §9.1 |
| B4 | HTTPS `200` · HTTP `301` | ✅ | §9.2 |
| B5 | SPA fallback 403 + 404 → `/index.html` 200 | ✅ | `get-distribution-config … CustomErrorResponses` |
| B6 | OAC gắn đúng, không OAI | ✅ | §9.1 |
| B7 | TLS: cert hợp lệ, TLS1.3 | ✅ | §9.4 |
| B8 | Bucket vẫn private (`403`) | ✅ | §9.2 |
| B9 | **Dev nghiệm thu bằng trình duyệt** (trang tải được, HTTPS hợp lệ, F5 không 404) | ✅ | Dev xác nhận `07/11/2026` tại https://d24f3bc3qfp5xf.cloudfront.net |
| C1 | Không bật website hosting / không nới quyền bucket | ✅ | §13.3 |
| C2 | Chỉ commit **sau khi** Dev review `git diff` (không push) | ✅ | Dev đã review → commit `docs(devops): [P3-Q01] …` trên `feature/P3-Q01-s3-cloudfront-deploy`, **chưa push** |
| C3 | `docs/TODO.md` — Dev tick `[x]` cho `P3-Q01` | ✅ | `docs/TODO.md` dòng 445: `- [x] P3-Q01` (Phase 3 `1/14`, Quang `1/4`) |
| **C4** | **Tạo PR + nhãn `infra`/`frontend`/`security`** | ⏳ | mô tả PR = §14.1 + §9 |
| **D-1/D-2** | **Hai đầu việc mở ở §13.2** | ⏳ | cần quyết định của Tech Lead |

### 14.3. Ghi chú cho Tech Lead khi review

1. Task **đã chạy thật** trên account `711695043505`: distribution `E3N44ZRJO1UZ2C` đang `Deployed`, frontend đã nằm trên CDN.
2. Điểm cần review kỹ nhất: **§8.2 — AWS ép security policy `TLSv1` với cert mặc định** (không phải lỗi cấu hình) và **D-1 — bucket policy chưa siết `SourceArn`** (vượt giới hạn 2 file).
3. Mọi thay đổi `distribution config` / `bucket policy` = **Level 4** → Tech Lead review + chạy lint §7 trước khi apply.
4. **Dev đã mở https://d24f3bc3qfp5xf.cloudfront.net bằng trình duyệt (07/11/2026)**: frontend hiển thị, ổ khóa HTTPS hợp lệ, F5 không lỗi — đây là bằng chứng mắt người cho AC-1/AC-4, bổ sung cho ma trận `curl` ở §9.
5. Đã tick `[x]` cho `P3-Q01` trong `docs/TODO.md` (Phase 3 → `1/14`, Quang → `1/4`); commit tạo sau khi Dev duyệt `git diff`, **không push**. Bước còn lại: mở PR + gắn nhãn `infra`/`frontend`/`security`.

---

<p align="center"><em>P3-Q01 · Fantasy Football Lineup Builder & Optimizer · AWS Free Tier ($0.00) · Quang (DevOps & AWS Lead)</em></p>




