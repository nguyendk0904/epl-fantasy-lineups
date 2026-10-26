import React, { useState } from 'react';
import { PositionType, LineupPlayer } from '../../types';
import { X, Plus, Shield } from 'lucide-react';

export const TEAM_CODE_MAP: Record<number, number> = {
  1: 3,    // Arsenal
  2: 7,    // Aston Villa
  3: 91,   // Bournemouth
  4: 94,   // Brentford
  5: 36,   // Brighton
  6: 8,    // Chelsea
  7: 31,   // Crystal Palace
  8: 11,   // Everton
  9: 54,   // Fulham
  10: 40,  // Ipswich
  11: 13,  // Leicester
  12: 14,  // Liverpool
  13: 43,  // Man City
  14: 1,   // Man Utd
  15: 4,   // Newcastle
  16: 17,  // Nottingham Forest
  17: 20,  // Southampton
  18: 6,   // Spurs
  19: 21,  // West Ham
  20: 39,  // Wolves
};

export function getPlayerKitUrl(teamId: number, position: PositionType, teamCode?: number): string {
  const code = teamCode || TEAM_CODE_MAP[teamId] || teamId;
  const isGKP = position === 'GKP';
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}${isGKP ? '_1' : ''}-66.webp`;
}

interface PlayerPitchSlotProps {
  player: LineupPlayer | null;
  expectedPosition: PositionType;
  isBench?: boolean;
  onSelectCaptain?: (id: number) => void;
  onSelectViceCaptain?: (id: number) => void;
  onRemovePlayer?: (id: number) => void;
  onAddPlayerClick?: (position: PositionType) => void;
}

export function PlayerPitchSlot({
  player,
  expectedPosition,
  isBench = false,
  onSelectCaptain,
  onSelectViceCaptain,
  onRemovePlayer,
  onAddPlayerClick,
}: PlayerPitchSlotProps) {
  const [imgError, setImgError] = useState(false);

  // Slot rỗng: Glassmorphism với viền đứt nét mờ ảo
  if (!player) {
    return (
      <div 
        onClick={() => onAddPlayerClick && onAddPlayerClick(expectedPosition)}
        className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all cursor-pointer group select-none
          backdrop-blur-md border border-dashed hover:scale-105 duration-200
          ${isBench 
            ? 'w-20 sm:w-24 h-28 sm:h-32 bg-slate-900/40 border-slate-700/50 hover:border-fpl-green/60 hover:bg-slate-800/50' 
            : 'w-20 sm:w-24 h-28 sm:h-32 bg-slate-950/40 border-white/20 hover:border-fpl-green/60 hover:bg-slate-900/60 shadow-lg'}`}
      >
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-fpl-green group-hover:bg-fpl-green/10 group-hover:scale-110 transition-all shadow-inner">
          <Plus className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-bold text-slate-300 mt-2 tracking-wider">
          {expectedPosition}
        </span>
      </div>
    );
  }

  const kitUrl = getPlayerKitUrl(player.team_id, player.element_type, player.team_code);

  return (
    <div className="relative group flex flex-col items-center w-20 sm:w-24 select-none">
      {/* Nút Xóa (X) Glassmorphism */}
      {onRemovePlayer && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemovePlayer(player.id);
          }}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500/80 backdrop-blur-md border border-rose-300/40 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-rose-600 transition-all z-30"
          title="Xóa cầu thủ"
          aria-label={`Xóa ${player.web_name}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Glassmorphism Card Container */}
      <div className={`relative w-full rounded-2xl p-2 pt-2.5 flex flex-col items-center transition-all duration-300
        backdrop-blur-md border shadow-xl group-hover:-translate-y-1 group-hover:shadow-2xl
        ${isBench 
          ? 'bg-slate-900/60 border-slate-700/50 hover:border-slate-500' 
          : 'bg-slate-950/50 border-white/15 hover:border-fpl-green/60 shadow-black/40'}`}
      >
        {/* Ánh sáng phản chiếu kính Glass Glare */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-2xl pointer-events-none" />

        {/* Áo thi đấu chính thức CLB (Premier League Jersey) */}
        <div className="relative cursor-pointer h-12 sm:h-14 flex items-center justify-center">
          {!imgError ? (
            <img
              src={kitUrl}
              alt={player.web_name}
              onError={() => setImgError(true)}
              className="h-12 sm:h-14 w-auto object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,0.6)] group-hover:scale-110 transition-transform duration-200"
              loading="lazy"
            />
          ) : (
            // Fallback nếu ảnh không tải được
            <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-purple-600 to-indigo-800 border border-purple-300 shadow-md flex items-center justify-center text-white">
              <Shield className="w-6 h-6 drop-shadow" />
            </div>
          )}

          {/* Badge Captain (C) - Glassmorphism Vàng */}
          {player.isCaptain && (
            <div className="absolute -bottom-1 -left-1.5 w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-lg border border-white ring-2 ring-amber-400/50 shadow-amber-500/50 z-20">
              C
            </div>
          )}

          {/* Badge Vice-Captain (V) - Glassmorphism Xanh Neon */}
          {player.isViceCaptain && (
            <div className="absolute -bottom-1 -left-1.5 w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-400 to-sky-300 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-lg border border-white ring-2 ring-sky-400/50 shadow-cyan-500/50 z-20">
              V
            </div>
          )}
        </div>

        {/* Tên cầu thủ (Glassmorphism Pill) */}
        <div className="mt-1.5 w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-1.5 py-0.5 text-center truncate shadow-inner">
          <p className="text-[11px] sm:text-xs font-bold text-white truncate tracking-tight">
            {player.web_name}
          </p>
        </div>

        {/* Giá & Điểm số (Glassmorphism Chip) */}
        <div className="w-full mt-1 bg-emerald-950/60 backdrop-blur-md border border-emerald-500/30 rounded-md px-1 py-0.5 text-center flex items-center justify-between text-[10px] text-emerald-300 font-semibold shadow-inner">
          <span>£{player.now_cost.toFixed(1)}m</span>
          <span className="text-white font-bold">{player.total_points}p</span>
        </div>
      </div>

      {/* Menu thao tác nhanh chọn C / V khi di chuột */}
      {!isBench && (
        <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-white/20 p-0.5 rounded-lg shadow-2xl z-40">
          <button
            onClick={() => onSelectCaptain && onSelectCaptain(player.id)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-black transition-colors ${
              player.isCaptain 
                ? 'bg-amber-400 text-slate-950' 
                : 'text-slate-300 hover:bg-slate-800 hover:text-amber-400'
            }`}
            title="Chọn làm Captain (x2 điểm)"
          >
            C
          </button>
          <button
            onClick={() => onSelectViceCaptain && onSelectViceCaptain(player.id)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-black transition-colors ${
              player.isViceCaptain 
                ? 'bg-sky-400 text-slate-950' 
                : 'text-slate-300 hover:bg-slate-800 hover:text-sky-400'
            }`}
            title="Chọn làm Vice-Captain"
          >
            V
          </button>
        </div>
      )}
    </div>
  );
}
