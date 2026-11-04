# 🗄️ P2-Q01 — AMAZON RDS POSTGRESQL 15 (FREE TIER) · RUNBOOK & HANDOFF

> **Task:** `P2-Q01` *(Level 4)* · **Owner:** Quang (DevOps) · **Branch:** `feature/P2-Q01-aws-rds-init`
> **Files:** `infra/aws/rds_setup.md` (tài liệu này) + `infra/aws/terraform_rds.tf` (IaC)
> **Nguồn chuẩn:** [`PROJECT_SSOT`](../../docs/PROJECT_SSOT.md) · [`ROADMAP`](../../docs/PROJECT_ROADMAP.md) · [`TODO`](../../docs/TODO.md) · [`AI_GUIDELINES`](../../docs/AI_GUIDELINES.md)
>
> **🚦 Trạng thái 04/11/2026:** ✅ Instance `available` · ✅ Kết nối TLS đã kiểm chứng (`psql` + `\conninfo`) · ✅ **`P2-NH01` (Nhất) pass 100 % test** trên RDS thật · ✅ Cửa sổ public tạm đã **đóng** (DB đang private). Còn mở: drift SG (§10.1).

---

## 1. ⚡ TL;DR

| Hạng mục | Giá trị thực tế |
| :--- | :--- |
| Instance | `fpl-fantasy-db` · **`available`** (tạo `2026-11-02T14:46Z`) · PostgreSQL **15.17** |
| Class / Storage | `db.t4g.micro` · **20 GiB `gp3`** · autoscaling **OFF** (`max_allocated_storage = 0`) |
| Availability | **Single-AZ** `ap-southeast-1b` |
| Public access | **`false`** — private trong default VPC (endpoint → `172.31.18.192`) |
| TLS | `rds.force_ssl = 1` (group `fpl-fantasy-db-postgres15`) · CA `rds-ca-rsa2048-g1` |
| Backup | 1 ngày · `18:00–18:30` UTC · `skip_final_snapshot = true` · maintenance `sun:19:00–19:30` UTC |
| Security Group | `sg-0f5970a2c3b47878a` · egress deny-all · ingress: **chỉ** rule `/32` của `P2-Q02` |
| Subnet / Parameter group | `fpl-fantasy-db-subnet-group` / `fpl-fantasy-db-postgres15` |
| Chi phí RDS (11/2026) | **$0.0000019** ≈ $0.00 · Budget guard `fpl-freetier-guard-1usd` ($1.00, email confirmed) |

---

## 2. 📇 THÔNG SỐ KẾT NỐI

| Thông số | Giá trị |
| :--- | :--- |
| **Host** | `fpl-fantasy-db.cr0maoomq80d.ap-southeast-1.rds.amazonaws.com` |
| **Port** | `5432` · **Database** `fantasy_fpl` · **Username** `fpl_admin` |
| **Password** | 🔒 Chỉ trong password manager — **không** ghi vào repo/chat/PR |
| **SSL** | `require` (bắt buộc) |

```env
# backend/.env (đã bị .gitignore chặn)
DATABASE_URL=postgresql+asyncpg://fpl_admin:<DB_PASSWORD>@fpl-fantasy-db.cr0maoomq80d.ap-southeast-1.rds.amazonaws.com:5432/fantasy_fpl?ssl=require
```

```text
# psql / DBeaver / pgAdmin
host=fpl-fantasy-db.cr0maoomq80d.ap-southeast-1.rds.amazonaws.com port=5432 dbname=fantasy_fpl user=fpl_admin sslmode=require
```

> ⚠️ `asyncpg` → `?ssl=require` · `psql`/libpq → `sslmode=require` (dùng sai ⇒ `invalid dsn` / `no encryption`).
> Host **không phải** bí mật (DB private) nên ghi đầy đủ; **mật khẩu thì tuyệt đối không**.
> Lấy mật khẩu (chỉ máy Quang, không dán output đi đâu): `cd infra/aws && terraform state show -no-color aws_db_instance.this | grep -E '^\s+password\s+='`

---

## 3. ✅ BẰNG CHỨNG KIỂM CHỨNG

**3.1. Kết nối TLS (Quang, 08:51)** — `postgres:15-alpine` + `sslmode=require`:

```text
connected to database "fantasy_fpl" as user "fpl_admin" (address "54.151.153.247") at port "5432"
SSL connection (protocol: TLSv1.2, cipher: ECDHE-RSA-AES256-GCM-SHA384, compression: off)
PostgreSQL 15.17 on aarch64-unknown-linux-gnu · ssl = on · current_database = fantasy_fpl
```

**3.2. Test âm (chứng minh `force_ssl`)** — client không TLS bị chặn:

```text
FATAL:  no pg_hba.conf entry for host "123.31.***.***", user "fpl_admin", database "fantasy_fpl", no encryption
```

**3.3. `P2-NH01` (Nhất) — PASS 100 %** trên RDS thật (integration test qua cửa sổ public 08:51 → 10:14). ⇒ `AC-3` đã đóng bằng **2 nguồn độc lập**.

**3.4. Đã đóng cửa sổ (10:14):** `PubliclyAccessible = false`, public IP gỡ khỏi ENI, DNS → `172.31.18.192`, TCP 5432 từ Internet → **timeout**, SG chỉ còn rule `/32` của `P2-Q02`.

**3.5. Tái lập khi cần (time-box, chỉ Quang):**

```bash
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress --region ap-southeast-1 --group-id sg-0f5970a2c3b47878a \
  --ip-permissions "IpProtocol=tcp,FromPort=5432,ToPort=5432,IpRanges=[{CidrIp=$MY_IP/32,Description=P2-temp-verify}]"
aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db --publicly-accessible --apply-immediately --region ap-southeast-1
#   ... test ... rồi ĐÓNG NGAY:
aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db --no-publicly-accessible --apply-immediately --region ap-southeast-1
aws ec2 revoke-security-group-ingress --region ap-southeast-1 --group-id sg-0f5970a2c3b47878a --protocol tcp --port 5432 --cidr "$MY_IP/32"
```

> 🔴 **Bài học 04/11:** IP public `52.221.3.116` bị **lọc port 5432 trên đường mạng của nhóm** (dù SG đã whitelist; `portquiz.net:5432` vẫn OK ⇒ không phải firewall cục bộ). Cách xử lý: tắt/bật public access để **xin IP public mới** (`54.151.153.247`) → kết nối ngay. Nếu gặp lại: xem §9.
> ⏱️ Cửa sổ thực tế mở **~95 phút** (08:39 → 10:14), dài hơn mốc 30 phút ⇒ lần sau **đặt hẹn giờ đóng tự động**.

---

## 4. 🔐 TRUY CẬP TỪ MÁY (DB private)

| Cách | Khi nào | Ghi chú |
| :--- | :--- | :--- |
| **A. Không kết nối trực tiếp** (mặc định) | Dev/test hàng ngày | Dùng Postgres local (service `database`) |
| **B. Public tạm** (đã dùng 04/11) | Verify RDS thật | Time-box, **đóng ngay**, dùng CLI, không `terraform apply` |
| **C. SSM port-forward** | `P2-Q02` / Phase 3 | Cần 1 EC2 + role `AmazonSSMManagedInstanceCore` (hiện **chưa có EC2**) |
| **D. Backend trong cùng VPC** | Phase 3 | Gọi endpoint private trực tiếp |

---

## 5. 🤝 BÀN GIAO `P2-NH01` — ✅ ĐÃ HOÀN THÀNH

| Hạng mục | Trạng thái |
| :--- | :--- |
| Thông số kết nối (§2) + mật khẩu qua kênh riêng | ✅ Đã bàn giao |
| `backend/app/core/rds_config.py` (ưu tiên `RDS_*` → fallback `DATABASE_URL` local) | ✅ Done — Nhất |
| `backend/tests/test_rds_connection.py` | ✅ Pass 100 % (gồm cả kết nối RDS thật) |

**3 điều cần nhớ cho các task sau (`P2-NH02`, Phase 3):**
1. **`docker-compose` không dùng `DATABASE_URL` root `.env`** — nó build URL từ `POSTGRES_*` với host `postgres` (`infra/docker-compose.yml`).
2. **Trần kết nối ~8–10** (`db.t4g.micro`, 1 GB RAM). `pool_size`/`max_overflow` thuộc **`P2-V02`** (Vũ) — không set trùng; nên `pool_pre_ping=True`.
3. **CI dùng `sqlite+aiosqlite`**, không dùng `fpl_admin` (tránh chiếm slot kết nối).

---


## 6. 👥 BÀN GIAO CÁC THÀNH VIÊN

| Thành viên | Task | Nhận từ `P2-Q01` |
| :--- | :--- | :--- |
| **Nhất** | `P2-NH01` ✅ → `P2-NH02` | Đã xong; dùng lại `rds_config.py`, xem 3 lưu ý §5 |
| **Vũ** | `P2-V01`, `P2-V02` | DB `fantasy_fpl` (PG 15.17); cần cửa sổ §3.5 để migrate thật; pool ≤ ~10 conn |
| **Nguyên** | `P3-NG*` | Không phụ thuộc trực tiếp |
| **Quang** | `P2-Q02` → `P2-Q04` | SG ID, subnet/parameter group, **phải xử lý drift §10.1** |

---

## 7. 💰 CHI PHÍ & VÒNG ĐỜI

- Guardrails: `db.t4g.micro` · 20 GiB gp3 · autoscaling OFF · Single-AZ · không PI/log export/snapshot · Budget **$1.00**.
- ⚠️ Tài khoản dùng **Free plan/credit-based** ⇒ trang *Billing → Free Tier* **không** liệt kê RDS ⇒ bằng chứng chi phí = **Budgets + Cost Explorer**.

```bash
aws ce get-cost-and-usage --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) --granularity MONTHLY \
  --metrics UnblendedCost --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Relational Database Service"]}}' \
  --region us-east-1 --query 'ResultsByTime[0].Total.UnblendedCost'

aws rds stop-db-instance --db-instance-identifier fpl-fantasy-db --region ap-southeast-1   # nghỉ > 1 tuần (tự start lại sau 7 ngày)
cd infra/aws && terraform destroy                                                          # kết thúc học kỳ
```

**Không bật:** Multi-AZ · storage autoscaling · Performance Insights · log export · `publicly_accessible=true` (trừ cửa sổ §3.5).

---

## 8. 🚀 TERRAFORM

```bash
cd infra/aws
export TF_VAR_db_password="<lấy từ password manager>"   # KHÔNG tạo mật khẩu mới nếu đã có DB
terraform init && terraform fmt -check && terraform validate
terraform plan -out=p2q01.tfplan    # kỳ vọng: chỉ drift SG (§10.1), không đổi instance
terraform apply p2q01.tfplan
```

- `validation` trong code chặn đổi `instance_class` / `engine_version` / `aws_region`.
- State **local**, chứa mật khẩu plaintext, đã bị `.gitignore` chặn ⇒ không commit, backup riêng.
- 🔴 **Đọc §10.1 trước khi `apply`.**

---

## 9. 🩺 TROUBLESHOOTING

| Triệu chứng | Nguyên nhân | Xử lý |
| :--- | :--- | :--- |
| **`TimeoutError` / `TcpTestSucceeded=False` dù SG đã whitelist IP** | **Dải IP public của RDS bị lọc port 5432 trên đường mạng** (gặp với `52.221.3.116`) | Tắt/bật `publicly_accessible` để **đổi IP public** → test lại (đã fix bằng `54.151.153.247`). Kiểm chứng nhanh mạng: `portquiz.net:5432` |
| Timeout + DNS ra `172.31.x.x` | DB đang private | Đúng thiết kế → §3.5 |
| `FATAL: ... no encryption` | Thiếu TLS | `sslmode=require` / `?ssl=require` |
| `invalid dsn` | Dùng `sslmode=` cho `asyncpg` | Đổi thành `?ssl=require` |
| `password authentication failed` | Sai mật khẩu | Lấy lại từ password manager; nếu mất: `aws rds modify-db-instance ... --master-user-password '<new>' --apply-immediately` rồi đồng bộ `TF_VAR_db_password` |
| `DBSubnetGroupDoesNotCoverEnoughAZs` | Default VPC bị xoá / < 2 subnet | Kiểm tra subnet default VPC |
| `Cannot find version 15.x` | Minor version bị đổi | Giữ `engine_version = "15"` |

---

## 10. ⚠️ RỦI RO MỞ

**10.1. 🔴 Drift Security Group (ưu tiên cao)** — trên AWS có **1 ingress rule `/32` thêm thủ công** (`14.191.166.167/32`, IP cũ), nhưng `terraform_rds.tf` + state đều ghi `ingress = []` ⇒ **`terraform apply` kế tiếp sẽ xoá rule này**.
→ `P2-Q02` phải **codify** rule vào `ingress` block + `var.dev_cidr_blocks` **trước khi** ai chạy `apply`. IP dev hay đổi ⇒ phải quản lý bằng biến, không mở tay.

**10.2. State local** — chưa có remote backend (chứa mật khẩu). Phase 3: **S3 backend + DynamoDB lock**.

**10.3. PostgreSQL 15 EOL ~2027** → sau mốc *standard support* sẽ **tự phát sinh phí** ⇒ đưa "nâng 15 → 17" vào backlog.

**10.4. Bằng chứng còn thiếu:** screenshot RDS Console (tab *Configuration*) cho báo cáo.

---

## 11. ✅ CHECKLIST NGHIỆM THU

| AC | Nội dung | ✓ | Bằng chứng |
| :--- | :--- | :--- | :--- |
| AC-1 | Instance `Available` | ✅ | §1 |
| AC-2 | Đúng hình dạng Free Tier | ✅ | §1 |
| AC-3 | Kết nối `psql` có TLS | ✅ | §3.1 + §3.2 + §3.3 (`P2-NH01` pass) |
| AC-4 | Không mở `0.0.0.0/0` | ✅ | §3.4 |
| AC-5 | Tài liệu không chứa mật khẩu | ✅ | §2 |
| AC-6 | Chi phí ≈ $0 | ✅ | §1 |
| AC-7 | Budget $1.00 active | ✅ | §1 |
| AC-8 | Không snapshot tính phí | ✅ | §7 |
| AC-9 | `.gitignore` chặn state/plan | ✅ | commit `4650e5a` |

**Việc còn lại:** screenshot Console (§10.4) · codify rule SG ở `P2-Q02` (§10.1) · `P2-Q03` bổ sung tài liệu + PR cho budget đã có.

---

## 📚 PHỤ LỤC

| Tài nguyên | Đường dẫn |
| :--- | :--- |
| IaC | [`terraform_rds.tf`](terraform_rds.tf) |
| Schema / API contract | [`docs/PROJECT_SSOT.md`](../../docs/PROJECT_SSOT.md) |
| Trạng thái task | [`docs/TODO.md`](../../docs/TODO.md) — mục `P2-Q01` |

> ✍️ **Bảo trì:** đổi `instance_class`, `allocated_storage`, `multi_az`, `publicly_accessible`, `dev_cidr_blocks` = **Level 4** → review Tech Lead + cập nhật tài liệu này cùng lúc.
