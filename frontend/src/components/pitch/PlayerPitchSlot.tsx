import React, { useState } from 'react';
import { PositionType, LineupPlayer } from '../../types';
import { X, Plus, Shield } from 'lucide-react';

export const TEAM_CODE_MAP: Record<number, number> = {
  1: 3,    // Arsenal (ARS)
  2: 7,    // Aston Villa (AVL)
  3: 94,   // Brentford (BRE)
  4: 36,   // Brighton (BHA)
  5: 8,    // Chelsea (CHE)
  6: 31,   // Crystal Palace (CRY)
  7: 11,   // Everton (EVE)
  8: 54,   // Fulham (FUL)
  9: 14,   // Liverpool (LIV)
  10: 43,  // Man City (MCI)
  11: 1,   // Man Utd (MUN)
  12: 4,   // Newcastle (NEW)
  13: 17,  // Nottingham Forest (NFO)
  14: 6,   // Tottenham (TOT)
  15: 21,  // West Ham (WHU)
  16: 39,  // Wolves (WOL)
};

export function getPlayerKitUrl(teamId: number, position: PositionType, teamCode?: number): string {
  const code = teamCode || TEAM_CODE_MAP[teamId] || teamId;
  const isGKP = position === 'GKP';
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}${isGKP ? '_1' : ''}-66.webp`;
}

interface PlayerPitchSlotProps {
  player: LineupPlayer | null;
  expectedPosition: PositionType;
  slotIndex?: number;
  isBench?: boolean;
  onSelectCaptain?: (id: number) => void;
  onSelectViceCaptain?: (id: number) => void;
  onRemovePlayer?: (id: number) => void;
  onAddPlayerClick?: (position: PositionType, slotIndex?: number, isBench?: boolean) => void;
}

export function PlayerPitchSlot({
  player,
  expectedPosition,
  slotIndex = 0,
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
        onClick={() => onAddPlayerClick && onAddPlayerClick(expectedPosition, slotIndex, isBench)}
        className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all cursor-pointer group select-none
          backdrop-blur-md border border-dashed hover:scale-105 duration-200
          ${isBench 
            ? 'w-20 sm:w-24 h-28 sm:h-32 bg-brand-darker/40 border-brand-border/60 hover:border-brand-skyblue hover:bg-brand-card/50' 
            : 'w-20 sm:w-24 h-28 sm:h-32 bg-brand-darker/40 border-white/20 hover:border-brand-skyblue hover:bg-brand-card/60 shadow-lg'}`}
      >
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-brand-muted group-hover:text-brand-skyblue-light group-hover:bg-brand-skyblue/10 group-hover:scale-110 transition-all shadow-inner">
          <Plus className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-bold text-brand-white mt-2 tracking-wider">
          {expectedPosition}
        </span>
      </div>
    );
  }

  const kitUrl = getPlayerKitUrl(player.team_id, player.element_type, player.team_code);

  return (
    <div className="relative group flex flex-col items-center w-20 sm:w-24 select-none pb-7">
      {/* Nút Xóa (X) Glassmorphism - luôn hiển thị trên mobile/touch */}
      {onRemovePlayer && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemovePlayer(player.id);
          }}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-hotpink-dark backdrop-blur-md border border-brand-hotpink/40 text-brand-white flex items-center justify-center shadow-lg hover:scale-110 hover:bg-brand-hotpink transition-all z-30"
          title="Xóa cầu thủ"
          aria-label={`Xóa ${player.web_name}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Glassmorphism Card Container */}
      <div className={`relative w-full rounded-2xl p-1.5 pt-2 flex flex-col items-center transition-all duration-300
        backdrop-blur-md border shadow-xl group-hover:-translate-y-1 group-hover:shadow-2xl
        ${isBench 
          ? 'bg-brand-card/70 border-brand-border hover:border-brand-border-light' 
          : 'bg-brand-card/70 border-white/15 hover:border-brand-skyblue shadow-black/40'}`}
      >
        {/* Ánh sáng phản chiếu kính Glass Glare */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-2xl pointer-events-none" />

        {/* 1. Giá hiển thị nhỏ ở trên cùng thẻ theo phong cách FPL */}
        <div className="w-full text-center mb-1">
          <span className="inline-block px-1.5 py-0.5 rounded bg-brand-darker/80 border border-brand-skyblue/30 text-[10px] font-bold text-brand-skyblue-light tracking-tight">
            £{player.now_cost.toFixed(1)}m
          </span>
        </div>

        {/* 2. Áo thi đấu chính thức CLB */}
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
            <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-brand-skyblue-dark to-brand-skyblue border border-brand-skyblue/40 shadow-md flex items-center justify-center text-brand-white">
              <Shield className="w-6 h-6 drop-shadow" />
            </div>
          )}

          {/* Badge Captain (C) */}
          {player.isCaptain && (
            <div className="absolute -bottom-1 -left-1.5 w-5 h-5 rounded-full bg-brand-hotpink-dark text-brand-white font-black text-[10px] flex items-center justify-center shadow-lg border border-brand-white ring-2 ring-brand-hotpink/50 shadow-brand-hotpink/50 z-20">
              C
            </div>
          )}

          {/* Badge Vice-Captain (V) */}
          {player.isViceCaptain && (
            <div className="absolute -bottom-1 -left-1.5 w-5 h-5 rounded-full bg-brand-skyblue text-brand-darker font-black text-[10px] flex items-center justify-center shadow-lg border border-brand-white ring-2 ring-brand-skyblue/50 shadow-brand-skyblue/50 z-20">
              V
            </div>
          )}
        </div>

        {/* 3. Tên cầu thủ (Glassmorphism Pill) + CLB nếu có */}
        <div className="mt-1 w-full bg-brand-darker/70 backdrop-blur-md border border-white/10 rounded-lg px-1 py-0.5 text-center truncate shadow-inner">
          <p className="text-[11px] sm:text-xs font-bold text-brand-white truncate tracking-tight">
            {player.web_name}
          </p>
          {player.team_short_name && (
            <p className="text-[9px] font-medium text-brand-muted tracking-wider uppercase -mt-0.5 truncate">
              {player.team_short_name}
            </p>
          )}
        </div>

        {/* 4. Điểm số (Glassmorphism Chip ở dưới cùng) */}
        <div className="w-full mt-1 bg-brand-darker/60 backdrop-blur-md border border-brand-border/60 rounded-md py-0.5 text-center shadow-inner">
          <span className="text-[10px] font-bold text-brand-white">
            {player.total_points}p
          </span>
        </div>
      </div>

      {/* Menu thao tác nhanh chọn C / V khi di chuột */}
      {!isBench && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 flex items-center gap-1.5 bg-brand-darker/95 backdrop-blur-md border border-brand-skyblue/40 px-2 py-1 rounded-xl shadow-[0_10px_25px_rgba(4,22,32,0.8)] z-40">
          <button
            onClick={() => onSelectCaptain && onSelectCaptain(player.id)}
            className={`px-2 py-0.5 rounded-md text-[11px] font-black transition-all ${
              player.isCaptain 
                ? 'bg-brand-hotpink-dark text-brand-white ring-2 ring-brand-hotpink/50 shadow-sm' 
                : 'bg-brand-card text-brand-muted hover:bg-brand-hotpink-dark hover:text-brand-white'
            }`}
            title="Chọn làm Captain (x2 điểm)"
          >
            C
          </button>
          <button
            onClick={() => onSelectViceCaptain && onSelectViceCaptain(player.id)}
            className={`px-2 py-0.5 rounded-md text-[11px] font-black transition-all ${
              player.isViceCaptain 
                ? 'bg-brand-skyblue text-brand-darker ring-2 ring-brand-skyblue/50 shadow-sm' 
                : 'bg-brand-card text-brand-muted hover:bg-brand-skyblue hover:text-brand-darker'
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
