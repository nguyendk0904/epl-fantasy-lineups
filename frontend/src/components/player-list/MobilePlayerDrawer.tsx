import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, ShieldAlert, ArrowUpDown, ChevronDown } from 'lucide-react';
import { Player, PositionType } from '../../types';
import { PREMIER_LEAGUE_TEAMS } from './PlayerFilters';
import { getPlayerKitUrl } from '../pitch/PlayerPitchSlot';

export interface MobilePlayerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  targetSlot?: {
    position: PositionType;
    slotIndex?: number;
    isBench?: boolean;
  } | null;
  players: Player[];
  selectedPlayerIds?: number[];
  onSelectPlayer: (player: Player) => void;
  remainingBudget?: number;
  clubCounts?: Record<number, number>;
}

type SortField = 'total_points' | 'now_cost_desc' | 'now_cost_asc' | 'form' | 'expected_points_next';

const POSITIONS: { label: string; value: PositionType | 'ALL' }[] = [
  { label: 'Tất cả', value: 'ALL' },
  { label: 'GKP', value: 'GKP' },
  { label: 'DEF', value: 'DEF' },
  { label: 'MID', value: 'MID' },
  { label: 'FWD', value: 'FWD' },
];

export const MobilePlayerDrawer: React.FC<MobilePlayerDrawerProps> = ({
  isOpen,
  onClose,
  targetSlot = null,
  players,
  selectedPlayerIds = [],
  onSelectPlayer,
  remainingBudget = 100.0,
  clubCounts = {},
}) => {
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<PositionType | 'ALL'>(targetSlot ? targetSlot.position : 'ALL');
  const [teamId, setTeamId] = useState<number | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<SortField>('total_points');

  // Sync position when targetSlot changes or drawer opens
  useEffect(() => {
    if (targetSlot) {
      setPosition(targetSlot.position);
    }
  }, [targetSlot, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const filteredAndSortedPlayers = useMemo(() => {
    return players
      .filter((p) => {
        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const fullName = `${p.first_name ?? ''} ${p.second_name ?? ''} ${p.web_name}`.toLowerCase();
          if (!fullName.includes(q)) return false;
        }

        // Position filter
        if (position !== 'ALL' && p.element_type !== position) {
          return false;
        }

        // Team filter
        if (teamId !== 'ALL' && p.team_id !== teamId) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'total_points':
            return b.total_points - a.total_points;
          case 'now_cost_desc':
            return b.now_cost - a.now_cost;
          case 'now_cost_asc':
            return a.now_cost - b.now_cost;
          case 'form':
            return (b.form ?? 0) - (a.form ?? 0);
          case 'expected_points_next':
            return (b.expected_points_next ?? 0) - (a.expected_points_next ?? 0);
          default:
            return 0;
        }
      });
  }, [players, search, position, teamId, sortBy]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Bảng chọn cầu thủ Mobile"
      data-testid="mobile-player-drawer"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-brand-darker/80 backdrop-blur-sm transition-opacity animate-fade-in"
        aria-hidden="true"
      />

      {/* Drawer Content Sheet */}
      <div className="relative z-10 w-full max-h-[85vh] sm:max-h-[80vh] flex flex-col bg-brand-dark/95 border-t border-brand-border rounded-t-3xl shadow-2xl backdrop-blur-xl animate-slide-up">
        {/* Drag handle bar */}
        <div className="w-full flex justify-center pt-3 pb-1 cursor-grab">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-brand-border">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                {targetSlot ? `Chọn ${targetSlot.position}` : 'Chọn Cầu Thủ'}
              </h2>
              {targetSlot && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-skyblue/20 border border-brand-skyblue/40 text-brand-skyblue-light uppercase">
                  {targetSlot.isBench ? 'Ghế dự bị' : 'Đá chính'}
                </span>
              )}
            </div>
            <p className="text-xs text-brand-muted">
              {targetSlot ? `Thay thế vị trí slot #${(targetSlot.slotIndex ?? 0) + 1}` : 'Thêm cầu thủ vào đội hình'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-brand-card hover:bg-brand-card-hover border border-white/10 text-brand-muted hover:text-white transition-all active:scale-95"
            aria-label="Đóng bảng chọn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Search & Filters Area */}
        <div className="p-3 border-b border-brand-border space-y-2.5 bg-brand-darker/50">
          {/* Search bar */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <input
              type="text"
              role="searchbox"
              aria-label="Tìm kiếm cầu thủ"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên cầu thủ (VD: Haaland, Salah...)"
              className="w-full pl-9 pr-8 py-2 bg-brand-card border border-brand-border rounded-xl text-xs sm:text-sm text-brand-white placeholder-brand-muted focus:outline-none focus:border-brand-skyblue focus:ring-1 focus:ring-brand-skyblue transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-white p-0.5"
                aria-label="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Position Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {POSITIONS.map((pos) => {
              const isActive = position === pos.value;
              return (
                <button
                  key={pos.value}
                  onClick={() => setPosition(pos.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 active:scale-95 ${
                    isActive
                      ? 'bg-brand-skyblue text-brand-darker shadow-md shadow-brand-skyblue/20'
                      : 'bg-brand-card text-brand-muted hover:text-brand-white border border-brand-border/60'
                  }`}
                >
                  {pos.label}
                </button>
              );
            })}
          </div>

          {/* Sort & Team Controls Row */}
          <div className="flex items-center gap-2">
            {/* Team select */}
            <div className="flex-1 relative">
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="w-full bg-brand-card border border-brand-border text-brand-white text-xs rounded-xl px-2.5 py-1.5 pr-7 appearance-none focus:outline-none focus:border-brand-skyblue"
                aria-label="Lọc theo CLB"
              >
                <option value="ALL">Tất cả CLB ({PREMIER_LEAGUE_TEAMS.length})</option>
                {PREMIER_LEAGUE_TEAMS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.short_name})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-brand-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Sort select */}
            <div className="flex-1 relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="w-full bg-brand-card border border-brand-border text-brand-white text-xs rounded-xl px-2.5 py-1.5 pr-7 appearance-none focus:outline-none focus:border-brand-skyblue"
                aria-label="Sắp xếp danh sách"
              >
                <option value="total_points">Điểm cao nhất</option>
                <option value="expected_points_next">xP cao nhất</option>
                <option value="form">Phong độ cao</option>
                <option value="now_cost_desc">Giá cao xuống thấp</option>
                <option value="now_cost_asc">Giá thấp lên cao</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-brand-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Player List (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredAndSortedPlayers.length === 0 ? (
            <div className="text-center py-12 text-brand-muted space-y-2">
              <ShieldAlert className="w-8 h-8 mx-auto text-brand-muted/60" />
              <p className="text-sm font-semibold">Không tìm thấy cầu thủ phù hợp</p>
              <p className="text-xs text-brand-muted/80">Thử đổi từ khóa tìm kiếm hoặc bỏ chọn bộ lọc vị trí/CLB.</p>
            </div>
          ) : (
            filteredAndSortedPlayers.map((player) => {
              const isSelected = selectedPlayerIds.includes(player.id);
              const clubCount = clubCounts[player.team_id] || 0;
              const isClubLimitReached = !isSelected && clubCount >= 3;
              const isOverBudget = !isSelected && player.now_cost > remainingBudget;
              const isDisabled = isSelected || isClubLimitReached;

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-brand-card/40 border-brand-border/40 opacity-60'
                      : 'bg-brand-card hover:bg-brand-card-hover border-brand-border hover:border-brand-skyblue/50 shadow-md'
                  }`}
                >
                  {/* Left: Shirt & Info */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={getPlayerKitUrl(player.team_id, player.element_type, player.team_code)}
                      alt={player.web_name}
                      className="w-10 h-10 object-contain drop-shadow"
                      loading="lazy"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                          {player.web_name}
                        </span>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-darker border border-white/10 text-brand-skyblue-light uppercase">
                          {player.element_type}
                        </span>
                        <span className="text-[10px] font-semibold text-brand-muted uppercase">
                          {player.team_short_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-brand-muted">
                        <span className="font-extrabold text-brand-skyblue-light">
                          £{player.now_cost.toFixed(1)}m
                        </span>
                        <span>•</span>
                        <span>{player.total_points} pts</span>
                        {player.expected_points_next !== undefined && (
                          <>
                            <span>•</span>
                            <span className="text-brand-hotpink-light font-medium">
                              {player.expected_points_next} xP
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Action button */}
                  <div className="shrink-0 pl-2">
                    {isSelected ? (
                      <span className="px-3 py-1.5 rounded-xl bg-brand-darker border border-brand-border text-brand-muted text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-brand-skyblue" />
                        <span>Đã chọn</span>
                      </span>
                    ) : isClubLimitReached ? (
                      <span className="px-2.5 py-1.5 rounded-xl bg-brand-hotpink/10 border border-brand-hotpink/30 text-brand-hotpink-light text-[11px] font-bold">
                        Max 3/CLB
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          onSelectPlayer(player);
                          onClose();
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-md ${
                          isOverBudget
                            ? 'bg-brand-hotpink-dark/80 hover:bg-brand-hotpink-dark text-white'
                            : 'bg-gradient-to-r from-brand-skyblue to-brand-skyblue-light text-brand-darker hover:brightness-110 shadow-brand-skyblue/20'
                        }`}
                        title={isOverBudget ? 'Vượt quá ngân sách còn lại!' : 'Chọn cầu thủ này'}
                      >
                        <span>+ Chọn</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MobilePlayerDrawer;
