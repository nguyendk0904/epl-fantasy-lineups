import React from 'react';
import { PlayerPitchSlot } from '../pitch/PlayerPitchSlot';
import { FormationType, LineupPlayer } from '../../types';
import { Armchair, ShieldCheck, Sparkles } from 'lucide-react';

export interface SharedPitchViewProps {
  startingXI: LineupPlayer[];
  bench: LineupPlayer[];
  formation: FormationType;
  captainId: number | null;
  viceCaptainId: number | null;
}

/**
 * SharedPitchView Component
 * Renders the virtual football pitch in strict Read-only mode.
 * Shows starting XI formation, 4 bench substitutes, and Captain/Vice-Captain badges.
 * Disables adding, swapping, or deleting players.
 */
export const SharedPitchView: React.FC<SharedPitchViewProps> = ({
  startingXI,
  bench,
  formation,
  captainId,
  viceCaptainId,
}) => {
  const [defCount, midCount, fwdCount] = formation.split('-').map(Number);

  // Group starting players by position according to formation
  const gkps = startingXI.filter((p) => p.element_type === 'GKP');
  const defs = startingXI.filter((p) => p.element_type === 'DEF');
  const mids = startingXI.filter((p) => p.element_type === 'MID');
  const fwds = startingXI.filter((p) => p.element_type === 'FWD');

  const gkpPlayer = gkps[0] || null;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Sân bóng cỏ nhân tạo Premier League */}
      <div 
        data-testid="shared-pitch-container"
        className="w-full max-w-4xl relative rounded-3xl overflow-hidden shadow-2xl border-2 border-brand-border"
        style={{
          background: 'linear-gradient(180deg, #0f3d1f 0%, #15572b 50%, #0f3d1f 100%)',
          minHeight: '680px',
        }}
      >
        {/* Họa tiết kẻ sọc sân cỏ Premier League */}
        <div className="absolute inset-0 opacity-20 pointer-events-none flex flex-col">
          {Array.from({ length: 7 }).map((_, i) => (
            <div 
              key={i} 
              className={`flex-1 ${i % 2 === 0 ? 'bg-black/20' : 'bg-white/5'}`} 
            />
          ))}
        </div>

        {/* Các đường line màu trắng trên sân */}
        <div className="absolute inset-4 sm:inset-6 border-2 border-white/20 rounded-2xl pointer-events-none" />
        
        {/* Vòng tròn trung tâm & Vạch giữa sân */}
        <div className="absolute top-1/2 left-4 right-4 sm:left-6 sm:right-6 -translate-y-1/2 h-[2px] bg-white/20 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 sm:w-40 sm:h-40 rounded-full border-2 border-white/20 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/30 pointer-events-none" />

        {/* Vòng cấm địa trên (Top Penalty Box) */}
        <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 w-64 sm:w-80 h-28 border-b-2 border-x-2 border-white/20 rounded-b-xl pointer-events-none" />

        {/* Vòng cấm địa dưới (Bottom Penalty Box - Thủ môn nhà) */}
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-64 sm:w-80 h-28 border-t-2 border-x-2 border-white/20 rounded-t-xl pointer-events-none" />

        {/* Formation & Status Header */}
        <div className="relative z-10 px-6 pt-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-brand-darker/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-xs">
            <ShieldCheck className="w-4 h-4 text-brand-skyblue-light" />
            <span className="text-brand-muted">Sơ đồ chiến thuật:</span>
            <span className="font-bold text-brand-skyblue-light font-mono">{formation}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-brand-hotpink-dark/60 backdrop-blur-md px-3 py-1 rounded-full border border-brand-hotpink/30 text-[11px] font-semibold text-brand-hotpink-light">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Chế độ chỉ xem (Read-only)</span>
          </div>
        </div>

        {/* 11 Vị trí đá chính (Starting XI) */}
        <div className="relative z-10 p-4 sm:p-6 flex flex-col justify-between" style={{ minHeight: '620px' }}>
          {/* Hàng Tiền đạo (FWD) */}
          <div className="flex justify-center items-center gap-4 sm:gap-10 my-2">
            {Array.from({ length: fwdCount }).map((_, idx) => {
              const player = fwds[idx] || null;
              return (
                <div key={`fwd-${idx}`} className="w-20 sm:w-24">
                  <PlayerPitchSlot
                    player={player}
                    position="FWD"
                    slotIndex={idx}
                    isStarting={true}
                    isCaptain={player ? player.id === captainId : false}
                    isViceCaptain={player ? player.id === viceCaptainId : false}
                  />
                </div>
              );
            })}
          </div>

          {/* Hàng Tiền vệ (MID) */}
          <div className="flex justify-center items-center gap-3 sm:gap-8 my-2">
            {Array.from({ length: midCount }).map((_, idx) => {
              const player = mids[idx] || null;
              return (
                <div key={`mid-${idx}`} className="w-20 sm:w-24">
                  <PlayerPitchSlot
                    player={player}
                    position="MID"
                    slotIndex={idx}
                    isStarting={true}
                    isCaptain={player ? player.id === captainId : false}
                    isViceCaptain={player ? player.id === viceCaptainId : false}
                  />
                </div>
              );
            })}
          </div>

          {/* Hàng Hậu vệ (DEF) */}
          <div className="flex justify-center items-center gap-2 sm:gap-6 my-2">
            {Array.from({ length: defCount }).map((_, idx) => {
              const player = defs[idx] || null;
              return (
                <div key={`def-${idx}`} className="w-20 sm:w-24">
                  <PlayerPitchSlot
                    player={player}
                    position="DEF"
                    slotIndex={idx}
                    isStarting={true}
                    isCaptain={player ? player.id === captainId : false}
                    isViceCaptain={player ? player.id === viceCaptainId : false}
                  />
                </div>
              );
            })}
          </div>

          {/* Hàng Thủ môn (GKP) */}
          <div className="flex justify-center items-center my-2">
            <div className="w-20 sm:w-24">
              <PlayerPitchSlot
                player={gkpPlayer}
                position="GKP"
                slotIndex={0}
                isStarting={true}
                isCaptain={gkpPlayer ? gkpPlayer.id === captainId : false}
                isViceCaptain={gkpPlayer ? gkpPlayer.id === viceCaptainId : false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hàng ghế dự bị (Bench - 4 Cầu thủ) */}
      <div className="w-full max-w-4xl mt-5 bg-brand-darker/90 border border-brand-border rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
          <div className="p-1.5 rounded-lg bg-brand-skyblue/10 text-brand-skyblue-light">
            <Armchair className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              Hàng ghế dự bị (Substitutes)
            </h4>
            <span className="text-[10px] text-brand-muted">1 Thủ môn phụ + 3 Cầu thủ ngoài sân</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-4 justify-items-center">
          {Array.from({ length: 4 }).map((_, idx) => {
            const player = bench[idx] || null;
            const expectedPos = idx === 0 ? 'GKP' : player?.element_type || 'DEF';
            return (
              <div key={`bench-${idx}`} className="w-full max-w-[100px] flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold text-brand-muted mb-1">
                  {idx === 0 ? 'Thủ môn phụ' : `Dự bị ${idx}`}
                </span>
                <PlayerPitchSlot
                  player={player}
                  position={expectedPos}
                  slotIndex={idx}
                  isBench={true}
                  isStarting={false}
                  isCaptain={false}
                  isViceCaptain={false}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SharedPitchView;
