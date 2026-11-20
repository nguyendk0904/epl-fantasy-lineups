import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Medal,
  Crown,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Users,
  Shield,
  Layers,
} from 'lucide-react';
import { DreamTeamModal } from './DreamTeamModal';

export interface LeaderboardEntry {
  rank: number;
  previous_rank: number;
  manager_name: string;
  team_name: string;
  gameweek_points: number;
  total_points: number;
  favorite_club: string;
  captain_name: string;
  formation: string;
}

/**
 * Sinh danh sách người chơi thực tế cho bảng xếp hạng (25 người chơi)
 */
export function generateLeaderboardData(gameweek: number): LeaderboardEntry[] {
  const baseManagers = [
    { name: 'Nguyên (UI Lead)', team: 'Antigravity Champions', club: 'ARS', captain: 'Haaland', form: '3-4-3' },
    { name: 'Quang (DevOps)', team: 'AWS Cloud Warriors FC', club: 'MCI', captain: 'Palmer', form: '4-3-3' },
    { name: 'Nhất (Backend)', team: 'FastAPI High Scorers', club: 'LIV', captain: 'Salah', form: '3-5-2' },
    { name: 'Vũ (Algo Solver)', team: 'PuLP 100m Optimizers', club: 'CHE', captain: 'Saka', form: '3-4-3' },
    { name: 'Minh Hoàng', team: 'The Invincibles 2026', club: 'ARS', captain: 'Haaland', form: '4-4-2' },
    { name: 'Tuấn Anh', team: 'Klopp Gegenpressing', club: 'LIV', captain: 'Salah', form: '3-4-3' },
    { name: 'Bảo Long', team: 'Tiki Taka Masterclass', club: 'MCI', captain: 'Palmer', form: '3-5-2' },
    { name: 'Gia Huy', team: 'Stamford Bridge Titans', club: 'CHE', captain: 'Haaland', form: '4-3-3' },
    { name: 'Đức Trọng', team: 'Old Trafford Dreams', club: 'MUN', captain: 'B.Fernandes', form: '4-4-2' },
    { name: 'Khánh Duy', team: 'Spurs Glory Hunters', club: 'TOT', captain: 'Son', form: '3-4-3' },
    { name: 'Hữu Phước', team: 'Villa Park Lions', club: 'AVL', captain: 'Watkins', form: '3-4-3' },
    { name: 'Thanh Tùng', team: 'Toon Army Strikers', club: 'NEW', captain: 'Isak', form: '4-3-3' },
    { name: 'Văn Hậu', team: 'The Seagulls Flight', club: 'BHA', captain: 'Pedro', form: '3-5-2' },
    { name: 'Anh Quân', team: 'Bees Honey Attack', club: 'BRE', captain: 'Mbeumo', form: '3-4-3' },
    { name: 'Thế Vinh', team: 'Craven Cottage XI', club: 'FUL', captain: 'Smith Rowe', form: '4-4-2' },
    { name: 'Quốc Đạt', team: 'Tricky Trees Fantasy', club: 'NFO', captain: 'Wood', form: '3-4-3' },
    { name: 'Hải Đăng', team: 'Goodison Park Hope', club: 'EVE', captain: 'Haaland', form: '5-3-2' },
    { name: 'Việt Hoàng', team: 'Selhurst Park Eagles', club: 'CRY', captain: 'Eze', form: '3-4-3' },
    { name: 'Đăng Khoa', team: 'Molineux Wanderers', club: 'WOL', captain: 'Cunha', form: '4-3-3' },
    { name: 'Tiến Dũng', team: 'Ipswich Tractor Boys', club: 'IPS', captain: 'Delap', form: '4-4-2' },
    { name: 'Hồng Phúc', team: 'London Stadium Irons', club: 'WHU', captain: 'Bowen', form: '3-4-3' },
    { name: 'Mạnh Cường', team: 'Premier League Fanatics', club: 'ARS', captain: 'Haaland', form: '3-4-3' },
    { name: 'Bá Đạt', team: 'Fantasy Masterminds', club: 'MCI', captain: 'Salah', form: '3-5-2' },
    { name: 'Thanh Bình', team: 'Golden Boot Hunters', club: 'LIV', captain: 'Palmer', form: '3-4-3' },
    { name: 'Trung Kiên', team: 'Clean Sheet Dreamers', club: 'ARS', captain: 'Gabriel', form: '5-3-2' },
  ];

  return baseManagers.map((m, index) => {
    const seed = (gameweek * 13 + index * 17) % 30;
    const gwPoints = 55 + ((seed * 7) % 35);
    const totalPoints = 550 + (25 - index) * 15 + ((gameweek * 11) % 40);
    const previousRank = Math.max(1, Math.min(25, index + 1 + (((index + gameweek) % 5) - 2)));

    return {
      rank: index + 1,
      previous_rank: previousRank,
      manager_name: m.name,
      team_name: m.team,
      gameweek_points: gwPoints,
      total_points: totalPoints,
      favorite_club: m.club,
      captain_name: m.captain,
      formation: m.form,
    };
  });
}

export interface LeaderboardViewProps {
  initialGameweek?: number;
  className?: string;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  initialGameweek = 11,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'gameweek' | 'overall'>('overall');
  const [gameweek, setGameweek] = useState<number>(initialGameweek);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDreamTeamOpen, setIsDreamTeamOpen] = useState<boolean>(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>(() =>
    generateLeaderboardData(initialGameweek)
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const pageSize = 10;

  // Tải dữ liệu bảng xếp hạng
  useEffect(() => {
    let isMounted = true;
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/leaderboard?gameweek=${gameweek}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setLeaderboardData(data);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Fallback tự động
      }

      if (isMounted) {
        setLeaderboardData(generateLeaderboardData(gameweek));
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
    return () => {
      isMounted = false;
    };
  }, [gameweek]);

  // Sắp xếp theo tab đang chọn (Điểm vòng hoặc Tổng điểm mùa giải)
  const sortedData = useMemo(() => {
    const list = [...leaderboardData];
    if (activeTab === 'gameweek') {
      list.sort((a, b) => b.gameweek_points - a.gameweek_points);
    } else {
      list.sort((a, b) => b.total_points - a.total_points);
    }
    // Gán lại rank sau khi sort
    return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [leaderboardData, activeTab]);

  // Lọc theo tìm kiếm tên hoặc tên đội
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return sortedData;
    const q = searchQuery.toLowerCase().trim();
    return sortedData.filter(
      (m) =>
        m.manager_name.toLowerCase().includes(q) ||
        m.team_name.toLowerCase().includes(q) ||
        m.favorite_club.toLowerCase().includes(q)
    );
  }, [sortedData, searchQuery]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage]);

  const top3 = sortedData.slice(0, 3);

  return (
    <div
      className={`bg-brand-card/90 border border-brand-border rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-6 ${className}`}
      data-testid="leaderboard-view"
    >
      {/* 1. Header Bảng Xếp Hạng & Nút Mở Dream Team */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shadow-lg shadow-amber-500/10">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>Bảng Xếp Hạng FPL</span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase tracking-wider">
                Mùa Giải 2026/27
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
              Theo dõi thứ hạng người chơi, vinh danh Top 3 và khám phá Đội hình tiêu biểu tuần.
            </p>
          </div>
        </div>

        {/* Nút mở Đội Hình Tiêu Biểu (Dream Team) */}
        <button
          onClick={() => setIsDreamTeamOpen(true)}
          className="self-start md:self-auto px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-brand-darker font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all"
        >
          <Crown className="w-4 h-4 fill-brand-darker" />
          <span>Đội Hình Tiêu Biểu (Dream Team)</span>
        </button>
      </div>

      {/* 2. Top 3 Podium (Bục Vinh Danh Top 3 Người Chơi Cao Nhất) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-black text-amber-400">
          <Sparkles className="w-4 h-4" />
          <span className="uppercase tracking-wider">BỤC VINH DANH CAO THỦ (TOP 3 LEADERBOARD)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 pt-1">
          {top3.map((entry, idx) => {
            const isFirst = idx === 0;
            const isSecond = idx === 1;
            const isThird = idx === 2;

            const podiumConfig = isFirst
              ? {
                  badge: '🥇 QUÁN QUÂN',
                  cardClass:
                    'bg-gradient-to-b from-amber-500/20 via-brand-darker to-brand-card/90 border-amber-400/80 shadow-amber-500/30 ring-2 ring-amber-400/40 md:-translate-y-2',
                  medalColor: 'text-amber-300',
                  rankColor: 'text-amber-400',
                }
              : isSecond
              ? {
                  badge: '🥈 Á QUÂN',
                  cardClass:
                    'bg-gradient-to-b from-slate-400/15 via-brand-darker to-brand-card/90 border-slate-300/60 shadow-slate-400/20',
                  medalColor: 'text-slate-300',
                  rankColor: 'text-slate-300',
                }
              : {
                  badge: '🥉 HẠNG BA',
                  cardClass:
                    'bg-gradient-to-b from-amber-700/15 via-brand-darker to-brand-card/90 border-amber-600/50 shadow-amber-700/20',
                  medalColor: 'text-amber-600',
                  rankColor: 'text-amber-500',
                };

            return (
              <div
                key={entry.rank}
                className={`relative rounded-3xl p-4 sm:p-5 border backdrop-blur-md shadow-2xl flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] ${podiumConfig.cardClass}`}
              >
                {/* Header Card */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded-full bg-brand-darker border border-white/10 uppercase">
                    {podiumConfig.badge}
                  </span>
                  <span className="text-xs font-bold text-brand-muted px-2 py-0.5 rounded-md bg-brand-darker border border-brand-border">
                    CLB: {entry.favorite_club}
                  </span>
                </div>

                {/* Tên & Team */}
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-black text-white truncate drop-shadow">
                    {entry.manager_name}
                  </h3>
                  <p className="text-xs text-brand-muted truncate font-medium">
                    {entry.team_name}
                  </p>
                </div>

                {/* Chỉ số điểm */}
                <div className="mt-4 pt-3 border-t border-brand-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-brand-muted block">Điểm GW {gameweek}</span>
                    <span className="text-xs font-extrabold text-brand-skyblue-light">
                      {entry.gameweek_points} pts
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-brand-muted block">Tổng Điểm Mùa</span>
                    <span className={`text-base sm:text-lg font-black ${podiumConfig.rankColor}`}>
                      {entry.total_points} pts
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Thanh Chuyển Tab (Điểm Vòng vs Toàn Mùa) & Gameweek Selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-brand-darker/70 p-2.5 rounded-2xl border border-brand-border">
        {/* Switch Tab Điểm */}
        <div className="flex items-center gap-1 bg-brand-dark p-1 rounded-xl border border-brand-border/60">
          <button
            onClick={() => setActiveTab('overall')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
              activeTab === 'overall'
                ? 'bg-brand-skyblue/20 text-brand-skyblue-light border border-brand-skyblue/40 shadow'
                : 'text-brand-muted hover:text-white'
            }`}
          >
            Tổng Điểm Mùa Giải
          </button>

          <button
            onClick={() => setActiveTab('gameweek')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
              activeTab === 'gameweek'
                ? 'bg-brand-skyblue/20 text-brand-skyblue-light border border-brand-skyblue/40 shadow'
                : 'text-brand-muted hover:text-white'
            }`}
          >
            Điểm Tuần (GW {gameweek})
          </button>
        </div>

        {/* Gameweek Selector */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <span className="text-xs font-bold text-brand-muted">Vòng đấu:</span>
          <button
            onClick={() => setGameweek((prev) => Math.max(1, prev - 1))}
            disabled={gameweek <= 1}
            className="p-1.5 rounded-lg bg-brand-card hover:bg-brand-card-hover border border-brand-border text-brand-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Vòng trước"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-black text-white px-2 py-1 rounded-lg bg-brand-card border border-brand-border min-w-[70px] text-center">
            GW {gameweek}
          </span>

          <button
            onClick={() => setGameweek((prev) => Math.min(38, prev + 1))}
            disabled={gameweek >= 38}
            className="p-1.5 rounded-lg bg-brand-card hover:bg-brand-card-hover border border-brand-border text-brand-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Vòng sau"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. Ô Tìm Kiếm Người Chơi */}
      <div className="relative">
        <Search className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          placeholder="Tìm kiếm theo tên Huấn Luyện Viên, tên Đội bóng, hoặc CLB yêu thích..."
          className="w-full bg-brand-darker/90 border border-brand-border rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-brand-muted focus:outline-none focus:border-brand-skyblue shadow-inner transition-colors"
          aria-label="Tìm kiếm người chơi"
        />
      </div>

      {/* 5. Bảng Chi Tiết Thứ Hạng Người Chơi */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-brand-muted space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-brand-skyblue border-t-transparent animate-spin" />
          <p className="text-xs font-bold">Đang tải bảng xếp hạng...</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="py-12 text-center text-brand-muted space-y-2">
          <p className="text-sm font-bold">Không tìm thấy người chơi nào khớp với từ khóa "{searchQuery}".</p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs font-bold text-brand-skyblue-light underline"
          >
            Xóa tìm kiếm
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-border/80 bg-brand-darker/60 shadow-xl">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-brand-darker/95 border-b border-brand-border text-[11px] font-black uppercase text-brand-muted tracking-wider">
              <tr>
                <th className="py-3 px-3 sm:px-4 text-center w-16">Thứ Hạng</th>
                <th className="py-3 px-3 sm:px-4">Huấn Luyện Viên & Đội Bóng</th>
                <th className="py-3 px-3 sm:px-4 text-center hidden md:table-cell">Đội Trưởng (C)</th>
                <th className="py-3 px-3 sm:px-4 text-center">Điểm Vòng</th>
                <th className="py-3 px-3 sm:px-4 text-right">Tổng Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/40">
              {paginatedData.map((entry) => {
                const rankDelta = entry.previous_rank - entry.rank;
                const isTop1 = entry.rank === 1;
                const isTop2 = entry.rank === 2;
                const isTop3 = entry.rank === 3;

                return (
                  <tr
                    key={entry.rank}
                    className="hover:bg-brand-card/50 transition-colors group"
                  >
                    {/* 1. Rank & Rank Change Delta */}
                    <td className="py-3 px-3 sm:px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                            isTop1
                              ? 'bg-amber-500 text-brand-darker shadow-lg shadow-amber-500/50'
                              : isTop2
                              ? 'bg-slate-300 text-brand-darker'
                              : isTop3
                              ? 'bg-amber-700 text-white'
                              : 'text-brand-muted'
                          }`}
                        >
                          {entry.rank}
                        </span>

                        {/* Delta Rank Arrow */}
                        <div className="text-[10px] font-bold min-w-[20px]">
                          {rankDelta > 0 ? (
                            <span className="text-emerald-400 flex items-center" title={`Tăng ${rankDelta} bậc`}>
                              <ArrowUp className="w-2.5 h-2.5" />
                              {rankDelta}
                            </span>
                          ) : rankDelta < 0 ? (
                            <span className="text-brand-hotpink-light flex items-center" title={`Giảm ${Math.abs(rankDelta)} bậc`}>
                              <ArrowDown className="w-2.5 h-2.5" />
                              {Math.abs(rankDelta)}
                            </span>
                          ) : (
                            <Minus className="w-2.5 h-2.5 text-brand-muted" title="Giữ nguyên thứ hạng" />
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 2. Manager Name, Team Name & Club Tag */}
                    <td className="py-3 px-3 sm:px-4">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-white text-xs sm:text-sm group-hover:text-brand-skyblue-light transition-colors truncate">
                            {entry.manager_name}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-brand-darker border border-white/10 text-brand-muted uppercase">
                            {entry.favorite_club}
                          </span>
                        </div>
                        <span className="text-[11px] text-brand-muted font-medium truncate mt-0.5">
                          {entry.team_name} • {entry.formation}
                        </span>
                      </div>
                    </td>

                    {/* 3. Captain */}
                    <td className="py-3 px-3 sm:px-4 text-center hidden md:table-cell">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-brand-darker border border-brand-border text-xs font-bold text-brand-white">
                        <span className="w-3.5 h-3.5 rounded-full bg-brand-hotpink text-white text-[9px] font-black flex items-center justify-center">
                          C
                        </span>
                        {entry.captain_name}
                      </span>
                    </td>

                    {/* 4. Gameweek Points */}
                    <td className="py-3 px-3 sm:px-4 text-center font-bold text-brand-skyblue-light text-xs sm:text-sm">
                      {entry.gameweek_points}
                    </td>

                    {/* 5. Total Points */}
                    <td className="py-3 px-3 sm:px-4 text-right font-black text-white text-xs sm:text-sm">
                      {entry.total_points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Phân Trang (Pagination Controls) */}
      <div className="flex items-center justify-between text-xs text-brand-muted pt-2 border-t border-brand-border/60">
        <span>
          Hiển thị {(currentPage - 1) * pageSize + 1} -{' '}
          {Math.min(currentPage * pageSize, filteredData.length)} / {filteredData.length} người chơi
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-xl bg-brand-darker hover:bg-brand-card border border-brand-border text-brand-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Trang trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-bold text-white px-2">
            Trang {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-xl bg-brand-darker hover:bg-brand-card border border-brand-border text-brand-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Trang sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Sân Bóng Vinh Danh Đội Hình Tiêu Biểu (Dream Team) */}
      <DreamTeamModal
        isOpen={isDreamTeamOpen}
        onClose={() => setIsDreamTeamOpen(false)}
        gameweek={gameweek}
      />
    </div>
  );
};
