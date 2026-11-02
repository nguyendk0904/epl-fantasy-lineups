# 🗄️ P2-Q01 — AMAZON RDS POSTGRESQL 15 (AWS FREE TIER) SETUP RUNBOOK

> **Task:** `P2-Q01` — *Risk Level 4 (Critical)* | **Owner:** Quang (DevOps & Cloud Infrastructure Lead)
> **Git Branch:** `feature/P2-Q01-aws-rds-init`
> **Thư mục:** `infra/aws/` | **Files:** `rds_setup.md` (tài liệu này), `terraform_rds.tf` (IaC)
> **Nguồn chuẩn:** [`docs/PROJECT_SSOT.md`](../../docs/PROJECT_SSOT.md) · [`docs/PROJECT_ROADMAP.md`](../../docs/PROJECT_ROADMAP.md) · [`docs/TODO.md`](../../docs/TODO.md) · [`docs/AI_GUIDELINES.md`](../../docs/AI_GUIDELINES.md)
>
> **Mục tiêu:** Khởi tạo **1 instance Amazon RDS PostgreSQL 15** (`db.t4g.micro`, Single-AZ, **20 GB gp3**) trên tài khoản AWS của Quang, **nằm trọn hạn mức Free Tier (chi phí $0.00)**, kèm tài liệu thông số kết nối an toàn **không chứa mật khẩu thật**.

---

## 🧭 MỤC LỤC

| # | Nội dung | # | Nội dung |
| :--- | :--- | :--- | :--- |
| 1 | Tóm tắt quyết định kỹ thuật | 8 | Kiểm chứng (Verification) — Console / CLI / psql |
| 2 | Hạn mức AWS Free Tier & hàng rào chi phí | 9 | Kết nối từ Backend (bàn giao cho P2-NH01) |
| 3 | Kiến trúc mạng & bảo mật | 10 | Troubleshooting |
| 4 | Yêu cầu môi trường (Prerequisites) | 11 | Dọn dẹp (Destroy) — tránh phát sinh chi phí |
| 5 | Triển khai bằng Terraform (khuyến nghị) | 12 | Ranh giới task & bàn giao |
| 6 | Phương án B: Tạo thủ công bằng Console | 13 | Checklist nghiệm thu (Acceptance Criteria) |
| 7 | Thông số kết nối an toàn (Secrets) | — | — |

---

## ⚡ 1. TÓM TẮT QUYẾT ĐỊNH KỸ THUẬT

| Hạng mục | Giá trị | Lý do (Free Tier / Security) |
| :--- | :--- | :--- |
| **Engine** | PostgreSQL **15** | Đúng Tech Stack trong `PROJECT_SSOT.md` (đồng bộ với `postgres:15-alpine` ở local). |
| **Instance class** | `db.t4g.micro` (ARM Graviton2, 2 vCPU / 1 GB RAM) | Thuộc danh sách Free Tier **750 giờ/tháng**; rẻ và nhanh hơn `db.t3.micro` cùng giá. |
| **Storage** | **20 GB gp3**, `max_allocated_storage = 0` | 20 GB là **trần Free Tier**; tắt **storage autoscaling** để DB không tự phình → không phát sinh bill. |
| **Availability** | **Single-AZ** (`multi_az = false`) | Multi-AZ **tính phí gấp đôi**, không có trong Free Tier. |
| **Region** | `ap-southeast-1` (Singapore) | Chuẩn hoá theo SSOT (`.env.example`), latency thấp cho VN. |
| **Public access** | **`publicly_accessible = false`** (mặc định) | DB chỉ sống trong VPC; muốn `psql` từ laptop phải qua tunnel (mục 8.3). |
| **Security Group** | **Không có ingress rule nào** (deny all) + egress deny all | Baseline "không thể bị quét". Rule 5432 least-privilege thuộc task **P2-Q02** → không bao giờ mở `0.0.0.0/0`. |
| **Encryption at rest** | `storage_encrypted = true` | Dùng key **AWS-managed `aws/rds`** → **miễn phí** (không tạo KMS CMK tốn phí). |
| **Encryption in transit** | Parameter group `rds.force_ssl = 1` | Mọi kết nối **bắt buộc TLS** (`sslmode=require`); client không TLS bị từ chối. |
| **Automated backup** | `backup_retention_period = 1` ngày | Free Tier cho 20 GB backup; 1 ngày đủ PITR cho đồ án và **không vượt hạn mức**. |
| **Performance Insights / Enhanced Monitoring / Log export** | **TẮT hết** | Đây là các tính năng **có thể phát sinh phí** (log ingestion, metric chi tiết). |
| **Final snapshot** | `skip_final_snapshot = true` | `terraform destroy` sạch, **không để lại snapshot tính phí**. |
| **State quản lý** | Terraform local state (không commit) | Tránh commit `tfstate` chứa mật khẩu (mục 7.3). |

> ⚠️ **Điều kiện tiên quyết về chi phí:** task `P2-Q03` (AWS Budgets Alert **$1.00**) là **BẮT BUỘC**. Khuyến nghị **hoàn thành P2-Q03 TRƯỚC** khi chạy `terraform apply` ở tài liệu này để mọi phát sinh ngoài ý muốn đều có email cảnh báo.

---

## 💰 2. HẠN MỨC AWS FREE TIER & HÀNG RÀO CHI PHÍ

### 2.1. Hạn mức áp dụng cho cấu hình này

| Tài nguyên | Hạn mức Free Tier | Cấu hình trong `terraform_rds.tf` | Trạng thái |
| :--- | :--- | :--- | :--- |
| RDS instance hours | **750 giờ/tháng** `db.t4g.micro` (Single-AZ) | 1 instance × ~730 giờ/tháng | ✅ Trong hạn mức |
| Storage | **20 GB** General Purpose SSD (**gp2/gp3**) | `allocated_storage = 20`, `storage_type = gp3` | ✅ Đúng trần |
| Storage autoscaling | Không được cấp (vượt 20 GB là tính phí) | `max_allocated_storage = 0` | ✅ Đã tắt |
| Backup storage | **20 GB** (bằng dung lượng provisioned) | `backup_retention_period = 1` | ✅ Dưới trần |
| Snapshot thủ công | Tính phí theo GB/tháng | Không tạo; `skip_final_snapshot = true` | ✅ Không có |
| Data transfer out | 100 GB/tháng (toàn tài khoản) | DB không public, traffic nội bộ VPC | ✅ Không đáng kể |
| Multi-AZ / Read replica | **Không** thuộc Free Tier | Đều tắt | ✅ |

### 2.2. ⚠️ 5 cạm bẫy khiến "Free Tier" thành **có phí** (đã chặn trong code)

1. **Storage autoscaling** bật mặc định trên Console → DB tự tăng tới 100 GB khi gần đầy. → Đã set `max_allocated_storage = 0`.
2. **Multi-AZ** (chọn nhầm "Multi-AZ DB instance") → gấp đôi giờ chạy. → `multi_az = false` hard-code.
3. **RDS Extended Support**: sau khi PostgreSQL 15 hết *End of standard support* (dự kiến **đầu 2027**), AWS **tính phí Extended Support** nếu chưa nâng version. → Bật `auto_minor_version_upgrade = true` và **đưa việc nâng major version (15 → 16/17) vào backlog trước mốc đó**.
4. **CloudWatch Logs export / Performance Insights** → phí ingestion & retention. → Đã tắt (`enabled_cloudwatch_logs_exports = []`, `performance_insights_enabled = false`).
5. **Quên `terraform destroy`** sau demo → chạy quá 750 giờ/tháng hoặc để lại snapshot. → Mục 11 có quy trình destroy 4 bước.

> 📌 **Lưu ý về loại tài khoản AWS:** tài khoản tạo **sau 15/07/2025** dùng mô hình **Free plan (credit-based, ~$100 credit + $100 bonus)** thay vì "12 tháng free tier" cổ điển. Trước khi `apply`, mở **Billing → Free Tier** và xác nhận dòng *"RDS: 750 hrs of db.t4g.micro"* còn hiệu lực. Nếu tài khoản đã hết hạn Free Tier → **DỪNG**, báo Tech Lead, không tạo instance.

---

## 🔐 3. KIẾN TRÚC MẠNG & BẢO MẬT

```
                          Internet
                             │  (KHÔNG có đường vào: không ingress rule + publicly_accessible = false)
                             ▼
   ┌───────────────────── Default VPC (ap-southeast-1) ──────────────────────┐
   │  ┌────────────────┐        ┌─────────────────────────────────────────┐ │
   │  │ DB Subnet Group│        │  SECURITY GROUP fpl-fantasy-db-sg       │ │
   │  │ (≥ 2 AZ)       │───────▶│  ingress : (rỗng — P2-Q02 sẽ thêm)      │ │
   │  └────────────────┘        │  egress  : deny all (127.0.0.1/32)      │ │
   │            │               └─────────────────────────────────────────┘ │
   │            ▼                                                            │
   │  ┌───────────────────────────────────────────────────────────────────┐  │
   │  │ RDS PostgreSQL 15 · db.t4g.micro · 20 GB gp3 · Single-AZ          │  │
   │  │ encrypted at rest (aws/rds) · TLS enforced (rds.force_ssl = 1)    │  │
   │  └───────────────────────────────────────────────────────────────────┘  │
   └─────────────────────────────────────────────────────────────────────────┘
                             ▲
                             │ :5432 (sau khi P2-Q02 mở rule; TLS bắt buộc)
        Backend trong VPC / dev IP cố định / SSM port-forwarding
```

**Defense-in-depth đã áp dụng:**

- **Không có ingress rule nào** trong SG ⇒ instance *không thể* bị truy cập từ Internet ngay sau khi tạo (kể cả khi ai đó bật `publicly_accessible`).
- **Egress deny-all**: RDS không khởi tạo kết nối ra ngoài ⇒ không có đường exfiltrate dữ liệu.
- **TLS bắt buộc**: `rds.force_ssl = 1` ⇒ mật khẩu/dữ liệu không đi qua mạng dạng plaintext.
- **Mật khẩu không nằm trong repo**: cấp qua biến môi trường `TF_VAR_db_password` (mục 7).
- **Hàng rào chi phí "khoá" ở mức IaC**: `instance_class` / `engine_version` / `aws_region` đều có `validation` ⇒ không ai vô tình đổi sang cấu hình tính phí.

---

## 🧰 4. YÊU CẦU MÔI TRƯỜNG (PREREQUISITES)

| Công cụ | Phiên bản | Kiểm tra | Ghi chú |
| :--- | :--- | :--- | :--- |
| Terraform CLI | **≥ 1.6.0** | `terraform version` | Windows: `winget install Hashicorp.Terraform` hoặc `choco install terraform`. |
| AWS CLI v2 | ≥ 2.x | `aws --version` | Dùng cho `sts get-caller-identity`, SSM port-forwarding. |
| `psql` (PostgreSQL 15 client) | 15+ | `psql --version` | Chỉ cần cho bước kiểm chứng; có thể dùng Docker `postgres:15-alpine` (đã pull sẵn). |
| Tài khoản AWS | Free Tier / Free plan còn hiệu lực | `aws sts get-caller-identity` | Phải trả về ARN **tài khoản của Quang**. |
| Quyền IAM | `rds:*`, `ec2:DescribeVpc*`, `ec2:DescribeSubnets`, `ec2:*SecurityGroup*` | — | Không dùng root access key; tạo IAM user/role riêng cho Terraform. |

**Cấu hình credentials (không hardcode):**

```bash
# Cách 1 (khuyến nghị): AWS IAM Identity Center (SSO)
aws configure sso --profile fpl-terraform
export AWS_PROFILE=fpl-terraform

# Cách 2: IAM access key (chỉ dùng trên máy cá nhân, KHÔNG commit)
aws configure --profile fpl-terraform      # access key + secret + region ap-southeast-1
export AWS_PROFILE=fpl-terraform

# Xác nhận đang ở ĐÚNG tài khoản trước khi tạo bất kỳ tài nguyên nào
aws sts get-caller-identity
```

> 🚫 **Không bao giờ** đặt `access_key` / `secret_key` / `db_password` trong file `.tf`, `.tfvars` được commit, hay chat/issue. Chỉ dùng `AWS_PROFILE`, `TF_VAR_db_password` (env) và password manager của nhóm.


---

## 🚀 5. TRIỂN KHAI BẰNG TERRAFORM (KHUYẾN NGHỊ)

### 5.1. Chuẩn bị mật khẩu master (không lưu vào file)

Sinh mật khẩu **16–128 ký tự**, **không** chứa `/`, `"`, `@`, space (ràng buộc của RDS, đã validate trong `.tf`):

```bash
# Git Bash / macOS / Linux  -> 32 ký tự hex (luôn hợp lệ: không chứa / " @ space)
export TF_VAR_db_password="$(openssl rand -hex 16)"
echo "$TF_VAR_db_password"   # -> LƯU NGAY vào password manager (Bitwarden/1Password/Keeper của nhóm)
```

```powershell
# PowerShell (Windows)
$env:TF_VAR_db_password = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 24 | % {[char]$_})
$env:TF_VAR_db_password   # -> LƯU NGAY vào password manager
```

> 🔑 Mật khẩu này là **master password của `fpl_admin`**. Nếu mất, chỉ còn cách `terraform taint`/`modify` để đổi. Lưu ngay vào password manager, **không** gửi qua chat, **không** ghi vào `.env` được commit.

### 5.2. Init → Plan → Apply

```bash
cd infra/aws

terraform init                 # tải provider hashicorp/aws ~> 5.60
terraform fmt -check           # phải trả về exit 0 (format chuẩn)
terraform validate             # phải in "Success! The configuration is valid."

# BƯỚC BẮT BUỘC: review plan trước khi apply (Risk Level 4)
terraform plan -out=p2q01.tfplan
# Kiểm tra trong plan: instance_class = db.t4g.micro, allocated_storage = 20,
# max_allocated_storage = 0, multi_az = false, publicly_accessible = false

terraform apply p2q01.tfplan   # tạo RDS, mất khoảng 8–15 phút
```

**Kết quả mong đợi (outputs):**

```text
db_identifier = "fpl-fantasy-db"
db_status     = "available"
db_host       = "fpl-fantasy-db.xxxxxxxxxxxx.ap-southeast-1.rds.amazonaws.com"
db_endpoint   = "fpl-fantasy-db.xxxxxxxxxxxx.ap-southeast-1.rds.amazonaws.com:5432"
db_port       = 5432
db_name       = "fantasy_fpl"
db_username   = "fpl_admin"
database_url_template = "postgresql+asyncpg://fpl_admin:<DB_PASSWORD>@fpl-fantasy-db...:5432/fantasy_fpl?ssl=require"
```

### 5.3. Nếu `terraform` không có sẵn trên máy

Chạy Terraform trong Docker (không cần cài đặt):

```bash
docker run --rm -it -v "/$(pwd):/tf" -w /tf \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN -e AWS_REGION=ap-southeast-1 \
  -e TF_VAR_db_password \
  hashicorp/terraform:1.9.8 init
# rồi thay `init` bằng `plan` / `apply` ở các lệnh tiếp theo
```

> ⚠️ Trên Windows + Git Bash phải thêm `MSYS_NO_PATHCONV=1` trước `docker run` để tránh lỗi `working directory ... is invalid`.

---

## 🖥️ 6. PHƯƠNG ÁN B: TẠO THỦ CÔNG BẰNG CONSOLE (nếu chưa dùng Terraform)

Chỉ dùng khi Terraform không khả dụng — **phải đối chiếu đúng từng thông số** để giữ $0.00:

| Bước | Console path | Giá trị **bắt buộc** |
| :--- | :--- | :--- |
| 1 | RDS → **Create database** → Standard create | Engine: **PostgreSQL**, Version: **15.x** |
| 2 | Templates | **Free tier** |
| 3 | Settings | DB instance identifier `fpl-fantasy-db`, Master username `fpl_admin`, **Auto generate password** (hoặc tự đặt) → **Credentials management: Managed in AWS Secrets Manager** (nếu muốn tránh lưu tay) |
| 4 | Instance configuration | **Burstable classes → db.t4g.micro** (KHÔNG chọn t3/t4g.small/medium) |
| 5 | Storage | Type **gp3**, Allocated **20 GiB**, **bỏ tick "Enable storage autoscaling"** |
| 6 | Connectivity | **Don't connect to an EC2 compute resource**, VPC = default, **Public access: No**, Security group: tạo mới `fpl-fantasy-db-sg` (**không thêm rule 0.0.0.0/0**) |
| 7 | Database authentication | Password authentication |
| 8 | Additional configuration | Initial database name `fantasy_fpl`; **Disable** Performance Insights, **Disable** Enhanced monitoring, **Disable** log exports; Backup retention **1 day**; **Disable** deletion protection; **bỏ tick** "Copy tags to snapshots" (không bắt buộc) |
| 9 | Estimated monthly costs | **Phải hiển thị 0.00 USD** — nếu khác, quay lại kiểm tra bước 2/4/5 |

> Sau khi tạo bằng Console, nên `terraform import aws_db_instance.this fpl-fantasy-db` để đưa instance vào quản lý IaC (tránh "hạ tầng ma" ngoài Terraform).

---

## 📇 7. THÔNG SỐ KẾT NỐI AN TOÀN (CONNECTION PARAMETERS)

### 7.1. Bảng thông số (điền sau khi `apply` — **không chứa mật khẩu**)

| Thông số | Biến môi trường Backend | Giá trị |
| :--- | :--- | :--- |
| Engine | — | `postgres` / PostgreSQL **15** |
| Identifier | — | `fpl-fantasy-db` |
| **Host** | `POSTGRES_HOST` | `<lấy từ output db_host>` |
| **Port** | `POSTGRES_PORT` | `5432` |
| **Database** | `POSTGRES_DB` | `fantasy_fpl` |
| **Username** | `POSTGRES_USER` | `fpl_admin` |
| **Password** | `POSTGRES_PASSWORD` | 🔒 **Chỉ lưu trong password manager của nhóm** — không ghi vào tài liệu/repo |
| SSL mode | — | `require` (bắt buộc — `rds.force_ssl = 1`) |
| Region | `AWS_REGION` | `ap-southeast-1` |
| Security Group ID | — | `<lấy từ output db_security_group_id>` (dùng cho P2-Q02) |
| Subnet group | — | `fpl-fantasy-db-subnet-group` |
| Parameter group | — | `fpl-fantasy-db-postgres15` |

**Chuỗi kết nối chuẩn cho Backend (SQLAlchemy async — theo `PROJECT_SSOT.md`):**

```env
# .env (LOCAL, đã nằm trong .gitignore) hoặc GitHub Actions Secret
DATABASE_URL=postgresql+asyncpg://fpl_admin:<DB_PASSWORD>@<db_host>:5432/fantasy_fpl?ssl=require
```

> ℹ️ Với driver `asyncpg`, tham số SSL là `?ssl=require` (KHÔNG dùng `?sslmode=require` — đó là cú pháp của `psql`/libpq). Nếu P2-NH01 gặp lỗi `invalid dsn`, kiểm tra lại điểm này.

**Chuỗi kết nối cho `psql` / GUI client (DBeaver, pgAdmin):**

```text
host=<db_host> port=5432 dbname=fantasy_fpl user=fpl_admin sslmode=require
```

### 7.2. Nguyên tắc lưu trữ bí mật (Bắt buộc — Level 4)

| Nơi lưu | Được phép? | Ghi chú |
| :--- | :--- | :--- |
| Password manager của nhóm (Bitwarden/1Password) | ✅ | **Nguồn chuẩn duy nhất** cho mật khẩu `fpl_admin`. |
| `.env` trên máy dev | ✅ | Đã bị `.gitignore` chặn (rule `.env`), không commit. |
| GitHub Actions **Secrets** (`DATABASE_URL`) | ✅ | Dùng cho CI/CD ở Phase 3. |
| `terraform.tfstate` (local) | ⚠️ | **Chứa mật khẩu dạng plaintext** ⇒ chỉ nằm trên máy Quang, **không commit**, không upload Drive công khai. |
| `*.tfvars`, `.tf` | ❌ | Không hardcode mật khẩu/access key. |
| Chat, issue, PR description, screenshot | ❌ | Tuyệt đối không. |

### 7.3. Checklist trước khi commit (Quang tự kiểm)

```bash
git status --porcelain          # chỉ được có infra/aws/rds_setup.md + infra/aws/terraform_rds.tf
git check-ignore -v terraform.tfstate   # phải khớp một rule ignore
```

> ⚠️ **Bắt buộc bổ sung vào `.gitignore` gốc** (task P2-Q01 bị giới hạn 2 file nên **không sửa** `.gitignore` trong task này — Quang thêm ngay ở task/commit kế tiếp):
>
> ```gitignore
> # Terraform (P2-Q01)
> **/.terraform/*
> *.tfstate
> *.tfstate.*
> *.tfplan
> crash.log
> *.tfvars
> !*.tfvars.example
> ```

---

## ✅ 8. KIỂM CHỨNG (VERIFICATION)

### 8.1. Cấp 1 — AWS Management Console (bằng chứng cho Acceptance Criteria)

1. Mở **Console → RDS → Databases** (region **Asia Pacific (Singapore) ap-southeast-1**).
2. Chọn `fpl-fantasy-db` → cột **Status** phải là **`Available`**.
3. Tab **Configuration** đối chiếu: `DB instance class = db.t4g.micro`, `Storage = 20 GiB gp3`, `Multi-AZ = No`, `Publicly accessible = No`.
4. **Chụp màn hình** đính kèm báo cáo (bằng chứng nghiệm thu).

### 8.2. Cấp 2 — AWS CLI (bằng chứng dạng text, tiện dán vào báo cáo)

```bash
# Trạng thái + cấu hình Free Tier của instance
aws rds describe-db-instances \
  --db-instance-identifier fpl-fantasy-db \
  --region ap-southeast-1 \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Class:DBInstanceClass,Engine:EngineVersion,GB:AllocatedStorage,Type:StorageType,MaxAuto:MaxAllocatedStorage,MultiAZ:MultiAZ,Public:PubliclyAccessible,Backup:BackupRetentionPeriod}' \
  --output table
```

Kỳ vọng:

```text
-----------------------------------------------------------
|                  DescribeDBInstances                    |
+-----------+---------------------------------------------+
|  Status   |  available                                  |
|  Class    |  db.t4g.micro                               |
|  Engine   |  15.x                                       |
|  GB       |  20                                         |
|  Type     |  gp3                                        |
|  MaxAuto  |  0                                          |
|  MultiAZ  |  False                                      |
|  Public   |  False                                      |
|  Backup   |  1                                          |
+-----------+---------------------------------------------+
```

```bash
# Kiểm tra bảo mật: SG phải KHÔNG có ingress rule 0.0.0.0/0
SG_ID=$(aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text --region ap-southeast-1)
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions' --output json   # kỳ vọng: []
```

### 8.3. Cấp 3 — Kiểm tra kết nối bằng `psql` (bằng chứng cuối cùng)

Vì `publicly_accessible = false`, laptop **không thể** nối trực tiếp. Chọn **một** trong hai cách:

#### Cách A (KHUYẾN NGHỊ) — SSM port-forwarding qua bastion Free Tier

Không mở port ra Internet. Cần 1 EC2 `t2.micro`/`t3.micro` **Free Tier** trong cùng VPC, có SSM Agent + IAM role `AmazonSSMManagedInstanceCore` (tạo tạm trong 15 phút rồi terminate, hoặc dùng cho Phase 3).

```bash
# 1) Mở tunnel: localhost:5433 -> RDS:5432 (giữ nguyên terminal này)
aws ssm start-session \
  --target i-0123456789abcdef0 \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["<db_host>"],"portNumber":["5432"],"localPortNumber":["5433"]}' \
  --region ap-southeast-1
```

```bash
# 2) Terminal khác: kết nối qua tunnel (TLS bắt buộc)
psql "host=127.0.0.1 port=5433 dbname=fantasy_fpl user=fpl_admin sslmode=require"
#    -> nhập mật khẩu từ password manager
```

```text
# 3) Bên trong psql — chứng minh kết nối + TLS hoạt động
fantasy_fpl=> SELECT version();
                                        version
---------------------------------------------------------------------------------------
 PostgreSQL 15.x on aarch64-unknown-linux-gnu, compiled by gcc, 64-bit
(1 row)

fantasy_fpl=> SHOW ssl;
 ssl
-----
 on
(1 row)

fantasy_fpl=> \conninfo
You are connected to database "fantasy_fpl" as user "fpl_admin" on host "127.0.0.1" at port "5433".
SSL connection (protocol: TLSv1.3, cipher: TLS_AES_256_GCM_SHA384, compression: off)
```

> ✅ Dòng **`SSL connection`** trong `\conninfo` là bằng chứng `rds.force_ssl = 1` đang hoạt động.

Nếu máy không có `psql`, dùng image có sẵn:

```bash
docker run --rm -it postgres:15-alpine \
  psql "host=host.docker.internal port=5433 dbname=fantasy_fpl user=fpl_admin sslmode=require"
```

#### Cách B (chỉ khi bất khả kháng) — mở tạm thời, **time-box < 15 phút**

```bash
# 1) Lấy IP công cộng của bạn
MY_IP=$(curl -s https://checkip.amazonaws.com) && echo "$MY_IP/32"

# 2) Tạm cho phép đúng IP đó (chỉ /32, KHÔNG bao giờ 0.0.0.0/0)
aws ec2 authorize-security-group-ingress --region ap-southeast-1 \
  --group-id "$SG_ID" --protocol tcp --port 5432 --cidr "$MY_IP/32"

# 3) Bật public access tạm thời (RDS apply ~ vài phút)
cd infra/aws && terraform apply -var="publicly_accessible=true" -auto-approve

# 4) Kiểm tra kết nối
psql "host=<db_host> port=5432 dbname=fantasy_fpl user=fpl_admin sslmode=require" \
  -c 'SELECT current_user, version();'

# 5) 🔴 HOÀN NGUYÊN NGAY: tắt public + thu hồi rule
terraform apply -var="publicly_accessible=false" -auto-approve
aws ec2 revoke-security-group-ingress --region ap-southeast-1 \
  --group-id "$SG_ID" --protocol tcp --port 5432 --cidr "$MY_IP/32"

# 6) Xác nhận đã đóng: kỳ vọng IpPermissions = []
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions' --output json
```

> ⚠️ Cách B tạo **cửa sổ rủi ro thật** trên Internet. Chỉ dùng khi Cách A không khả thi, làm liên tục 1 mạch và **bắt buộc** chạy lại bước 5–6. Ghi lại thời điểm mở/đóng vào báo cáo.

---

## 🔌 9. KẾT NỐI TỪ BACKEND (bàn giao cho `P2-NH01`)

Task này **chỉ tạo hạ tầng + tài liệu**; việc đổi `DATABASE_URL` trong `backend/app/core/config.py` thuộc quyền **Nhất (`P2-NH01`)**. Quang bàn giao:

1. `DATABASE_URL` mẫu (mục 7.1) — Nhất chỉ cần thay `<DB_PASSWORD>` bằng secret từ password manager / GitHub Secret.
2. **Điều kiện mạng:** backend local (Docker trên laptop) **chưa** nối được RDS cho tới khi:
   - `P2-Q02` mở rule 5432 cho IP dev / SG backend, **và**
   - có đường mạng vào VPC (SSM tunnel ở mục 8.3, hoặc deploy backend vào App Runner/EC2 cùng VPC ở Phase 3).
3. **Pool size trên `db.t4g.micro` (1 GB RAM):** tối đa ~**8–10 kết nối** đồng thời → đã giao `P2-V02` tinh chỉnh `pool_size=5`, `max_overflow=5`, `pool_pre_ping=True`, `pool_recycle=1800`.

---

## 🩺 10. TROUBLESHOOTING

| Triệu chứng | Nguyên nhân | Cách xử lý |
| :--- | :--- | :--- |
| `Cannot find version 15.x for postgres` | Minor version đã bị thay bằng bản mới hơn | Giữ `engine_version = "15"` (default). Xem bản có sẵn: `aws rds describe-db-engine-versions --engine postgres --query "DBEngineVersions[?contains(EngineVersion,'15')].EngineVersion" --region ap-southeast-1` |
| `DBSubnetGroupDoesNotCoverEnoughAZs` | Default VPC bị xoá hoặc còn < 2 subnet | Kiểm tra `aws ec2 describe-subnets --filters Name=vpc-id,Values=<vpc-id>`; nếu account không còn default VPC → tạo subnet group trỏ 2 private subnet và ghi chú lại trong báo cáo |
| `psql: could not connect ... Connection timed out` | Chưa có ingress rule (`P2-Q02` chưa xong) hoặc sai đường mạng | **Đây là hành vi đúng theo thiết kế** (deny-all). Dùng Cách A mục 8.3 |
| `FATAL: no pg_hba.conf entry ... SSL off` | `rds.force_ssl = 1` chặn client không TLS | Thêm `sslmode=require` (psql) hoặc `?ssl=require` (asyncpg) |
| `password authentication failed for user "fpl_admin"` | Mật khẩu không khớp `TF_VAR_db_password` | Lấy lại từ password manager; nếu mất hẳn: `aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db --master-user-password '<new>' --apply-immediately` |
| Terraform báo lỗi vượt hạn mức / `FreeTierRestriction` | Đã có instance Free Tier khác đang chạy | Free Tier chỉ cho **1** instance: xoá instance cũ trước khi tạo mới |
| `Storage-full` | Đã chạm 20 GB (gần như không xảy ra với dữ liệu FPL ~650 cầu thủ) | `SELECT pg_size_pretty(pg_database_size('fantasy_fpl'));` → dọn bảng log/`shared_lineups` cũ. **KHÔNG** tăng storage (vượt Free Tier) |
| Instance restart ngoài ý muốn | Maintenance window `sun:19:00-sun:19:30` (UTC) | Bình thường; đổi window nếu trùng lúc demo |
| `terraform destroy` báo `deletion_protection` | Ai đó đã bật `true` | `aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db --no-deletion-protection --apply-immediately` rồi destroy lại |

---

## 🧹 11. DỌN DẸP (DESTROY) — BẮT BUỘC TRƯỚC KHI KẾT THÚC HỌC KỲ

```bash
cd infra/aws

# 1) Xem trước những gì sẽ bị xoá
terraform plan -destroy

# 2) Xoá toàn bộ (RDS + SG + subnet group + parameter group). Mất 5–10 phút.
terraform destroy

# 3) Xác nhận không còn instance/snapshot sót lại (kỳ vọng: mảng rỗng [])
aws rds describe-db-instances --region ap-southeast-1 --query 'DBInstances[].DBInstanceIdentifier'
aws rds describe-db-snapshots --region ap-southeast-1 --snapshot-type manual --query 'DBSnapshots[].DBSnapshotIdentifier'

# 4) Kiểm tra hoá đơn cuối cùng (mục Billing → Cost Explorer, lọc service = RDS)
```

> 💡 Vì `skip_final_snapshot = true`, bước 3 phải trả về **không có snapshot**. Nếu có snapshot thủ công sót lại → `aws rds delete-db-snapshot --db-snapshot-identifier <id>`.

**Chế độ "tạm nghỉ" (tiết kiệm giờ Free Tier mà vẫn giữ dữ liệu):**

```bash
aws rds stop-db-instance --db-instance-identifier fpl-fantasy-db --region ap-southeast-1
# AWS tự start lại sau 7 ngày -> phải stop lại, hoặc destroy hẳn nếu không dùng nữa.
```


---

## 🧭 12. RANH GIỚI TASK & BÀN GIAO (SCOPE BOUNDARY)

| Nội dung | Task sở hữu | Trạng thái sau `P2-Q01` |
| :--- | :--- | :--- |
| Tạo RDS PostgreSQL 15 (`db.t4g.micro`, 20 GB gp3, Single-AZ) | **P2-Q01** ✅ | Xong (IaC + runbook) |
| Tài liệu thông số kết nối an toàn | **P2-Q01** ✅ | Mục 7 |
| Rule ingress 5432 least-privilege (dev IP + backend SG) | `P2-Q02` | **Chưa làm** (SG đang deny-all — cố ý) |
| AWS Budgets Alert $1.00 | `P2-Q03` | **Chưa làm** — khuyến nghị chạy trước `apply` |
| S3 static hosting | `P2-Q04` | Không thuộc task này |
| Đổi `DATABASE_URL` trong backend | `P2-NH01` (Nhất) | Không thuộc task này (chỉ bàn giao mẫu URL) |
| Alembic migration lên RDS | `P2-V01` (Vũ) | Không thuộc task này |
| Tinh chỉnh connection pool | `P2-V02` (Vũ) | Không thuộc task này (đã nêu khuyến nghị) |

> 📌 **Ghi chú thiết kế:** `terraform_rds.tf` **cố tình** chỉ tạo "vỏ" Security Group không có ingress rule. Điều này đảm bảo nguyên tắc *strict scope boundary* của `AI_GUIDELINES.md` (không lấn sân `P2-Q02`) **đồng thời** khiến việc mở `0.0.0.0/0` trở thành bất khả thi về mặt cấu trúc.

---

## ✅ 13. CHECKLIST NGHIỆM THU (ACCEPTANCE CRITERIA)

### 13.1. Tiêu chí bắt buộc của task

- [ ] **AC-1:** Instance `fpl-fantasy-db` ở trạng thái **`Available`** trên RDS Console (region `ap-southeast-1`).
      *Bằng chứng:* screenshot Console + output `aws rds describe-db-instances` (mục 8.1, 8.2).
- [ ] **AC-2:** Cấu hình đúng Free Tier: `db.t4g.micro` · **20 GiB gp3** · `Multi-AZ = No` · `MaxAllocatedStorage = 0` · `BackupRetention = 1`.
      *Bằng chứng:* bảng output CLI mục 8.2.
- [ ] **AC-3:** Kết nối thành công bằng `psql` (TLS bật).
      *Bằng chứng:* output `\conninfo` có dòng `SSL connection` (mục 8.3).
- [ ] **AC-4:** Không có ingress rule `0.0.0.0/0` trên SG của DB (`IpPermissions = []` trước khi `P2-Q02`).
      *Bằng chứng:* output `aws ec2 describe-security-groups` (mục 8.2).
- [ ] **AC-5:** Tài liệu thông số kết nối **không chứa mật khẩu thật**; mật khẩu chỉ nằm trong password manager + biến môi trường.

### 13.2. Checklist riêng của Quang (DevOps Guardian) — trước khi kết thúc ngày

- [ ] `P2-Q03` (Budgets Alert **$1.00**) đã **ACTIVE** và đã nhận email xác nhận SNS.
- [ ] Billing → **Free Tier** hiển thị RDS usage **< 100 %** (750 h, 20 GB).
- [ ] `.gitignore` đã có block Terraform (mục 7.3) — *làm ở commit kế tiếp*.
- [ ] Không commit `terraform.tfstate`, `*.tfplan`, `*.tfvars`.
- [ ] Nếu **không** dùng DB trong ≥ 1 tuần → chạy `stop-db-instance` hoặc `terraform destroy` (mục 11).
- [ ] Đã thêm dòng RDS vào báo cáo kiến trúc Phase 3 (`P3-Q04`).

### 13.3. Lệnh kiểm tra nhanh "tất cả trong một"

```bash
# 0) Đúng tài khoản?
aws sts get-caller-identity

# 1) Trạng thái + Free Tier shape
aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db --region ap-southeast-1 \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Class:DBInstanceClass,Engine:EngineVersion,GB:AllocatedStorage,Type:StorageType,MaxAuto:MaxAllocatedStorage,MultiAZ:MultiAZ,Public:PubliclyAccessible}' \
  --output table

# 2) Không có cửa vào từ Internet
SG_ID=$(aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text --region ap-southeast-1)
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions' --output json

# 3) Terraform không còn drift
cd infra/aws && terraform plan -detailed-exitcode   # exit 0 = không có thay đổi
```

---

## 📚 PHỤ LỤC — LIÊN KẾT NHANH

| Tài nguyên | Đường dẫn |
| :--- | :--- |
| IaC của task này | [`infra/aws/terraform_rds.tf`](terraform_rds.tf) |
| Hợp đồng dữ liệu / schema | [`docs/PROJECT_SSOT.md`](../../docs/PROJECT_SSOT.md) |
| Trạng thái task | [`docs/TODO.md`](../../docs/TODO.md) — mục **P2-Q01** |
| Hướng dẫn local | [`LOCAL_SETUP_GUIDE.md`](../../LOCAL_SETUP_GUIDE.md) |
| Docker Compose local | [`infra/docker-compose.yml`](../docker-compose.yml) |
| AWS RDS PostgreSQL Free Tier | <https://aws.amazon.com/rds/free/> |
| AWS Free Tier (account plans) | <https://aws.amazon.com/free/> |

---

> ✍️ **Ghi chú bảo trì:** mọi thay đổi về `instance_class`, `allocated_storage`, `multi_az`, `publicly_accessible` đều là **thay đổi Level 4** → phải qua review của Tech Lead và cập nhật lại tài liệu này cùng lúc.

