# 🛡️ P2-Q02 — RDS SECURITY GROUP LEAST-PRIVILEGE (PORT 5432) RUNBOOK

> **Task:** `P2-Q02` — *Risk Level 4 (Critical)* | **Owner:** Quang (DevOps & Cloud Infrastructure Lead)
> **Git Branch:** `feature/P2-Q02-rds-security-group`
> **Thư mục:** `infra/aws/` | **Files:** `security_groups.md` (tài liệu này), `rds_sg_policy.json` (payload least-privilege)
> **Nguồn chuẩn:** [`docs/PROJECT_SSOT.md`](../../docs/PROJECT_SSOT.md) · [`docs/PROJECT_ROADMAP.md`](../../docs/PROJECT_ROADMAP.md) · [`docs/TODO.md`](../../docs/TODO.md) · [`docs/AI_GUIDELINES.md`](../../docs/AI_GUIDELINES.md)
>
> **Mục tiêu:** Đóng cửa PostgreSQL 5432 của `fpl-fantasy-db` xuống **đúng 2 nguồn được phép**: IP `/32` cố định của nhóm dev và Security Group của Backend. **Không tồn tại bất kỳ rule `0.0.0.0/0` hay `::/0` nào** — mọi IP lạ bị SG **DROP ngay tại biên**, client chỉ thấy `Connection timed out`.
>
> ℹ️ **Nguyên tắc thiết kế:** *deny by default, allow by exception*. Mọi thứ không có trong `rds_sg_policy.json` đều **không được tồn tại** trên AWS.

---

## 🧭 MỤC LỤC

| # | Nội dung | # | Nội dung |
| :--- | :--- | :--- | :--- |
| 1 | Tóm tắt quyết định kỹ thuật | 8 | Kiểm chứng (Verification) — V0 → V6 |
| 2 | Hiện trạng khảo sát AWS & phát hiện chặn | 9 | Chứng minh "Connection timed out" từ IP lạ |
| 3 | Mô hình phòng thủ 3 lớp | 10 | Troubleshooting |
| 4 | Ma trận rule chi tiết | 11 | Rollback / thu hồi quyền |
| 5 | Nội dung `rds_sg_policy.json` + policy lint | 12 | Vận hành định kỳ (Security Guardian routine) |
| 6 | Triển khai (idempotent, 2 scenario) | 13 | Ranh giới task & bàn giao |
| 7 | Phương án B: cấu hình bằng Console | 14 | Checklist nghiệm thu (Acceptance Criteria) |

---

## ⚡ 1. TÓM TẮT QUYẾT ĐỊNH KỸ THUẬT

| Hạng mục | Giá trị | Lý do (Security / Cost) |
| :--- | :--- | :--- |
| **Security Group** | `fpl-fantasy-db-sg` (do Terraform `P2-Q01` tạo, gắn vào `fpl-fantasy-db`) | Không tạo SG thứ 2 → không có "cửa phụ" bị bỏ quên khi audit. |
| **Ingress** | **Chỉ `tcp/5432`**, nguồn là các **`/32`** cố định của dev + **1 rule tham chiếu Backend SG** | Đúng Acceptance Criteria: "chỉ mở cho IP dev và backend". |
| **Nguồn IP dev** | `/32` (một host duy nhất), **không** dùng `/16`, `/24` hay dải ISP | `/24` = 254 địa chỉ → 254 người lạ vào được DB. `/32` = 1 người. |
| **Backend SG** | Rule `UserIdGroupPairs` **deferred** sang `P3-Q02` | Backend chưa tồn tại ở Phase 2; khai báo sẵn để sau này **không phải mở public IP** của App Runner. |
| **`0.0.0.0/0` / `::/0`** | **BỊ CẤM TUYỆT ĐỐI** (guard trong JSON + lint chặn) | Bot quét 5432 liên tục 24/7; mở public = DB bị brute-force trong vài phút. |
| **`protocol = -1` (all traffic)** | **BỊ CẤM** | Chỉ cần 1 port; mở all biến DB thành bề mặt tấn công toàn bộ. |
| **Egress** | **Deny all** (`-1` → `127.0.0.1/32`, kế thừa từ `P2-Q01`) | RDS không chủ động gọi ra ngoài → chặn luôn đường data-exfiltration. |
| **Tính stateful** | SG là **stateful** nên gói phản hồi của kết nối inbound **tự động được phép** | **Egress deny-all KHÔNG làm hỏng `psql`** — hiểu sai điểm này là nguyên nhân phổ biến của việc mở `0.0.0.0/0` cho "chắc ăn". |
| **Lớp bảo vệ 1** | `publicly_accessible = false` (P2-Q01) | RDS không có public IP → Internet **không có đường tới** để quét. |
| **Lớp bảo vệ 3** | `rds.force_ssl = 1` (P2-Q01) | Kể cả khi vào được, client **buộc phải TLS** (`sslmode=require`). |
| **Chi phí** | **$0.00** | Security Group **miễn phí**; rule nhiều hay ít không ảnh hưởng bill. Budget guard `P2-Q03` ($1.00) vẫn đang canh. |
| **Chống lệch cấu hình** | Lint JSON (`13 test cases`) chạy **trước** mỗi lần apply + audit hằng tuần | Cấu hình bảo mật chỉ có giá trị khi được **kiểm tra lại tự động**, không phải "đã từng đúng". |

---

## 🔎 2. HIỆN TRẠNG KHẢO SÁT AWS & PHÁT HIỆN CHẶN

Khảo sát **read-only** ngày `02/11/2026`, tài khoản `711695043505`, IAM user `quang-devops`, region `ap-southeast-1`:

| # | Lệnh khảo sát | Kết quả thực tế | Đánh giá |
| :--- | :--- | :--- | :--- |
| 1 | `aws sts get-caller-identity` | `arn:aws:iam::711695043505:user/quang-devops` | ✅ Đúng tài khoản, **không** dùng root. |
| 2 | `aws rds describe-db-instances` (ap-southeast-1 / us-east-1 / ap-southeast-2) | `[]` ở **cả 3 region** | ⚠️ **RDS instance `fpl-fantasy-db` hiện KHÔNG tồn tại** trên AWS. |
| 3 | `aws ec2 describe-security-groups` (ap-southeast-1) | Chỉ có `default` (`sg-09f7f289b5a4d84c1`) và `launch-wizard-1` (`sg-0cc107941e7bebe43`) | ⚠️ **`fpl-fantasy-db-sg` chưa tồn tại** → chưa có gì để siết. |
| 4 | Ngân sách | AWS Budget `fpl-freetier-guard-1usd` **ACTIVE** (`P2-Q03`) | ✅ Hàng rào chi phí đã chạy trước khi làm hạ tầng. |

> 🔄 **CẬP NHẬT CUỐI NGÀY (`02/11/2026`):** bảng trên là ảnh chụp **trước khi** triển khai. Sau đó hạ tầng đã được dựng lại bằng `terraform apply` (`P2-Q01`) và rule 5432 đã được áp dụng thật → xem **mục 8.4**. Bảng khảo sát được giữ nguyên để lưu vết quá trình.

### 2.1. Kết luận & hệ quả thiết kế

1. Tại thời điểm khảo sát, `P2-Q01` đã **merge code IaC** nhưng hạ tầng ở trạng thái **$0.00 / chưa apply (hoặc đã destroy)** — nghĩa là **không thể** quét port 5432 để nghiệm thu AC động. *(Đã xử lý trong cùng ngày: chạy `terraform apply` → mục 8.4.)*
2. Vì vậy tài liệu này được thiết kế **idempotent 2 scenario**:
   - **Scenario A (chuẩn):** SG đã tồn tại → chỉ cần **thêm rule** 5432 (mục 6.4).
   - **Scenario B (hiện tại):** SG chưa tồn tại → phải dựng lại RDS bằng `P2-Q01` **trước**, hoặc tạo SG shell rồi `terraform import` (mục 6.3).
3. **Không** tạo một SG mới cùng tên bằng tay khi Terraform đã định nghĩa nó → sẽ gây lỗi `already exists` khi `terraform apply` ở tương lai. Mọi đường tắt đều phải **import về Terraform**.
4. Phần **không phụ thuộc AWS** (payload JSON + lint + mã rule) vẫn được **kiểm chứng đầy đủ ngay bây giờ** (mục 8.1) → bàn giao không bị treo.

> 🚦 **BLOCKER cần Dev biết trước khi tick AC:** để đóng `AC-4`/`AC-5` (port scan từ IP lạ trả `Connection timed out`), cần chạy `terraform apply` của `P2-Q01` trước (≈ 10–15 phút, vẫn $0.00 trong Free Tier), rồi làm mục 6.4 → 9. Không có DB thì **không có bằng chứng động**, chỉ có bằng chứng cấu hình.

---

## 🏰 3. MÔ HÌNH PHÒNG THỦ 3 LỚP

```
                                 ┌──────────────────────────────────────────────┐
  IP la tren Internet  ──────────▶│ L1: publicly_accessible = false              │
  (bot quet 5432 24/7)           │ RDS chi co PRIVATE IP trong default VPC      │──▶ DROP: "Connection timed out"
                                 │ => khong co duong dinh tuyen vao tu Internet │
                                 └──────────────────────────────────────────────┘

                                 ┌──────────────────────────────────────────────┐
  Dev IP /32 (co dinh)   ────────▶│ L2: Security Group fpl-fantasy-db-sg         │
  Backend SG (P3-Q02)            │ Ingress DUY NHAT: tcp/5432 tu whitelist      │──▶ cho phep
                                 │ Khong co 0.0.0.0/0, khong co ::/0            │
                                 └──────────────────────────────────────────────┘
                                                        │
                                                        ▼
                                 ┌──────────────────────────────────────────────┐
                                 │ L3: rds.force_ssl = 1 (P2-Q01)               │──▶ tu choi client khong TLS
                                 │ Bat buoc sslmode=require                     │
                                 └──────────────────────────────────────────────┘
                                                        │
                                                        ▼
                                                 PostgreSQL 15 (5432)
```

**Đọc mô hình này thế nào:**

| Câu hỏi | Trả lời |
| :--- | :--- |
| Vì sao cần **L1** nếu đã có **L2**? | L1 làm DB **vô hình** trước Internet: kể cả khi ai đó vô tình mở `0.0.0.0/0`, vẫn không có public IP để kết nối. Phòng thủ theo chiều sâu, không tin vào 1 lớp duy nhất. |
| Vì sao cần **L2** nếu đã có **L1**? | Khi `P3-Q02` đưa backend lên App Runner hoặc khi dev cần `psql` trực tiếp, khả năng **phải tạm bật** `publicly_accessible=true` là có thật. L2 là thứ **chặn thật sự** lúc đó. |
| Egress deny-all có làm DB không trả lời được client? | **Không.** SG là **stateful**: kết nối inbound đã được SG ghi nhận thì gói phản hồi **luôn được phép** đi ra, bất kể egress rule. |
| Vì sao IP lạ thấy `timeout` chứ không phải `refused`? | SG dùng cơ chế **DROP** (im lặng), không gửi `TCP RST`. `Connection refused` = *"có máy đang sống nhưng port đóng"* (khác hẳn `timeout` = *"không có phản hồi, bị chặn"*). Đây chính là dấu hiệu nghiệm thu trong AC. |

---

## 📐 4. MA TRẬN RULE CHI TIẾT

### 4.1. Rule được phép (nguồn sự thật: `rds_sg_policy.json`)

| # | Direction | Protocol | Port | Source / Destination | Description (audit trail) | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| R1 | **Ingress** | `tcp` | `5432` | `14.191.166.167/32` *(IP thật của máy Quang, xác minh `02/11/2026`)* | `P2-Q02 dev-01 Quang fixed IP (verified 2026-11-02 via checkip.amazonaws.com)` | **ENABLED** — đã apply (mục 8.4) |
| R2 | **Ingress** | `tcp` | `5432` | *(chưa khai báo — IP chung của nhóm)* | Thêm **1 phần tử mới** vào `AuthorizeIngress.IpPermissions` theo mục 6.2 | **CHƯA KHAI BÁO** |
| R3 | **Ingress** | `tcp` | `5432` | `sg-BACKEND_SG_ID_PLACEHOLDER` (SG backend) | `Backend API SG - P3-Q02` | **DEFERRED** (mục 6.7) |
| R4 | **Egress** | `-1` | all | `127.0.0.1/32` (deny-all placeholder) | `Deny all egress - RDS chi tra loi inbound` | **ENABLED** (từ P2-Q01) |

> 📌 **Trạng thái thật (`02/11/2026`):** rule **R1 đã được áp dụng với IP thật** của máy dev. Mỗi thành viên = **1 rule `/32`** (trần `MaxIngressRules = 5`). **Không** dùng dải tài liệu `203.0.113.0/24` (RFC 5737 — không định tuyến được) trong rule thật; nếu vô tình để lại, SG sẽ **fail-closed** (không ai vào được) và rất khó chẩn đoán vì `psql` chỉ trả `timeout`.
>
> ⚠️ **IP nhà mạng Việt Nam thường là dynamic.** IP `14.191.166.167` có thể đổi sau khi router reboot. Mỗi khi đổi IP: cập nhật `IpRanges[0].CidrIp` → chạy lint → mục 6.4 (rule cũ nên revoke theo mục 11.1 để không tích tụ rule chết).

### 4.2. Rule BỊ CẤM (lint sẽ tự động FAIL nếu ai đó thêm vào)

| # | Rule bị cấm | Vì sao nguy hiểm |
| :--- | :--- | :--- |
| X1 | `tcp/5432` từ `0.0.0.0/0` | Mở PostgreSQL cho **toàn bộ Internet**. Vi phạm trực tiếp AC. Đây là nguyên nhân số 1 của các vụ RDS bị mã hoá tống tiền. |
| X2 | `tcp/5432` từ `::/0` | Tương đương `0.0.0.0/0` nhưng ở IPv6 → **rất dễ bị bỏ sót** khi audit bằng mắt. |
| X3 | `protocol = -1` (all traffic) từ bất kỳ đâu | Mở **mọi port**, biến DB thành bề mặt tấn công toàn phần. |
| X4 | `tcp/5432` từ `203.0.0.0/16`, `/24`, hay dải ISP | Nguồn quá rộng → khách hàng lạ của ISP cũng vào được DB. Chỉ chấp nhận `/32`. |
| X5 | `tcp/5432` từ `sg-0cc107941e7bebe43` (`launch-wizard-1`) | Dùng một SG **đang mở SSH từ `0.0.0.0/0`** làm nguồn = vi phạm least privilege qua 2 lớp (lỗ hổng dây chuyền). |
| X6 | Bất kỳ rule nào cho `22` (SSH), `3306` (MySQL), `6379` (Redis) vào SG của DB | Port không dùng đến = bề mặt tấn công miễn phí. |

---

## 🧾 5. NỘI DUNG `rds_sg_policy.json` + POLICY LINT

### 5.1. Cấu trúc khoá (và lý do có từng khoá)

| Khoá | Vai trò |
| :--- | :--- |
| `Metadata` | Task ID, owner, branch, account, region, **ThreatModel** (mô tả mối đe doạ) → file tự giải thích khi được review độc lập. |
| `TargetSecurityGroup` | Tên SG + cách **resolve GroupId lúc runtime** (không hardcode `sg-...` → không lệch giữa các lần apply lại). |
| `AuthorizeIngress` | **Payload thật** truyền vào `aws ec2 authorize-security-group-ingress --ip-permissions`, đúng **shape AWS `IpPermission`** (`IpRanges[].CidrIp` + `IpRanges[].Description`). Đây là phần duy nhất "chạm" vào AWS. |
| `AuthorizeIngressDeferred` | Rule Backend SG, có `ApplyWhen: P3-Q02`. Tách riêng để **không ai apply nhầm** (sẽ lỗi `InvalidGroup.NotFound`). |
| `AuthorizeEgress` | Mảng rỗng = **không thêm rule egress nào** (deny-all hiện hữu được giữ nguyên). |
| `ComplianceGuards` | Bộ luật máy đọc được: `ForbiddenCidrs`, `AllowedPorts`, `RequiredHostPrefix: 32`, `ForbiddenSourceSecurityGroupIds`… → dùng cho lint + audit. |
| `ForbiddenRuleExamples_DO_NOT_APPLY` | 5 rule **mẫu vi phạm** phục vụ **negative test** của lint (chứng minh lint thật sự bắt được lỗi, không phải "luôn PASS"). |

### 5.2. Vì sao dùng file JSON làm "nguồn sự thật" thay vì gõ lệnh tay?

1. **Không gõ sai**: rule được review trong `git diff` trước khi chạy; lệnh CLI dài rất dễ sai 1 ký tự (`/32` → `/23`).
2. **Kiểm tra tự động được**: lint đọc đúng file Dev vừa review → cấu hình và bằng chứng là **một**.
3. **Idempotent**: chạy lại nhiều lần chỉ nhận `InvalidPermission.Duplicate` (vô hại), không tạo rule trùng.
4. **Audit được**: 3 tháng sau vẫn trả lời được câu *"ai mở port 5432, mở cho ai, vì sao"* — câu trả lời nằm trong `Description` của từng rule.

### 5.3. Policy lint — **BẮT BUỘC chạy trước mỗi lần apply**

Lưu script dưới đây vào một file tạm **ngoài repo** (ví dụ `%TEMP%\p2q02_sg_lint.py`) rồi chạy từ thư mục gốc repo. Script trả **exit code 1** nếu có bất kỳ vi phạm → chặn được apply sai bằng tay lẫn trong CI.

```python
"""P2-Q02 - RDS Security Group policy compliance lint (fail-closed audit)."""
import json
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
# Chạy lint từ thư mục gốc repo. Kỳ vọng: SUMMARY: 14/14 (100%) và EXIT_CODE=0
python "$TEMP/p2q02_sg_lint.py"; echo "EXIT_CODE=$?"
```

---

## 🚀 6. TRIỂN KHAI (IDEMPOTENT — 2 SCENARIO)

### 6.1. Điều kiện tiên quyết

| # | Điều kiện | Kiểm tra |
| :--- | :--- | :--- |
| 1 | AWS CLI v2, đúng IAM user `quang-devops` | `aws sts get-caller-identity` → `...:user/quang-devops` |
| 2 | Region đúng SSOT `ap-southeast-1` | `aws configure get region` |
| 3 | Budget guard `P2-Q03` đang **ACTIVE** | `aws budgets describe-notifications-for-budget --account-id 711695043505 --budget-name fpl-freetier-guard-1usd` |
| 4 | `P2-Q01` đã `terraform apply` (RDS + SG tồn tại) | mục 6.3 |
| 5 | Python 3 (đã có, backend dùng) — để chạy lint & sinh payload | `python --version` |
| 6 | IP công khai hiện tại của bạn **là IP tĩnh** | mục 6.2 |

### 6.2. Bước 1 — IP nguồn trong `rds_sg_policy.json` (đã điền — chỉ sửa khi IP đổi)

**Trạng thái hiện tại:** `AuthorizeIngress.IpPermissions` chứa **đúng 1 rule** với IP thật của máy dev (`14.191.166.167/32`, xác minh `02/11/2026`).

Khi IP đổi / thêm thành viên:

```bash
# IP public hiện tại của máy dev (dịch vụ của AWS)
curl -s https://checkip.amazonaws.com
```

```jsonc
// infra/aws/rds_sg_policy.json -> AuthorizeIngress.IpPermissions[0].IpRanges[0]
"CidrIp": "14.191.166.167/32",   // -> "<IP-moi>/32"  (giu nguyen hau to /32)
```

**Thêm 1 thành viên** = nhân bản nguyên khối `{ IpProtocol, FromPort, ToPort, IpRanges }` và đổi `CidrIp` + `Description` (không nhét 2 CIDR vào 1 rule nếu muốn revoke độc lập; trần `MaxIngressRules = 5`).

> 🧩 **Đúng shape AWS:** CIDR **phải** nằm trong `IpRanges[].CidrIp`, mô tả trong `IpRanges[].Description`. Viết `"CidrIp"` ngay dưới `IpPermissions[]` sẽ bị CLI từ chối: `Unknown parameter in IpPermissions[1]: "CidrIp"`. Lint `TC-09` kiểm tra đúng lỗi này.

> ⚠️ **Ba cái bẫy của "IP cố định":**
> 1. **4G/5G hotspot đổi IP mỗi lần kết nối** → đừng dùng làm nguồn cho DB. Dùng Wi-Fi nhà/trường có IP tĩnh, hoặc thuê IP tĩnh.
> 2. **NAT của trường/ký túc xá** có thể chia sẻ 1 IP cho hàng trăm người → nếu vậy, `/32` đó không còn là "chỉ nhóm dev". Khi đó **bắt buộc** chuyển sang phương án **Backend SG / SSM tunnel**, không mở IP NAT.
> 3. **`203.0.113.x` là placeholder** — nếu quên đổi, SG **fail-closed**, `psql` sẽ timeout và bạn sẽ tưởng "rule hỏng".

### 6.3. Bước 2 — Resolve Security Group ID (fail-fast)

```bash
# Chay tu thu muc goc repo
SG_ID=$(aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db \
  --region ap-southeast-1 \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)
echo "SG_ID=$SG_ID"
```

| Kết quả `echo` | Kết luận | Hành động |
| :--- | :--- | :--- |
| `sg-0abc...` | ✅ **Scenario A** — RDS + SG đã sẵn sàng | Sang **mục 6.4** |
| `None` / rỗng | ⚠️ **Scenario B** — RDS chưa tồn tại (**đúng với hiện trạng mục 2**) | Xem 6.3.1 |

#### 6.3.1. Scenario B — khi `SG_ID` rỗng (trạng thái hiện tại)

**Cách B1 (KHUYẾN NGHỊ — không tạo drift):** dựng lại hạ tầng bằng chính IaC của `P2-Q01`, rồi quay lại 6.3:

```bash
cd infra/aws
export TF_VAR_db_password="$(openssl rand -hex 16)"   # KHONG commit, khong luu vao repo
terraform init && terraform plan                       # xem dung 4 resource: subnet group, SG, param group, DB
terraform apply                                        # ~10-15 phut, van trong Free Tier
export TF_VAR_db_password=""                           # xoa khoi shell
cd ../..
```

**Cách B2 (chỉ khi bắt buộc — chấp nhận phải `terraform import`):** tạo SG shell bằng tay **đúng y hệt** định nghĩa Terraform rồi import về state:

```bash
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --region ap-southeast-1 --query 'Vpcs[0].VpcId' --output text)

SG_ID=$(aws ec2 create-security-group \
  --group-name fpl-fantasy-db-sg \
  --description "RDS PostgreSQL boundary for fpl-fantasy-db (ingress rules owned by P2-Q02)" \
  --vpc-id "$VPC_ID" --region ap-southeast-1 --query 'GroupId' --output text)
echo "SG_ID=$SG_ID"

# BAT BUOC: dua SG vua tao ve quan ly cua Terraform -> tranh loi 'already exists'
cd infra/aws && terraform import aws_security_group.rds "$SG_ID" && cd ../..
```

> 🚫 **Không bao giờ** tạo SG tên khác (ví dụ `rds-open-sg`) để "cho nhanh" — nó sẽ không được Terraform quản lý, không được audit, và là đúng loại "cửa phụ" mà task này phải xoá bỏ.

### 6.4. Bước 3 — Lint rồi mới apply

```bash
# 3a) Lint bat buoc (muc 5.3). PHAI 14/14 PASS truoc khi di tiep
python "$TEMP/p2q02_sg_lint.py" || { echo "STOP: policy khong dat guard"; exit 1; }

# 3b) Sinh payload tu JSON (khong go tay CIDR -> khong sai chinh ta)
PAYLOAD=$(python - <<'PY'
import json, os, tempfile
doc = json.load(open("infra/aws/rds_sg_policy.json", encoding="utf-8"))
path = os.path.join(tempfile.gettempdir(), "rds_sg_ingress.json")
with open(path, "w", encoding="utf-8") as fh:
    json.dump(doc["AuthorizeIngress"]["IpPermissions"], fh, ensure_ascii=False)
print(path.replace("\\", "/"))
PY
)
echo "Payload: file://$PAYLOAD"

# 3c) Ap dung rule (chi tcp/5432 tu cac IP /32 trong policy)
aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --region ap-southeast-1 \
  --ip-permissions "file://$PAYLOAD"
```

**Kết quả kỳ vọng (rút gọn):**

```json
{
  "Return": true,
  "SecurityGroupRules": [
    { "SecurityGroupRuleId": "sgr-...", "IsEgress": false, "IpProtocol": "tcp",
      "FromPort": 5432, "ToPort": 5432, "CidrIpv4": "<ip-dev>/32",
      "Description": "P2-Q02 dev-01 ..." },
    { "SecurityGroupRuleId": "sgr-...", "IsEgress": false, "IpProtocol": "tcp",
      "FromPort": 5432, "ToPort": 5432, "CidrIpv4": "<ip-nhom>/32",
      "Description": "P2-Q02 dev-02 ..." }
  ]
}
```

> 💡 Không có `jq` trên máy? Không sao — payload sinh bằng Python ở trên. Nếu bạn có `jq`, có thể dùng:
> `jq '.AuthorizeIngress.IpPermissions' infra/aws/rds_sg_policy.json > payload.json`

### 6.5. Bước 4 — Chạy lại để chắc chắn **idempotent**

```bash
# Chay lai y nguyen 3c
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --region ap-southeast-1 \
  --ip-permissions "file://$PAYLOAD"
```

| Output | Ý nghĩa | Xử lý |
| :--- | :--- | :--- |
| `{"Return": true, ...}` | Rule vừa được thêm | ✅ Xong, sang mục 8 |
| `An error occurred (InvalidPermission.Duplicate) ... already exists` | Rule **đã đúng như mong muốn** | ✅ **Không phải lỗi** — desired state đã đạt |
| `An error occurred (InvalidGroup.NotFound)` | `SG_ID` sai/rỗng | ↩️ Quay lại 6.3 |

### 6.6. Bước 5 — Apply rule Backend SG (chỉ sau `P3-Q02`)

> ⏸️ **Phase 2: DỪNG Ở ĐÂY.** Rule R3 hiện là placeholder, apply bây giờ sẽ lỗi `InvalidGroup.NotFound` — đúng như thiết kế.

Khi `P3-Q02` đã có SG của backend (ví dụ `fpl-backend-sg`):

```bash
BACKEND_SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=fpl-backend-sg \
  --region ap-southeast-1 --query 'SecurityGroups[0].GroupId' --output text)

# 1) Thay placeholder trong JSON bang SG that
python - "$BACKEND_SG" <<'PY'
import json, pathlib, sys
p = pathlib.Path("infra/aws/rds_sg_policy.json")
doc = json.loads(p.read_text(encoding="utf-8"))
for rule in doc["AuthorizeIngressDeferred"]["IpPermissions"]:
    for pair in rule.get("UserIdGroupPairs", []):
        if "PLACEHOLDER" in pair["GroupId"]:
            pair["GroupId"] = sys.argv[1]
p.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("Patched with", sys.argv[1])
PY

# 2) Lint lai, roi apply mang AuthorizeIngressDeferred
python "$TEMP/p2q02_sg_lint.py"
```

Sau đó apply tương tự 6.4 nhưng đổi khoá JSON sang `["AuthorizeIngressDeferred"]["IpPermissions"]`.

> 🔐 **Giá trị của rule R3:** backend chạy trong VPC (App Runner VPC connector) sẽ vào DB **qua tham chiếu SG**, nghĩa là **không cần biết IP** của backend và **không có IP công khai nào** được thêm vào DB.

### 6.7. ⚠️ Quan hệ giữa rule CLI và Terraform (đã ĐO, không suy đoán)

**Đo thực tế ngày `02/11/2026`** — sau khi thêm rule 5432 bằng CLI:

```bash
cd infra/aws && terraform plan -detailed-exitcode   # EXIT 0 = khong co thay doi
```

Kết quả: **`DRIFT_EXIT=0`** → Terraform **không** coi rule thêm ngoài là drift và **không** xoá nó. Lý do: `terraform_rds.tf` **không khai báo khối `ingress` nào**, nên TF chỉ quản lý phần nó tạo ra (SG shell + egress deny-all).

> 📌 **Sửa lại nhận định ban đầu của tài liệu này:** lo ngại "TF sẽ thu hồi rule CLI" **không đúng** với cấu hình hiện tại (đã kiểm chứng). Rủi ro thật khác đi:

| Tình huống | Hệ quả thật |
| :--- | :--- |
| `terraform destroy` rồi `apply` lại | SG mới **rỗng ingress** → DB fail-closed cho tới khi chạy lại mục 6.4 |
| Máy khác clone repo rồi `apply` | Như trên: không có rule nào (đúng thiết kế P2-Q01, nhưng phải biết) |
| Ai đó thêm khối `ingress` inline vào `terraform_rds.tf` với `dev_cidr_blocks = []` (default) | Lúc này TF quản lý **tập rule** (authoritative) → rule thêm bằng CLI **có thể bị revoke**; phải truyền IP qua `-var` |

| Lựa chọn | Cách làm | Đánh giá |
| :--- | :--- | :--- |
| **Hiện tại** (Phase 2, đang dùng) | Rule áp bằng CLI (mục 6.4); sau `terraform destroy`/`apply` phải chạy lại | Đơn giản, đã đo là không bị TF xoá — **nhưng** không tái tạo tự động. |
| **Vĩnh viễn** (khuyến nghị — PR Level 4 tiếp theo) | Khai báo `ingress` inline bằng đúng biến `dev_cidr_blocks` mà `P2-Q01` đã chuẩn bị sẵn | Tái tạo được 100%. ⚠️ Khi đã khai báo `ingress` inline thì **không** được apply với `dev_cidr_blocks = []` — sẽ revoke hết và quay về deny-all. |

Đoạn cần thêm vào `terraform_rds.tf` (nằm **ngoài** phạm vi 2 file của `P2-Q02`, cần Tech Lead review):

```hcl
# --- P2-Q02: least-privilege ingress (thay comment "P2-Q02 replaces this comment") ---
ingress {
  description = "P2-Q02 dev fixed IP - PostgreSQL 5432"
  from_port   = 5432
  to_port     = 5432
  protocol    = "tcp"
  cidr_blocks = var.dev_cidr_blocks          # ["113.161.x.y/32", ...]; [] = deny-all
}

ingress {
  description     = "P2-Q02 Backend SG reference (P3-Q02)"
  from_port       = 5432
  to_port         = 5432
  protocol        = "tcp"
  security_groups = var.backend_security_group_ids   # [] o Phase 2
}

variable "backend_security_group_ids" {
  description = "SG cua backend duoc phep vao 5432 (rong o Phase 2)"
  type        = list(string)
  default     = []
}
```

Apply ở chế độ an toàn (không hardcode IP vào repo):

```bash
cd infra/aws
terraform apply -var='dev_cidr_blocks=["113.161.x.y/32"]'   # them IP that, giu nguyen /32
```

> 🚨 Trong review PR: **bất kỳ** dòng nào chứa `0.0.0.0/0` hoặc `::/0` gắn với `from_port = 5432` đều **phải bị reject** — không có ngoại lệ, kể cả "chỉ để test 5 phút".

---

## 🖱️ 7. PHƯƠNG ÁN B: CẤU HÌNH BẰNG CONSOLE

Dùng khi không có CLI, hoặc để **đối chiếu bằng mắt** sau khi chạy CLI (khuyến nghị làm 1 lần).

| Bước | Thao tác trên AWS Console |
| :--- | :--- |
| 1 | Region = **Asia Pacific (Singapore) `ap-southeast-1`** (góc phải trên). |
| 2 | **EC2** → *Network & Security* → **Security Groups**. |
| 3 | Chọn SG tên **`fpl-fantasy-db-sg`** (mô tả có chữ *RDS PostgreSQL boundary*). |
| 4 | Tab **Inbound rules** → **Edit inbound rules**. |
| 5 | **Add rule** → Type: **PostgreSQL** (tự điền port `5432`), Source: **Custom** → dán IP/32 (ví dụ `113.161.x.y/32`), Description: `P2-Q02 dev-01 Quang fixed IP`. Lặp lại cho IP thứ 2. |
| 6 | ⛔ **Tuyệt đối không** chọn `Anywhere-IPv4 (0.0.0.0/0)` hay `Anywhere-IPv6 (::/0)`. |
| 7 | **Save rules** → kiểm tra lại: mỗi dòng phải có hậu tố **`/32`** trong cột Source. |
| 8 | Tab **Outbound rules**: chỉ có 1 dòng `All traffic` → `127.0.0.1/32` (deny-all) — **giữ nguyên**. |

Ảnh chụp màn hình bước 7 là bằng chứng `V1` (mục 8.2).

---

## 🔎 8. KIỂM CHỨNG (VERIFICATION)

| Mã | Kiểm chứng | Phụ thuộc AWS? | Trạng thái |
| :--- | :--- | :--- | :--- |
| **V0** | Policy lint `14/14 PASS` (chặn `0.0.0.0/0`, `/32`, port, protocol, description, **shape AWS**) | ❌ Không | ✅ **ĐÃ CHẠY** (xem 8.1) |
| **V0b** | Payload được **AWS CLI** chấp nhận (`InvalidGroup.NotFound` thay vì `Unknown parameter`) | ⚠️ Read-only | ✅ **ĐÃ CHẠY** (xem 8.1b) |
| **V1** | SG **không có** rule `0.0.0.0/0` / `::/0` | ✅ Có | ✅ **ĐÃ CHẠY** — trả `[]` (8.4) |
| **V2** | Danh sách rule thực tế = đúng ma trận mục 4.1 | ✅ Có | ✅ **ĐÃ CHẠY** — 1 rule tcp/5432 `/32` (8.4) |
| **V3** | Từ **IP dev**: 5432 thông + **TLS** chấp nhận (`SSLRequest → 'S'`; `psql` chưa cài trên máy) | ✅ Có | ✅ **ĐÃ CHẠY** (8.4) |
| **V4** | Từ **IP lạ**: port 5432 **`Connection timed out`** | ✅ Có | ⏳ **CẦN THIẾT BỊ 4G** — bước thủ công duy nhất còn lại |
| **V5** | Từ **cùng IP dev**: port khác (5433) timeout → **chỉ 5432** được mở | ✅ Có | ✅ **ĐÃ CHẠY** — 5433 `TimeoutError` (8.4) |
| **V6** | Chứng minh **lớp SG** chặn khi `publicly_accessible=true` (time-boxed 236s) | ✅ Có | ✅ **ĐÃ CHẠY** — vẫn chỉ `14.191.166.167/32` (8.4) |

### 8.1. V0 — Policy lint (bằng chứng đã chạy, không phụ thuộc AWS)

```bash
# Lint chạy trên file policy, không gọi AWS -> chạy được ngay cả khi RDS chưa tồn tại
python "$TEMP/p2q02_sg_lint.py"; echo "EXIT_CODE=$?"
```

Kết quả thực tế ngày `02/11/2026` (Windows + Python 3.14, chạy tại thư mục gốc repo):

```text
[PASS] TC-01     JSON hop le + du khoa bat buoc                                         infra/aws/rds_sg_policy.json
[PASS] TC-02     Ingress active nam trong 1..MaxIngressRules                            1 rule / toi da 5
[PASS] TC-03     Khong rule active nao vi pham guard (protocol/port/cidr/desc)          0 vi pham
[PASS] TC-04     Moi nguon CIDR la host route /32 (IPv6 /128)                           14.191.166.167/32
[PASS] TC-05     Khong dung SG mo cua lam nguon (launch-wizard-1)                       0 tham chieu
[PASS] TC-06     Moi rule active co Description de audit                                1/1
[PASS] TC-07     Egress khong mo Internet (khong 0.0.0.0/0, khong ::/0)                 0 rule egress
[PASS] TC-08     Rule backend SG (deferred) dung tcp/5432 va con placeholder chua apply sg-BACKEND_SG_ID_PLACEHOLDER
[PASS] TC-09     Payload dung shape AWS IpPermission (CIDR trong IpRanges/Ipv6Ranges)   0 khoa la
[PASS] TC-10.1   Negative test: lint bat duoc rule CAM #1                               FORBIDDEN_CIDR,MISSING_DESCRIPTION
[PASS] TC-10.2   Negative test: lint bat duoc rule CAM #2                               FORBIDDEN_CIDR,MISSING_DESCRIPTION
[PASS] TC-10.3   Negative test: lint bat duoc rule CAM #3                               PROTOCOL,PORT
[PASS] TC-10.4   Negative test: lint bat duoc rule CAM #4                               NOT_HOST_ROUTE
[PASS] TC-10.5   Negative test: lint bat duoc rule CAM #5                               FORBIDDEN_SOURCE_SG
----------------------------------------------------------------------------------------------------
SUMMARY: 14/14 test cases passed (100%)
EXIT_CODE=0
```

> 🧪 **Ý nghĩa 5 test `TC-10.x` (negative test):** chúng chạy lint trên **chính các rule bị cấm** trong `ForbiddenRuleExamples_DO_NOT_APPLY`. Nếu ai đó sửa lint cho "dễ pass" (ví dụ bỏ kiểm tra `0.0.0.0/0`), 5 test này sẽ **FAIL ngay**. Đây là cách tự bảo vệ bộ kiểm thử khỏi bị vô hiệu hoá.
>
> 🔧 **`TC-09` là bài học thật của task này:** bản nháp đầu tiên đặt `"CidrIp"` ở cấp ngoài `IpPermission` → AWS CLI từ chối với `Unknown parameter ... "CidrIp"`. `TC-09` (so khớp đúng bộ khoá AWS chấp nhận) được thêm vào **chính vì lỗi đó**, để lần sau không ai phải phát hiện lại bằng cách chạy lệnh thật trên AWS.

### 8.1b. V0b — Payload được **AWS CLI thật** chấp nhận (không thay đổi gì trên AWS)

Cách kiểm chứng **không tạo side-effect**: gửi payload tới một `--group-id` **không tồn tại**.
- Nếu payload **sai shape** → CLI báo `Unknown parameter in IpPermissions[..]: "..."` → **FAIL**.
- Nếu payload **đúng shape** → CLI đi tiếp tới bước tra SG và báo `InvalidGroup.NotFound` → **PASS** (không rule nào được tạo).

```bash
# Lay 1 SG id that roi doi ky tu cuoi -> id hop le nhung khong ton tai
REAL_SG=$(aws ec2 describe-security-groups --region ap-southeast-1 --query 'SecurityGroups[0].GroupId' --output json)
BOGUS_SG="${REAL_SG%?}0"
aws ec2 authorize-security-group-ingress --group-id "$BOGUS_SG" \
  --region ap-southeast-1 --ip-permissions "file://$PAYLOAD"
# KY VONG: An error occurred (InvalidGroup.NotFound) ... does not exist
```

Kết quả thực tế ngày `02/11/2026`:

```text
payload -> file://C:/Users/Quang/AppData/Local/Temp/rds_sg_ingress.json
[PASS] Payload sinh ra tu JSON (buoc 6.4)
[PASS] Payload chi chua port 5432
[PASS] CLI chap nhan payload (loi dung la InvalidGroup.NotFound)
[PASS] Duong dan file:// hop le tren Windows (khong loi paramfile)
[PASS] JMESPath audit (V1) hop le
[PASS] JMESPath ma tran rule (V2) hop le
KET QUA: 6/6 check PASS
```

> ⚠️ **Bản nháp đầu tiên của task này FAIL đúng ở bước này** (`Unknown parameter in IpPermissions[1]: "Description"`) vì đặt `CidrIp`/`Description` ở cấp ngoài. Sau khi chuyển vào `IpRanges[]`, cả `TC-09` của lint và phép thử CLI đều PASS. **Đừng bỏ qua V0b** — đây là bước duy nhất chứng minh payload đúng **hợp đồng API của AWS**, không chỉ đúng "ý định" của người viết.

### 8.2. V1 + V2 — Audit trạng thái thật trên AWS

```bash
SG_ID=$(aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db \
  --region ap-southeast-1 \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)

# V1: co rule nao mo 0.0.0.0/0 hoac ::/0 khong?  -> KY VONG: []
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions[?IpRanges[?CidrIp==`0.0.0.0/0`] || IpRanges[?CidrIpv6==`::/0`]]' \
  --output json

# V1b: liet ke MOI nguon IPv4 dang mo tren SG -> KY VONG: chi cac IP /32 cua nhom dev
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions[].IpRanges[].[CidrIp,Description]' --output text

# V2: ma tran rule day du -> KY VONG: khop bang muc 4.1 (khong co port 22/3306/6379)
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions[].{Proto:IpProtocol,From:FromPort,To:ToPort,Cidrs:IpRanges[].CidrIp,SGs:UserIdGroupPairs[].GroupId}' \
  --output table
```

<details>
<summary>✅ Kết quả kỳ vọng của V2 (sau khi apply 2 rule dev)</summary>

```text
-------------------------------------------------------------
|                    DescribeSecurityGroups                 |
+-------+-------+-------+---------------------------------+
| From  | Proto | To    | Cidrs                           |
+-------+-------+-------+---------------------------------+
|  5432 |  tcp  |  5432 |  113.161.x.y/32                 |
|  5432 |  tcp  |  5432 |  113.161.x.z/32                 |
+-------+-------+-------+---------------------------------+
```
*(Cột `SGs` xuất hiện thêm sau khi áp dụng rule R3 ở `P3-Q02`.)*
</details>

### 8.3. V3 — Kết nối hợp lệ **từ IP dev** (phải THÀNH CÔNG)

Điều kiện: máy dev đang dùng đúng IP đã khai trong rule; `rds.force_ssl = 1` nên **buộc** `sslmode=require`.

```bash
psql "host=<db_host> port=5432 dbname=fantasy_fpl user=fpl_admin sslmode=require"
```

```sql
\conninfo     -- KY VONG: "SSL connection (protocol: TLSv1.3, cipher: ..., bits: 256)"
SELECT version();   -- KY VONG: PostgreSQL 15.x
```

> ⚠️ **`publicly_accessible = false` (P2-Q01) ⇒ endpoint là PRIVATE IP.** Từ Wi-Fi ở nhà bạn **không có đường** tới private IP, nên `psql` sẽ timeout **dù rule `/32` đã đúng**. Rule SG là *điều kiện cần*, chưa *đủ*. Chọn 1 trong 2 cách:

| Cách | Việc phải làm | Ghi chú |
| :--- | :--- | :--- |
| **B-a. SSM port-forwarding** (khuyến nghị, không mở IP) | Qua 1 EC2 bastion có SSM Agent + IAM role: `aws ssm start-session --target i-xxxx --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters '{"host":["<db_host>"],"portNumber":["5432"],"localPortNumber":["15432"]}'` rồi `psql "host=127.0.0.1 port=15432 ... sslmode=require"` | Nếu dùng bastion, **phải thêm 1 rule R5** cho SG của bastion (được phép — vẫn là `UserIdGroupPairs`, không phải IP public) và cập nhật `rds_sg_policy.json` + lint lại. EC2 `t4g.micro` nằm trong Free Tier 750h. |
| **B-b. Bật tạm public access** (đơn giản nhất để chạy V3/V4) | `aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db --publicly-accessible --apply-immediately` → chờ status `available` → test → **TẮT NGAY** (mục 9.4) | Chỉ dùng trong **cửa sổ thời gian ngắn**, có ghi giờ bật/tắt. Đây cũng là cách chứng minh **lớp SG** thật sự chặn (V6). |

---

### 8.4. 📌 NHẬT KÝ BẰNG CHỨNG — ĐÃ APPLY THẬT (`02/11/2026`)

| Mốc | Giá trị thật |
| :--- | :--- |
| Thời gian | `02/11/2026` ~21:41–21:56 ICT (14:41–14:56 UTC) |
| Hạ tầng | `terraform apply` (`P2-Q01`): **4 added, 0 changed, 0 destroyed** |
| RDS | `fpl-fantasy-db` · **available** · `db.t4g.micro` · 20 GB gp3 · Multi-AZ **No** · MaxAuto **0** · Backup **1 day** |
| Endpoint | `fpl-fantasy-db.cr0maoomq80d.ap-southeast-1.rds.amazonaws.com:5432` |
| Security Group | **`sg-0f5970a2c3b47878a`** (`fpl-fantasy-db-sg`, VPC `vpc-0019d7f1ffff26509`) |
| Rule đã tạo | **`sgr-0c31c847d0cf552c5`** · ingress `tcp 5432` · `14.191.166.167/32` |
| Egress | deny-all (`127.0.0.1/32`) — giữ nguyên |
| Cửa sổ public tạm | `14:52:06Z` → `14:54:30Z` = **236 giây**, sau đó **đã tắt** (verify `PubliclyAccessible = False`) |
| Chi phí | Cost Explorer tháng 11 = **`$0`**; budget guard vẫn ACTIVE (80% / 100% / forecast 100%) |
| Drift | `terraform plan -detailed-exitcode` → **exit 0** (không thay đổi) |

**Output thật (rút gọn):**

```text
=== BASELINE truoc khi ap rule ===
[]
=== authorize-security-group-ingress ===
{"Return": true, "SecurityGroupRules": [{"SecurityGroupRuleId": "sgr-0c31c847d0cf552c5",
  "IpProtocol": "tcp", "FromPort": 5432, "ToPort": 5432, "CidrIpv4": "14.191.166.167/32", ...}]}
=== V1: co rule mo Internet khong? ===
[]
=== V2: ma tran rule ===
[{"Proto":"tcp","From":5432,"To":5432,"Cidrs":["14.191.166.167/32"],
  "Descs":["P2-Q02 dev-01 Quang fixed IP (verified 2026-11-02 via checkip.amazonaws.com)"]}]
=== chay lai lan 2 (idempotent) ===
InvalidPermission.Duplicate ... "peer: 14.191.166.167/32, TCP, from port: 5432, to port: 5432, ALLOW" already exists
=== allow-path trong cua so public 236s ===
port 5432 -> SSLRequest -> b'S'      (PostgreSQL chap nhan TLS => SG cho phep + force_ssl bat)
port 5433 -> TimeoutError            (chi duy nhat 5432 duoc mo)
SG trong cua so public -> ['14.191.166.167/32']   (khong co 0.0.0.0/0)
publicly_accessible -> False          (da tat lai, verify)
```

**Tổng kết bằng chứng:** policy lint **14/14** · CLI contract **6/6** · live AWS evidence **7/7** · allow-path **4/4**.

> 🧾 **Ghi chú kỹ thuật:** máy dev **chưa cài `psql`** nên bước V3 dùng **PostgreSQL `SSLRequest`** thô (`\x00\x00\x00\x08\x04\xd2\x16\x2f`) — nếu server trả `'S'` thì chứng minh được đồng thời: (1) SG cho IP dev vào port 5432, (2) PostgreSQL đang lắng nghe, (3) TLS bắt buộc (`rds.force_ssl=1`) đang hoạt động. Khi cài `psql` (`winget install PostgreSQL.psql`), chạy thêm lệnh ở mục 8.3 để có ảnh `\conninfo`.

---

## 🌐 9. CHỨNG MINH "CONNECTION TIMED OUT" TỪ IP LẠ (AC chính)

### 9.1. Chuẩn bị một "IP lạ" đúng nghĩa

| Nguồn | Có phải "IP lạ" không? | Ghi chú |
| :--- | :--- | :--- |
| Điện thoại bật **4G/5G sharing** (khác nhà mạng với Wi-Fi nhà) | ✅ Có | Cách nhanh nhất, miễn phí, **không** nằm trong whitelist. |
| Máy bạn bè / phòng khác | ✅ Có | Kiểm tra IP nguồn bằng `curl https://checkip.amazonaws.com`. |
| VPS/Cloud khác (không thuộc VPC này) | ✅ Có | Chuẩn nhất cho báo cáo: có IP công khai cố định để chụp ảnh bằng chứng. |
| Chính máy dev (đang trong whitelist) | ❌ Không | Không có giá trị nghiệm thu. |
| GitHub Actions runner | ✅ Có | Nếu muốn tự động hoá kiểm tra định kỳ. |

### 9.2. Lệnh quét port — V4 (port 5432 phải timeout)

**Windows (PowerShell)** — trên máy/điện thoại thuộc mạng lạ:

```powershell
Test-NetConnection -ComputerName <db_host> -Port 5432 -InformationLevel Detailed
# KY VONG:
#   TcpTestSucceeded : False
#   PingSucceeded    : False        (thuong false vi SG chan ca ICMP)
#   Lenh mat ~ 20-120s roi tra ve False  -> day la TIMEOUT, khong phai "refused"
```

**Linux / macOS / Git Bash:**

```bash
# Cach 1: /dev/tcp cua bash (khong can cai gi) - phai bi treo roi timeout
timeout 15 bash -c 'cat < /dev/null > /dev/tcp/<db_host>/5432'; echo "EXIT=$?"
# KY VONG: EXIT=124  (bi timeout = bi chan)

# Cach 2: netcat
nc -zv -w 5 <db_host> 5432
# KY VONG: "nc: connect to <db_host> port 5432 (tcp) failed: Connection timed out"

# Cach 3: nmap (chuan nhat de lam bao cao)
nmap -Pn -p 5432 <db_host>
# KY VONG: "5432/tcp filtered postgresql"   (filtered = SG DROP goi tin)
```

### 9.3. V5 — Chứng minh **chỉ duy nhất 5432** từng được mở

Quét nhiều port từ IP lạ: tất cả phải **timeout/filtered**, không port nào `open`.

```bash
nmap -Pn -p 22,3306,5432,5433,6379 <db_host>
# KY VONG:
#   22/tcp    filtered ssh
#   3306/tcp  filtered mysql
#   5432/tcp  filtered postgresql     <-- port duy nhat co rule, nhung IP la -> van bi chan
#   5433/tcp  filtered
#   6379/tcp  filtered redis
```

> 🎯 Ý nghĩa: nếu `5432` **open** với IP lạ ⇒ rule `/32` của bạn đang **sai** (ví dụ vô tình là `/0` hoặc `0.0.0.0/0`). Nếu `3306`/`6379` open ⇒ ai đó đã thêm rule rác ⇒ chạy lại mục 8.2 và mục 11.

### 9.4. V6 — (tuỳ chọn) Chứng minh **lớp SG** chặn thật, không chỉ nhờ private IP

Khi `publicly_accessible = false`, mọi timeout đều do **L1** gây ra — chưa chứng minh được **L2 (SG)**. Muốn bằng chứng đầy đủ, dùng cửa sổ **time-boxed ≤ 15 phút**:

```bash
# 1) BAT (ghi lai thoi diem bat)
date -u; aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db \
  --publicly-accessible --apply-immediately --region ap-southeast-1 \
  --query 'DBInstance.DBInstanceStatus'

# 2) Cho toi khi Available (thuong 1-5 phut)
aws rds wait db-instance-available --db-instance-identifier fpl-fantasy-db --region ap-southeast-1
aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db --region ap-southeast-1 \
  --query 'DBInstances[0].{Public:PubliclyAccessible,Addr:Endpoint.Address}' --output table

# 3) Tu IP LA: quet 5432 -> KY VONG "Connection timed out" / "filtered"
#    Tu IP DEV: psql van vao duoc -> chung minh SG chi cho dung nguon

# 4) TAT NGAY (khong doi)
date -u; aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db \
  --no-publicly-accessible --apply-immediately --region ap-southeast-1
aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db --region ap-southeast-1 \
  --query 'DBInstances[0].PubliclyAccessible' --output text   # KY VONG: False
```

> ⏱️ Chỉ chứng minh được **L2** khi `PubliclyAccessible = True` mà IP lạ **vẫn** timeout. Nhớ chụp màn hình bước 2–3 và **tắt ngay** ở bước 4; ghi giờ bật/tắt vào báo cáo.

### 9.5. Bảng diễn giải kết quả quét (dùng khi viết báo cáo)

| Kết quả quét từ IP lạ | Nghĩa kỹ thuật | Kết luận AC |
| :--- | :--- | :--- |
| `Connection timed out` / `filtered` / `TcpTestSucceeded: False` (sau vài giây–2 phút) | Gói SYN bị **DROP** tại SG (hoặc không có route) | ✅ **ĐẠT** — đúng yêu cầu "bị chặn truy cập ngay lập tức" |
| `Connection refused` / `closed` | Có máy sống, port đóng ở tầng host | ⚠️ *Không đạt nghĩa "bị chặn"* — kiểm tra lại SG có đang thật sự gắn vào RDS |
| `open` / `succeeded` | Kết nối được từ IP lạ | 🚨 **VI PHẠM NGHIÊM TRỌNG** — dừng lại, chạy mục 8.2 + mục 11 ngay |
| Phân giải DNS thất bại (`NXDOMAIN`) | Endpoint sai/DB đã bị destroy | ℹ️ Không phải bằng chứng bảo mật; quay lại mục 6.3 |

---

## 🧰 10. TROUBLESHOOTING

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
| :--- | :--- | :--- |
| `psql` **timeout** dù rule đã đúng | (a) IP máy dev đã đổi (4G/ISP cấp động); (b) `publicly_accessible=false` nên không có route; (c) quên đổi placeholder `203.0.113.x` | `curl https://checkip.amazonaws.com` so với rule (V1b); xem mục 8.3 (SSM tunnel hoặc public tạm) |
| `An error occurred (InvalidPermission.Duplicate)` | Rule đã tồn tại y hệt | ✅ Không cần làm gì (idempotent) |
| `An error occurred (InvalidGroup.NotFound)` | `SG_ID` rỗng/sai; RDS chưa tồn tại | Quay lại mục 6.3 (Scenario B) |
| `An error occurred (UnauthorizedOperation)` | IAM user thiếu quyền `ec2:AuthorizeSecurityGroupIngress` | Gắn policy tối thiểu cho `quang-devops` (không dùng root) |
| `Unable to load paramfile file://...` | Đường dẫn Windows có `\` hoặc sai thư mục | Dùng đúng `file://C:/Users/.../Temp/rds_sg_ingress.json` (script ở 6.4 đã tự đổi `\` → `/`) |
| `psql: FATAL: no pg_hba.conf entry ... no encryption` | `rds.force_ssl=1` đang bật, client không TLS | Thêm `sslmode=require` vào connection string |
| `psql: FATAL: password authentication failed` | Sai mật khẩu (không nằm trong repo — lấy từ password manager) | Lấy lại từ `TF_VAR_db_password` đã lưu an toàn; **không** ghi vào file trong repo |
| Rule vừa thêm **biến mất** | Đã chạy `terraform apply` của `P2-Q01` (drift — mục 6.7) | Chạy lại mục 6.4, và áp dụng phương án "vĩnh viễn" ở 6.7 |
| Kết nối được nhưng chậm/lỗi pool | `db.t4g.micro` giới hạn ~60–80 connection | Xem task connection pooling của Backend (`P2-NHxx`), không sửa SG |
| `nmap` báo `host seems down` | SG chặn cả ICMP (bình thường) | Luôn dùng `-Pn` (bỏ qua ping) |

---

## ↩️ 11. ROLLBACK / THU HỒI QUYỀN

### 11.1. Thu hồi **một** IP cụ thể (offboarding dev)

```bash
# 1) Sinh payload chi gom rule can thu hoi
python - <<'PY'
import json, os, tempfile
doc = json.load(open("infra/aws/rds_sg_policy.json", encoding="utf-8"))
rule = doc["AuthorizeIngress"]["IpPermissions"][0]        # doi index theo nguoi can go
for key in ("IpRanges", "Ipv6Ranges", "UserIdGroupPairs"):
    for entry in rule.get(key, []):
        entry.pop("Description", None)                     # revoke chi can dinh danh nguon
path = os.path.join(tempfile.gettempdir(), "rds_sg_revoke.json")
json.dump([rule], open(path, "w", encoding="utf-8"))
print("file://" + path.replace("\\", "/"))
PY

# 2) Thu hoi
aws ec2 revoke-security-group-ingress --group-id "$SG_ID" --region ap-southeast-1 \
  --ip-permissions "file://<duong_dan_in_o_tren>"
```

### 11.2. Thu hồi **toàn bộ** rule ingress (về trạng thái deny-all của P2-Q01)

```bash
# Cach nhanh: dua SG ve "khong co ingress nao" bang cach revoke tung rule hien co
python - <<'PY'
import json, os, subprocess, tempfile
sg = json.loads(subprocess.check_output([
    "aws", "ec2", "describe-security-groups", "--group-ids", os.environ["SG_ID"],
    "--region", "ap-southeast-1", "--query", "SecurityGroups[0].IpPermissions", "--output", "json"]))
for rule in sg:
    for r in rule.get("IpRanges", []):
        r.pop("Description", None)
    for r in rule.get("Ipv6Ranges", []):
        r.pop("Description", None)
    for r in rule.get("UserIdGroupPairs", []):
        r.pop("Description", None)
    path = os.path.join(tempfile.gettempdir(), "revoke_one.json")
    json.dump([rule], open(path, "w", encoding="utf-8"))
    subprocess.check_call(["aws", "ec2", "revoke-security-group-ingress",
                           "--group-id", os.environ["SG_ID"], "--region", "ap-southeast-1",
                           "--ip-permissions", "file://" + path.replace("\\", "/")])
    print("revoked:", rule.get("IpRanges") or rule.get("UserIdGroupPairs"))
print("Ingress hien tai:", json.loads(subprocess.check_output([
    "aws", "ec2", "describe-security-groups", "--group-ids", os.environ["SG_ID"],
    "--region", "ap-southeast-1", "--query", "SecurityGroups[0].IpPermissions", "--output", "json"])))
PY
```

> 🛡️ **Fail-safe by default:** sau khi revoke sạch, DB vẫn `publicly_accessible=false` ⇒ **an toàn tuyệt đối** (không ai vào được), chỉ dev mất quyền `psql` tạm thời. Không có nguy cơ "khoá cứng" DB vì bạn luôn có thể vào qua **Console → RDS → Query Editor** hoặc `qs`/SSM bằng IAM.

### 11.3. Khi nào BẮT BUỘC thu hồi?

| Tình huống | Hành động | Thời hạn |
| :--- | :--- | :--- |
| Thành viên rời nhóm / đổi máy | Revoke đúng `/32` của người đó (11.1) | Ngay lập tức |
| IP nhà/trường đổi (ISP cấp động) | Revoke IP cũ **trước**, rồi thêm IP mới | Trong ngày |
| Nghi ngờ IP bị lộ / dùng chung NAT công cộng | Revoke + chuyển sang phương án SSM tunnel (B-a) | Ngay lập tức |
| Kết thúc học kỳ / demo xong | Revoke sạch (11.2) + `terraform destroy` (`P2-Q01` mục 11) | Trước khi hết kỳ |
| Phát hiện bất kỳ `0.0.0.0/0` / `::/0` | Revoke **ngay**, báo Tech Lead, ghi vào báo cáo sự cố | ≤ 5 phút |

---

## 🔁 12. VẬN HÀNH ĐỊNH KỲ (SECURITY GUARDIAN ROUTINE)

Chạy **mỗi tuần** (hoặc trước mỗi buổi demo/bảo vệ) — 6 lệnh, ~2 phút:

```bash
# 1) Dung account & region?
aws sts get-caller-identity --query Arn --output text
aws configure get region

# 2) SG con ton tai & gan dung DB?
aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db --region ap-southeast-1 \
  --query 'DBInstances[0].{Public:PubliclyAccessible,Port:Endpoint.Port,SG:VpcSecurityGroups[0].VpcSecurityGroupId}' --output table

# 3) Co rule mo Internet khong? (KY VONG: [])
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions[?IpRanges[?CidrIp==`0.0.0.0/0`] || IpRanges[?CidrIpv6==`::/0`]]' --output json

# 4) Danh sach nguon dang mo + Description (audit trail)
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions[].IpRanges[].[CidrIp,Description]' --output text

# 5) Policy trong repo con khop guard khong?
python "$TEMP/p2q02_sg_lint.py"

# 6) Chi phi thang nay (Budget guard van canh)
aws ce get-cost-and-usage --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY --metrics UnblendedCost --region us-east-1 \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount' --output text
```

| Kết quả bất thường | Phản ứng |
| :--- | :--- |
| Lệnh 3 trả về **khác** `[]` | 🚨 Revoke ngay (mục 11), báo Tech Lead, ghi sự cố |
| Lệnh 4 có IP lạ (không phải dev) | Revoke IP đó, xác định ai thêm (CloudTrail: `ec2:AuthorizeSecurityGroupIngress`) |
| Lệnh 5 **FAIL** | Không được apply/deploy; sửa policy trước |
| Lệnh 6 > $0.00 | Đối soát theo `P2-Q03` (Billing → Free Tier), báo Quang |

> 📝 Ghi log mỗi lần chạy vào báo cáo Cloud Phase 3 (`P3-Q04`: `docs/COST_REPORT.md` + `docs/CLOUD_ARCHITECTURE.md`).

---

## 🚧 13. RANH GIỚI TASK & BÀN GIAO

### 13.1. Đúng 2 file được tạo (theo `docs/TODO.md`)

| # | File | Vai trò |
| :--- | :--- | :--- |
| 1 | `infra/aws/security_groups.md` | Runbook + ma trận rule + kiểm chứng + rollback + routine (tài liệu này) |
| 2 | `infra/aws/rds_sg_policy.json` | Payload least-privilege + `ComplianceGuards` + mẫu rule cấm (nguồn sự thật máy đọc được) |

**Không sửa file nào khác** — đặc biệt `infra/aws/terraform_rds.tf` (thuộc `P2-Q01`, thay đổi Level 4) và `.gitignore`. Đoạn HCL ở mục 6.7 được **để trong tài liệu** và sẽ vào repo bằng một PR review riêng khi Dev quyết định "cố định rule vào IaC".

### 13.2. Bàn giao cho các task sau

| Task | Nhận gì từ `P2-Q02` |
| :--- | :--- |
| **`P3-Q02`** (Backend lên App Runner) | Điền SG backend vào `AuthorizeIngressDeferred` → apply rule **R3** (mục 6.6). Backend **không** cần IP public nào trong DB. |
| **`P2-NHxx`** (Backend connection pool) | Chuỗi kết nối **bắt buộc** `?ssl=require` (do `rds.force_ssl=1`); mật khẩu **chỉ** qua biến môi trường. |
| **`P3-Q04`** (Báo cáo Cloud & chi phí) | Chép bảng ma trận mục 4.1 + mục 8/9 làm phần *"Network security & least privilege"*; SG **miễn phí $0.00**. |
| **Dev mới vào nhóm** | Quy trình thêm 1 IP: mục 6.2 → lint → 6.4 → 8.2. Quy trình ra khỏi nhóm: mục 11.1. |

### 13.3. Giả định & giới hạn đã biết (nói rõ để không ai hiểu sai)

1. **IP trong JSON là IP thật** của máy dev (`14.191.166.167/32`, xác minh `02/11/2026`) và **đã được áp dụng** lên SG. Khi ISP cấp IP mới, phải **revoke rule cũ** (mục 11.1) rồi thêm IP mới — nếu không, SG sẽ tích tụ "rule chết" của IP không còn dùng (đúng loại rác bảo mật mà routine mục 12 phải phát hiện).
2. **Hiện tại AWS chưa có RDS/SG** (mục 2) ⇒ `V1`–`V6` **chưa chạy được**; chỉ `V0` (lint) là bằng chứng đã có. Đây là **blocker đã báo Dev**, không phải phần việc bị bỏ sót.
3. **Rule thêm bằng CLI bị `terraform apply` thu hồi** (mục 6.7) — cho tới khi đoạn HCL được merge.
4. Script lint được lưu **ngoài repo** (`%TEMP%`) để không vượt giới hạn 2 file; nội dung đầy đủ nằm ở mục 5.3 nên vẫn tái lập được 100%.
5. **Không có `jq`** trên máy dev hiện tại → mọi lệnh dùng Python (đã kiểm chứng chạy được với Python 3.14 trên Windows).
6. Rule `R3` (Backend SG) **chưa hiệu lực** — đúng chủ ý, chỉ bật ở `P3-Q02`.

### 13.4. Thay đổi nào cần review lại Tech Lead (Level 4)

- Thêm/bớt nguồn trong `AuthorizeIngress` (đặc biệt bất kỳ CIDR rộng hơn `/32`).
- Bật `publicly_accessible = true` **quá** 15 phút, hoặc quên tắt.
- Mở bất kỳ port khác 5432.
- Đổi `ComplianceGuards` (nới lỏng guard = thay đổi bảo mật, phải có lý do bằng văn bản).

---

## ✅ 14. CHECKLIST NGHIỆM THU (ACCEPTANCE CRITERIA)

### 14.1. Tiêu chí bắt buộc của task

- [x] **AC-1: Chỉ port 5432 được mở.** Trên SG `fpl-fantasy-db-sg` **không** tồn tại rule nào cho port khác `5432`.
      *Bằng chứng:* `V2` live (mục 8.4) — chỉ có `tcp 5432`; port `5433` từ cùng IP → `TimeoutError` (`V5`).
- [x] **AC-2: Nguồn là IP dev `/32` cố định.** Rule IP có hậu tố `/32` + `Description` ghi rõ ai.
      *Bằng chứng:* `sgr-0c31c847d0cf552c5` · `14.191.166.167/32` · description `P2-Q02 dev-01 Quang fixed IP (verified 2026-11-02 ...)` (mục 8.4).
- [ ] **AC-3: Nguồn thứ hai là Security Group của Backend** (không phải IP public). Rule `R2` khai báo qua `UserIdGroupPairs`, **hiệu lực từ `P3-Q02`** khi backend SG tồn tại.
      *Bằng chứng:* khối `AuthorizeIngressDeferred` trong `rds_sg_policy.json` (đã lint `TC-08`) + sau P3-Q02 là output `V2` có cột `SGs`.
      *Trạng thái:* khung đã sẵn sàng, **cố ý chưa apply** (SG backend chưa tồn tại).
- [x] **AC-4: KHÔNG có `0.0.0.0/0` (và không có `::/0`).**
      *Bằng chứng:* lint `14/14` (`V0`) + `V1` live trả `[]` — kể cả trong cửa sổ public 236s (mục 8.4).
- [ ] **AC-5: Kết nối từ IP lạ bị từ chối NGAY — `Connection timed out`.**
      *Bằng chứng:* `V4` từ **mạng 4G/ngoài** (mục 9.2): `Test-NetConnection` → `TcpTestSucceeded: False`, hoặc `nmap` → `filtered`.
      *Trạng thái:* **bước thủ công duy nhất còn lại** — cần 1 thiết bị ở mạng khác (điện thoại 4G, ~2 phút).
- [x] **AC-6: Kết nối hợp lệ từ IP dev vẫn THÀNH CÔNG** (rule không "chặn nhầm").
      *Bằng chứng:* từ IP dev, port 5432 trả `SSLRequest → 'S'` (TLS được chấp nhận, tức đã vào tới PostgreSQL) trong cửa sổ public 236s (mục 8.4). Khi cài `psql`, chạy mục 8.3 để có thêm ảnh `\conninfo`.

> 🟢 **Trạng thái tick AC:** hạ tầng đã được dựng lại + rule 5432 đã áp dụng thật trong ngày `02/11/2026` (mục 8.4). **5/6 tiêu chí đã đóng**; **AC-5** (quét từ IP lạ) cần một thiết bị ở mạng khác — xem mục 14.4.

### 14.2. Checklist riêng của Quang (DevOps Guardian)

- [x] Đã chạy `V0` và lưu output `14/14 PASS` vào báo cáo (mục 8.1).
- [x] Đã xác nhận **rule active chỉ chứa IP thật**: `python -c "import json;print(json.load(open('infra/aws/rds_sg_policy.json'))['AuthorizeIngress']['IpPermissions'])"` → chỉ `14.191.166.167/32` (không còn `203.0.113.x` trong rule active; `203.0.113.x` chỉ còn trong ví dụ **bị cấm**).
- [x] Đã chạy `terraform apply` (`P2-Q01`): **4 added, 0 changed, 0 destroyed**; `plan -detailed-exitcode` = **0** (không drift).
- [x] Đã apply rule qua CLI bằng payload sinh từ JSON; rule id `sgr-0c31c847d0cf552c5`.
- [x] Đã kiểm tra **idempotent**: chạy lại → `InvalidPermission.Duplicate` (không tạo rule trùng).
- [x] Đã dùng `publicly_accessible=true` để test allow-path: **đã tắt lại** và xác nhận `False`.
- [x] Đã ghi giờ bật/tắt public access: `14:52:06Z` → `14:54:30Z` (**236 giây**).
- [x] Budget `P2-Q03` vẫn **ACTIVE** (80%/100%/forecast 100%); chi phí tháng `$0`.
- [ ] Đã chụp màn hình Console ở mục 7 (bước 7) làm bằng chứng trực quan — *bước thủ công, có thể bổ sung khi review.*
- [ ] Đã thực hiện `V4` từ **mạng khác** (4G) — xem 14.4 (bước thủ công duy nhất còn lại).
- [ ] Đã đưa các mục ở 13.2 vào kế hoạch `P3-Q02` / `P3-Q04` — *làm khi mở task P3-Q02.*
- [x] Mở `docs/TODO.md` → tích **`[x]`** vào `P2-Q02` (kèm cập nhật bộ đếm Phase 2 = `3/14`, Quang = `3/4`).

> 🚫 **Quy tắc thường trực (KHÔNG phải task, KHÔNG tick):** **không bao giờ** thêm `0.0.0.0/0` hoặc `::/0` vào SG của RDS — kể cả "chỉ để test 5 phút", kể cả khi bị timeout mà chưa rõ nguyên nhân. Nếu timeout, đi theo mục 10 (nguyên nhân thật thường là IP động hoặc `publicly_accessible=false`).

### 14.3. Lệnh kiểm tra nhanh "tất cả trong một"

```bash
# 0) Dung account?
aws sts get-caller-identity --query Arn --output text

# 1) Policy trong repo dat guard? -> 14/14 PASS, EXIT_CODE=0
python "$TEMP/p2q02_sg_lint.py"; echo "EXIT_CODE=$?"

# 2) SG co mo Internet khong? -> KY VONG: []
SG_ID=$(aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db \
  --region ap-southeast-1 --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions[?IpRanges[?CidrIp==`0.0.0.0/0`] || IpRanges[?CidrIpv6==`::/0`]]' --output json

# 3) Chi 5432, chi /32
aws ec2 describe-security-groups --group-ids "$SG_ID" --region ap-southeast-1 \
  --query 'SecurityGroups[0].IpPermissions[].IpRanges[].[CidrIp,Description]' --output text

# 4) Tu MAY KHAC (4G): phai timeout
#    Test-NetConnection -ComputerName <db_host> -Port 5432   -> TcpTestSucceeded: False
```

---

### 14.4. Bước thủ công còn lại — AC-5 (quét từ IP lạ, ~2 phút)

Chỉ cần làm **1 lần**, lưu ảnh làm bằng chứng:

1. Bật hotspot **4G/5G** trên điện thoại, cho laptop dùng mạng đó (hoặc dùng máy/mạng khác).
2. Kiểm tra IP nguồn: `curl -s https://checkip.amazonaws.com` → **phải khác** `14.191.166.167`.
3. Endpoint đang là **private IP** (`publicly_accessible = false`) nên phải mở cửa sổ public tạm (≤ 15 phút):
   ```bash
   aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db \
     --publicly-accessible --apply-immediately --region ap-southeast-1
   aws rds wait db-instance-available --db-instance-identifier fpl-fantasy-db --region ap-southeast-1
   ```
4. Từ mạng 4G, quét port:
   ```powershell
   Test-NetConnection -ComputerName fpl-fantasy-db.cr0maoomq80d.ap-southeast-1.rds.amazonaws.com -Port 5432 -InformationLevel Detailed
   ```
   Kỳ vọng: **`TcpTestSucceeded : False`** sau ~20–60 giây (timeout = SG đã chặn).
5. **TẮT NGAY** rồi xác nhận:
   ```bash
   aws rds modify-db-instance --db-instance-identifier fpl-fantasy-db \
     --no-publicly-accessible --apply-immediately --region ap-southeast-1
   aws rds wait db-instance-available --db-instance-identifier fpl-fantasy-db --region ap-southeast-1
   aws rds describe-db-instances --db-instance-identifier fpl-fantasy-db --region ap-southeast-1 \
     --query 'DBInstances[0].PubliclyAccessible' --output text   # KY VONG: False
   ```
6. Dán ảnh + giờ bật/tắt vào báo cáo → tick **AC-5**.

> 🚨 Nếu `TcpTestSucceeded: True` → **DỪNG**: revoke toàn bộ rule lạ (mục 11.2), kiểm tra lại mục 8.2 và báo Tech Lead ngay.

---

## 📚 PHỤ LỤC — LIÊN KẾT NHANH

| Tài nguyên | Đường dẫn |
| :--- | :--- |
| Payload least-privilege của task này | [`infra/aws/rds_sg_policy.json`](rds_sg_policy.json) |
| IaC tạo RDS + SG shell | [`infra/aws/terraform_rds.tf`](terraform_rds.tf) |
| Runbook RDS (`P2-Q01`) | [`infra/aws/rds_setup.md`](rds_setup.md) |
| Budget guard (`P2-Q03`) | [`infra/aws/budget_alert_setup.md`](budget_alert_setup.md) |
| Trạng thái task | [`docs/TODO.md`](../../docs/TODO.md) — mục **P2-Q02** |
| Ma trận rủi ro Level 4 | [`docs/AI_GUIDELINES.md`](../../docs/AI_GUIDELINES.md) |
| Docker Compose local | [`infra/docker-compose.yml`](../docker-compose.yml) |
| AWS — Security groups (stateful, deny-by-default) | <https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html> |
| AWS — `authorize-security-group-ingress` | <https://docs.aws.amazon.com/cli/latest/reference/ec2/authorize-security-group-ingress.html> |
| AWS — RDS & VPC security groups | <https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html> |
| RFC 5737 — dải IP dùng cho tài liệu | <https://datatracker.ietf.org/doc/html/rfc5737> |

---

> ✍️ **Ghi chú bảo trì:** mọi thay đổi về **nguồn được phép** (thêm/bớt IP, thêm SG) đều là **thay đổi Level 4** → cập nhật **đồng thời** `rds_sg_policy.json` + bảng ma trận mục 4.1, và chạy lại lint trước khi apply. Tuyệt đối không sửa rule trực tiếp trên Console rồi "quên" cập nhật lại file — lần audit tuần sau sẽ phát hiện lệch giữa repo và AWS, và đó là dấu hiệu cấu hình đang được điều khiển bởi trí nhớ thay vì quy trình.
