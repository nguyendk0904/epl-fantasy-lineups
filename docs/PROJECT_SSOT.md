# PROJECT SINGLE SOURCE OF TRUTH (SSOT)
# Fantasy Football Lineup Builder & Optimizer

> **QUY ĐỊNH BẮT BUỘC:** Mọi thành viên trong team và tất cả AI agents phải tuân thủ nghiêm ngặt các định nghĩa và hợp đồng kỹ thuật trong tài liệu này. Không tự ý thay đổi API spec, schema database hoặc luật nghiệp vụ nếu chưa có sự đồng thuận của Tech Lead.

---

## 1. TECH STACK SPECIFICATION

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | React + TypeScript + Vite | React 18+, Vite 5+ | SPA Framework, hiệu năng cao, build nhanh. |
| **Styling** | TailwindCSS + Lucide Icons | Latest | Shadcn/ui trong kế hoạch, chưa sử dụng. |
| **Data Viz** | Recharts | Latest | Vẽ biểu đồ so sánh Radar chart, Bar chart. |
| **State Management** | Zustand | Latest | Quản lý state sân bóng (Pitch state), localStorage. |
| **Data Fetching** | TanStack Query (React Query) | v5 | Đã khai báo dependency; chưa sử dụng trong frontend. Cache và polling bằng TanStack Query thuộc kế hoạch. |
| **Backend** | Python (FastAPI) | 3.11+ / FastAPI 0.110+ | High-performance async REST API. |
| **ORM / Migration** | SQLAlchemy 2.0 (Async) + Alembic | Latest | Thao tác DB type-safe, migration an toàn. |
| **Optimization Solver** | PuLP | 2.8+ | Thư viện giải bài toán 0-1 Integer Linear Programming. |
| **Database** | PostgreSQL | 15+ | CSDL quan hệ chính. |
| **Infrastructure** | AWS Free Tier (S3, CloudFront, RDS db.t4g.micro, EC2 + Caddy) | - | Triển khai cloud an toàn với chi phí $0. |

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
    chance_of_playing_next_round INT CHECK (chance_of_playing_next_round BETWEEN 0 AND 100), -- NULL: chưa biết; migration 005 (P4-NH01)
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

**Quy ước xP (FIX-03):** Trong response của `POST /api/v1/optimizer/solve`, `expected_points_next` của từng cầu thủ là xP sau điều chỉnh FDR, làm tròn một chữ số thập phân. Solver dùng xP sau FDR ở độ chính xác đầy đủ để chọn XI và đội trưởng. `total_expected_points` bằng tổng xP hiển thị của XI cộng thêm xP hiển thị của đội trưởng, làm tròn một chữ số thập phân.

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

### 4.4. Fixtures & Dream Team (P4-NH03)

- **`GET /api/v1/fixtures?gameweek=1`**: `gameweek` bắt buộc, 1–38. Giữ contract đã tích hợp frontend: array các trường `id`, `gameweek`, `kickoff_time` (UTC), `kickoff_date` (`dd/mm/yyyy`), `home_team`/`away_team` (`id`, `name`, `short_name`), `team_h_score`/`team_a_score` (nullable), `team_h_difficulty`/`team_a_difficulty`, `finished`. Sắp xếp kickoff rồi ID; bỏ qua trận thiếu kickoff hoặc FDR theo contract hiện tại. Vòng không có trận đủ dữ liệu trả `200 []`; thiếu/sai Gameweek trả `422`.
- **`GET /api/v1/dream-team/{gw}`**: `gw` từ 1–38. `200` trả cấu trúc tương thích `DreamTeamData` hiện có của frontend:
  - `gameweek`, `formation`, `total_points`.
  - `mvp`: `{id, name, points, team}`; `team` là tên CLB viết tắt.
  - `players`: đúng 11 phần tử `{id, web_name, team_short_name, team_id, element_type, points, goals, assists, clean_sheet, bonus, isMvp}`. Không tự tạo `team_code` khi DB chưa có.
- Giữ thứ tự `dream_teams.top_player_ids`; metadata tên/CLB/vị trí lấy từ players/teams hiện tại. Cộng stats qua mọi trận thuộc đúng Gameweek cho các cầu thủ được chọn; `bonus` lấy `bonus_points`, `clean_sheet=true` nếu có ít nhất một clean sheet. Không nhân điểm đội trưởng. Tổng điểm phải khớp snapshot Dream Team đã lưu; MVP là người có điểm cao nhất, bằng điểm thì chọn người xuất hiện trước trong snapshot.
- Chưa sync snapshot trả `404`; thiếu player/team/stats, sai sơ đồ hoặc tổng điểm chưa khớp trả `503` để sync lại. Lỗi SQL trả `503` với thông báo an toàn; Gameweek sai trả `422`. API chỉ đọc DB, không gọi FPL hoặc trả dữ liệu demo.
- Modal Dream Team hiện vẫn dùng dữ liệu mẫu; nối API vào UI là phần phối hợp riêng với NG, chưa nằm trong thay đổi backend này.

---

### 4.5. Leaderboard & Transfers — phạm vi demo P4-NH04

- **`GET /api/v1/leaderboard?gameweek=2`**: public, chỉ đọc điểm đã lưu trong `user_gameweek_lineups`; không tự gọi scoring hoặc tạo bảng BXH. Query `gameweek=1..38` bắt buộc; `sort_by=overall|gameweek` mặc định overall; `page>=1`, `limit=1..100` mặc định 100. Body giữ dạng array để tương thích loader frontend. Header `X-Total-Count`, `X-Page`, `X-Limit`, `X-Total-Pages` được expose qua CORS; ngoài trang cuối trả array rỗng.
- Mỗi entry: `{user_id, rank, previous_rank, manager_name, team_name, gameweek_points, total_points, favorite_club, captain_name, formation}`. Tổng điểm chỉ cộng đến vòng được yêu cầu, không lấy vòng tương lai; điểm tuần là điểm của chính vòng đó. Đồng điểm dùng hạng 1,1,3 và user ID làm thứ tự phụ ổn định. `previous_rank` là hạng tương ứng tại vòng trước; 0 nghĩa chưa có entry trước.
- Chưa có bảng users/profiles: `manager_name="Player #<id>"`, `team_name="Squad #<id>"` là nhãn demo theo ID, không phải tên cá nhân thật; `favorite_club=""` vì chưa lưu. Captain/sơ đồ lấy từ đội hình gần nhất đến vòng yêu cầu; dữ liệu chưa xác định dùng chuỗi rỗng. Frontend cần xử lý previous_rank=0 và giữ hạng server nếu muốn hiển thị đồng hạng.
- **`POST /api/v1/transfers/confirm`**: dùng `Authorization: Bearer <demo-token>`; danh tính lấy từ token, không nhận user ID trong body. Body gồm `gameweek` (integer 1–38), `starting_player_ids` (11), `bench_player_ids` (4), `formation`, `captain_id`, `vice_captain_id`; cấm các field thừa. ID duy nhất, C/V khác nhau và thuộc XI. Giá, CLB, vị trí, deadline và số lượt đều do server kiểm tra.
- Deadline lấy từ `events[].deadline_time` trong FPL bootstrap, dùng giờ UTC của server; nguồn không xác minh được trả 503 và không ghi DB. Kiểm tra lại sau khi đợi lock và trước commit. Sau deadline hoặc `is_locked=true` trả 400; kiểm tra đủ 15 vị trí chuẩn FPL, sơ đồ đúng XI, <=3 cầu thủ/CLB và tổng giá hiện tại <=100m.
- Mỗi lần chốt đếm số ID mới so với đội hình đã lưu cùng vòng; nếu chưa có thì so với đội hình vòng trước gần nhất. Lần chọn 15 người đầu tiên của người chơi tính 0 lượt. Tổng tối đa 3/vòng, không chuyển lượt dư sang vòng sau; đảo bench/XI hoặc đổi C/V không tính là mua cầu thủ mới. Retry cùng đội hình không tăng số lượt. Chốt là lưu trước deadline, không khóa vĩnh viễn ngay từ lần đầu.
- `200` trả `{lineup_id, user_id, gameweek, starting_player_ids, bench_player_ids, captain_id, vice_captain_id, formation, total_cost, transfers_count, transfers_used, remaining_transfers, deadline, is_locked}`. 400 cho giới hạn/deadline/đội hình/ngân sách; 404 nếu thiếu cầu thủ; 422 nếu body sai; 401 nếu token không hợp lệ/hết hạn; 503 nếu chưa bật demo writes, DB hoặc deadline không sẵn sàng. Lỗi không commit thay đổi một phần.
- PostgreSQL dùng advisory transaction lock theo user để bảo vệ cả lần tạo đầu tiên; đọc row hiện có FOR UPDATE. SQLite file dùng BEGIN IMMEDIATE cho test đồng thời. Lịch sử, lượt và đội hình nằm trong một transaction; không dựa trên lock trong bộ nhớ process.
- **Token demo, chưa phải hệ thống tài khoản/login:** `GAMEWEEK_DEMO_AUTH_ENABLED=false` mặc định. Khi bật phải đặt `GAMEWEEK_DEMO_TOKEN_SECRET` ngẫu nhiên >=32 ký tự, giữ riêng phía server. Token HMAC-SHA256 có user ID, thời hạn và audience cố định; hết hạn trả 401, đổi secret thu hồi mọi token cũ. Operator cấp token riêng từng người qua `python -m app.core.gameweek_auth --user-id 1 --hours 24` (1–168 giờ). Không có endpoint cấp token public; không gửi secret sang frontend hoặc đưa token/secret vào Git/chat/log. Chỉ chạy lệnh cấp token tại terminal riêng không bị thu thập output làm log.
- **Chấm điểm và bàn giao Q:** Sau khi deadline qua, NH01 cập nhật các fixture đã finished và NH02 cập nhật stats, chạy `python -m app.services.gameweek_service --score-gameweek 2` để gọi scoring engine hiện có của Vũ. Chỉ chấm khi có lịch, tất cả trận vòng đã kết thúc và mỗi trận có stats; ghi điểm/khóa lineup trong một transaction, chạy lại không cộng điểm lặp. BXH đọc điểm này; chưa có chấm điểm live tự động hoặc lịch chạy mới trong P4-NH04.
- NG cần nối token, payload và số lượt từ server vào TransferControl; màn hình hiện còn lưu cục bộ. Chưa tự thay frontend, schema DB, IAM, Docker hoặc CI/CD. Nghiệm thu PostgreSQL/RDS và tích hợp UI thực hiện riêng.

---

## 5. CẤU HÌNH BIẾN MÔI TRƯỜNG BẮT BUỘC (`.env.example`)

```env
# Frontend
VITE_API_BASE_URL=http://localhost:8000/api/v1

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
