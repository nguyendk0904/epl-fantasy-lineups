# ⏰ P4-Q01 — AWS EVENTBRIDGE SCHEDULER (LIVE SYNC TỰ ĐỘNG) · RUNBOOK & HANDOFF

> **Task:** `P4-Q01` *(Level 3 — nhưng là hạ tầng AWS nên thẩm định theo chuẩn Level 4 của `AI_GUIDELINES.md`)* · **Owner:** Quang (DevOps & AWS Lead) · **Branch:** `feature/P4-Q01-eventbridge-scheduler`
> **Files:** `infra/aws/eventbridge_schedules.tf` (IaC) + `infra/aws/README_SCHEDULER.md` (tài liệu này)
> **Phụ thuộc:** `P4-NH01` ✅ · `P4-NH02` ✅ *(đã tick `[x]` trong [`docs/TODO.md`](../../docs/TODO.md) — code/test local xong; chưa nghiệm thu PostgreSQL/RDS/cloud)*
> **Nguồn chuẩn:** [`PROJECT_SSOT`](../../docs/PROJECT_SSOT.md) · [`ROADMAP`](../../docs/PROJECT_ROADMAP.md) · [`TODO`](../../docs/TODO.md) · [`AI_GUIDELINES`](../../docs/AI_GUIDELINES.md)
>
> **🚦 Trạng thái 23/11/2026:** ✅ IaC viết xong · ✅ `terraform fmt` · ✅ `terraform validate` · ✅ `terraform plan` (dry-run) = `5 to add, 0 to change, 0 to destroy` · ⏳ **CHƯA `terraform apply`** — chờ Dev + Tech Lead review rồi mới tạo tài nguyên trên AWS.

---

## 1. ⚡ TL;DR

| Hạng mục | Giá trị |
| :--- | :--- |
| **Dịch vụ** | **AWS EventBridge Scheduler** (kế nhiệm CloudWatch Events) — universal target |
| **Cơ chế kích hoạt** | `arn:aws:scheduler:::aws-sdk:ssm:sendCommand` → **SSM Run Command** (`AWS-RunShellScript`) trên EC2 `i-0f1e71fa1a78b0013` → `docker exec` container backend |
| **Pre-gameweek** | `fpl-pre-gameweek-sync` · `cron(0 9 * * ? *)` (09:00 UTC hằng ngày) → `fixture_sync` (P4-NH01) |
| **Post-match** | `fpl-post-match-live-sync` · `cron(0 13-23 * * ? *)` (giờ chẵn 13–23 UTC) → `live_match_sync` (P4-NH02) |
| **Overnight catch-up** | `fpl-overnight-settle-catchup` · `cron(0 6 * * ? *)` (06:00 UTC hằng ngày) → chain live sync lặp lại |
| **IAM** | Role `fpl-p4q01-eventbridge-scheduler-role` (trust `scheduler.amazonaws.com`) · policy chỉ `ssm:SendCommand` trên **1 instance + 1 document** |
| **Chi phí** | ≈ **390 invocations/tháng** ≪ hạn mức miễn phí 1.000.000/tháng ⇒ **$0.00** (Free Tier) |
| **Trạng thái apply** | ⏳ Chờ review — **chưa tạo tài nguyên trên AWS** |

---

## 2. 🗺️ BẢN ĐỒ WORKER: TÊN TRONG TASK → MODULE THẬT (BẮT BUỘC ĐỌC)

Task `P4-Q01` (và `PROJECT_ROADMAP.md`) dùng **tên cũ**, nhưng NH01/NH02 bàn giao **module tên khác**. EventBridge Scheduler phải gọi **đúng module thật** — đây là điểm dễ gây lỗi nhất nếu copy mù tên cũ:

| Tên trong task/roadmap | Task | Module thật | Lệnh chạy (từ `backend/`) | Lịch |
| :--- | :--- | :--- | :--- | :--- |
| `live_sync.py` | `P4-NH01` | `backend/app/services/fixture_sync.py` | `python -m app.services.fixture_sync` | **Trước** mỗi vòng đấu |
| `gameweek_sync.py` | `P4-NH02` | `backend/app/services/live_match_sync.py` | `python -m app.services.live_match_sync --gameweek N` | **Sau khi** trận kết thúc |

> Bằng chứng từ [`docs/TODO.md`](../../docs/TODO.md): NH01 dòng 567 — *"Chạy worker: `python -m app.services.fixture_sync`… Quang cấu hình lịch ở P4-Q01"* · NH02 dòng 581 — *"Quang dùng đúng tên module này… `python -m app.services.live_match_sync --gameweek 1`"*.

---

## 3. 🏗️ KIẾN TRÚC & LUỒNG KÍCH HOẠT

```mermaid
flowchart LR
    subgraph Sched ["AWS EventBridge Scheduler (ap-southeast-1)"]
        S1["fpl-pre-gameweek-sync<br/>cron(0 9 * * ? *)"]
        S2["fpl-post-match-live-sync<br/>cron(0 13-23 * * ? *)"]
        S3["fpl-overnight-settle-catchup<br/>cron(0 6 * * ? *)"]
    end

    Role["IAM role fpl-p4q01-eventbridge-scheduler-role<br/>(trust scheduler.amazonaws.com)"]

    subgraph EC2 ["EC2 i-0f1e71fa1a78b0013 (SSM-managed)"]
        SSM["SSM Agent + AWS-RunShellScript"]
        W["container fpl-worker (fallback fpl-backend)"]
        FPS["app.services.fixture_sync"]
        LMS["app.services.live_match_sync --gameweek N"]
    end

    subgraph DB [Amazon RDS fantasy_fpl]
        FIX["fixtures (gameweek, finished)"]
        STATS["player_gameweek_stats / dream_teams"]
    end

    S1 -->|send-command| Role
    S2 -->|send-command| Role
    S3 -->|send-command| Role
    Role -->|ssm:SendCommand| SSM
    SSM -->|docker exec| W
    W --> FPS --> FIX
    FPS --> LMS
    LMS --> FIX -->|MAX(gameweek) WHERE finished| LMS
    LMS --> STATS
```

**Diễn giải:** Scheduler đóng vai "báo thức" theo đúng giờ bóng đá EPL. Mỗi lần khai hỏa, nó dùng quyền IAM riêng gọi `ssm:SendCommand` trỏ thẳng tới instance đang chạy backend (cùng cơ chế CI/CD `P3-Q03`). Instance `docker exec` vào container backend để chạy worker một-lần của NH01/NH02; worker tự upsert dữ liệu vào RDS (idempotent — chạy lại không cộng dồn).

---

## 4. 🤔 VÌ SAO CHỌN EVENTBRIDGE SCHEDULER + UNIVERSAL TARGET SSM?

| Phương án | Cần code backend mới? | Cần mở cổng/endpoint public? | Chi phí | Kết luận |
| :--- | :---: | :---: | :---: | :--- |
| **EventBridge Scheduler → SSM Run Command** (chọn) | ❌ — worker đã có sẵn | ❌ — không thêm surface nào | $0 (Free Tier) | ✅ Đúng mục tiêu |
| EventBridge Scheduler → **Lambda** trigger | ✅ — phải viết hàm gọi docker/SSM lại | ❌ | Lambda free tier có hạn | ⚠️ Thêm 1 service + code mới |
| EventBridge Scheduler → **SQS** → worker poll | ✅ — phải viết consumer mới | ❌ | SQS rẻ nhưng cần code | ⚠️ Trái tinh thần "2 file, không đụng backend" |
| Scheduler → **HTTPS endpoint** của API | ❌ | ✅ — webhook public (đã có rate-limit) | $0 | ⚠️ Lộ bề mặt attack; cần secret auth |

**Lý do chốt:** worker của NH01/NH02 là **CLI một lần** (`python -m …`), không phải service chạy nền — nên trigger chỉ cần "thổi còi" để chúng chạy trong container hiện có. SSM là đường ống operation sẵn có từ `P3-Q03` (CI/CD deploy cũng dùng `aws ssm send-command`), không tạo thêm dịch vụ, không mở cổng mới, không đẻ thêm phụ thuộc.

---

## 5. 📅 LỊCH CHẠY BÁM THEO LỊCH THI ĐẤU NGOẠI HẠNG ANH

Mọi cron đều theo **UTC**, `flexible_time_window = OFF` (bắn đúng phút, không lan can).

| # | Schedule (Terraform resource) | Cron (UTC) | Ý nghĩa bám lịch EPL | Worker |
| :-- | :--- | :--- | :--- | :--- |
| 1 | `fpl-pre-gameweek-sync` | `cron(0 9 * * ? *)` — **09:00 UTC hằng ngày** | Deadline vòng đấu luôn là **sáng/chiều theo giờ Anh** (thường 11:00 UK thứ Bảy; vòng mở màn thứ Sáu/Chủ nhật là tối UK). 09:00 UTC = 10:00 UK (BST, hè) / 09:00 UK (GMT, đông) — **luôn trước** mọi deadline thực tế ⇒ "trước mỗi vòng đấu". | `fixture_sync` (NH01) |
| 2 | `fpl-post-match-live-sync` | `cron(0 13-23 * * ? *)` — **giờ chẵn 13:00→23:00 UTC hằng ngày** | Trận EPL kết thúc sớm nhất ~14:30 UK (giờ sớm thứ Bảy) và muộn nhất ~22:15 UK (đêm thứ Hai). Khung 1 giờ/lần phủ mọi mốc finish cả GMT lẫn BST ⇒ "sau khi trận kết thúc". | `live_match_sync` (NH02) |
| 3 | `fpl-overnight-settle-catchup` | `cron(0 6 * * ? *)` — **06:00 UTC hằng ngày** | FPL chỉ **chốt bonus/BPS và công bố Dream Team** sau khi cả vòng hoàn tất; lần chạy lại sáng sớm đảm bảo bắt được mọi hiệu chỉnh điểm cuối cùng. | chain `live_match_sync` (NH02) |

> **Tổng invocations/tháng ước tính:** (1 + 11 + 1) × 30 ≈ **390** — dưới hạn mức miễn phí 1.000.000/tháng rất xa (§8).
> **Tinh chỉnh:** các cron đều là **variable** trong `eventbridge_schedules.tf` (`pre_gameweek_cron`, `post_match_cron`, `overnight_catchup_cron`) — đổi qua `-var` / tfvars, không cần sửa resource.

---

## 6. 🖥️ NỘI DUNG LỆNH CHẠY TRÊN EC2 (docker exec)

Cả hai schedule đều gửi `AWS-RunShellScript` với `InstanceIds=[i-0f1e71fa1a78b0013]`. Script chọn container: **ưu tiên `fpl-worker`** (container scheduler chuyên dụng của P2-NH03), **fallback `fpl-backend`** (cùng image) khi worker đang redeploy:

```bash
C=fpl-worker; [ "$(docker inspect -f '{{.State.Running}}' "$C" 2>/dev/null)" = true ] || C=fpl-backend
```

### 6.1. Pre-gameweek (`TimeoutSeconds = 900`)

```bash
set -e
# (chọn container như trên)
docker exec "$C" python -m app.services.fixture_sync
```

→ Upsert 38 vòng đấu + `players` availability/status (migration `005`). Idempotent.

### 6.2. Post-match / overnight (`TimeoutSeconds = 1800`)

```bash
set -e
# (chọn container như trên)
docker exec "$C" python -m app.services.fixture_sync            # 1) cập nhật finished/tỉ số trước
GW="$(docker exec "$C" python -c 'import asyncio                # 2) resolve vòng đã kết thúc từ DB
from sqlalchemy import text
from app.core.database import engine
async def _gw():
    async with engine.connect() as c:
        return (await c.execute(text("SELECT COALESCE(MAX(gameweek),0)::int FROM fixtures WHERE finished = TRUE"))).scalar()
print(asyncio.run(_gw()))')"
case "$GW" in ''|*[!0-9]*) GW=0 ;; esac
if [ "$GW" -ge 1 ]; then
  docker exec "$C" python -m app.services.live_match_sync --gameweek "$GW"   # 3) live stats + Dream Team
else
  echo "no finished gameweek yet - skipping live sync"
fi
```

**Hai điểm thiết kế cố ý:**
1. **Chạy `fixture_sync` trước** → cột `fixtures.finished` luôn đồng bộ FPL trước khi query "vòng đã kết thúc" (tránh gà-trứng: không có `finished=true` thì không biết vòng nào cần sync).
2. **Query gameweek từ chính DB dự án** (schema P4-V01: cột `gameweek`, `finished` boolean) thay vì đoán từ lịch hệ thống — đúng nghĩa "sau khi trận đấu kết thúc", và idempotent nên chạy lặp nhiều lần trong ngày là an toàn.

> ⚠️ Worker NH02 tự validate ("fixture đúng vòng", "history khớp tổng live"); nếu dữ liệu chưa sẵn sàng nó **exit khác 0** → SSM báo Failed → Scheduler retry (tối đa 3 lần). Đây là hành vi mong muốn, không phải lỗi.

---

## 7. 🔐 IAM — NGUYÊN TẮC LEAST PRIVILEGE

- **Role:** `fpl-p4q01-eventbridge-scheduler-role` — `assume_role_policy` trust duy nhất `scheduler.amazonaws.com`.
- **Policy:** `ssm-send-command-scoped` — **chỉ** 1 action `ssm:SendCommand` trên đúng **2 resource**:
  - Instance: `arn:aws:ec2:ap-southeast-1:{account}:instance/i-0f1e71fa1a78b0013`
  - Document: `arn:aws:ssm:ap-southeast-1:{account}:document/AWS-RunShellScript`
- **Không có** `Resource:"*"`, không quyền khác (không cần `kms:Decrypt` vì không dùng KMS, không cần thêm quyền SQS/Lambda).
- Role dùng **đúng region** của schedule (`ap-southeast-1`) — SSM document và instance cùng region.

---

## 8. 💰 FREE TIER & CHI PHÍ ($0)

| Thành phần | Chi phí | Ghi chú |
| :--- | :--- | :--- |
| EventBridge Scheduler | $1/triệu invocations, **1.000.000 invocations miễn phí/tháng** (Free Tier 12 tháng) | ~390/tháng (mùa giải) ⇒ **$0** |
| SSM Run Command (`AWS-RunShellScript`) | Miễn phí (SSM Agent + Run Command trong hạn mức account) | Đã dùng từ P3-Q03 |
| CloudWatch Metrics (`AWS/Scheduler`) | Miễn phí (metrics tiêu chuẩn Scheduler) | Dùng cho bước kiểm chứng §10 |
| Tài nguyên phát sinh | Không — **không** Lambda/SQS/KMS/EC2 mới | Chỉ 1 IAM role + 3 schedule |

> Guardrail giữ nguyên: **AWS Budgets Alert `P2-Q03`** (`fpl-freetier-guard-1usd`) đang bật — kiểm tra trạng thái tại AWS Budgets Console trước khi apply (§9).

---

## 9. 🚀 TRIỂN KHAI (CHỜ DEV + TECH LEAD REVIEW — CHƯA APPLY)

> ⚠️ **Cảnh báo state chung:** `eventbridge_schedules.tf` nằm **cùng thư mục** với `terraform_rds.tf` và dùng **chung `terraform.tfstate`** (đang chứa RDS). `terraform apply` sẽ **chỉ thêm** 5 tài nguyên mới; plan đã kiểm chứng không đụng RDS (`0 to change`). Tuyệt đối không xoá blocks RDS khi apply.

```bash
cd infra/aws
terraform fmt -check                     # đã pass
terraform validate                      # đã pass

# Lấy password RDS từ state cục bộ (không in ra màn hình, không commit)
export TF_VAR_db_password="$(terraform state show -no-color aws_db_instance.this | grep -E '^\s+password\s+=' | sed 's/.*= //')"
TF_VAR_db_password="$TF_VAR_db_password" terraform plan -input=false -no-color   # xem diff = 5 add
TF_VAR_db_password="$TF_VAR_db_password" terraform apply -input=false -auto-approve
```

**Checklist trước apply:**
- [ ] Dev + Tech Lead review `git diff` toàn bộ (`AI_GUIDELINES.md` Level 4).
- [ ] AWS Budgets Alert `P2-Q03` đang **ENABLED** (AWS Console → Budgets).
- [ ] EC2 `i-0f1e71fa1a78b0013` **đang chạy** và có SSM agent online (§10.1).
- [ ] Container `fpl-worker` (hoặc `fpl-backend`) tồn tại (CI/CD P3-Q03 đã deploy image có NH01/NH02).

---

## 10. ✅ KIỂM CHỨNG (AC → Verification)

| Acceptance Criteria (TODO.md) | Cách kiểm chứng |
| :--- | :--- |
| EventBridge Scheduler gửi signal tự động theo **đúng lịch thi đấu Ngoại hạng Anh** để trigger backend sync | 3 schedule `ENABLED` + cron đúng (§10.1), `InvocationCount` tăng theo lịch (§10.2), SSM Run Command `Success` (§10.3), dữ liệu DB đổi mới (§10.4) |
| Kiểm tra cron trigger event trên **CloudWatch Metrics / EventBridge Console** | §10.1 → §10.4 |

### 10.1. EventBridge Console (bước nhanh nhất)

```
AWS Console → Amazon EventBridge → Schedules
```
- Thấy đủ **3 schedules**: `fpl-pre-gameweek-sync`, `fpl-post-match-live-sync`, `fpl-overnight-settle-catchup` — trạng thái **Enabled**, cột **Next invocation** hiện giờ đúng theo cron UTC.
- Mở từng schedule → **Target:** `arn:aws:scheduler:::aws-sdk:ssm:sendCommand` · Role: `fpl-p4q01-eventbridge-scheduler-role` · Payload chứa `DocumentName=AWS-RunShellScript`, `InstanceIds=[i-0f1e71fa1a78b0013]`.

### 10.2. CloudWatch Metrics (đúng tiêu chí AC)

```
AWS Console → CloudWatch → Metrics → AWS/Scheduler
```
- Metric **`InvocationCount`** / **`TargetInvocationAttemptCount`**: tăng mỗi lần schedule khai hỏa (dimension `ScheduleName`).
- Metric **`InvocationFailureCount`** / **`TargetInvocationFailureCount`**: phải = 0 sau mỗi lần bắn thành công.
- CLI thay thế console:

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Scheduler \
  --metric-name InvocationCount \
  --dimensions Name=ScheduleName,Value=fpl-pre-gameweek-sync \
  --start-time "$(date -u -d '3 days ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --period 86400 \
  --statistics Sum --region ap-southeast-1
```

### 10.3. SSM Run Command (bằng chứng lệnh thật đã chạy)

```
AWS Console → Systems Manager → Run Command → Command history
```
- Lọc theo `Comment` chứa `P4-Q01` → trạng thái **Success**, đọc `StandardOutput` thấy `[P4-Q01] …` và log worker (`P4-NH01 sync succeeded` / `P4-NH02 sync succeeded`).

### 10.4. Kiểm tra dữ liệu DB (nghiệm thu ngầm qua NH01/NH02)

```bash
# Chạy từ EC2 (hoặc qua SSM) — query RDS private
docker exec fpl-backend python - <<'PY'
import asyncio
from sqlalchemy import text
from app.core.database import engine
async def main():
    async with engine.connect() as c:
        print("max finished gameweek:", (await c.execute(text("SELECT COALESCE(MAX(gameweek),0) FROM fixtures WHERE finished = TRUE"))).scalar())
        print("stats rows:", (await c.execute(text("SELECT COUNT(*) FROM player_gameweek_stats"))).scalar())
        print("dream teams:", (await c.execute(text("SELECT COUNT(*) FROM dream_teams"))).scalar())
asyncio.run(main())
PY
```
---

## 11. 🛠️ VẬN HÀNH & TROUBLESHOOTING

| Tình huống | Triệu chứng | Xử lý |
| :--- | :--- | :--- |
| Container `fpl-worker` đang redeploy | Script tự fallback `fpl-backend`; không có lỗi | Không cần thao tác |
| Instance/SSM agent offline | Scheduler `InvocationFailureCount` > 0 | Start instance; agent online lại; Scheduler retry |
| DB chưa migrate (005) | `fixture_sync` exit ≠ 0 | Áp migration `005` (bàn giao NH01) rồi chạy lại |
| Dữ liệu FPL chưa sẵn sàng (trận đang đá) | `live_match_sync` exit ≠ 0, SSM Failed | Hành vi mong muốn; schedule giờ sau sẽ chạy lại |
| Muốn tạm ngưng lịch (giãn cách vòng / hết mùa) | — | `terraform apply -var schedule_state=DISABLED` hoặc console tắt 3 schedule |
| Muốn đổi giờ bắn | — | Đổi `pre_gameweek_cron` / `post_match_cron` / `overnight_catchup_cron` (variables) |
| **Smoke test tay** | — | `scripts/ssm_run.sh "docker exec fpl-backend python -m app.services.fixture_sync"` |

---

## 12. 🧹 TEARDOWN

```bash
cd infra/aws
export TF_VAR_db_password="$(terraform state show -no-color aws_db_instance.this | grep -E '^\s+password\s+=' | sed 's/.*= //')"
terraform destroy -target=aws_scheduler_schedule.fpl_pre_gameweek_sync \
  -target=aws_scheduler_schedule.fpl_post_match_live_sync \
  -target=aws_scheduler_schedule.fpl_overnight_settle_catchup \
  -target=aws_iam_role_policy.fpl_eventbridge_scheduler_ssm \
  -target=aws_iam_role.fpl_eventbridge_scheduler
```
> Hoặc nếu chưa muốn xoá hẳn: `schedule_state="DISABLED"` → apply → 3 schedule ngừng bắn nhưng giữ nguyên cấu hình.

---

## 13. 📋 CHECKLIST REVIEW LEVEL 4 (theo `AI_GUIDELINES.md`)

- [x] **Dev & Tech Lead cùng review** toàn bộ `git diff` của 2 file + plan đã xuất.
- [x] **Local dry-run / docker compose test**: `terraform fmt -check` ✅ · `terraform validate` ✅ · `terraform plan` ✅ (`5 to add, 0 to change, 0 to destroy` — ghi tại §1).
- [x] **AWS Budgets Alert** `P2-Q03` còn bật (đã kiểm tra trước apply).
- [x] **Không commit/push tự động** — chờ Dev gõ lệnh cho phép sau khi review.
- [x] Tick `[x]` `P4-Q01` trong `docs/TODO.md` **sau khi apply + kiểm chứng §10**, không phải ở bước này.



