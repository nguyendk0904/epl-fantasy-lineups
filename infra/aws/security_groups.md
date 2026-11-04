# 🛡️ P2-Q02 — RDS SECURITY GROUP LEAST-PRIVILEGE (PORT 5432)

> **Task:** `P2-Q02` *(Level 4 — Critical)* · **Owner:** Quang (DevOps) · **Branch:** `feature/P2-Q02-rds-security-group`
> **Files:** `infra/aws/security_groups.md` (runbook này) + `infra/aws/rds_sg_policy.json` (payload least-privilege = nguồn sự thật máy đọc được)
> **Nguồn chuẩn:** [`PROJECT_SSOT`](../../docs/PROJECT_SSOT.md) · [`TODO`](../../docs/TODO.md) · [`AI_GUIDELINES`](../../docs/AI_GUIDELINES.md) · [`rds_setup.md`](rds_setup.md) (P2-Q01)
>
> **Mục tiêu:** PostgreSQL `5432` của `fpl-fantasy-db` chỉ mở cho **IP `/32` của nhóm dev** và **SG của Backend**. **Không tồn tại `0.0.0.0/0` hay `::/0`** — IP lạ bị **DROP tại SG**, client chỉ thấy `Connection timed out`.
>
> 🚦 **Trạng thái `04/11/2026`:** ✅ đúng **1 rule** `tcp/5432` → `14.191.166.167/32` (không `0.0.0.0/0`) · ✅ DB **private** (`PubliclyAccessible=false`, PG `15.17`) · ✅ TLS `psql` OK + **`P2-NH01` PASS 100 %** (allow-path) · 🟡 `AC-5` chưa đóng (cần quét từ mạng **khác ISP** + baseline) · 🔴 `AC-7` codify IaC chờ PR riêng.

**Mục lục:** [1 Quyết định](#1-quyết-định-kỹ-thuật) · [2 Mô hình 3 lớp](#2-mô-hình-phòng-thủ-3-lớp) · [3 Ma trận rule](#3-ma-trận-rule) · [4 Policy + lint](#4-policy-json--lint) · [5 Triển khai](#5-triển-khai-idempotent) · [6 Kiểm chứng](#6-kiểm-chứng) · [7 AC-5 từ IP lạ](#7-chứng-minh-ac-5-từ-ip-lạ) · [8 Troubleshooting](#8-troubleshooting) · [9 Rollback](#9-rollback--thu-hồi) · [10 Routine](#10-vận-hành-định-kỳ-mỗi-tuần--trước-demo) · [11 Ranh giới](#11-ranh-giới--bàn-giao) · [12 Checklist AC](#12-checklist-nghiệm-thu)

---

## 1. QUYẾT ĐỊNH KỸ THUẬT

| Hạng mục | Giá trị / quyết định | Lý do |
| :--- | :--- | :--- |
| Security Group | `fpl-fantasy-db-sg` = **`sg-0f5970a2c3b47878a`** · VPC `vpc-0019d7f1ffff26509` (Terraform `P2-Q01` tạo) | Không có SG thứ 2 ⇒ không có "cửa phụ" khi audit |
| Ingress | **Chỉ `tcp/5432`**: 1 rule `/32` của dev (`sgr-0c31c847d0cf552c5`) + 1 rule **Backend SG** (deferred `P3-Q02`) | Đúng AC "chỉ IP dev và backend" |
| Nguồn IP | **`/32`** (1 host) — **không** `/24`, `/16`, dải ISP | `/24` = 254 người lạ vào được DB |
| `0.0.0.0/0`, `::/0`, `protocol=-1` | **BỊ CẤM** (guard trong JSON + lint FAIL) | Bot quét 5432 24/7; mở public = bị brute-force trong vài phút |
| Egress | **Deny all** (`127.0.0.1/32`, kế thừa `P2-Q01`) | RDS không chủ động gọi ra ngoài ⇒ chặn data-exfiltration |
| Stateful | Gói phản hồi của kết nối inbound **tự động được phép** | Egress deny-all **không** làm hỏng `psql` |
| L1 / L3 | `publicly_accessible=false` + `rds.force_ssl=1` | Internet không có route tới DB; client buộc TLS |
| Chi phí | **$0.00** (SG miễn phí) | Budget `fpl-freetier-guard-1usd` ($1.00) vẫn canh |
| Chống lệch | Lint **18 test** trước mỗi lần apply + audit tuần (§10) | Cấu hình chỉ đúng khi được **kiểm tra lại tự động** |

## 2. MÔ HÌNH PHÒNG THỦ 3 LỚP

```text
IP la Internet ──────▶ L1 publicly_accessible = false ──▶ khong co route  (timeout)
Dev IP /32, Backend SG ─▶ L2 SG: chi tcp/5432, khong 0.0.0.0/0 ──▶ cho phep
                        └▶ L3 rds.force_ssl = 1 ──▶ tu choi client khong TLS
```

- **Vì sao cần cả 3?** L1 làm DB vô hình trước Internet; L2 là lớp **chặn thật** khi phải tạm bật public (dev `psql`, migration `P2-V01`); L3 bảo vệ dữ liệu trên đường truyền.
- **`timeout` ≠ `refused`:** SG **DROP** im lặng ⇒ `timeout`. `refused` = có máy sống nhưng port đóng.

---

## 3. MA TRẬN RULE

**Được phép**

| # | Direction | Proto | Port | Source | Description (audit trail) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R1 | Ingress | tcp | 5432 | `14.191.166.167/32` | `P2-Q02 dev-01 Quang fixed IP (verified 2026-11-02 ...)` | **ENABLED** (`sgr-0c31c847d0cf552c5`) |
| R2 | Ingress | tcp | 5432 | mỗi thành viên **1 rule `/32`** (trần `MaxIngressRules = 5`) | `P2-Q02 dev-0x ...` | chưa khai báo |
| R3 | Ingress | tcp | 5432 | `sg-BACKEND_SG_ID_PLACEHOLDER` (Backend SG) | `Backend API SG - P3-Q02` | **DEFERRED** |
| R4 | Egress | -1 | all | `127.0.0.1/32` | `Deny all egress - RDS chi tra loi inbound` | **ENABLED** |

**BỊ CẤM** — lint FAIL nếu ai thêm: `0.0.0.0/0` · `::/0` · `protocol=-1` (all traffic) · CIDR rộng hơn `/32` (`/16`, `/24`, dải ISP) · nguồn là SG mở `sg-0cc107941e7bebe43` (`launch-wizard-1`, đang mở SSH `0.0.0.0/0`) · port khác `5432` (22/3306/6379…).

> ⚠️ **IP nhà mạng là động.** Mỗi lần đổi IP: sửa `AuthorizeIngress.IpRanges[0].CidrIp` **và** `VerifiedRuntimeState.DevCidrs` (lint **TC-14** chặn nếu lệch) → lint → §5.4 → revoke IP cũ (§9).
> ⚠️ **Không** dùng `203.0.113.x` (RFC 5737) trong rule thật — SG sẽ fail-closed và rất khó chẩn đoán.

## 4. POLICY JSON + LINT

`rds_sg_policy.json` là **nguồn sự thật**: rule được review trong `git diff` trước khi chạy, và lint đọc **đúng file sắp apply**.

| Khoá | Vai trò |
| :--- | :--- |
| `Metadata` | task, account `711695043505`, region, threat model, ngày review |
| `TargetSecurityGroup` | tên SG + **cách resolve GroupId** lúc runtime (không hardcode) |
| `VerifiedRuntimeState` | ảnh chụp **thật** 04/11: SG id, VPC, PG `15.17`, `PubliclyAccessible=false`, TLS, rule id, IP dev, cửa sổ public |
| `AuthorizeIngress` / `AuthorizeEgress` | payload đúng shape AWS `IpPermission` (`IpRanges[].CidrIp` + `.Description`); egress `[]` |
| `AuthorizeIngressDeferred` | rule Backend SG, `ApplyWhen: P3-Q02` — apply sớm sẽ `InvalidGroup.NotFound` |
| `DriftControl` | drift IaC còn mở + 4 bước cutover + guard chống `apply` với `dev_cidr_blocks = []` |
| `VerificationPlaybook` | cách chứng minh AC-5 **đúng** (baseline `portquiz.net:5432`, bài học ISP lọc 5432) |
| `ComplianceGuards` | luật máy đọc: `ForbiddenCidrs`, `AllowedPorts`, `RequiredHostPrefix = 32`, `MaxIngressRules = 5`… |
| `ForbiddenRuleExamples_DO_NOT_APPLY` | 5 rule mẫu vi phạm → **negative test** của lint |

**Lint (18 test, fail-closed)** — lưu **ngoài repo** (ví dụ `%TEMP%\p2q02_sg_lint.py`), chạy từ thư mục gốc repo:

```python
"""P2-Q02 - RDS Security Group policy compliance lint (fail-closed audit)."""
import json
import re
import sys

POLICY = "infra/aws/rds_sg_policy.json"
results = []

# Exact key surface accepted by AWS IpPermission (CLI/API validation).
AWS_RULE_KEYS = {"IpProtocol", "FromPort", "ToPort", "UserIdGroupPairs",
                 "IpRanges", "Ipv6Ranges", "PrefixListIds"}
AWS_RANGE_KEYS = {"CidrIp", "CidrIpv6", "Description"}
AWS_PAIR_KEYS = {"GroupId", "GroupName", "UserId", "Description"}


def check(cid, desc, ok, detail=""):
    results.append((cid, desc, bool(ok), detail))


def shape_errors(rule):
    """Return keys AWS would reject (guards against the classic IpRanges mistake)."""
    errors = ["BAD_KEY:%s" % k for k in rule if k not in AWS_RULE_KEYS]
    for key, allowed in (("IpRanges", AWS_RANGE_KEYS), ("Ipv6Ranges", AWS_RANGE_KEYS),
                         ("UserIdGroupPairs", AWS_PAIR_KEYS)):
        for entry in rule.get(key, []):
            errors += ["BAD_KEY:%s.%s" % (key, k) for k in entry if k not in allowed]
    return errors


def violations(rule, guards):
    """Return every guard a single ingress rule breaks (positive + negative tests)."""
    found = []
    if rule.get("IpProtocol") not in guards["AllowedProtocols"]:
        found.append("PROTOCOL")
    if (rule.get("FromPort") not in guards["AllowedPorts"]
            or rule.get("ToPort") not in guards["AllowedPorts"]):
        found.append("PORT")
    described = False
    for key, field, host_prefix in (("IpRanges", "CidrIp", "32"),
                                    ("Ipv6Ranges", "CidrIpv6", "128")):
        for rng in rule.get(key, []):
            cidr = rng.get(field, "")
            described = described or bool(rng.get("Description"))
            if cidr in guards["ForbiddenCidrs"]:
                found.append("FORBIDDEN_CIDR")
            elif cidr.rsplit("/", 1)[-1] != host_prefix:
                found.append("NOT_HOST_ROUTE")
    for pair in rule.get("UserIdGroupPairs", []):
        described = described or bool(pair.get("Description"))
        if pair.get("GroupId") in guards["ForbiddenSourceSecurityGroupIds"]:
            found.append("FORBIDDEN_SOURCE_SG")
    if guards["RequireDescription"] and not described:
        found.append("MISSING_DESCRIPTION")
    return found


with open(POLICY, encoding="utf-8") as fh:
    doc = json.load(fh)

guards = doc["ComplianceGuards"]
live = doc["AuthorizeIngress"]["IpPermissions"]
deferred = doc["AuthorizeIngressDeferred"]["IpPermissions"]
egress = doc["AuthorizeEgress"]["IpPermissions"]
live_cidrs = [rng["CidrIp"] for r in live for rng in r.get("IpRanges", [])]
runtime = doc.get("VerifiedRuntimeState", {})
drift = doc.get("DriftControl", {})
playbook = doc.get("VerificationPlaybook", {})

check("TC-01", "JSON hop le + du khoa bat buoc",
      all(k in doc for k in ("Metadata", "TargetSecurityGroup", "AuthorizeIngress",
                             "AuthorizeIngressDeferred", "AuthorizeEgress", "ComplianceGuards")),
      POLICY)
check("TC-02", "Ingress active nam trong 1..MaxIngressRules",
      1 <= len(live) <= guards["MaxIngressRules"],
      "%d rule / toi da %d" % (len(live), guards["MaxIngressRules"]))

bad = {i: violations(r, guards) for i, r in enumerate(live)}
bad = {i: v for i, v in bad.items() if v}
check("TC-03", "Khong rule active nao vi pham guard (protocol/port/cidr/desc)",
      not bad, "vi pham: %s" % bad if bad else "0 vi pham")
check("TC-04", "Moi nguon CIDR la host route /32 (IPv6 /128)",
      all(c.rsplit("/", 1)[-1] == "32" for c in live_cidrs), ", ".join(live_cidrs))
check("TC-05", "Khong dung SG mo cua lam nguon (launch-wizard-1)",
      not any(p.get("GroupId") in guards["ForbiddenSourceSecurityGroupIds"]
              for r in live for p in r.get("UserIdGroupPairs", [])), "0 tham chieu")
described = [any(rng.get("Description") for rng in r.get("IpRanges", []) + r.get("Ipv6Ranges", []))
             or any(p.get("Description") for p in r.get("UserIdGroupPairs", []))
             for r in live]
check("TC-06", "Moi rule active co Description de audit",
      all(described), "%d/%d" % (sum(described), len(live)))
check("TC-07", "Egress khong mo Internet (khong 0.0.0.0/0, khong ::/0)",
      not any(rng.get(field) in guards["ForbiddenCidrs"]
              for r in egress
              for key, field in (("IpRanges", "CidrIp"), ("Ipv6Ranges", "CidrIpv6"))
              for rng in r.get(key, [])), "%d rule egress" % len(egress))
check("TC-08", "Rule backend SG (deferred) dung tcp/5432 va con placeholder chua apply",
      all(r["IpProtocol"] == "tcp" and r["FromPort"] == 5432 and r["ToPort"] == 5432
          for r in deferred)
      and all("PLACEHOLDER" in p["GroupId"]
              for r in deferred for p in r.get("UserIdGroupPairs", [])),
      deferred[0]["UserIdGroupPairs"][0]["GroupId"])
shape_bad = {i: shape_errors(r) for i, r in enumerate(live + deferred)}
shape_bad = {i: v for i, v in shape_bad.items() if v}
check("TC-09", "Payload dung shape AWS IpPermission (CIDR trong IpRanges/Ipv6Ranges)",
      not shape_bad, "khoa la: %s" % shape_bad if shape_bad else "0 khoa la")

for i, example in enumerate(doc["ForbiddenRuleExamples_DO_NOT_APPLY"], start=1):
    found = violations(example["Rule"], guards)
    check("TC-10.%d" % i, "Negative test: lint bat duoc rule CAM #%d" % i, bool(found),
          ",".join(found))

REQUIRED_RUNTIME_KEYS = ("AsOf", "DbInstanceStatus", "DbEngineVersion", "PubliclyAccessible",
                         "DbPort", "TlsEnforced", "SecurityGroupId", "DevCidrs")
check("TC-11", "VerifiedRuntimeState du khoa: SG id that, DB private, port 5432, TLS bat",
      all(k in runtime for k in REQUIRED_RUNTIME_KEYS)
      and re.fullmatch(r"sg-[0-9a-f]{17}", str(runtime.get("SecurityGroupId", ""))) is not None
      and runtime.get("PubliclyAccessible") is False
      and runtime.get("DbPort") == 5432
      and runtime.get("TlsEnforced") is True,
      "%s / PostgreSQL %s / public=%s" % (runtime.get("SecurityGroupId"),
                                          runtime.get("DbEngineVersion"),
                                          runtime.get("PubliclyAccessible")))
check("TC-12", "DriftControl: dung bien terraform dev_cidr_blocks + co guard chong apply rong",
      drift.get("TerraformVariable") == "dev_cidr_blocks"
      and bool(drift.get("DestructiveApplyGuard"))
      and drift.get("CodifyStatus") in ("iac-ready-pending-cutover", "codified")
      and len(drift.get("CutoverSteps", [])) >= 3,
      drift.get("CodifyStatus"))
check("TC-13", "VerificationPlaybook: co baseline control test + bai hoc ISP loc 5432",
      bool(playbook.get("BaselineControlTest"))
      and bool(playbook.get("IspPort5432FilterLesson"))
      and len(playbook.get("ExternalNetworkOptions", [])) >= 2,
      "%d network options, %d control cmds" % (len(playbook.get("ExternalNetworkOptions", [])),
                                               len(playbook.get("ControlCommands", []))))
check("TC-14", "CIDR active trong policy khop VerifiedRuntimeState.DevCidrs (khong lech IP)",
      sorted(live_cidrs) == sorted(runtime.get("DevCidrs", [])),
      "%s vs %s" % (live_cidrs, runtime.get("DevCidrs")))

width = max(len(r[1]) for r in results)
failed = 0
for cid, desc, ok, detail in results:
    if not ok:
        failed += 1
    print("%s %-9s %-*s %s" % ("[PASS]" if ok else "[FAIL]", cid, width, desc, detail))

print("-" * 100)
print("SUMMARY: %d/%d test cases passed (%.0f%%)" % (
    len(results) - failed, len(results), 100.0 * (len(results) - failed) / len(results)))
sys.exit(1 if failed else 0)
```

```bash
python "$TEMP/p2q02_sg_lint.py"; echo "EXIT_CODE=$?"   # KY VONG: SUMMARY: 18/18 (100%), EXIT_CODE=0
```

`TC-11`–`TC-14` (thêm `04/11`) ràng buộc: runtime state phải khớp `P2-Q01`; `DriftControl` phải còn; `VerificationPlaybook` phải có baseline; **CIDR active phải khớp `DevCidrs`**. 5 test `TC-10.x` chạy lint trên **chính các rule bị cấm** → ai sửa lint cho "dễ pass" sẽ **FAIL ngay**.

---

## 5. TRIỂN KHAI (IDEMPOTENT)

**Điều kiện:** AWS CLI v2 với IAM `quang-devops` · region `ap-southeast-1` · RDS + SG đã tồn tại (`P2-Q01`) · budget `P2-Q03` ACTIVE · Python 3 (cho lint).

```bash
# 5.1 IP hien tai cua may dev (phai la IP tinh)
curl -s https://checkip.amazonaws.com

# 5.2 Resolve SG_ID (fail-fast)
SG_ID=$(aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db \
  --region ap-southeast-1 \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)
echo "SG_ID=$SG_ID"        # KY VONG: sg-0f5970a2c3b47878a

# 5.3 Lint bat buoc (18/18 PASS)
python "$TEMP/p2q02_sg_lint.py" || { echo "STOP: policy khong dat guard"; exit 1; }

# 5.4 Sinh payload tu JSON (khong go tay CIDR) roi apply
PAYLOAD=$(python - <<'PY'
import json, os, tempfile
doc = json.load(open("infra/aws/rds_sg_policy.json", encoding="utf-8"))
path = os.path.join(tempfile.gettempdir(), "rds_sg_ingress.json")
json.dump(doc["AuthorizeIngress"]["IpPermissions"], open(path, "w", encoding="utf-8"), ensure_ascii=False)
print(path.replace("\\", "/"))
PY
)
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --region ap-southeast-1 \
  --ip-permissions "file://$PAYLOAD"

# 5.5 Chay lai y nguyen 5.4 -> idempotent
```

| Output | Nghĩa |
| :--- | :--- |
| `{"Return": true, "SecurityGroupRules": [...]}` | Rule vừa được tạo ✅ |
| `InvalidPermission.Duplicate ... already exists` | Đã đúng desired state ✅ (không phải lỗi) |
| `InvalidGroup.NotFound` | `SG_ID` rỗng/sai → quay lại 5.2 |

> 🧩 **Đúng shape AWS:** CIDR **phải** nằm trong `IpRanges[].CidrIp`, mô tả trong `IpRanges[].Description`. Đặt `"CidrIp"` ở cấp ngoài ⇒ `Unknown parameter ... "CidrIp"` (lint `TC-09` chặn đúng lỗi này).
> 🖱️ **Đối chiếu Console:** EC2 → Security Groups → `fpl-fantasy-db-sg` → Inbound: **chỉ** PostgreSQL `5432`, Source có hậu tố **`/32`**, **không** `Anywhere-IPv4/IPv6`; Outbound: chỉ `All traffic → 127.0.0.1/32`.
> ⏸️ **Backend SG (R3):** Phase 2 **dừng** — chỉ apply sau `P3-Q02`; khi đó backend vào DB **qua tham chiếu SG**, không cần IP public nào.

**Drift IaC (chưa đóng — `rds_setup.md` §10.1).** Rule R1 có thật trên AWS nhưng `terraform_rds.tf` ghi `ingress = []`.
> ⚖️ **Hoà giải 2 nguồn:** `rds_setup.md` §10.1 dự đoán "`apply` kế tiếp sẽ xoá rule"; P2-Q02 **đo thực tế `02/11`** → `plan -detailed-exitcode = 0`, rule **không** bị xoá (TF không quản lý ingress khi không có khối `ingress`). Vì chưa chốt được hành vi cho mọi trường hợp (`destroy`/máy khác/khai báo `ingress` rỗng), coi đây là **rủi ro mở** và xử lý bằng **AC-7 (codify)**, không dựa vào suy đoán.

| Tình huống | Hệ quả |
| :--- | :--- |
| `terraform destroy` + `apply` lại, hoặc máy khác clone repo | SG **rỗng ingress** → DB fail-closed, phải chạy lại 5.4 |
| Thêm khối `ingress` với `dev_cidr_blocks = []` rồi `apply` | TF quản lý tập rule (authoritative) → **revoke hết** |
| `apply` trên máy dev hiện tại (chưa codify) | Đã **đo** `02/11`: `plan -detailed-exitcode` = 0, rule **không** bị xoá |

**AC-7 — codify (PR Level 4 riêng; task này KHÔNG sửa `terraform_rds.tf`):** thêm `dynamic "ingress"` dùng `var.dev_cidr_blocks`, lấy IP từ `jsondecode(file("${path.module}/rds_sg_policy.json"))` để chỉ có **một nguồn sự thật** → revoke rule CLI → `terraform apply -var='dev_cidr_blocks=["14.191.166.167/32"]'` → verify `plan -detailed-exitcode` = 0. ⚠️ Sau đó **không bao giờ** `apply` thiếu `-var` (default `[]` = deny-all).

---

## 6. KIỂM CHỨNG

| Mã | Nội dung | Trạng thái |
| :--- | :--- | :--- |
| **V0** | Policy lint **18/18 PASS** (CIDR/port/proto/desc/shape/runtime/drift/baseline) | ✅ đã chạy (§6.1) |
| **V1** | SG **không có** `0.0.0.0/0` / `::/0` | ✅ `[]` (02/11 và 04/11) |
| **V2** | Rule thực tế = ma trận §3 | ✅ đúng 1 rule `tcp 5432` · `14.191.166.167/32` |
| **V3** | Từ IP dev: 5432 thông + TLS | ✅ `SSLRequest → 'S'` (02/11); `psql`+`\conninfo` + **`P2-NH01` pass 100 %** (04/11) |
| **V4** | Từ IP lạ: `Connection timed out` | 🟡 **một phần** — timeout khi DB private chỉ chứng minh **L1** |
| **V4b** | **Baseline** `portquiz.net:5432` phải **mở** | ⏳ chưa chạy — bước thủ công còn lại (§7) |
| **V5** | Từ chính IP dev: port `5433` phải timeout | ✅ `TimeoutError` |
| **V6** | Lớp SG chặn thật khi `publicly_accessible=true` | ✅ 02/11 (236 s) chỉ `/32`; 04/11 cửa sổ `08:39–10:14` rồi **đóng** |
| **V7** | Drift: `terraform plan -detailed-exitcode` = 0 dù rule ngoài tồn tại | ✅ đã đo — **vẫn là rủi ro mở** (AC-7) |

### 6.1. Output lint thật — `04/11/2026` (rút gọn)

```text
[PASS] TC-01..TC-09  JSON/shape/guard/port/protocol/description/egress/backend-placeholder
[PASS] TC-10.1..10.5 Negative test: lint bat duoc ca 5 rule CAM
[PASS] TC-11 VerifiedRuntimeState: sg-0f5970a2c3b47878a / PostgreSQL 15.17 / public=False
[PASS] TC-12 DriftControl: var dev_cidr_blocks + guard chong apply rong (iac-ready-pending-cutover)
[PASS] TC-13 VerificationPlaybook: baseline control + bai hoc ISP loc 5432
[PASS] TC-14 CIDR active khop DevCidrs: ['14.191.166.167/32'] vs ['14.191.166.167/32']
SUMMARY: 18/18 test cases passed (100%)   EXIT_CODE=0
```

### 6.2. Nhật ký bằng chứng live

| Mốc | Giá trị thật |
| :--- | :--- |
| `02/11` apply | `sgr-0c31c847d0cf552c5` · `tcp 5432` · `14.191.166.167/32`; chạy lại → `InvalidPermission.Duplicate`; cửa sổ public `14:52:06Z → 14:54:30Z` (**236 s**) rồi tắt (`False`) |
| `02/11` allow-path | `5432 → SSLRequest → 'S'`; `5433 → TimeoutError`; `V1 = []` **kể cả** trong cửa sổ public |
| `04/11` re-check | `describe-security-groups`: **1 rule** `/32`, `UserIdGroupPairs: []`, `Ipv6Ranges: []`; `describe-db-instances`: `available` · `15.17` · `PubliclyAccessible=false`; `checkip` = `14.191.166.167` (**khớp rule**) |
| `04/11` allow-path | `psql sslmode=require` + `\conninfo` TLS OK; client không TLS bị từ chối `no encryption`; **`P2-NH01` PASS 100 %** |
| `04/11` cửa sổ public | mở `08:39 → 10:14` (~**95 phút**, dài hơn mốc 30) → đã **đóng**; TCP 5432 từ Internet → timeout |

### 6.3. Lệnh audit nhanh

```bash
aws sts get-caller-identity --query Arn --output text      # ...:user/quang-devops
SG_ID=$(aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db --region ap-southeast-1 \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions[?IpRanges[?CidrIp==`0.0.0.0/0`] || Ipv6Ranges[?CidrIpv6==`::/0`]]' --output json   # KY VONG: []
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions[].IpRanges[].[CidrIp,Description]' --output text
python "$TEMP/p2q02_sg_lint.py"                                                                                              # 18/18
```

---

## 7. CHỨNG MINH AC-5 TỪ IP LẠ

> 🔴 **Đọc trước:** `timeout` một mình **không đủ** kết luận. Có **3 nguyên nhân**: (1) **L1** — DB private ⇒ không có route từ Internet; (2) **ISP lọc 5432** — đã xảy ra thật: RDS public IP `52.221.3.116` bị lọc dù SG whitelist đúng, trong khi `portquiz.net:5432` vẫn OK ⇒ đổi `publicly_accessible` để xin IP mới `54.151.153.247` thì kết nối được ngay; (3) **SG DROP** — điều cần chứng minh.

**Thứ tự bắt buộc (~5 phút, làm 1 lần):**

```bash
# 1. IP nguoi quet phai KHAC 14.191.166.167
curl -s https://checkip.amazonaws.com

# 2. BASELINE: ISP co chan 5432 khong?  (EXIT=0 => khong chan => phep quet moi co nghia)
timeout 15 bash -c 'cat < /dev/null > /dev/tcp/portquiz.net/5432'; echo "EXIT=$?"

# 3. Loai tru L1: mo cua so public tam <= 15 phut + HEN GIO DONG truoc khi test
sleep 900 && aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db \
  --no-publicly-accessible --apply-immediately --region ap-southeast-1 &
aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db \
  --publicly-accessible --apply-immediately --region ap-southeast-1
aws rds wait db-instance-available --db-instance-identifier fpl-fantasy-db --region ap-southeast-1

# 4. Quet tu IP la (ky vong filtered/timeout cho MOI port)
nmap -Pn -p 22,3306,5432,5433,6379 fpl-fantasy-db.cr0maoomq80d.ap-southeast-1.rds.amazonaws.com
#    PowerShell: Test-NetConnection -ComputerName <db_host> -Port 5432 -InformationLevel Detailed

# 5. DONG ngay + xac nhan
aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db --region ap-southeast-1 \
  --query 'DBInstances[0].PubliclyAccessible' --output text     # KY VONG: False
```

| Kết quả | Kết luận |
| :--- | :--- |
| timeout **+** baseline OK **+** DB đang public tạm | ✅ **ĐẠT AC-5** (SG đã DROP gói SYN) |
| timeout **nhưng** baseline cũng fail | ⚠️ **Phép đo vô hiệu** — ISP lọc 5432, phải đổi mạng/cloud runner làm lại |
| timeout khi DB **private** | 🟡 Chỉ chứng minh **L1**, chưa chứng minh L2 |
| `open` / `succeeded` | 🚨 **VI PHẠM** — revoke ngay (§9), báo Tech Lead |

> ⏱️ **Bài học `04/11`:** cửa sổ mở **~95 phút** (`08:39 → 10:14`) vì quên đóng ⇒ luôn đặt hẹn giờ (bước 3) và ghi giờ bật/tắt vào báo cáo.
> 🧭 Nguồn "IP lạ" hợp lệ: hotspot **4G/5G khác ISP**, máy bạn bè/phòng khác, VPS/cloud **không** thuộc VPC, GitHub Actions runner. **Không** dùng chính máy dev (đang trong whitelist).

## 8. TROUBLESHOOTING

| Triệu chứng | Nguyên nhân | Xử lý |
| :--- | :--- | :--- |
| `psql` **timeout** dù rule đúng | IP dev đổi · DB private · **ISP lọc 5432** | `checkip` so với rule; test `portquiz.net:5432`; đổi mạng — **không** mở `0.0.0.0/0` |
| Timeout + DNS ra `172.31.x.x` | DB đang private | Đúng thiết kế → mở cửa sổ tạm (§7) |
| `InvalidPermission.Duplicate` | Rule đã tồn tại y hệt | ✅ Không cần làm gì (idempotent) |
| `InvalidGroup.NotFound` | `SG_ID` rỗng/sai | Quay lại §5.2 |
| `UnauthorizedOperation` | IAM thiếu `ec2:AuthorizeSecurityGroupIngress` | Gắn policy tối thiểu cho `quang-devops` (không dùng root) |
| `Unable to load paramfile file://...` | Đường dẫn Windows sai `\` | Dùng `file://C:/.../Temp/...` (script §5.4 tự đổi `\` → `/`) |
| `no pg_hba.conf entry ... no encryption` | Thiếu TLS (`rds.force_ssl=1`) | `sslmode=require` (psql) / `?ssl=require` (asyncpg) |
| `password authentication failed` | Sai mật khẩu | Lấy từ password manager — **không** ghi vào repo/chat |
| Rule vừa thêm **biến mất** | `terraform destroy`/`apply` lại | Chạy lại §5.4; codify theo AC-7 |
| Lỗi/chậm pool | `db.t4g.micro` chỉ **~8–10** connection (không phải 60–80) | `pool_size`/`max_overflow` + `pool_pre_ping` thuộc **`P2-V02`** — **không** sửa SG |
| `nmap` báo "host seems down" | SG chặn cả ICMP | Dùng `-Pn` |

---

## 9. ROLLBACK / THU HỒI

```bash
# Thu hoi 1 IP (offboarding dev)
aws ec2 revoke-security-group-ingress --group-id "$SG_ID" --region ap-southeast-1 \
  --protocol tcp --port 5432 --cidr "<ip-can-go>/32"

# Thu hoi TOAN BO ingress (ve deny-all cua P2-Q01)
for RULE in $(aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
               --query 'SecurityGroups[0].IpPermissions[].IpRanges[].CidrIp' --output text); do
  aws ec2 revoke-security-group-ingress --group-id "$SG_ID" --region ap-southeast-1 \
    --protocol tcp --port 5432 --cidr "$RULE"
done
```

| Khi nào | Hành động | Thời hạn |
| :--- | :--- | :--- |
| Thành viên rời nhóm / đổi máy | Revoke đúng `/32` của người đó | Ngay |
| IP nhà đổi | Revoke IP cũ **trước**, rồi thêm IP mới (cập nhật cả `DevCidrs`) | Trong ngày |
| Phát hiện `0.0.0.0/0` / `::/0` / IP lạ | Revoke **ngay**, báo Tech Lead, truy CloudTrail `ec2:AuthorizeSecurityGroupIngress` | ≤ 5 phút |
| Kết thúc học kỳ | Revoke sạch + `terraform destroy` (`P2-Q01`) | Trước khi hết kỳ |

> 🛡️ **Fail-safe:** revoke sạch + `publicly_accessible=false` ⇒ DB **không ai vào được**; vẫn truy cập lại được bằng **Console → RDS → Query Editor** hoặc SSM với IAM.

---

## 10. VẬN HÀNH ĐỊNH KỲ (mỗi tuần / trước demo)

```bash
aws sts get-caller-identity --query Arn --output text        # dung account?
aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db --region ap-southeast-1 \
  --query 'DBInstances[0].{Public:PubliclyAccessible,Port:Endpoint.Port,SG:VpcSecurityGroups[0].VpcSecurityGroupId}' --output table
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions[?IpRanges[?CidrIp==`0.0.0.0/0`] || Ipv6Ranges[?CidrIpv6==`::/0`]]' --output json   # KY VONG: []
python "$TEMP/p2q02_sg_lint.py"                                                                                              # 18/18
aws ce get-cost-and-usage --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY --metrics UnblendedCost --region us-east-1 \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' --output text                                                         # 0
```

| Bất thường | Phản ứng |
| :--- | :--- |
| Có `0.0.0.0/0` / `::/0` | 🚨 Revoke ngay (§9), báo Tech Lead, ghi sự cố |
| Danh sách nguồn có IP lạ | Revoke + truy CloudTrail ai đã thêm |
| Lint **FAIL** | Không apply/deploy; sửa policy trước |
| Chi phí > `$0.00` | Đối soát theo `P2-Q03`, báo Quang |

## 11. RANH GIỚI & BÀN GIAO

- **Chỉ 2 file:** `security_groups.md` + `rds_sg_policy.json`. **Không** sửa `terraform_rds.tf` (Level 4 — PR riêng cho AC-7), `rds_setup.md`, hay file của thành viên khác.
- Script lint để **ngoài repo** (`%TEMP%`) → nội dung đầy đủ ở §4 nên vẫn tái lập **100 %**.
- Giới hạn đã biết: `AC-5` cần mạng **khác ISP**; `AC-7` cần PR IaC; `timeout` **không** phải bằng chứng tự thân (§7).

| Nhận bàn giao | Nội dung |
| :--- | :--- |
| **`P3-Q02`** (Backend App Runner) | Điền SG backend vào `AuthorizeIngressDeferred` → apply **R3**; **không** thêm IP public nào vào DB |
| **`P2-NH01`** ✅ · **`P2-V01`/`P2-V02`** (Vũ) | `P2-NH01` pass ⇒ bằng chứng allow-path; `P2-V01` migrate qua cửa sổ tạm (§7); `P2-V02` sở hữu pool (`~8–10` conn) |
| **`P3-Q04`** (báo cáo Cloud) | Chép §1 + §3 + §6 vào phần *"Network security & least privilege"*; SG **$0.00** |

**Cần Tech Lead review (Level 4):** thêm/bớt nguồn ingress (nhất là CIDR rộng hơn `/32`) · `publicly_accessible=true` quá 15 phút · mở port khác `5432` · nới `ComplianceGuards` · codify IaC (AC-7).

---

## 12. CHECKLIST NGHIỆM THU

- [x] **AC-1 — Chỉ port 5432:** `V2` chỉ có `tcp 5432`; port `5433` từ cùng IP → `TimeoutError` (`V5`).
- [x] **AC-2 — Nguồn `/32` cố định:** `sgr-0c31c847d0cf552c5` · `14.191.166.167/32` · có `Description` ghi rõ ai.
- [ ] **AC-3 — Nguồn thứ 2 là Backend SG** (không phải IP public): khung `AuthorizeIngressDeferred` sẵn sàng, **cố ý chưa apply** (chờ `P3-Q02`).
- [x] **AC-4 — Không có `0.0.0.0/0` / `::/0`:** lint `18/18` + `V1 = []` (02/11 và 04/11).
- [ ] **AC-5 — Từ IP lạ bị từ chối ngay:** cần `V4` **kèm `V4b` baseline** `portquiz.net:5432` + cửa sổ public tạm (§7). Hiện chỉ có timeout khi DB private ⇒ **mới chứng minh L1**.
- [x] **AC-6 — Từ IP dev vẫn vào được:** `SSLRequest → 'S'` (02/11); `psql` + `\conninfo` TLS (04/11); **`P2-NH01` pass 100 %**.
- [ ] **AC-7 — Rule được codify vào IaC** (`var.dev_cidr_blocks`): HCL/quy trình sẵn ở §5, chờ **PR Level 4 riêng**.

> **Tổng: 4/7 đóng.** Còn `AC-3` (đúng thiết kế — chờ P3), `AC-5` (thủ công, §7), `AC-7` (PR IaC).
>
> 🚫 **Quy tắc thường trực:** **không bao giờ** thêm `0.0.0.0/0` hoặc `::/0` vào SG của RDS — kể cả "test 5 phút", kể cả khi timeout chưa rõ nguyên nhân. Timeout ⇒ đi theo §7/§8.

---

## PHỤ LỤC

| Tài nguyên | Đường dẫn |
| :--- | :--- |
| Payload least-privilege | [`rds_sg_policy.json`](rds_sg_policy.json) |
| IaC tạo RDS + SG shell | [`terraform_rds.tf`](terraform_rds.tf) |
| Runbook RDS (`P2-Q01`) | [`rds_setup.md`](rds_setup.md) |
| Budget guard (`P2-Q03`) | [`budget_alert_setup.md`](budget_alert_setup.md) |
| Trạng thái task | [`docs/TODO.md`](../../docs/TODO.md) — mục `P2-Q02` |
| AWS docs | VPC security groups · RDS security groups · `authorize-security-group-ingress` |
| RFC 5737 (dải IP tài liệu) | <https://datatracker.ietf.org/doc/html/rfc5737> |

> ✍️ **Bảo trì:** mọi thay đổi **nguồn được phép** (thêm/bớt IP, thêm SG) = **Level 4** → cập nhật **đồng thời** JSON + bảng §3 + `VerifiedRuntimeState`, rồi chạy lint trước khi apply. Không sửa rule trên Console mà quên cập nhật file — audit tuần sau sẽ phát hiện lệch.
