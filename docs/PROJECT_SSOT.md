# PROJECT SINGLE SOURCE OF TRUTH (SSOT)
# Fantasy Football Lineup Builder & Optimizer

> **QUY ĐỊNH BẮT BUỘC:** Mọi thành viên trong team và tất cả AI agents phải tuân thủ nghiêm ngặt các định nghĩa và hợp đồng kỹ thuật trong tài liệu này. Không tự ý thay đổi API spec, schema database hoặc luật nghiệp vụ nếu chưa có sự đồng thuận của Tech Lead.

---

## 1. TECH STACK SPECIFICATION

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | React + TypeScript + Vite | React 18+, Vite 5+ | SPA Framework, hiệu năng cao, build nhanh. |
| **Styling** | TailwindCSS + Shadcn/ui + Lucide Icons | Latest | UI System hiện đại, responsive. |
| **Data Viz** | Recharts | Latest | Vẽ biểu đồ so sánh Radar chart, Bar chart. |
| **State Management** | Zustand | Latest | Quản lý state sân bóng (Pitch state), localStorage. |
| **Data Fetching** | TanStack Query (React Query) | v5 | Cache API data, polling data. |
| **Backend** | Python (FastAPI) | 3.11+ / FastAPI 0.110+ | High-performance async REST API. |
| **ORM / Migration** | SQLAlchemy 2.0 (Async) + Alembic | Latest | Thao tác DB type-safe, migration an toàn. |
| **Optimization Solver** | PuLP | 2.8+ | Thư viện giải bài toán 0-1 Integer Linear Programming. |
| **Database** | PostgreSQL | 15+ | CSDL quan hệ chính. |
| **Infrastructure** | AWS Free Tier (S3, CloudFront, RDS db.t4g.micro, EC2/App Runner) | - | Triển khai cloud an toàn với chi phí $0. |

---

## 2. LUẬT NGHIỆP VỤ FANTASY PREMIER LEAGUE (FPL RULES)

1. **Tổng quân số đội hình:** Bắt buộc đúng **15 cầu thủ**.
2. **Phân bổ vị trí (Squad composition):**
   - 2 Thủ môn (GKP)
   - 5 Hậu vệ (DEF)
   - 5 Tiền vệ (MID)
   - 3 Tiền đạo (FWD)
3. **Đội hình xuất phát (Starting XI):** Đúng 11 cầu thủ đá chính, 4 cầu thủ dự bị trên bench (1 dự bị GKP + 3 dự bị outfield).
4. **Sơ đồ chiến thuật hợp lệ (Valid Formations):**
   - Luôn có đúng 1 GKP bắt chính.
   - Tối thiểu 3 DEF, tối đa 5 DEF.
   - Tối thiểu 2 MID, tối đa 5 MID.
   - Tối thiểu 1 FWD, tối đa 3 FWD.
   - Các sơ đồ hợp lệ: 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1, 5-2-3.
5. **Giới hạn ngân sách (Budget Cap):** Tổng giá trị mua 15 cầu thủ $\le \text{£}100.0\text{m}$.
6. **Giới hạn CLB (Club Limit):** Tối đa **3 cầu thủ** thuộc cùng một câu lạc bộ Ngoại Hạng Anh trong 1 đội hình.
7. **Captain & Vice-Captain:**
   - 1 Captain: Điểm được x2 (nhân đôi).
   - 1 Vice-Captain: Kích hoạt x2 nếu Captain không thi đấu phút nào.

---

## 3. DATABASE SCHEMA (POSTGRESQL SPEC)

```sql
-- 1. Bảng Teams (20 CLB Premier League)
CREATE TABLE teams (
    id INT PRIMARY KEY,                 -- ID đồng bộ từ FPL API (1 đến 20)
    name VARCHAR(100) NOT NULL,          -- Ví dụ: Arsenal, Manchester City
    short_name VARCHAR(5) NOT NULL,      -- Ví dụ: ARS, MCI
    strength INT DEFAULT 3,              -- Điểm sức mạnh tổng thể (1 - 5)
    strength_attack_home INT,
    strength_attack_away INT,
    strength_defence_home INT,
    strength_defence_away INT
);

-- 2. Bảng Players (Danh sách cầu thủ)
CREATE TABLE players (
    id INT PRIMARY KEY,                 -- FPL player ID (element id)
    first_name VARCHAR(100),
    second_name VARCHAR(100),
    web_name VARCHAR(100) NOT NULL,     -- Tên hiển thị trên áo (Haaland, Salah, Saka)
    team_id INT REFERENCES teams(id),
    element_type VARCHAR(5) NOT NULL,   -- 'GKP', 'DEF', 'MID', 'FWD'
    now_cost NUMERIC(4, 1) NOT NULL,    -- Giá (ví dụ: 15.2, 10.5)
    status VARCHAR(5) DEFAULT 'a',      -- 'a' (available), 'd' (doubtful), 'i' (injured), 's' (suspended)
    news TEXT,                          -- Chi tiết chấn thương nếu có
    total_points INT DEFAULT 0,         -- Tổng điểm mùa giải
    form NUMERIC(4, 1) DEFAULT 0.0,     -- Điểm phong độ trung bình các trận gần nhất
    selected_by_percent NUMERIC(4, 1),  -- % sở hữu
    expected_goals NUMERIC(5, 2),       -- xG
    expected_assists NUMERIC(5, 2),     -- xA
    ict_index NUMERIC(5, 1),            -- Chỉ số Influence, Creativity, Threat
    expected_points_next NUMERIC(4, 1)  -- Điểm dự kiến tuần tới (xP)
);

-- 3. Bảng Shared Lineups (Dành cho chức năng share link)
CREATE TABLE shared_lineups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_code VARCHAR(20) UNIQUE NOT NULL,
    lineup_name VARCHAR(100) NOT NULL,
    total_cost NUMERIC(4, 1) NOT NULL,
    predicted_points NUMERIC(5, 1) NOT NULL,
    player_data JSONB NOT NULL,         -- Danh sách 15 ID cầu thủ, kèm captain_id, vice_captain_id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. REST API CONTRACT SPECIFICATIONS

Tất cả các endpoint đều có tiền tố `/api/v1`.

### 4.1. Players & Teams
- **`GET /api/v1/teams`**
  - Response: `Array<Team>`
- **`GET /api/v1/players`**
  - Query Params:
    - `position` (optional): `GKP` | `DEF` | `MID` | `FWD`
    - `team_id` (optional): `int`
    - `max_cost` (optional): `float`
    - `search` (optional): `string`
    - `sort_by` (default: `total_points`): `total_points` | `now_cost` | `form` | `expected_points_next`
  - Response:
    ```json
    {
      "total": 650,
      "page": 1,
      "limit": 50,
      "items": [
        {
          "id": 355,
          "web_name": "Haaland",
          "team_short_name": "MCI",
          "element_type": "FWD",
          "now_cost": 15.2,
          "total_points": 180,
          "form": 7.8,
          "status": "a",
          "expected_points_next": 8.5
        }
      ]
    }
    ```

### 4.2. Optimizer Endpoint (Lõi tính toán)
- **`POST /api/v1/optimizer/solve`**
  - Request Body:
    ```json
    {
      "budget": 100.0,
      "locked_player_ids": [355, 328],  // Cầu thủ người dùng bắt buộc giữ
      "excluded_player_ids": [10],      // Cầu thủ không muốn chọn
      "target_formation": "3-4-3"       // Tùy chọn, để null nếu muốn AI tự chọn
    }
    ```
  - Response Body:
    ```json
    {
      "status": "optimal",
      "total_cost": 99.8,
      "total_expected_points": 78.4,
      "starting_xi": [ ...11 cầu thủ... ],
      "bench": [ ...4 cầu thủ... ],
      "captain_id": 355,
      "vice_captain_id": 328,
      "formation": "3-4-3"
    }
    ```

### 4.3. Comparison Endpoint (So sánh đội hình)
- **`POST /api/v1/lineups/compare`**
  - Request Body:
    ```json
    {
      "lineup_a_player_ids": [1, 2, 3, ...15 IDs],
      "lineup_b_player_ids": [4, 5, 6, ...15 IDs]
    }
    ```
  - Response Body:
    ```json
    {
      "lineup_a": { "total_cost": 99.5, "total_xp": 72.1, "attack_rating": 85, "defense_rating": 78 },
      "lineup_b": { "total_cost": 100.0, "total_xp": 74.5, "attack_rating": 90, "defense_rating": 74 },
      "head_to_head_delta": {
        "cost_diff": -0.5,
        "xp_diff": -2.4,
        "common_players_count": 8,
        "differential_players": [ ... ]
      }
    }
    ```

---

## 5. CẤU HÌNH BIẾN MÔI TRƯỜNG BẮT BUỘC (`.env.example`)

```env
# Backend Environment
ENVIRONMENT=development
PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/fantasy_fpl
CORS_ORIGINS=["http://localhost:5173", "http://localhost:3000"]
FPL_BOOTSTRAP_URL=https://fantasy.premierleague.com/api/bootstrap-static/

# AWS Free Tier Deploy Configurations (Production Only)
AWS_REGION=ap-southeast-1
S3_BUCKET_NAME=fpl-lineup-frontend-prod
CLOUDFRONT_DISTRIBUTION_ID=
```
