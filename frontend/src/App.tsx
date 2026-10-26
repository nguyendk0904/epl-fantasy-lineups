import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Trophy, 
  Users, 
  Sparkles, 
  GitCompare, 
  Wallet, 
  ShieldCheck, 
  Layers
} from 'lucide-react';
import { VirtualPitch } from './components/pitch/VirtualPitch';
import { LineupPlayer, PositionType, FormationType } from './types';

export type TabType = 'pitch' | 'players' | 'optimizer' | 'compare';

const SAMPLE_STARTING_XI: LineupPlayer[] = [
  { id: 1, web_name: 'Flekken', team_id: 3, element_type: 'GKP', now_cost: 4.5, total_points: 88, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 2, web_name: 'Saliba', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 85, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 3, web_name: 'Gabriel', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 82, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 4, web_name: 'Konsa', team_id: 2, element_type: 'DEF', now_cost: 4.5, total_points: 55, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
  { id: 5, web_name: 'Robinson', team_id: 9, element_type: 'DEF', now_cost: 4.5, total_points: 60, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 4 },
  { id: 6, web_name: 'Saka', team_id: 1, element_type: 'MID', now_cost: 10.0, total_points: 120, isStarting: true, isCaptain: false, isViceCaptain: true, slotIndex: 5 },
  { id: 7, web_name: 'Palmer', team_id: 6, element_type: 'MID', now_cost: 10.5, total_points: 135, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 6 },
  { id: 8, web_name: 'Rogers', team_id: 2, element_type: 'MID', now_cost: 5.0, total_points: 70, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 7 },
  { id: 9, web_name: 'Haaland', team_id: 13, element_type: 'FWD', now_cost: 15.0, total_points: 160, isStarting: true, isCaptain: true, isViceCaptain: false, slotIndex: 8 },
  { id: 10, web_name: 'Wood', team_id: 16, element_type: 'FWD', now_cost: 6.0, total_points: 95, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 9 },
  { id: 11, web_name: 'Delap', team_id: 10, element_type: 'FWD', now_cost: 5.5, total_points: 80, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 10 },
];

const SAMPLE_BENCH: LineupPlayer[] = [
  { id: 12, web_name: 'Turner', team_id: 16, element_type: 'GKP', now_cost: 4.0, total_points: 20, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 11 },
  { id: 13, web_name: 'Dunk', team_id: 5, element_type: 'DEF', now_cost: 4.5, total_points: 50, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 12 },
  { id: 14, web_name: 'Smith Rowe', team_id: 9, element_type: 'MID', now_cost: 5.5, total_points: 65, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 13 },
  { id: 15, web_name: 'Semenyo', team_id: 4, element_type: 'MID', now_cost: 5.5, total_points: 75, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 14 },
];

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('pitch');
  const [startingXI, setStartingXI] = useState<LineupPlayer[]>(SAMPLE_STARTING_XI);
  const [bench, setBench] = useState<LineupPlayer[]>(SAMPLE_BENCH);
  const [formation, setFormation] = useState<FormationType>('4-3-3');

  // Calculate live squad stats
  const totalCost = [...startingXI, ...bench].reduce((sum, p) => sum + p.now_cost, 0);
  const totalBudget = 100.0;
  const remainingBudget = totalBudget - totalCost;
  const totalPlayers = startingXI.length + bench.length;

  const handleSelectCaptain = (id: number) => {
    setStartingXI(prev => prev.map(p => ({
      ...p,
      isCaptain: p.id === id,
      // If player was vice-captain, clear it
      isViceCaptain: p.id === id ? false : p.isViceCaptain,
    })));
  };

  const handleSelectViceCaptain = (id: number) => {
    setStartingXI(prev => prev.map(p => ({
      ...p,
      isViceCaptain: p.id === id,
      // If player was captain, clear it
      isCaptain: p.id === id ? false : p.isCaptain,
    })));
  };

  const handleRemovePlayer = (id: number) => {
    setStartingXI(prev => prev.filter(p => p.id !== id));
    setBench(prev => prev.filter(p => p.id !== id));
  };

  const handleAddPlayerClick = (position: PositionType) => {
    setActiveTab('players');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-fpl-green selection:text-fpl-purple">
      {/* Top Navbar */}
      <header className="border-b border-purple-900/40 bg-[#240029]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-fpl-purple to-fpl-magenta flex items-center justify-center shadow-lg shadow-purple-950/50 border border-fpl-green/30">
              <Trophy className="w-5 h-5 text-fpl-green" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl tracking-tight text-white flex items-center gap-2">
                FPL LINEUP <span className="text-fpl-green font-black">BUILDER</span>
              </h1>
              <p className="text-xs text-purple-300/70 hidden sm:block">AI-Powered Fantasy Premier League Optimizer</p>
            </div>
          </div>

          {/* Quick Lineup Status Widgets */}
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg shadow-inner">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400 hidden sm:inline">Ngân sách:</span>
              <span className={`font-bold ${remainingBudget >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                £{remainingBudget.toFixed(1)}m
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">£{totalBudget.toFixed(1)}m</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg shadow-inner">
              <Users className="w-4 h-4 text-sky-400" />
              <span className="text-slate-400 hidden sm:inline">Đội hình:</span>
              <span className={`font-bold ${totalPlayers === 15 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {totalPlayers}/15
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-2 border-t border-purple-900/30">
          <button
            onClick={() => setActiveTab('pitch')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'pitch'
                ? 'border-fpl-green text-fpl-green bg-purple-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Sân Bóng (Pitch View)</span>
          </button>

          <button
            onClick={() => setActiveTab('players')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'players'
                ? 'border-fpl-green text-fpl-green bg-purple-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Danh Sách Cầu Thủ</span>
          </button>

          <button
            onClick={() => setActiveTab('optimizer')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'optimizer'
                ? 'border-fpl-green text-fpl-green bg-purple-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Bộ Tối Ưu (Optimizer)</span>
          </button>

          <button
            onClick={() => setActiveTab('compare')}
            className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'compare'
                ? 'border-fpl-green text-fpl-green bg-purple-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <GitCompare className="w-4 h-4 text-fpl-cyan" />
            <span>So Sánh (Compare)</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {activeTab === 'pitch' && (
          <section className="space-y-4">
            <div className="bg-gradient-to-r from-purple-950/60 to-slate-900/60 border border-purple-800/30 rounded-2xl p-4 sm:p-6 backdrop-blur shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-fpl-green" />
                    Đội hình thi đấu chính thức (Gameweek)
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Chọn đủ 15 cầu thủ (11 đá chính, 4 dự bị) trong ngân sách £100.0m và tối đa 3 người/CLB.
                  </p>
                </div>
              </div>

              {/* Integrated VirtualPitch Component from Task P1-NG02 */}
              <VirtualPitch
                startingXI={startingXI}
                bench={bench}
                formation={formation}
                onFormationChange={setFormation}
                onSelectCaptain={handleSelectCaptain}
                onSelectViceCaptain={handleSelectViceCaptain}
                onRemovePlayer={handleRemovePlayer}
                onAddPlayerClick={handleAddPlayerClick}
              />
            </div>
          </section>
        )}

        {activeTab === 'players' && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-2">Thị Trường Chuyển Nhượng Cầu Thủ</h2>
            <p className="text-sm text-slate-400">
              Khu vực tích hợp component <code className="text-fpl-cyan bg-slate-950 px-2 py-0.5 rounded">PlayerTable</code> từ Task <strong>P1-NG03</strong>.
            </p>
          </section>
        )}

        {activeTab === 'optimizer' && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-2">Bộ Tối Ưu Hóa Đội Hình (PuLP Solver)</h2>
            <p className="text-sm text-slate-400">
              Khu vực tích hợp component <code className="text-fpl-cyan bg-slate-950 px-2 py-0.5 rounded">OptimizerControl</code> từ Task <strong>P1-NG05</strong>.
            </p>
          </section>
        )}

        {activeTab === 'compare' && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-2">So Sánh Đội Hình (Radar Chart)</h2>
            <p className="text-sm text-slate-400">
              Khu vực tích hợp component <code className="text-fpl-cyan bg-slate-950 px-2 py-0.5 rounded">LineupComparisonView</code> từ Task <strong>P1-NG05</strong>.
            </p>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 mt-auto text-center text-xs text-slate-500">
        <p>Fantasy Football Lineup Builder & Optimizer • Cloud Computing Project 2026</p>
      </footer>
    </div>
  );
}

// Auto mount to DOM if running as standalone entrypoint
if (typeof document !== 'undefined') {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(<App />);
  }
}
