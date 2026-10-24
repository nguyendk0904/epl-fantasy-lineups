import React from 'react';
import { PositionType, LineupPlayer } from '../../types';
import { X, Plus, Shield } from 'lucide-react';

interface LinePlayerIconProps {
  position: PositionType;
  isCaptain?: boolean;
}

export function LinePlayerIcon({ position, isCaptain }: LinePlayerIconProps) {
  // Styling jersey color by position
  const getJerseyStyle = () => {
    switch (position) {
      case 'GKP':
        return 'from-amber-400 to-yellow-600 text-slate-950 border-amber-300';
      case 'DEF':
        return 'from-sky-500 to-blue-700 text-white border-sky-300';
      case 'MID':
        return 'from-emerald-500 to-teal-700 text-white border-emerald-300';
      case 'FWD':
        return 'from-rose-500 to-red-700 text-white border-rose-300';
      default:
        return 'from-purple-600 to-indigo-800 text-white border-purple-300';
    }
  };

  return (
    <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-b ${getJerseyStyle()} border shadow-md flex items-center justify-center relative transition-transform group-hover:scale-105`}>
      <Shield className="w-6 h-6 drop-shadow" />
      {isCaptain && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
        </span>
      )}
    </div>
  );
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
  if (!player) {
    return (
      <div 
        onClick={() => onAddPlayerClick && onAddPlayerClick(expectedPosition)}
        className={`flex flex-col items-center justify-center p-2 rounded-xl border border-dashed transition-all cursor-pointer group select-none
          ${isBench 
            ? 'w-20 sm:w-24 h-24 sm:h-28 bg-slate-900/60 border-slate-700/60 hover:border-fpl-green/60 hover:bg-slate-800/60' 
            : 'w-20 sm:w-24 h-24 sm:h-28 bg-black/25 border-white/20 hover:border-fpl-green/60 hover:bg-black/40'}`}
      >
        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-fpl-green group-hover:scale-110 transition-all">
          <Plus className="w-5 h-5" />
        </div>
        <span className="text-[11px] font-bold text-slate-300 mt-2 tracking-wider">
          {expectedPosition}
        </span>
      </div>
    );
  }

  return (
    <div className="relative group flex flex-col items-center w-20 sm:w-24 select-none">
      {/* Top action button: Remove (X) */}
      {onRemovePlayer && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemovePlayer(player.id);
          }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500/90 text-white flex items-center justify-center shadow opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-rose-600 transition-all z-20"
          title="Xóa cầu thủ"
          aria-label={`Xóa ${player.web_name}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Jersey Icon with Captain / Vice-Captain Badges */}
      <div className="relative cursor-pointer">
        <LinePlayerIcon position={player.element_type} isCaptain={player.isCaptain} />

        {/* Captain (C) Badge */}
        {player.isCaptain && (
          <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-lg border border-white ring-2 ring-amber-500/30">
            C
          </div>
        )}

        {/* Vice-Captain (V) Badge */}
        {player.isViceCaptain && (
          <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-sky-400 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-lg border border-white ring-2 ring-sky-500/30">
            V
          </div>
        )}
      </div>

      {/* Player Web Name Card */}
      <div className="mt-1 w-full bg-slate-950/90 border border-slate-700/80 rounded px-1.5 py-0.5 text-center shadow-md backdrop-blur-sm truncate">
        <p className="text-[11px] sm:text-xs font-bold text-white truncate tracking-tight">
          {player.web_name}
        </p>
      </div>

      {/* Cost & Points row */}
      <div className="w-full bg-emerald-950/80 border border-emerald-800/50 rounded-b px-1 py-0.5 text-center -mt-0.5 flex items-center justify-between text-[10px] text-emerald-300 font-semibold">
        <span>£{player.now_cost.toFixed(1)}m</span>
        <span>{player.total_points}p</span>
      </div>

      {/* Hover action menu for selecting C / V */}
      {!isBench && (
        <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-slate-900 border border-slate-700 p-0.5 rounded-lg shadow-xl z-30">
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

