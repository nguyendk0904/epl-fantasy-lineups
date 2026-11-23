import { apiClient } from '../../services/apiClient';
import { MockDataBanner } from '../common/MockDataBanner';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { FixtureCard, FixtureItem, getFdrConfig } from './FixtureCard';
import { PREMIER_LEAGUE_TEAMS } from '../player-list/PlayerFilters';

export const CURRENT_GAMEWEEK = 11;
export const TOTAL_GAMEWEEKS = 38;

/**
 * Thuật toán sinh đầy đủ 38 vòng đấu Ngoại Hạng Anh (380 trận)
 * cho 20 CLB chuẩn Premier League kèm tỉ số và chỉ số độ khó FDR (1-5).
 */
export function generate38GameweekFixtures(): Record<number, FixtureItem[]> {
  const teams = PREMIER_LEAGUE_TEAMS;
  const n = teams.length; // 20 teams
  const fixturesByGw: Record<number, FixtureItem[]> = {};

  // Standard Berger round-robin pairings
  const teamList = [...teams];
  const roundRobinPairings: [number, number][][] = [];

  for (let round = 0; round < n - 1; round++) {
    const roundMatches: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = (round + i) % (n - 1);
      let away = (n - 1 - i + round) % (n - 1);
      if (i === 0) {
        away = n - 1;
      }
      if (round % 2 === 1) {
        roundMatches.push([home, away]);
      } else {
        roundMatches.push([away, home]);
      }
    }
    roundRobinPairings.push(roundMatches);
  }

  // Lượt đi: 19 vòng đầu (GW 1 -> 19)
  // Lượt về: 19 vòng sau đảo sân (GW 20 -> 38)
  for (let gw = 1; gw <= TOTAL_GAMEWEEKS; gw++) {
    const isReturnLeg = gw > 19;
    const roundIndex = (gw - 1) % 19;
    const pairings = roundRobinPairings[roundIndex];

    const isFinished = gw < CURRENT_GAMEWEEK;
    const dayOffset = (gw - 1) * 7;
    const baseDate = new Date(2026, 7, 15); // Khởi tranh 15/08/2026

    const matches: FixtureItem[] = pairings.map(([t1, t2], matchIndex) => {
      const homeIdx = isReturnLeg ? t2 : t1;
      const awayIdx = isReturnLeg ? t1 : t2;
      const homeTeam = teamList[homeIdx];
      const awayTeam = teamList[awayIdx];

      // Ngày thi đấu: Thứ 7 hoặc Chủ Nhật
      const matchDate = new Date(baseDate);
      matchDate.setDate(baseDate.getDate() + dayOffset + (matchIndex >= 7 ? 1 : 0));
      const dateFormatted = matchDate.toLocaleDateString('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      });

      const timeSlot = ['12:30', '15:00', '15:00', '15:00', '15:00', '17:30', '20:00', '14:00', '16:30', '20:00'][
        matchIndex % 10
      ];

      // FDR dựa theo chênh lệch sức mạnh tương đối giữa 2 CLB
      const bigSix = [1, 6, 14, 15, 16, 19]; // ARS, CHE, LIV, MCI, MUN, TOT
      const isHomeBig = bigSix.includes(homeTeam.id);
      const isAwayBig = bigSix.includes(awayTeam.id);

      let homeDifficulty = 3;
      let awayDifficulty = 3;

      if (isAwayBig && !isHomeBig) {
        homeDifficulty = 4;
        awayDifficulty = 2;
      } else if (isHomeBig && !isAwayBig) {
        homeDifficulty = 2;
        awayDifficulty = 4;
      } else if (isHomeBig && isAwayBig) {
        homeDifficulty = 4;
        awayDifficulty = 4;
      }

      // Tạo tỉ số giả lập thực tế cho các vòng đã đá (GW 1 -> 10)
      let team_h_score: number | null = null;
      let team_a_score: number | null = null;

      if (isFinished) {
        const seed = (gw * 31 + homeTeam.id * 7 + awayTeam.id) % 10;
        team_h_score = (seed % 4) + (isHomeBig ? 1 : 0);
        team_a_score = ((seed + 2) % 3) + (isAwayBig ? 1 : 0);
      }

      return {
        id: gw * 100 + matchIndex + 1,
        gameweek: gw,
        kickoff_time: timeSlot,
        kickoff_date: dateFormatted,
        home_team: {
          id: homeTeam.id,
          name: homeTeam.name,
          short_name: homeTeam.short_name,
        },
        away_team: {
          id: awayTeam.id,
          name: awayTeam.name,
          short_name: awayTeam.short_name,
        },
        team_h_score,
        team_a_score,
        team_h_difficulty: homeDifficulty,
        team_a_difficulty: awayDifficulty,
        finished: isFinished,
      };
    });

    fixturesByGw[gw] = matches;
  }

  return fixturesByGw;
}

export const ALL_38_GAMEWEEK_FIXTURES = generate38GameweekFixtures();

export async function loadFixtures(gameweek: number) {
  try {
    const data = await apiClient.get<FixtureItem[]>('/fixtures', { params: { gameweek } });
    if (Array.isArray(data) && data.length > 0) return { data, isMock: false };
  } catch {
    // Keep the demo available when the API request fails.
  }
  return { data: ALL_38_GAMEWEEK_FIXTURES[gameweek] || [], isMock: true };
}

export interface FixturesViewProps {
  initialGameweek?: number;
  onSelectTeam?: (teamId: number) => void;
  className?: string;
}

export const FixturesView: React.FC<FixturesViewProps> = ({
  initialGameweek = CURRENT_GAMEWEEK,
  onSelectTeam,
  className = '',
}) => {
  const [gameweek, setGameweek] = useState<number>(initialGameweek);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<number | 'ALL'>('ALL');
  const [fixtures, setFixtures] = useState<FixtureItem[]>([]);
  const [isMock, setIsMock] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showFdrLegend, setShowFdrLegend] = useState<boolean>(false);

  // Kéo dữ liệu vòng đấu từ API hoặc nạp từ dataset 38 vòng chuẩn
  useEffect(() => {
    let isMounted = true;
    const fetchFixtures = async () => {
      setIsLoading(true);
      const result = await loadFixtures(gameweek);
      if (isMounted) {
        setFixtures(result.data);
        setIsMock(result.isMock);
        setIsLoading(false);
      }
    };

    fetchFixtures();
    return () => {
      isMounted = false;
    };
  }, [gameweek]);

  // Lọc theo CLB nếu người dùng chọn
  const filteredFixtures = useMemo(() => {
    if (selectedTeamFilter === 'ALL') {
      return fixtures;
    }
    return fixtures.filter(
      (m) =>
        m.home_team.id === selectedTeamFilter ||
        m.away_team.id === selectedTeamFilter
    );
  }, [fixtures, selectedTeamFilter]);

  // Gom nhóm trận đấu theo ngày
  const groupedMatches = useMemo(() => {
    return filteredFixtures.reduce<Record<string, FixtureItem[]>>((acc, match) => {
      const dateKey = match.kickoff_date || 'Lịch chưa ấn định';
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(match);
      return acc;
    }, {});
  }, [filteredFixtures]);

  const isCurrentGW = gameweek === CURRENT_GAMEWEEK;
  const isPastGW = gameweek < CURRENT_GAMEWEEK;

  return (
    <div
      className={`bg-brand-card/90 border border-brand-border rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-6 ${className}`}
      data-testid="fixtures-view"
    >
      {isMock && <MockDataBanner />}
      {/* 1. Header & Điều hướng Gameweek */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-skyblue/15 border border-brand-skyblue/30 flex items-center justify-center text-brand-skyblue-light shadow-md">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-brand-white flex items-center gap-2">
                <span>Lịch Thi Đấu & Độ Khó FDR</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-brand-skyblue/20 text-brand-skyblue-light border border-brand-skyblue/40 font-bold uppercase tracking-wider">
                  38 Vòng EPL
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
                Theo dõi kết quả thực tế và đánh giá độ khó đối đầu (FDR 1 - 5) để tối ưu đội hình.
              </p>
            </div>
          </div>
        </div>

        {/* Nút bấm chuyển vòng trước/sau + Nhảy đến vòng hiện tại */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setGameweek(CURRENT_GAMEWEEK)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              isCurrentGW
                ? 'bg-brand-skyblue/20 text-brand-skyblue-light border-brand-skyblue/50'
                : 'bg-brand-darker hover:bg-brand-card text-brand-muted hover:text-white border-brand-border'
            }`}
            title="Nhảy đến vòng đấu hiện tại"
          >
            Vòng hiện tại (GW {CURRENT_GAMEWEEK})
          </button>

          <div className="flex items-center gap-1 bg-brand-darker/90 p-1 rounded-xl border border-brand-border shadow-inner">
            <button
              onClick={() => setGameweek((prev) => Math.max(1, prev - 1))}
              disabled={gameweek <= 1}
              className="p-1.5 rounded-lg text-brand-muted hover:text-brand-white hover:bg-brand-card disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Vòng trước"
              aria-label="Vòng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs sm:text-sm font-black text-brand-white px-3 min-w-[110px] text-center">
              Gameweek {gameweek}
            </span>

            <button
              onClick={() => setGameweek((prev) => Math.min(TOTAL_GAMEWEEKS, prev + 1))}
              disabled={gameweek >= TOTAL_GAMEWEEKS}
              className="p-1.5 rounded-lg text-brand-muted hover:text-brand-white hover:bg-brand-card disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Vòng sau"
              aria-label="Vòng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Thanh cuộn ngang chọn nhanh 38 vòng (Gameweek Chips Selector) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-brand-muted px-1">
          <span className="font-semibold flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-brand-skyblue-light" />
            Chọn nhanh vòng đấu (1 - 38):
          </span>
          <span className="font-bold text-brand-skyblue-light">
            {isPastGW ? '✓ Đã kết thúc' : isCurrentGW ? '⚡ Đang diễn ra' : '⏳ Sắp diễn ra'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-brand-border scrollbar-track-transparent">
          {Array.from({ length: TOTAL_GAMEWEEKS }, (_, i) => i + 1).map((gwNum) => {
            const isSelected = gwNum === gameweek;
            const isCurrent = gwNum === CURRENT_GAMEWEEK;
            const isFinished = gwNum < CURRENT_GAMEWEEK;

            return (
              <button
                key={gwNum}
                onClick={() => setGameweek(gwNum)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-200 border ${
                  isSelected
                    ? 'bg-gradient-to-r from-brand-skyblue to-brand-skyblue-light text-brand-darker border-white shadow-lg shadow-brand-skyblue/30 scale-105'
                    : isCurrent
                    ? 'bg-brand-skyblue/20 text-brand-skyblue-light border-brand-skyblue/50 hover:bg-brand-skyblue/30'
                    : isFinished
                    ? 'bg-brand-darker/80 text-brand-white/80 border-brand-border/60 hover:border-brand-skyblue/40 hover:text-white'
                    : 'bg-brand-darker/50 text-brand-muted border-brand-border/40 hover:border-brand-border hover:text-white'
                }`}
                aria-label={`Gameweek ${gwNum}`}
                aria-pressed={isSelected}
              >
                GW {gwNum}
                {isFinished && <span className="ml-1 text-[9px] opacity-70">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Bộ lọc CLB & Bảng giải thích chỉ số FDR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-brand-darker/60 p-3 rounded-2xl border border-brand-border/80">
        {/* Lọc theo CLB */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-brand-skyblue-light shrink-0" />
          <span className="text-xs font-bold text-brand-muted shrink-0">Lọc CLB:</span>
          <select
            value={selectedTeamFilter}
            onChange={(e) =>
              setSelectedTeamFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
            }
            className="bg-brand-card text-brand-white text-xs font-bold rounded-xl border border-brand-border px-3 py-1.5 focus:outline-none focus:border-brand-skyblue cursor-pointer"
            aria-label="Lọc theo CLB"
          >
            <option value="ALL">Tất cả 20 Câu Lạc Bộ</option>
            {PREMIER_LEAGUE_TEAMS.map((team) => (
              <option key={team.id} value={team.id}>
                {team.short_name} - {team.name}
              </option>
            ))}
          </select>

          {selectedTeamFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedTeamFilter('ALL')}
              className="text-xs text-brand-hotpink-light hover:underline font-bold"
            >
              Xóa lọc
            </button>
          )}
        </div>

        {/* Nút bật/tắt Bảng giải thích FDR */}
        <button
          onClick={() => setShowFdrLegend((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-skyblue-light hover:text-white transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          <span>{showFdrLegend ? 'Ẩn chú thích FDR' : 'Giải thích độ khó FDR'}</span>
        </button>
      </div>

      {/* 4. Bảng chú thích độ khó FDR (Fixture Difficulty Rating) */}
      {showFdrLegend && (
        <div className="bg-brand-darker/90 border border-brand-skyblue/30 rounded-2xl p-4 space-y-3 animate-fade-in shadow-xl">
          <div className="flex items-center gap-2 text-xs font-black text-brand-skyblue-light">
            <Sparkles className="w-4 h-4" />
            <span>QUY ƯỚC CHỈ SỐ ĐỘ KHÓ TRẬN ĐẤU (FDR - FIXTURE DIFFICULTY RATING)</span>
          </div>
          <p className="text-xs text-brand-muted">
            FDR dao động từ 1 (rất dễ) đến 5 (rất khó). Thuật toán tối ưu (Optimizer) dùng FDR để nhân hệ số xP dự kiến:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            {[1, 2, 3, 4, 5].map((lvl) => {
              const cfg = getFdrConfig(lvl);
              return (
                <div
                  key={lvl}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center ${cfg.badgeClass}`}
                >
                  <span className="text-xs font-black">FDR {lvl}</span>
                  <span className="text-[11px] font-bold mt-0.5">{cfg.label}</span>
                  <span className="text-[10px] opacity-80 mt-0.5">x{cfg.multiplier}x xP</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Danh sách các trận đấu theo nhóm ngày */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-brand-muted space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-brand-skyblue border-t-transparent animate-spin" />
          <p className="text-xs font-bold">Đang tải lịch thi đấu Gameweek {gameweek}...</p>
        </div>
      ) : Object.keys(groupedMatches).length === 0 ? (
        <div className="py-12 text-center text-brand-muted space-y-2">
          <p className="text-sm font-bold">Không tìm thấy trận đấu nào cho bộ lọc này.</p>
          <button
            onClick={() => setSelectedTeamFilter('ALL')}
            className="text-xs font-bold text-brand-skyblue-light underline"
          >
            Xem toàn bộ trận đấu
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedMatches).map(([dateLabel, matches]) => (
            <div key={dateLabel} className="space-y-3">
              {/* Tiêu đề ngày thi đấu */}
              <div className="flex items-center gap-2 border-b border-brand-border/40 pb-1.5">
                <span className="text-xs font-extrabold text-brand-white uppercase tracking-wider bg-brand-darker/90 px-3 py-1 rounded-lg border border-brand-border/60">
                  {dateLabel}
                </span>
                <span className="text-xs text-brand-muted font-semibold">
                  ({matches.length} trận)
                </span>
              </div>

              {/* Grid 2 cột các trận đấu */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {matches.map((fixture) => (
                  <FixtureCard
                    key={fixture.id}
                    fixture={fixture}
                    onSelectTeam={onSelectTeam}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
