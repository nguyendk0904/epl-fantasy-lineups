import React, { useState } from 'react';
import { PlayerPitchSlot } from './PlayerPitchSlot';
import { PositionType, FormationType, LineupPlayer } from '../../types';
import { Armchair, ChevronDown, Sparkles } from 'lucide-react';

interface VirtualPitchProps {
  startingXI?: (LineupPlayer | null)[];
  bench?: (LineupPlayer | null)[];
  formation?: FormationType;
  onFormationChange?: (formation: FormationType) => void;
  onSelectCaptain?: (id: number) => void;
  onSelectViceCaptain?: (id: number) => void;
  onRemovePlayer?: (id: number) => void;
  onAddPlayerClick?: (position: PositionType) => void;
}

const FORMATIONS: FormationType[] = [
  '4-3-3',
  '3-4-3',
  '3-5-2',
  '4-4-2',
  '4-5-1',
  '5-3-2',
  '5-4-1',
  '5-2-3'
];

export function VirtualPitch({
  startingXI = [],
  bench = [],
  formation: initialFormation = '4-3-3',
  onFormationChange,
  onSelectCaptain,
  onSelectViceCaptain,
  onRemovePlayer,
  onAddPlayerClick,
}: VirtualPitchProps) {
  const [formation, setFormation] = useState<FormationType>(initialFormation);

  // Parse formation string into number of [DEF, MID, FWD]
  const [defCount, midCount, fwdCount] = formation.split('-').map(Number);

  const handleFormationSelect = (newForm: FormationType) => {
    setFormation(newForm);
    if (onFormationChange) onFormationChange(newForm);
  };

  // Group starting players into rows
  const gkpPlayer = startingXI[0] || null;
  const defPlayers = startingXI.slice(1, 1 + defCount);
  const midPlayers = startingXI.slice(1 + defCount, 1 + defCount + midCount);
  const fwdPlayers = startingXI.slice(1 + defCount + midCount, 11);

  // Bench slots (Index 0: GKP, Index 1-3: Outfielders)
  const benchGKP = bench[0] || null;
  const benchOutfield = [bench[1] || null, bench[2] || null, bench[3] || null];

  return (
    <div className="w-full flex flex-col items-center">
      {/* Pitch Header / Toolbar */}
      <div className="w-full max-w-4xl flex items-center justify-between pb-4 px-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Sơ đồ chiến thuật:</span>
          <div className="relative inline-block">
            <select
              value={formation}
              onChange={(e) => handleFormationSelect(e.target.value as FormationType)}
              className="bg-purple-950/70 border border-purple-700/60 text-fpl-green font-bold text-xs sm:text-sm rounded-xl px-3.5 py-1.5 pr-8 appearance-none cursor-pointer hover:border-fpl-green transition-colors focus:outline-none focus:ring-2 focus:ring-fpl-green/30 backdrop-blur-md shadow-lg"
              aria-label="Chọn sơ đồ chiến thuật"
            >
              {FORMATIONS.map((f) => (
                <option key={f} value={f} className="bg-slate-900 text-white font-normal">
                  {f}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-fpl-green absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-300">
          <span className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-full shadow-inner">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 ring-2 ring-amber-400/40 inline-block shadow-sm"></span>
            <strong className="text-amber-300">(C)</strong> Captain x2
          </span>
          <span className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-full shadow-inner">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-cyan-400 to-sky-300 ring-2 ring-cyan-400/40 inline-block shadow-sm"></span>
            <strong className="text-sky-300">(V)</strong> Vice-Captain
          </span>
        </div>
      </div>

      {/* Main Pitch Field (Figma-Inspired Premier League Pitch) */}
      <div 
        className="relative w-full max-w-4xl rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border-2 border-emerald-500/20 ring-1 ring-white/10 transition-all"
        style={{
          // Sọc cỏ Ngoại Hạng Anh so le đậm nhạt chuẩn Figma Design
          background: 'repeating-linear-gradient(to bottom, #0d3419 0px, #0d3419 65px, #114220 65px, #114220 130px)',
        }}
      >
        {/* Lớp ánh sáng Spotlight chiếu giữa sân (Radial Stadium Spotlight) */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 0.09) 0%, transparent 70%)',
          }}
        />

        {/* Lớp vân cỏ mờ và vạch kẻ sân bóng SVG */}
        <div className="absolute inset-0 pointer-events-none opacity-60">
          <svg width="100%" height="100%" viewBox="0 0 600 850" preserveAspectRatio="none">
            {/* Viền ngoài sân */}
            <rect x="25" y="25" width="550" height="800" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" />
            
            {/* Vạch giữa sân */}
            <line x1="25" y1="425" x2="575" y2="425" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
            
            {/* Vòng tròn giữa sân & Chấm giao bóng */}
            <circle cx="300" cy="425" r="75" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
            <circle cx="300" cy="425" r="4.5" fill="white" />
            
            {/* Vòng cấm địa phía trên (GKP) */}
            <rect x="160" y="25" width="280" height="135" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
            <rect x="220" y="25" width="160" height="55" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
            <circle cx="300" cy="100" r="3.5" fill="white" />
            {/* Vòng cung D trên */}
            <path d="M 240,160 A 65,65 0 0,0 360,160" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
            
            {/* Vòng cấm địa phía dưới */}
            <rect x="160" y="690" width="280" height="135" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
            <rect x="220" y="770" width="160" height="55" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
            <circle cx="300" cy="750" r="3.5" fill="white" />
            {/* Vòng cung D dưới */}
            <path d="M 240,690 A 65,65 0 0,1 360,690" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />

            {/* Cung phạt góc 4 góc */}
            <path d="M 25,45 A 20,20 0 0,0 45,25" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
            <path d="M 555,25 A 20,20 0 0,0 575,45" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
            <path d="M 25,805 A 20,20 0 0,0 45,825" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
            <path d="M 555,825 A 20,20 0 0,0 575,805" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
          </svg>
        </div>

        {/* 11 Vị trí xuất phát chính thức (Starting XI) */}
        <div className="relative z-10 py-8 sm:py-10 px-4 flex flex-col justify-between min-h-[640px] sm:min-h-[720px]">
          {/* Hàng 1: Thủ Môn (GKP) */}
          <div className="flex justify-center items-center">
            <PlayerPitchSlot
              player={gkpPlayer}
              expectedPosition="GKP"
              onSelectCaptain={onSelectCaptain}
              onSelectViceCaptain={onSelectViceCaptain}
              onRemovePlayer={onRemovePlayer}
              onAddPlayerClick={onAddPlayerClick}
            />
          </div>

          {/* Hàng 2: Hậu Vệ (DEF) */}
          <div className="flex justify-around items-center gap-1 sm:gap-2 max-w-3xl mx-auto w-full">
            {Array.from({ length: defCount }).map((_, i) => (
              <PlayerPitchSlot
                key={`def-${i}`}
                player={defPlayers[i] || null}
                expectedPosition="DEF"
                onSelectCaptain={onSelectCaptain}
                onSelectViceCaptain={onSelectViceCaptain}
                onRemovePlayer={onRemovePlayer}
                onAddPlayerClick={onAddPlayerClick}
              />
            ))}
          </div>

          {/* Hàng 3: Tiền Vệ (MID) */}
          <div className="flex justify-around items-center gap-1 sm:gap-2 max-w-3xl mx-auto w-full">
            {Array.from({ length: midCount }).map((_, i) => (
              <PlayerPitchSlot
                key={`mid-${i}`}
                player={midPlayers[i] || null}
                expectedPosition="MID"
                onSelectCaptain={onSelectCaptain}
                onSelectViceCaptain={onSelectViceCaptain}
                onRemovePlayer={onRemovePlayer}
                onAddPlayerClick={onAddPlayerClick}
              />
            ))}
          </div>

          {/* Hàng 4: Tiền Đạo (FWD) */}
          <div className="flex justify-around items-center gap-1 sm:gap-2 max-w-2xl mx-auto w-full">
            {Array.from({ length: fwdCount }).map((_, i) => (
              <PlayerPitchSlot
                key={`fwd-${i}`}
                player={fwdPlayers[i] || null}
                expectedPosition="FWD"
                onSelectCaptain={onSelectCaptain}
                onSelectViceCaptain={onSelectViceCaptain}
                onRemovePlayer={onRemovePlayer}
                onAddPlayerClick={onAddPlayerClick}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Khu vực Ghế Dự Bị (Substitutes Bench) - Glassmorphism Cao Cấp */}
      <div className="w-full max-w-4xl mt-5 backdrop-blur-xl bg-slate-950/70 border border-white/10 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        {/* Hiệu ứng phản chiếu ánh sáng kính */}
        <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

        <div className="flex items-center justify-between pb-3.5 border-b border-white/10 text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-white font-bold">
            <div className="w-7 h-7 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Armchair className="w-4 h-4" />
            </div>
            <span>Ghế Dự Bị (Substitutes Bench)</span>
          </div>
          <span className="text-slate-400 text-xs flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-fpl-cyan" />
            1 Thủ môn + 3 Cầu thủ dự bị
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-4 pt-4 justify-items-center">
          {/* Bench Slot 1: Thủ môn dự bị */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-amber-400/90 mb-1.5 uppercase tracking-wider">GK Sub</span>
            <PlayerPitchSlot
              player={benchGKP}
              expectedPosition="GKP"
              isBench={true}
              onRemovePlayer={onRemovePlayer}
              onAddPlayerClick={onAddPlayerClick}
            />
          </div>

          {/* Bench Slot 2: Sub 1 */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Sub 1</span>
            <PlayerPitchSlot
              player={benchOutfield[0]}
              expectedPosition="DEF"
              isBench={true}
              onRemovePlayer={onRemovePlayer}
              onAddPlayerClick={onAddPlayerClick}
            />
          </div>

          {/* Bench Slot 3: Sub 2 */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Sub 2</span>
            <PlayerPitchSlot
              player={benchOutfield[1]}
              expectedPosition="MID"
              isBench={true}
              onRemovePlayer={onRemovePlayer}
              onAddPlayerClick={onAddPlayerClick}
            />
          </div>

          {/* Bench Slot 4: Sub 3 */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Sub 3</span>
            <PlayerPitchSlot
              player={benchOutfield[2]}
              expectedPosition="FWD"
              isBench={true}
              onRemovePlayer={onRemovePlayer}
              onAddPlayerClick={onAddPlayerClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
