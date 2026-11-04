# 🗄️ P2-Q01 — AMAZON RDS POSTGRESQL 15 (FREE TIER) · RUNBOOK & HANDOFF

> **Task:** `P2-Q01` *(Level 4)* · **Owner:** Quang (DevOps & Cloud Infrastructure Lead) · **Branch:** `feature/P2-Q01-aws-rds-init`
> **Files:** `infra/aws/rds_setup.md` (tài liệu này) + `infra/aws/terraform_rds.tf` (IaC)
> **Nguồn chuẩn:** [`PROJECT_SSOT`](../../docs/PROJECT_SSOT.md) · [`ROADMAP`](../../docs/PROJECT_ROADMAP.md) · [`TODO`](../../docs/TODO.md) · [`AI_GUIDELINES`](../../docs/AI_GUIDELINES.md)
>
> **🚦 Trạng thái 2026-11-04:** ✅ Instance **`available`** và **đã kiểm chứng kết nối TLS thật thành công** (`psql` + `\conninfo`, có cả test âm chứng minh `force_ssl`). Cửa sổ public tạm đã **đóng lại ngay** — xem **§3**, **§4**.

---

## 🧭 MỤC LỤC

| # | Nội dung | # | Nội dung |
| :--- | :--- | :--- | :--- |
| 1 | Tóm tắt hạ tầng (TL;DR) | 7 | Chi phí & vòng đời tài nguyên |
| 2 | Thông số kết nối + TLS | 8 | Terraform: apply / change / destroy |
| 3 | Bằng chứng kiểm chứng | 9 | Troubleshooting |
| 4 | Truy cập RDS (private → 3 cách) | 10 | Rủi ro mở & việc tiếp theo |
| 5 | **Bàn giao `P2-NH01` (Nhất)** | 11 | Checklist nghiệm thu |
| 6 | Bàn giao thành viên khác | — | — |

---

## 1. ⚡ TL;DR — HẠ TẦNG HIỆN CÓ

| Hạng mục | Giá trị thực tế (verify 2026-11-04) |
| :--- | :--- |
| Instance | `fpl-fantasy-db` · **`available`** (tạo `2026-11-02T14:46Z`) |
| Engine | PostgreSQL **15.17** (family `postgres15`) |
| Instance class | `db.t4g.micro` (ARM, 2 vCPU / 1 GB RAM) |
| Storage | **20 GiB `gp3`** · storage autoscaling **OFF** (`max_allocated_storage = 0`) |
| Availability | **Single-AZ** `ap-southeast-1b` (`multi_az = false`) |
| Public access | **`false`** — DB nằm trong default VPC, không có đường vào từ Internet |
| Encryption at rest | Bật (AWS-managed key `aws/rds`) · CA TLS `rds-ca-rsa2048-g1` |
| Encryption in transit | **`rds.force_ssl = 1`** (group `fpl-fantasy-db-postgres15`) — client không TLS bị từ chối |
| Backup | 1 ngày · window `18:00–18:30` UTC · `skip_final_snapshot = true` |
| Maintenance | `sun:19:00–sun:19:30` UTC |
| Security Group | `sg-0f5970a2c3b47878a` · egress **deny-all** · ingress: chỉ rule `/32` thuộc `P2-Q02` (⚠️ xem §10.1) |
| Subnet / Parameter group | `fpl-fantasy-db-subnet-group` / `fpl-fantasy-db-postgres15` |
| Chi phí RDS | **$0.0000019** (tháng 11/2026) ≈ **$0.00** |
| Budget guard | `fpl-freetier-guard-1usd` — **$1.00**, cảnh báo 80 % / 100 % / forecast → SNS email **đã confirm** |

---

## 2. 📇 THÔNG SỐ KẾT NỐI + TLS

| Thông số | Giá trị |
| :--- | :--- |
| **Host** | `fpl-fantasy-db.cr0maoomq80d.ap-southeast-1.rds.amazonaws.com` |
| **Port** | `5432` |
| **Database** | `fantasy_fpl` |
| **Username** | `fpl_admin` (master user) |
| **Password** | 🔒 **Chỉ lưu trong password manager của nhóm** — không ghi vào repo/chat/PR |
| **SSL** | `require` (bắt buộc) |
| **CA cert** | `rds-ca-rsa2048-g1` |

**Backend (SQLAlchemy async) — dán vào `.env` local (đã bị `.gitignore` chặn):**

```env
DATABASE_URL=postgresql+asyncpg://fpl_admin:<DB_PASSWORD>@fpl-fantasy-db.cr0maoomq80d.ap-southeast-1.rds.amazonaws.com:5432/fantasy_fpl?ssl=require
```

**`psql` / DBeaver / pgAdmin:**

```text
host=fpl-fantasy-db.cr0maoomq80d.ap-southeast-1.rds.amazonaws.com port=5432 dbname=fantasy_fpl user=fpl_admin sslmode=require
```

> ⚠️ **Cú pháp SSL khác nhau theo client:** `asyncpg` → `?ssl=require` · `psql`/libpq → `sslmode=require`.
> ℹ️ Endpoint host **không phải** bí mật (DB private, không thể truy cập từ Internet) nên ghi đầy đủ để bàn giao; **mật khẩu thì tuyệt đối không**.
> Muốn xác thực CA đầy đủ: tải [global-bundle.pem](https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem) rồi dùng `?ssl=verify-full&sslrootcert=<path>`.
> Lấy mật khẩu (chỉ trên máy Quang, **không dán output vào chat/PR**): `cd infra/aws && terraform state show -no-color aws_db_instance.this | grep -E '^\s+password\s+='`

---

## 3. ✅ BẰNG CHỨNG KIỂM CHỨNG (2026-11-04)

**3.1. Kết nối TLS thành công** (`docker run --rm -it postgres:15-alpine psql "host=... sslmode=require"`):

```text
You are connected to database "fantasy_fpl" as user "fpl_admin" on host
"fpl-fantasy-db.xxxxxxxx.ap-southeast-1.rds.amazonaws.com" (address "18.139.38.8") at port "5432".
SSL connection (protocol: TLSv1.2, cipher: ECDHE-RSA-AES256-GCM-SHA384, compression: off)

 PostgreSQL 15.17 on aarch64-unknown-linux-gnu, compiled by aarch64-unknown-linux-gnu-gcc (GCC) 12.4.0, 64-bit
 ssl = on
 current_user = fpl_admin | current_database = fantasy_fpl
```

**3.2. Test âm — chứng minh `rds.force_ssl = 1` có hiệu lực** (client không TLS bị chặn):

```text
psql: error: connection to server at "...rds.amazonaws.com" (18.139.38.8), port 5432 failed:
FATAL:  no pg_hba.conf entry for host "123.31.***.***", user "fpl_admin", database "fantasy_fpl", no encryption
```

**3.3. Đã đóng cửa sổ verify** (bắt buộc): `PubliclyAccessible = false`, DNS trả về IP private `172.31.18.192`, TCP `5432` từ laptop → **timeout**, SG chỉ còn rule `/32` của `P2-Q02`.

**3.4. Cách tái lập nhanh (time-box < 15 phút, chỉ Quang làm):**

```bash
MY_IP=$(curl -s https://checkip.amazonaws.com)
# 1) mở đúng IP hiện tại (SG ID: sg-0f5970a2c3b47878a)
aws ec2 authorize-security-group-ingress --region ap-southeast-1 --group-id sg-0f5970a2c3b47878a \
  --ip-permissions "IpProtocol=tcp,FromPort=5432,ToPort=5432,IpRanges=[{CidrIp=$MY_IP/32,Description=P2-Q01-temp-verify}]"
# 2) bật public TẠM — DÙNG CLI, KHÔNG dùng terraform apply (xem cảnh báo §10.1)
aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db --publicly-accessible \
  --apply-immediately --region ap-southeast-1
# 3) test
docker run --rm -it postgres:15-alpine psql \
  "host=fpl-fantasy-db.cr0maoomq80d.ap-southeast-1.rds.amazonaws.com port=5432 dbname=fantasy_fpl user=fpl_admin sslmode=require" \
  -c '\conninfo' -c 'SELECT version();'
# 4) 🔴 ĐÓNG NGAY
aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db --no-publicly-accessible \
  --apply-immediately --region ap-southeast-1
aws ec2 revoke-security-group-ingress --region ap-southeast-1 --group-id sg-0f5970a2c3b47878a \
  --protocol tcp --port 5432 --cidr "$MY_IP/32"
```

---

## 4. 🔐 TRUY CẬP RDS TỪ MÁY (DB đang private)

| Cách | Khi nào dùng | Ghi chú |
| :--- | :--- | :--- |
| **A. Mặc định: không kết nối trực tiếp** | Dev thường ngày | Endpoint resolve về IP private `172.31.x.x` ⇒ dùng Postgres local (service `database` trong docker-compose) |
| **B. Public tạm < 15 phút** | Cần verify RDS thật (đã dùng ở §3) | Bắt buộc **đóng lại**; dùng CLI, **không** dùng `terraform apply` |
| **C. SSM port-forwarding** | `P2-Q02` / Phase 3 | Cần 1 EC2 Free Tier + role `AmazonSSMManagedInstanceCore` (hiện **chưa có EC2 nào**) |
| **D. Deploy backend cùng VPC** | Phase 3 | Gọi endpoint private trực tiếp, không cần tunnel |

---


## 5. 🤝 BÀN GIAO `P2-NH01` — NHẤT (Backend Core & FPL Sync)

*Task:* chuyển chuỗi kết nối DB sang Amazon RDS qua biến môi trường (`RDS_HOSTNAME`, `RDS_DB_NAME`, `RDS_USERNAME`, `RDS_PASSWORD`) + **fallback Postgres local khi offline**.
*Branch:* `feature/P2-NH01-rds-connection` · *2 file mới:* `backend/app/core/rds_config.py`, `backend/tests/test_rds_connection.py` · *Verify:* `pytest backend/tests/test_rds_connection.py` pass 100 %.

### 5.1. Nhất nhận gì từ `P2-Q01`

| Nội dung | Ở đâu |
| :--- | :--- |
| host / port / database / username | **§2** |
| Mật khẩu `fpl_admin` | **Kênh riêng** (password manager) — không có trong repo |
| `DATABASE_URL` mẫu + cú pháp TLS | **§2** (`?ssl=require`) |
| Bằng chứng kết nối RDS đã chạy được | **§3.1** |
| Cách test thật khi cần (máy dev không vào được DB private) | **§3.4** / **§4** |

### 5.2. Thiết kế gợi ý (khớp code hiện tại)

`rds_config.py` → hàm `get_database_url()`:

1. Nếu **đủ 4** biến `RDS_*` → build `postgresql+asyncpg://{user}:{pass}@{host}:5432/{db}?ssl=require` (nhớ **URL-encode** mật khẩu).
2. Nếu **thiếu** bất kỳ biến nào → trả `settings.DATABASE_URL` (Postgres local) ⇒ đây chính là "fallback khi offline".
3. Cho `app/core/config.py` hoặc `app/core/database.py` dùng `get_database_url()` ⇒ **Alembic (`backend/alembic/env.py`) tự động migrate đúng DB cho `P2-V01`** mà không sửa gì thêm.

> Không log URL/mật khẩu; không hardcode; `Settings` đã có `extra="allow"` nên thêm field `RDS_*` không phá gì.

### 5.3. Test (theo pattern có sẵn `backend/tests/test_fpl_sync.py:148-153`)

- **Unit test offline (bắt buộc, chạy được không cần mạng):** set env giả → assert URL build đúng thứ tự; xoá env → assert fallback về local.
- **Integration test:** đọc env riêng (vd `RDS_TEST_DATABASE_URL`), **`pytest.skip` khi thiếu env**, và `fail` nếu database không kết thúc `_test` ⇒ `pytest` vẫn **pass 100 %** khi chưa có đường mạng.

### 5.4. 3 cái bẫy phải nói trước

1. **`docker-compose` không dùng `DATABASE_URL` root `.env`**: `infra/docker-compose.yml:59` build URL từ `POSTGRES_*` với host `postgres` ⇒ set `.env` → RDS **không** làm container đổi DB (chỉ ảnh hưởng khi chạy `uvicorn` trên host).
2. **Trần kết nối `db.t4g.micro` ≈ 8–10** (1 GB RAM). `pool_size=5` / `max_overflow=5` là việc của **`P2-V02`** (Vũ) — đừng set trùng; nhưng nên bật `pool_pre_ping=True`.
3. **CI không dùng `fpl_admin`**: test dùng `sqlite+aiosqlite` (đã có trong `requirements.txt`) để không chiếm slot kết nối.

### 5.5. Checklist của Nhất

- [ ] Nhận §2 + mật khẩu qua kênh riêng.
- [ ] Tạo `rds_config.py` (ưu tiên `RDS_*` → fallback `DATABASE_URL`) + `test_rds_connection.py`.
- [ ] `pytest backend/tests/test_rds_connection.py` → **pass 100 % offline** (bằng chứng bắt buộc).
- [ ] **KHÔNG** sửa `infra/`, **KHÔNG** chạy `terraform apply/destroy`, **KHÔNG** commit secret.
- [ ] Báo "sẵn sàng test thật" → Quang mở cửa sổ §3.4 để chạy integration test.

---

## 6. 👥 BÀN GIAO CÁC THÀNH VIÊN KHÁC

| Thành viên | Task | Nhận từ `P2-Q01` | Chặn hiện tại |
| :--- | :--- | :--- | :--- |
| **Nhất** | `P2-NH01` | Toàn bộ §2 + §5 | Máy dev không vào được DB private (§4) |
| **Vũ** | `P2-V01`, `P2-V02` | DB đích `fantasy_fpl` (PG 15.17); DB `_test` cho integration; trần ~8–10 conn | `P2-V01` cần cửa sổ §3.4 để migrate thật |
| **Nguyên** | `P3-NG*` | Không phụ thuộc trực tiếp | — |
| **Quang** | `P2-Q02` → `P2-Q04` | SG ID, subnet/parameter group, drift SG (§10.1) | `P2-Q02` phải codify rule SG trước khi merge |

---


## 7. 💰 CHI PHÍ & VÒNG ĐỜI TÀI NGUYÊN

**Hàng rào chi phí đang bật:** `db.t4g.micro` · 20 GiB `gp3` · autoscaling **OFF** · Single-AZ · không Performance Insights / log export / snapshot thủ công · Budget **$1.00** (80 %/100 %/forecast → email).

> ⚠️ **Tài khoản mới (sau 15/07/2025) dùng Free plan/credit-based**: trang **Billing → Free Tier KHÔNG liệt kê RDS** (chỉ 7 mục *always free*). Vì vậy **bằng chứng chi phí = Budget + Cost Explorer**, không phải ảnh chụp trang Free Tier.

```bash
# Chi phí RDS tháng này (kỳ vọng ≈ 0)
aws ce get-cost-and-usage --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY --metrics UnblendedCost \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Relational Database Service"]}}' \
  --region us-east-1 --query 'ResultsByTime[0].Total.UnblendedCost'

# Tạm nghỉ (giữ dữ liệu, tiết kiệm giờ) — AWS tự start lại sau 7 ngày
aws rds stop-db-instance --db-instance-identifier fpl-fantasy-db --region ap-southeast-1

# Kết thúc học kỳ: xoá sạch, không để snapshot tính phí
cd infra/aws && terraform destroy
aws rds describe-db-instances --region ap-southeast-1 --query 'DBInstances[].DBInstanceIdentifier'
aws rds describe-db-snapshots --region ap-southeast-1 --snapshot-type manual --query 'DBSnapshots[].DBSnapshotIdentifier'
```

**Tuyệt đối không bật:** Multi-AZ · storage autoscaling · Performance Insights · CloudWatch log export · `publicly_accessible=true` (trừ cửa sổ §3.4) — tất cả đều phát sinh phí.

---

## 8. 🚀 TERRAFORM — APPLY / THAY ĐỔI / DESTROY

```bash
cd infra/aws
export TF_VAR_db_password="$(openssl rand -hex 16)"   # LƯU NGAY vào password manager
terraform init && terraform fmt -check && terraform validate
terraform plan -out=p2q01.tfplan      # review: db.t4g.micro / 20 / 0 / false / false
terraform apply p2q01.tfplan
```

- Guardrails trong code: `validation` chặn đổi `instance_class`, `engine_version`, `aws_region` ⇒ không ai vô tình chọn cấu hình tính phí.
- **State là local và chứa mật khẩu plaintext** ⇒ đã bị `.gitignore` chặn (`*.tfstate`, `*.tfplan`, `*.tfvars`), **không commit**, nên backup riêng.
- ⚠️ **Đọc §10.1 trước khi chạy `terraform apply`** — hiện có drift ở Security Group.

---

## 9. 🩺 TROUBLESHOOTING

| Triệu chứng | Nguyên nhân | Xử lý |
| :--- | :--- | :--- |
| `psql: could not connect ... timed out` | DB private, chưa có đường vào | Đúng thiết kế → dùng §3.4 hoặc §4-C |
| `FATAL: no pg_hba.conf entry ... no encryption` | `rds.force_ssl = 1` chặn client không TLS | Thêm `sslmode=require` (psql) / `?ssl=require` (asyncpg) |
| `invalid dsn` phía backend | Dùng `?sslmode=` cho `asyncpg` | Đổi thành `?ssl=require` |
| `password authentication failed for user "fpl_admin"` | Sai mật khẩu | Lấy lại từ password manager; nếu mất: `aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db --master-user-password '<new>' --apply-immediately` **rồi đồng bộ lại `TF_VAR_db_password`** |
| `DBSubnetGroupDoesNotCoverEnoughAZs` | Default VPC bị xoá / < 2 subnet | Kiểm tra subnet default VPC, hoặc trỏ subnet group sang 2 private subnet |
| `Storage-full` | Chạm 20 GB (rất khó với dữ liệu FPL) | Dọn bảng log/cũ. **KHÔNG** tăng storage (vượt Free Tier) |
| `Cannot find version 15.x` | Minor version bị thay | Giữ `engine_version = "15"` |

---

## 10. ⚠️ RỦI RO MỞ & VIỆC TIẾP THEO

**10.1. 🔴 IaC drift ở Security Group (ưu tiên cao nhất)**
Trên AWS có **1 ingress rule `/32` (IP dev) do thao tác thủ công**, nhưng `terraform_rds.tf` và `terraform.tfstate` đều ghi `ingress = []`. Lần `terraform apply` kế tiếp **Terraform sẽ xoá rule này** → mất đường vào DB.
→ **`P2-Q02` phải codify** rule vào `ingress` block + `var.dev_cidr_blocks` **trước khi** ai đó chạy `apply`. IP dev hay đổi (đã đổi 1 lần), nên rule phải được quản lý bằng biến, không mở tay.

**10.2. State local chưa có remote backend** → chỉ máy Quang giữ state (chứa mật khẩu). Phase 3: chuyển sang **S3 backend + DynamoDB lock** (bucket private, mã hoá).

**10.3. RDS Extended Support** — PostgreSQL 15 hết *standard support* dự kiến ~2027, sau mốc đó **tự động phát sinh phí** ⇒ đưa "nâng 15 → 17" vào backlog trước EOL.

**10.4. Bằng chứng còn thiếu cho báo cáo:** screenshot RDS Console (tab *Configuration*) — `AC-3` đã có output text ở §3.1.

**10.5. Máy dev chưa cài `psql`** ⇒ dùng `docker run --rm -it postgres:15-alpine psql ...` (image đã có sẵn).

---

## 11. ✅ CHECKLIST NGHIỆM THU

| AC | Nội dung | Trạng thái | Bằng chứng |
| :--- | :--- | :--- | :--- |
| AC-1 | Instance `Available` | ✅ | §1 (2026-11-04) |
| AC-2 | Đúng hình dạng Free Tier | ✅ | §1 (`db.t4g.micro` · 20 GiB gp3 · Single-AZ · autoscaling OFF · backup 1) |
| AC-3 | Kết nối `psql` có TLS | ✅ | §3.1 (`SSL connection` + `ssl = on`) + §3.2 (test âm) |
| AC-4 | Không mở `0.0.0.0/0` | ✅ | §3.3 (SG chỉ có rule `/32`) |
| AC-5 | Tài liệu không chứa mật khẩu | ✅ | §2 dùng placeholder `<DB_PASSWORD>` |
| AC-6 | Chi phí ≈ $0 | ✅ | §1 ($0.0000019) |
| AC-7 | Budget $1.00 active | ✅ | §1 (SNS email đã confirm) |
| AC-8 | Không snapshot tính phí | ✅ | §7 (`[]`) |
| AC-9 | `.gitignore` chặn state/plan | ✅ | commit `4650e5a` |

**Còn lại trước khi kết thúc:** screenshot Console (§10.4) · codify rule SG ở `P2-Q02` (§10.1) · nhắc `P2-Q03` bổ sung tài liệu + PR cho budget đã có.

---

## 📚 PHỤ LỤC

| Tài nguyên | Đường dẫn |
| :--- | :--- |
| IaC của task này | [`terraform_rds.tf`](terraform_rds.tf) |
| Hợp đồng dữ liệu / schema | [`docs/PROJECT_SSOT.md`](../../docs/PROJECT_SSOT.md) |
| Trạng thái task | [`docs/TODO.md`](../../docs/TODO.md) — mục `P2-Q01` |
| Hướng dẫn local | [`LOCAL_SETUP_GUIDE.md`](../../LOCAL_SETUP_GUIDE.md) |
| AWS RDS Free Tier | <https://aws.amazon.com/rds/free/> |

> ✍️ **Bảo trì:** thay đổi `instance_class`, `allocated_storage`, `multi_az`, `publicly_accessible`, `dev_cidr_blocks` là **thay đổi Level 4** → review Tech Lead + cập nhật tài liệu này cùng lúc.
