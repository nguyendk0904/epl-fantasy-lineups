# 🚀 P3-Q02 — BACKEND FASTAPI TRÊN AWS (D-2: EC2 + Docker) · RUNBOOK & HANDOFF

> **Task:** `P3-Q02` *(Level 4 — Critical)* · **Owner:** Quang (DevOps & AWS Lead) · **Branch:** `feature/P3-Q02-backend-aws-deploy`
> **Files:** `infra/aws/app_runner_setup.md` (tài liệu này) + `infra/aws/apprunner.yaml` (spec App Runner — xem §9)
> **Account/Region:** `711695043505` · `ap-southeast-1` · **Ngày chốt:** 09/11/2026

## 1. ⚡ TL;DR — trạng thái hiện tại

| Hạng mục | Giá trị |
| :--- | :--- |
| **Backend đang chạy** | ✅ EC2 `i-0f1e71fa1a78b0013` (`t3.micro`, AL2023, VPC default) — container `fpl-backend` healthy + `fpl-caddy` TLS |
| **URL nghiệm thu (đã được duyệt thay thế)** | 🔗 **`https://54.255.194.74.sslip.io/health`** → `HTTP 200` `{"status":"healthy",…,"environment":"production"}` |
| **DB** | ✅ RDS private `fpl-fantasy-db` (`172.31.18.192`), PostgreSQL `15.17`, user `fpl_admin`, **TLS 1.2** |
| **Bảo mật** | Secret ở Secrets Manager (EC2 đọc bằng instance role) · RDS **không** public · **không** mở SSH (SSM) · SG chỉ **SG→SG** · IMDSv2 required |
| **Chi phí** | ≈ **$0.03/2 h** · ≈ **$11–12/tháng** nếu để 24/7 · Budget guard thật = **$10.00** (không phải $1.00) |
| **Việc còn lại** | Chỉ còn tick `[x]` trong `docs/TODO.md` + áp dụng sửa AC `P3-Q04` (§2.3) |

> **Vì sao không phải App Runner?** AWS đã **đóng App Runner với khách hàng mới**; account này bị `SubscriptionRequiredException` (đo bằng CLI, §3). Đề bài cho phép phương án thay thế ⇒ đã chạy **EC2 + Docker** (D-2). `apprunner.yaml` vẫn được giữ làm spec chuẩn (lint 16/16) cho ngày account có quyền hoặc để đối chiếu cấu hình.

---

## 2. ✅ QUYẾT ĐỊNH ĐÃ CHỐT (Dev + Tech Lead, 09/11/2026)

### 2.1. Chấp nhận thay thế URL nghiệm thu

| | Nội dung |
| :--- | :--- |
| **Gốc trong task** | `curl https://xxxx.awsapprunner.com/health` → 200 `{"status":"healthy"}` |
| **Không khả thi vì** | App Runner đóng với account mới ⇒ **không tồn tại** domain `*.awsapprunner.com` |
| **✅ Đã duyệt thay thế** | `curl https://54.255.194.74.sslip.io/health` → **200 `{"status":"healthy",…}`** — **TLS thật (Let's Encrypt, CN=54.255.194.74.sslip.io)**, cùng payload, cùng mã trạng thái |

### 2.2. Thời hạn giữ 24/7

- **Chính sách:** giữ backend online **24/7 phục vụ demo/báo cáo**, **tối đa tới 16/11/2026**; sau mốc đó **teardown** theo §8.3.
- Đổi mốc? Chỉ cần sửa đúng một dòng này + ghi ngày vào `docs/TODO.md`.
- ⚠️ Instance **không** gắn Elastic IP ⇒ `stop`/`start` sẽ **đổi public IP** và **URL sslip.io cũ mất hiệu lực** (§7.4). Muốn URL cố định: gắn EIP (miễn phí khi đang gắn vào instance chạy).

### 2.3. Sửa Acceptance Criteria của `P3-Q04` (đã duyệt)

| | Nội dung |
| :--- | :--- |
| **Cũ** | “Báo cáo chi phí trên AWS Billing hiển thị **$0.00**” |
| **✅ Mới** | “Chi phí AWS **≤ ngân sách đã duyệt** (Budget guard hiện `$10.00`); có báo cáo đối soát số thực tế + giải trình các hạng mục phát sinh” |

> Việc sửa chữ trong `docs/TODO.md` do Dev thực hiện (file theo dõi của nhóm, ngoài phạm vi 2 file của task này). Nội dung cần dán: dòng AC của `P3-Q04` đổi thành câu **“✅ Mới”** ở trên.

### 2.4. Đối chiếu Acceptance Criteria `P3-Q02`

| AC | Trạng thái | Bằng chứng |
| :--- | :---: | :--- |
| Backend FastAPI online **trên AWS** | ✅ ĐẠT | Container `Up (healthy)`, `restart=unless-stopped`, docker `enabled` — §5.2 |
| Kết nối **thông suốt với RDS** | ✅ ĐẠT | `inet_server_addr()=172.31.18.192`, `pg_stat_ssl → (True,'TLSv1.2')`, query bảng `teams` OK — §5.3 |
| `/health` → **HTTP 200** | ✅ ĐẠT | HTTP và HTTPS đều `200` + payload `{"status":"healthy"}` — §5.1 |
| Verification URL | ✅ ĐẠT *(thay thế đã duyệt)* | `https://54.255.194.74.sslip.io/health` — §2.1 |

---

## 3. 🧭 SỰ THẬT BUỘC PHẢI ĐỔI PHƯƠNG ÁN (đo bằng CLI, 09/11/2026)

| # | Bằng chứng | Kết luận |
| :-- | :--- | :--- |
| 1 | `aws apprunner list-services` → `SubscriptionRequiredException` | App Runner **không mở** cho account này (không phải lỗi IAM: `aws ecr describe-repositories` chạy được) |
| 2 | Docs AWS: *“App Runner is no longer open to new customers… recommends Amazon ECS Express Mode”* | Không thể tạo service ⇒ **không thể có** URL `*.awsapprunner.com` |
| 3 | `aws freetier get-free-tier-usage` → chỉ CloudFront/SNS/Glue/CloudWatch/KMS | Account là **Free plan dạng credit** ⇒ **không có** 750 h `t3.micro`; `t4g.small` free-trial đã hết hạn 31/12/2025 ⇒ **không còn “EC2 Free Tier”** |
| 4 | App Runner giá: `$0.007/GB-h` memory provisioned 24/7 | Rẻ nhất ≈ **$2.56/tháng** ⇒ App Runner **chưa bao giờ** nằm trong Free Tier |
| 5 | RDS `PubliclyAccessible=false`, SG `sg-0f5970a2c3b47878a` chỉ mở `14.191.166.167/32:5432` | Backend **buộc** chạy trong VPC + thêm đúng **1 ingress SG→SG** |
| 6 | Budget `fpl-freetier-guard-1usd` → limit **$10.00**, alert ở 80%/100% | Tên budget gây nhầm; ngân sách thật là **$10**, không phải $1 (đã ghi vào AC `P3-Q04`, §2.3) |
| 7 | Wheel `cbcbox` (CBC solver) chỉ có `manylinux2014_x86_64` | Chọn **`t3.micro` x86_64**, **không** dùng `t4g` (ARM64) để tránh chết solver lúc runtime |

---

## 4. 🏗️ KIẾN TRÚC & TÀI NGUYÊN ĐANG CHẠY

```text
Người dùng ──HTTPS(443, Let's Encrypt)──► EC2 t3.micro (54.255.194.74 / private 172.31.35.103)
                                            ├─ fpl-caddy  (host network, 80/443, TLS + reverse proxy)
                                            └─ fpl-backend (127.0.0.1:8000 → uvicorn, user appuser)
                                                        │  TLS 1.2 (ssl=require)
                                                        ▼
                                          RDS PostgreSQL 15.17 — private 172.31.18.192
CloudFront (P3-Q01) ──CORS──► backend            Secrets Manager ──instance role──► fpl-backend
```

| Tài nguyên | ID / giá trị | Ghi chú |
| :--- | :--- | :--- |
| EC2 instance | **`i-0f1e71fa1a78b0013`** · `t3.micro` · `ami-0cf413490361a2a2b` (AL2023) | IP `54.255.194.74` · **không** key pair · IMDSv2 required |
| Storage | 20 GB `gp3`, **encrypted**, `DeleteOnTermination=true` | xoá cùng instance |
| Security Group | **`sg-08de3ad35630bd8dc`** (`fpl-p3q02-ec2-sg`) | In `80`,`443`; **không** mở `22` · Out `443`,`80`, `53`→`172.31.0.2`, `5432`→**SG RDS** |
| IAM | role **`fpl-p3q02-ec2-role`** + profile `fpl-p3q02-ec2-profile` | `AmazonSSMManagedInstanceCore` + inline: ECR pull (1 repo) + `secretsmanager:GetSecretValue` (**1 ARN**) |
| ECR | repo **`fpl-backend`** · image **1.32 GB** · tag `50948b2` + `latest` | Giữ lại cho `P3-Q03` (~$0.13/tháng) |
| Secrets Manager | **`fpl/backend/rds-zZsTzh`** | JSON 6 field; container chỉ dùng key `password` |
| RDS SG | `sg-0f5970a2c3b47878a` **+1 ingress** `5432` ← `sg-08de3ad35630bd8dc` | ⚠️ **drift** so với `terraform_rds.tf` ⇒ phải revoke khi teardown (§8.3) |

---

## 5. 🧪 BẰNG CHỨNG ĐO THẬT

### 5.1. `/health` — HTTP và HTTPS (TLS thật)

```console
$ curl -sS -w '\nHTTP=%{http_code}\n' http://54.255.194.74/health
{"status":"healthy","service":"Fantasy Football Lineup Optimizer API","version":"1.0.0","environment":"production"}
HTTP=200

$ curl -sS -w '\nHTTP=%{http_code}\n' https://54.255.194.74.sslip.io/health
{"status":"healthy","service":"Fantasy Football Lineup Optimizer API","version":"1.0.0","environment":"production"}
HTTP=200

$ openssl s_client -connect 54.255.194.74.sslip.io:443 -servername 54.255.194.74.sslip.io | openssl x509 -noout -subject -issuer -dates
subject=CN=54.255.194.74.sslip.io
issuer=C=US, O=Let's Encrypt, CN=YE1
notBefore=Nov  9 03:26:30 2026 GMT   notAfter=Feb  7 03:26:29 2027 GMT
```

### 5.2. Trạng thái dịch vụ (đo qua SSM, không SSH)

```console
fpl-caddy   | Up 3 minutes |
fpl-backend | Up 3 minutes (healthy) | 127.0.0.1:8000->8000/tcp
IMAGE=711695043505.dkr.ecr.ap-southeast-1.amazonaws.com/fpl-backend:latest HEALTH=healthy USER=appuser
enabled / active            # systemctl is-enabled|is-active docker
RESTART_POLICY=unless-stopped
up 7 minutes                # bootstrap xong ~95 giây sau khi instance running
```

### 5.3. RDS thật + TLS (AC-2)

```console
DB_EVIDENCE ('172.31.18.192/32', 'fantasy_fpl', 'fpl_admin', 'PostgreSQL 15.17 on aarch64-unknown-linux-gnu …')
DB_TLS (True, 'TLSv1.2')          SERVER_SSL_ON on
$ curl https://54.255.194.74.sslip.io/api/v1/teams?limit=3  → HTTP=200  []
```

- `inet_server_addr()=172.31.18.192` ⇒ kết nối **đi tới RDS private**, không phải DB trong container.
- `pg_stat_ssl.ssl=True` ⇒ đường DB **mã hoá TLS**, đúng yêu cầu `rds_config.py`.
- `count(*) from teams` chạy được ⇒ schema tồn tại; `[]` là **0 dòng dữ liệu**, **không** phải lỗi kết nối (seed dữ liệu không thuộc task này).

---

## 6. 🔐 CẤU HÌNH & BÍ MẬT

### 6.1. Biến môi trường (khớp `backend/app/core/config.py` + `rds_config.py`)

| Biến | Nguồn | Giá trị production | Vì sao |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | env | `production` | Bật 3 guard: driver `postgresql+asyncpg`, host **không** localhost, **TLS bắt buộc** |
| `RDS_HOSTNAME` / `RDS_PORT` / `RDS_DB_NAME` / `RDS_USERNAME` | env | `fpl-fantasy-db.…rds.amazonaws.com` / `5432` / `fantasy_fpl` / `fpl_admin` | `rds_config.py` yêu cầu **đủ 4** biến (thiếu 1 ⇒ crash ngay, fail-fast) |
| **`RDS_PASSWORD`** | 🔒 **Secrets Manager** | *(không nằm ở repo/EC2 user-data/log)* | `SecretStr`, `repr=False` |
| `CORS_ORIGINS` | env | `["https://d24f3bc3qfp5xf.cloudfront.net"]` | JSON array; thêm domain mới nếu frontend gọi trực tiếp |
| `FPL_SYNC_ENABLED` | env | **`false`** (trong cửa sổ kiểm chứng) | Nếu bật: giữ bất biến **đúng 1 scheduler** (`cron_scheduler.py`) — 1 container duy nhất |
| `FPL_BOOTSTRAP_URL`, `FPL_SYNC_INTERVAL_SECONDS`, `AWS_REGION` | env | mặc định hợp lệ | Scheduler chỉ dùng khi `FPL_SYNC_ENABLED=true` |

### 6.2. Bí mật & IAM (đã áp dụng)

- Secret `fpl/backend/rds` chứa JSON 6 field (`username/password/engine/host/port/dbname`); container chỉ lấy nhánh `password`.
- EC2 **không** lưu mật khẩu lâu dài: user-data đọc secret lúc boot bằng **instance role** → ghi `/opt/fpl/backend.env` (`chmod 600`) → xoá file tạm.
- Inline policy **chỉ** cho: `ecr:GetAuthorizationToken`, 3 quyền pull trên **1 repo**, `GetSecretValue` trên **1 ARN**. Không `Resource:"*"`.
- Không mở SSH: quản trị qua **SSM Session Manager / Run Command** (`AmazonSSMManagedInstanceCore`).

---

## 7. 🔧 VẬN HÀNH (ops runbook)

### 7.1. Kiểm tra nhanh (30 giây)

```bash
curl -sS -m 10 -w '\nHTTP=%{http_code}\n' https://54.255.194.74.sslip.io/health
aws ec2 describe-instances --instance-ids i-0f1e71fa1a78b0013 --region ap-southeast-1 \
  --query 'Reservations[].Instances[].[State.Name,PublicIpAddress]' --output text
aws ssm send-command --region ap-southeast-1 --instance-ids i-0f1e71fa1a78b0013 \
  --document-name AWS-RunShellScript --parameters 'commands=["docker ps --format \"{{.Names}} | {{.Status}}\""]' \
  --query Command.CommandId --output text     # rồi get-command-invocation để xem output
```

### 7.2. Cập nhật phiên bản mới (rolling, ~2 phút)

```bash
TAG=$(git rev-parse --short HEAD)
ECR=711695043505.dkr.ecr.ap-southeast-1.amazonaws.com
docker build -t fpl-backend:$TAG backend/
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin $ECR
docker tag fpl-backend:$TAG $ECR/fpl-backend:latest && docker push $ECR/fpl-backend:latest
# trên instance (qua SSM Run Command):
#   docker pull $ECR/fpl-backend:latest && docker rm -f fpl-backend && \
#   docker run -d --name fpl-backend --restart unless-stopped \
#     --env-file /opt/fpl/backend.env -p 127.0.0.1:8000:8000 $ECR/fpl-backend:latest
```

> `P3-Q03` sẽ tự động hoá đúng 4 bước này trong GitHub Actions.

### 7.3. Dựng lại từ đầu (nếu instance bị terminate)

1. `aws ecr` repo `fpl-backend` vẫn còn image ⇒ **không** cần build lại.
2. Tạo SG `fpl-p3q02-ec2-sg` (`80`,`443` in; `443`,`80`,`53`→`172.31.0.2`, `5432`→SG RDS out).
3. Thêm ingress `5432` trên SG RDS từ SG backend (**chỉ** SG→SG).
4. Chạy `aws ec2 run-instances` với `--iam-instance-profile Name=fpl-p3q02-ec2-profile`, `--user-data file://<bootstrap.sh>`, `--metadata-options HttpTokens=required`.
5. Bootstrap script (đã dùng, ~40 dòng): cài docker → ECR login → pull → đọc secret → ghi `/opt/fpl/backend.env` → `docker run` backend → `caddy` container với Caddyfile `$IP.sslip.io`.

### 7.4. ⚠️ Ba điều dễ làm hỏng hệ thống này

1. **`stop`/`start` đổi public IP** ⇒ URL `*.sslip.io` cũ chết (chứng chỉ gắn với domain cũ). Muốn cố định: gắn **Elastic IP** rồi cập nhật `Caddyfile` + `CORS_ORIGINS`.
2. **Xoá SG backend** ⇒ RDS SG mất tham chiếu ⇒ DB timeout; luôn revoke ingress trước khi xoá SG.
3. **Bật `FPL_SYNC_ENABLED=true` khi có >1 container** ⇒ sync trùng. Giữ **1 container** (bất biến của `cron_scheduler.py`).

---

## 8. 💰 CHI PHÍ & TEARDOWN

### 8.1. Đồng hồ chi phí

| Hạng mục | Đơn giá | 2 giờ | 30 ngày (24/7) |
| :--- | :--- | ---: | ---: |
| EC2 `t3.micro` on-demand | *ước tính* `$0.0128/h` | ~$0.03 | ~$9.3 |
| EBS 20 GB `gp3` | ~$0.0027/GB-tháng | ~$0.0004 | ~$1.9 (**kể cả khi stop**) |
| ECR 1.32 GB | $0.10/GB-tháng | ~$0.0004 | ~$0.13 |
| Secrets Manager | $0.40/secret-tháng | ~$0.001 | $0.40 |
| **Tổng** | | **≈ $0.03** | **≈ $11–12** |

> Giá EC2 **là ước tính** (AWS Pricing API không truy cập được từ máy dev); số thật hiện trong Cost Explorer sau ~24 h. Budget `$10.00` ⇒ chạy 24/7 sẽ chạm ngưỡng **80% (~$8) sau ~2,5–3 tuần**. Nếu chỉ cần demo, **teardown ngay sau demo** là rẻ nhất.

### 8.2. Dừng tạm (giữ dữ liệu/đĩa)

```bash
aws ec2 stop-instances --instance-ids i-0f1e71fa1a78b0013 --region ap-southeast-1
```
→ Vẫn tính **EBS ~$1.9/tháng**; **public IP sẽ đổi** khi start lại (§7.4).

### 8.3. Teardown hoàn toàn (đúng thứ tự)

```bash
R=i-0f1e71fa1a78b0013; SG=sg-08de3ad35630bd8dc; RDS_SG=sg-0f5970a2c3b47878a
aws ec2 terminate-instances --instance-ids $R --region ap-southeast-1
aws ec2 wait instance-terminated --instance-ids $R --region ap-southeast-1
# hoàn nguyên SG RDS (xoá drift do P3-Q02 thêm)
aws ec2 revoke-security-group-ingress --group-id $RDS_SG --protocol tcp --port 5432 --source-group $SG --region ap-southeast-1
aws ec2 delete-security-group --group-id $SG --region ap-southeast-1
# IAM
aws iam remove-role-from-instance-profile --instance-profile-name fpl-p3q02-ec2-profile --role-name fpl-p3q02-ec2-role
aws iam delete-instance-profile --instance-profile-name fpl-p3q02-ec2-profile
aws iam detach-role-policy --role-name fpl-p3q02-ec2-role --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam delete-role-policy --role-name fpl-p3q02-ec2-role --policy-name fpl-p3q02-inline
aws iam delete-role --role-name fpl-p3q02-ec2-role
# secret (chỉ khi chắc chắn không cần) + ECR (giữ cho P3-Q03 nếu muốn)
aws secretsmanager delete-secret --secret-id fpl/backend/rds --force-delete-without-recovery --region ap-southeast-1
# aws ecr delete-repository --repository-name fpl-backend --force --region ap-southeast-1
# kiểm tra sạch
aws ec2 describe-instances --region ap-southeast-1 --query 'Reservations[].Instances[].[InstanceId,State.Name]' --output text
aws ec2 describe-volumes --region ap-southeast-1 --filters Name=status,Values=available --query 'Volumes[].VolumeId' --output text
```
> **Không** xoá `fpl-fantasy-db` (RDS) — tài nguyên của `P2-Q01`.

---

## 9. 📦 `apprunner.yaml` — spec App Runner (giữ lại, không dùng để chạy)

- **Là gì:** spec version 1.0 (runtime/build/start command/port/env/`run.secrets`) — nguồn sự thật duy nhất cho cấu hình production, đã **lint 16/16 PASS**.
- **Vì sao vẫn giữ:** (a) nếu account/Tech Lead có App Runner (khách hàng cũ) thì dùng được ngay; (b) mọi giá trị env/secret/port trong tài liệu này đều đối chiếu từ file đó.
- **Lưu ý khi dùng thật:** App Runner **chỉ** đọc `apprunner.yaml` cho service **source-based** và file phải nằm ở **root repo**. Monorepo này để file trong `infra/aws/` (ràng buộc 2 file) ⇒ nếu chọn App Runner, tạo **nhánh deploy tạm** và copy file lên root (không commit vào `main`). Với service kiểu **image (ECR)**, file **bị bỏ qua** — mọi giá trị truyền qua `aws apprunner create-service`.
- **Điều file này KHÔNG chứa được** (phải cấu hình ở service): healthcheck, CPU/RAM, auto-scaling. Giá trị đúng đã chốt trong lịch sử task: healthcheck `HTTP /health`, `0.25 vCPU / 1 GB`, `MaxSize=1` (bất biến 1 scheduler).

**Lint (chạy lại khi sửa yaml):** 16 test case offline kiểm schema, port đồng bộ yaml↔command↔`Dockerfile EXPOSE`, `--reload` bị cấm, đủ 4 biến `RDS_*`, `RDS_PASSWORD` **chỉ** đến từ Secrets Manager ARN, `CORS_ORIGINS` là JSON https, và **mọi tên biến phải tồn tại trong `Settings`**. Script đầy đủ: xem **Phụ lục A**.

---

## 10. 🚑 TROUBLESHOOTING (sự cố đã gặp thật)

| Triệu chứng | Nguyên nhân | Xử lý |
| :--- | :--- | :--- |
| `SubscriptionRequiredException` | App Runner đóng với account mới — **không phải** thiếu IAM | Không thêm policy; dùng D-2 (hiện tại) |
| Cloud-init không chạy script | user-data bị **CRLF** trên Windows ⇒ `#!/bin/bash\r` | `tr -d '\r'` rồi kiểm `od -c`/`file` trước khi launch |
| Đọc public IP trong user-data fail | IMDSv2 required (`HttpTokens=required`) | Lấy token `PUT /latest/api/token` trước |
| `add-role-to-instance-profile` → `NoSuchEntity` | IAM eventual consistency | `sleep 8` rồi retry |
| Backend restart loop + `ValidationError` | Thiếu 1 trong 4 biến `RDS_*` / secret không đọc được | Kiểm `/opt/fpl/backend.env` + quyền `GetSecretValue` trên đúng ARN |
| `/health` 200 nhưng UI trống | **`/health` không ping DB**; bảng `teams` 0 dòng | Kiểm `/api/v1/teams`; seed dữ liệu (task khác) |
| DB timeout | SG chưa mở **SG→SG**, hoặc IP instance đổi sau `stop/start` | Kiểm ingress của `sg-0f5970a2c3b47878a` |
| Service chết sau `stop/start` | Public IP đổi ⇒ `Caddyfile`/cert cũ | Cập nhật `Caddyfile` theo IP mới + `docker restart fpl-caddy` |
| Sửa `apprunner.yaml` không có tác dụng | Service kiểu image ⇒ yaml bị bỏ qua | Dùng source-based, hoặc truyền qua API (§9) |

---

## 11. 🤝 BÀN GIAO & VIỆC CÒN LẠI

### 11.1. Dev cần làm để đóng task

- [x] **Tick `[x]` `P3-Q02`** trong `docs/TODO.md` (kèm ghi chú: “D-2 EC2 + Docker, URL `https://54.255.194.74.sslip.io/health`, bằng chứng §5”).
- [ ] **Sửa AC `P3-Q04`** theo §2.3: `$0.00` → **“Chi phí ≤ ngân sách đã duyệt ($10.00)”**. (Để sau)
- [x] Ghi mốc teardown đã chốt (§2.2: **tối đa 6/12/2026**).
- [x] Review diff 2 file mới rồi quyết định commit.

### 11.2. Việc chuyển tiếp (không thuộc `P3-Q02`)

| # | Việc | Người nhận |
| :-- | :--- | :--- |
| T-1 | Build frontend production với `VITE_API_BASE_URL=https://54.255.194.74.sslip.io/api/v1` (code đọc `VITE_API_BASE_URL`, **không** phải `VITE_API_URL`) | Nguyên (`P3-NG05`) |
| T-2 | Đưa 4 bước §7.2 vào pipeline | Quang (`P3-Q03`) |
| T-3 | Seed/sync dữ liệu FPL vào RDS (hiện `teams` = 0 dòng) | Nhất/Vũ |
| T-4 | **Rotate mật khẩu RDS** (đã xuất hiện trong chat 09/11) rồi `put-secret-value` lại | Quang + Tech Lead |

### 11.3. Guardian — kiểm tra mỗi tuần (5 phút)

1. `curl https://54.255.194.74.sslip.io/health` → 200.
2. Billing/Cost Explorer ≤ ngân sách; email budget `fpl-freetier-guard-1usd` (limit `$10`).
3. RDS **vẫn private**: `aws rds describe-db-instances --query 'DBInstances[].PubliclyAccessible'` → `false`.
4. SG RDS **không** có `0.0.0.0/0`; SG backend **không** mở `22`.
5. `git log -p --all -- infra/ backend/ | grep -iE 'password|secret'` → phải **rỗng**.

> ❌ Tuyệt đối không: mở RDS public, mở `0.0.0.0/0:5432`, nhét secret vào repo/user-data, tắt budget guard, tự `git commit/push` khi chưa được duyệt.

---

## 📚 PHỤ LỤC A — Lint 16 test case cho `apprunner.yaml` (chạy lại khi sửa yaml)

Lưu script **ngoài repo** (ví dụ `%TEMP%\p3q02_lint.py`), chạy tại **root repo** với `backend/venv` (cần `pyyaml`):

```python
import json, re, sys
from pathlib import Path
import yaml

cfg = yaml.safe_load(Path('infra/aws/apprunner.yaml').read_text(encoding='utf-8'))
settings_src = Path('backend/app/core/config.py').read_text(encoding='utf-8')
dockerfile = Path('backend/Dockerfile').read_text(encoding='utf-8')
rows = []
chk = lambda i, d, c: rows.append((i, d, bool(c)))

chk('L01', 'parse mapping', isinstance(cfg, dict))
chk('L02', 'version+top keys', str(cfg.get('version')) == '1.0'
    and set(cfg) <= {'version', 'runtime', 'build', 'run'})
chk('L03', 'runtime python', str(cfg.get('runtime', '')).startswith('python3'))
build = ((cfg.get('build') or {}).get('commands') or {}).get('build')
chk('L04', 'build list[str]', isinstance(build, list) and build
    and all(isinstance(x, str) and x.strip() for x in build))
run = cfg.get('run') or {}
cmd = run.get('command', '')
chk('L05', 'command non-empty', isinstance(cmd, str) and cmd.strip() != '')
chk('L06', 'command -> app.main:app', 'app.main:app' in cmd)
chk('L07', 'bind 0.0.0.0', '--host 0.0.0.0' in cmd)
chk('L08', 'no --reload', '--reload' not in cmd)
net = run.get('network') or {}
chk('L09', 'port dong bo', net.get('port') == 8000 and '--port 8000' in cmd
    and 'EXPOSE 8000' in dockerfile)
chk('L10', 'network.env PORT', net.get('env') == 'PORT')
env = {e.get('name'): e.get('value') for e in (run.get('env') or [])}
chk('L11', 'ENVIRONMENT=production', env.get('ENVIRONMENT') == 'production')
chk('L12', 'du 4 bien RDS_*', all(env.get(k) for k in
    ['RDS_HOSTNAME', 'RDS_DB_NAME', 'RDS_USERNAME', 'RDS_PORT']))
host = env.get('RDS_HOSTNAME', '')
chk('L13', 'RDS_HOSTNAME hop le', host.endswith('.rds.amazonaws.com')
    and host == host.strip() and not any(c in host for c in '/:@?#'))
chk('L14', 'password khong trong env', 'RDS_PASSWORD' not in env)
sec = {s.get('name'): s.get('value-from') for s in (run.get('secrets') or [])}
chk('L15', 'password tu secret ARN', 'RDS_PASSWORD' in sec
    and all(re.match(r'^arn:aws:(secretsmanager|ssm):ap-southeast-1:\d{12}:', str(v))
            for v in sec.values()) and sec['RDS_PASSWORD'].endswith(':password::'))
cors = json.loads(env.get('CORS_ORIGINS') or 'null')
known = set(re.findall(r'^ {4}([A-Z][A-Z0-9_]*)\s*:', settings_src, re.M))
chk('L16', 'CORS https + ten bien hop le', isinstance(cors, list) and cors
    and all(u.startswith('https://') for u in cors) and not (set(env) - known))

for i, d, ok in rows:
    print(('PASS' if ok else 'FAIL'), i, '-', d)
p = sum(1 for _, _, ok in rows if ok)
print('\nRESULT: %d/%d PASS (%.1f%%)' % (p, len(rows), 100.0 * p / len(rows)))
sys.exit(0 if p == len(rows) else 1)
```

**Kết quả 09/11/2026:** `RESULT: 16/16 PASS (100.0%)`. Lần chạy đầu từng FAIL ở L01 vì ARN Secrets Manager kết thúc bằng `::` **phải được quote** — đã sửa trong yaml.

## 📚 PHỤ LỤC B — Nguồn tham chiếu

| Nguồn | Dùng cho |
| :--- | :--- |
| AWS Docs — *App Runner availability change* | App Runner đóng với khách hàng mới (§3, dòng 1–2) |
| AWS Docs — *App Runner configuration file reference* | Schema `apprunner.yaml`, chỉ áp dụng cho source-based (§9) |
| AWS Docs — *App Runner VPC networking* | VPC Connector cần **private subnet** (lý do loại Path A) |
| AWS — *App Runner pricing* | `$0.064/vCPU-h` + `$0.007/GB-h` ⇒ App Runner không có Free Tier (§3, dòng 4) |
| Code repo | `app/main.py` (`/health` không ping DB), `core/config.py`, `core/rds_config.py` (guard production + TLS), `services/cron_scheduler.py` (1 scheduler), `Dockerfile` (port/user/healthcheck), `frontend/src/services/apiClient.ts` (`VITE_API_BASE_URL`) |

> **Số liệu chưa kiểm chứng:** giá EC2 on-demand & NAT Gateway (AWS Pricing API không phản hồi từ máy dev) ⇒ đã ghi rõ là *ước tính*; phải đối soát bằng Cost Explorer. Bản tài liệu chi tiết trước khi rút gọn được lưu tại `%TEMP%\p3q02_app_runner_setup_v1_backup.md` (ngoài repo, không commit).




