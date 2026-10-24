import React, { useState } from 'react';
import { PlayerPitchSlot } from './PlayerPitchSlot';
import { PositionType, FormationType, LineupPlayer } from '../../types';
import { Armchair, ChevronDown } from 'lucide-react';

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
      <div className="w-full max-w-4xl flex items-center justify-between pb-3 px-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Sơ đồ chiến thuật:</span>
          <div className="relative inline-block">
            <select
              value={formation}
              onChange={(e) => handleFormationSelect(e.target.value as FormationType)}
              className="bg-purple-950/70 border border-purple-700/60 text-fpl-green font-bold text-xs sm:text-sm rounded-lg px-3 py-1.5 pr-8 appearance-none cursor-pointer hover:border-fpl-green transition-colors focus:outline-none focus:ring-1 focus:ring-fpl-green"
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
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
            (C) Captain x2
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block"></span>
            (V) Vice-Captain
          </span>
        </div>
      </div>

      {/* Main Pitch Field */}
      <div className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border-2 border-emerald-900/40 bg-gradient-to-b from-[#102d18] via-[#153c20] to-[#102d18]">
        {/* Realistic Soccer Pitch Field Markings (SVG Overlay) */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <svg width="100%" height="100%" viewBox="0 0 600 800" preserveAspectRatio="none">
            {/* Outer Boundary */}
            <rect x="20" y="20" width="560" height="760" fill="none" stroke="white" strokeWidth="2.5" />
            
            {/* Halfway line */}
            <line x1="20" y1="400" x2="580" y2="400" stroke="white" strokeWidth="2" />
            
            {/* Center circle & dot */}
            <circle cx="300" cy="400" r="70" fill="none" stroke="white" strokeWidth="2" />
            <circle cx="300" cy="400" r="4" fill="white" />
            
            {/* Penalty box Top (GKP) */}
            <rect x="180" y="20" width="240" height="120" fill="none" stroke="white" strokeWidth="2" />
            <rect x="230" y="20" width="140" height="50" fill="none" stroke="white" strokeWidth="2" />
            <circle cx="300" cy="90" r="3" fill="white" />
            
            {/* Penalty box Bottom */}
            <rect x="180" y="660" width="240" height="120" fill="none" stroke="white" strokeWidth="2" />
            <rect x="230" y="730" width="140" height="50" fill="none" stroke="white" strokeWidth="2" />
            <circle cx="300" cy="710" r="3" fill="white" />

            {/* Corner Arcs */}
            <path d="M 20,40 A 20,20 0 0,0 40,20" fill="none" stroke="white" strokeWidth="2" />
            <path d="M 560,20 A 20,20 0 0,0 580,40" fill="none" stroke="white" strokeWidth="2" />
            <path d="M 20,760 A 20,20 0 0,0 40,780" fill="none" stroke="white" strokeWidth="2" />
            <path d="M 560,780 A 20,20 0 0,0 580,760" fill="none" stroke="white" strokeWidth="2" />
          </svg>
        </div>

        {/* 11 Starting Pitch Players Rows */}
        <div className="relative z-10 py-6 sm:py-8 px-4 flex flex-col justify-between min-h-[580px] sm:min-h-[660px]">
          {/* Row 1: Goalkeeper (1 GKP) */}
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

          {/* Row 2: Defenders (DEF) */}
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

          {/* Row 3: Midfielders (MID) */}
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

          {/* Row 4: Forwards (FWD) */}
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

      {/* Bench Section (4 Players: 1 GKP, 3 Outfield) */}
      <div className="w-full max-w-4xl mt-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-white font-bold">
            <Armchair className="w-4 h-4 text-amber-400" />
            <span>Ghế Dự Bị (Substitutes Bench)</span>
          </div>
          <span className="text-slate-400 text-xs">
            1 Thủ môn + 3 Cầu thủ dự bị
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-4 pt-4 justify-items-center">
          {/* Bench Slot 1: Backup GKP */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-amber-400/80 mb-1">GK Sub</span>
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
            <span className="text-[10px] font-bold text-slate-400 mb-1">Sub 1</span>
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
            <span className="text-[10px] font-bold text-slate-400 mb-1">Sub 2</span>
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
            <span className="text-[10px] font-bold text-slate-400 mb-1">Sub 3</span>
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

