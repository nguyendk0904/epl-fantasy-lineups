import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Trophy, 
  Users, 
  Sparkles, 
  GitCompare, 
  Wallet, 
  ShieldCheck, 
  Layers,
  ArrowRight,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { VirtualPitch } from './components/pitch/VirtualPitch';
import { PlayerTable } from './components/player-list/PlayerTable';
import { PositionType, Player, LineupPlayer } from './types';
import { useLineupStore, TOTAL_BUDGET } from './stores/lineupStore';

export type TabType = 'pitch' | 'players' | 'optimizer' | 'compare';

const INITIAL_STARTING_XI: LineupPlayer[] = [
  { id: 1, web_name: 'Flekken', team_id: 3, element_type: 'GKP', now_cost: 4.5, total_points: 88, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 2, web_name: 'Saliba', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 85, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 3, web_name: 'Gabriel', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 82, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 4, web_name: 'Konsa', team_id: 2, element_type: 'DEF', now_cost: 4.5, total_points: 55, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 5, web_name: 'Robinson', team_id: 9, element_type: 'DEF', now_cost: 4.5, total_points: 60, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
  { id: 6, web_name: 'Saka', team_id: 1, element_type: 'MID', now_cost: 10.0, total_points: 120, isStarting: true, isCaptain: false, isViceCaptain: true, slotIndex: 0 },
  { id: 7, web_name: 'Palmer', team_id: 5, element_type: 'MID', now_cost: 10.5, total_points: 135, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 8, web_name: 'Rogers', team_id: 2, element_type: 'MID', now_cost: 5.0, total_points: 70, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 9, web_name: 'Haaland', team_id: 10, element_type: 'FWD', now_cost: 15.0, total_points: 160, isStarting: true, isCaptain: true, isViceCaptain: false, slotIndex: 0 },
  { id: 10, web_name: 'Wood', team_id: 13, element_type: 'FWD', now_cost: 6.0, total_points: 95, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 11, web_name: 'Delap', team_id: 10, element_type: 'FWD', now_cost: 5.5, total_points: 80, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
];

const INITIAL_BENCH: LineupPlayer[] = [
  { id: 12, web_name: 'Turner', team_id: 13, element_type: 'GKP', now_cost: 4.0, total_points: 20, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 13, web_name: 'Dunk', team_id: 4, element_type: 'DEF', now_cost: 4.5, total_points: 50, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 14, web_name: 'Smith Rowe', team_id: 9, element_type: 'MID', now_cost: 5.5, total_points: 65, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 15, web_name: 'Semenyo', team_id: 3, element_type: 'MID', now_cost: 5.5, total_points: 75, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
];

export const SAMPLE_MARKET_PLAYERS: Player[] = [
  { id: 1, web_name: 'Flekken', first_name: 'Mark', second_name: 'Flekken', team_id: 3, team_short_name: 'BRE', element_type: 'GKP', now_cost: 4.5, total_points: 88, form: 4.2, expected_points_next: 3.5, status: 'a' },
  { id: 2, web_name: 'Saliba', first_name: 'William', second_name: 'Saliba', team_id: 1, team_short_name: 'ARS', element_type: 'DEF', now_cost: 6.0, total_points: 85, form: 5.0, expected_points_next: 4.5, status: 'a' },
  { id: 3, web_name: 'Gabriel', first_name: 'Gabriel', second_name: 'Magalhaes', team_id: 1, team_short_name: 'ARS', element_type: 'DEF', now_cost: 6.0, total_points: 82, form: 4.8, expected_points_next: 4.2, status: 'a' },
  { id: 4, web_name: 'Konsa', first_name: 'Ezri', second_name: 'Konsa', team_id: 2, team_short_name: 'AVL', element_type: 'DEF', now_cost: 4.5, total_points: 55, form: 3.5, expected_points_next: 3.0, status: 'a' },
  { id: 5, web_name: 'Robinson', first_name: 'Antonee', second_name: 'Robinson', team_id: 9, team_short_name: 'FUL', element_type: 'DEF', now_cost: 4.5, total_points: 60, form: 4.0, expected_points_next: 3.2, status: 'a' },
  { id: 6, web_name: 'Saka', first_name: 'Bukayo', second_name: 'Saka', team_id: 1, team_short_name: 'ARS', element_type: 'MID', now_cost: 10.0, total_points: 120, form: 6.8, expected_points_next: 6.5, status: 'a' },
  { id: 7, web_name: 'Palmer', first_name: 'Cole', second_name: 'Palmer', team_id: 5, team_short_name: 'CHE', element_type: 'MID', now_cost: 10.5, total_points: 135, form: 7.5, expected_points_next: 7.2, status: 'a' },
  { id: 8, web_name: 'Rogers', first_name: 'Morgan', second_name: 'Rogers', team_id: 2, team_short_name: 'AVL', element_type: 'MID', now_cost: 5.0, total_points: 70, form: 5.2, expected_points_next: 4.5, status: 'a' },
  { id: 9, web_name: 'Haaland', first_name: 'Erling', second_name: 'Haaland', team_id: 10, team_short_name: 'MCI', element_type: 'FWD', now_cost: 15.0, total_points: 160, form: 8.5, expected_points_next: 8.8, status: 'a' },
  { id: 10, web_name: 'Wood', first_name: 'Chris', second_name: 'Wood', team_id: 13, team_short_name: 'NFO', element_type: 'FWD', now_cost: 6.0, total_points: 95, form: 6.0, expected_points_next: 5.5, status: 'a' },
  { id: 11, web_name: 'Delap', first_name: 'Liam', second_name: 'Delap', team_id: 10, team_short_name: 'MCI', element_type: 'FWD', now_cost: 5.5, total_points: 80, form: 4.5, expected_points_next: 4.0, status: 'a' },
  { id: 12, web_name: 'Turner', first_name: 'Matt', second_name: 'Turner', team_id: 13, team_short_name: 'NFO', element_type: 'GKP', now_cost: 4.0, total_points: 20, form: 1.0, expected_points_next: 1.0, status: 's' },
  { id: 13, web_name: 'Dunk', first_name: 'Lewis', second_name: 'Dunk', team_id: 4, team_short_name: 'BHA', element_type: 'DEF', now_cost: 4.5, total_points: 50, form: 3.2, expected_points_next: 2.8, status: 'a' },
  { id: 14, web_name: 'Smith Rowe', first_name: 'Emile', second_name: 'Smith Rowe', team_id: 9, team_short_name: 'FUL', element_type: 'MID', now_cost: 5.5, total_points: 65, form: 4.0, expected_points_next: 3.8, status: 'a' },
  { id: 15, web_name: 'Semenyo', first_name: 'Antoine', second_name: 'Semenyo', team_id: 3, team_short_name: 'BRE', element_type: 'MID', now_cost: 5.5, total_points: 75, form: 5.0, expected_points_next: 4.5, status: 'a' },
  { id: 16, web_name: 'Salah', first_name: 'Mohamed', second_name: 'Salah', team_id: 9, team_short_name: 'LIV', element_type: 'MID', now_cost: 12.8, total_points: 170, form: 8.8, expected_points_next: 8.5, status: 'a' },
  { id: 17, web_name: 'Son', first_name: 'Heung-Min', second_name: 'Son', team_id: 14, team_short_name: 'TOT', element_type: 'MID', now_cost: 9.8, total_points: 110, form: 6.2, expected_points_next: 6.0, status: 'd' },
  { id: 18, web_name: 'Watkins', first_name: 'Ollie', second_name: 'Watkins', team_id: 2, team_short_name: 'AVL', element_type: 'FWD', now_cost: 9.0, total_points: 125, form: 6.5, expected_points_next: 6.2, status: 'a' },
  { id: 19, web_name: 'Isak', first_name: 'Alexander', second_name: 'Isak', team_id: 12, team_short_name: 'NEW', element_type: 'FWD', now_cost: 8.5, total_points: 115, form: 7.0, expected_points_next: 6.8, status: 'a' },
  { id: 20, web_name: 'Alexander-Arnold', first_name: 'Trent', second_name: 'Alexander-Arnold', team_id: 9, team_short_name: 'LIV', element_type: 'DEF', now_cost: 7.2, total_points: 98, form: 5.5, expected_points_next: 5.8, status: 'a' },
  { id: 21, web_name: 'Gvardiol', first_name: 'Josko', second_name: 'Gvardiol', team_id: 10, team_short_name: 'MCI', element_type: 'DEF', now_cost: 6.1, total_points: 92, form: 5.8, expected_points_next: 5.2, status: 'a' },
  { id: 22, web_name: 'Raya', first_name: 'David', second_name: 'Raya', team_id: 1, team_short_name: 'ARS', element_type: 'GKP', now_cost: 5.5, total_points: 102, form: 5.0, expected_points_next: 4.8, status: 'a' },
  { id: 23, web_name: 'Pickford', first_name: 'Jordan', second_name: 'Pickford', team_id: 7, team_short_name: 'EVE', element_type: 'GKP', now_cost: 4.9, total_points: 85, form: 4.5, expected_points_next: 4.0, status: 'a' },
  { id: 24, web_name: 'Mbeumo', first_name: 'Bryan', second_name: 'Mbeumo', team_id: 3, team_short_name: 'BRE', element_type: 'MID', now_cost: 7.6, total_points: 108, form: 6.4, expected_points_next: 5.9, status: 'a' },
  { id: 25, web_name: 'Bruno Fernandes', first_name: 'Bruno', second_name: 'Fernandes', team_id: 11, team_short_name: 'MUN', element_type: 'MID', now_cost: 8.2, total_points: 96, form: 5.2, expected_points_next: 5.5, status: 'a' },
];

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('pitch');

  // Zustand Store Hooks
  const {
    startingXI,
    bench,
    formation,
    targetSlot,
    notification,
    setFormation,
    setCaptain,
    setViceCaptain,
    setTargetSlot,
    removePlayer,
    addPlayerToLineup,
    loadSampleLineup,
    resetLineup,
    clearToast,
    getTotalCost,
    getRemainingBudget,
    getTotalPlayers,
    getSelectedPlayerIds,
    validateLineup,
  } = useLineupStore();

  // Khởi tạo sample lineup lần đầu nếu store rỗng
  useEffect(() => {
    if (startingXI.length === 0 && bench.length === 0) {
      loadSampleLineup(INITIAL_STARTING_XI, INITIAL_BENCH);
    }
  }, []);

  // Tự tắt Toast sau 3 giây
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        clearToast();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearToast]);

  const totalCost = getTotalCost();
  const remainingBudget = getRemainingBudget();
  const totalPlayers = getTotalPlayers();
  const selectedPlayerIds = getSelectedPlayerIds();
  const validation = validateLineup();

  const handleAddPlayerClick = (position: PositionType, slotIndex?: number, isBench?: boolean) => {
    setTargetSlot({ position, slotIndex, isBench: !!isBench });
    setActiveTab('players');
  };

  const handleSelectPlayerFromMarket = (player: Player) => {
    const success = addPlayerToLineup(player);
    if (success) {
      setActiveTab('pitch');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-fpl-green selection:text-fpl-purple">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-2 animate-bounce">
          <span>{notification}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="border-b border-purple-900/40 bg-[#240029]/80 backdrop-blur-md sticky top-0 z-40">
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
              <span className="text-slate-400">£{TOTAL_BUDGET.toFixed(1)}m</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg shadow-inner">
              <Users className="w-4 h-4 text-sky-400" />
              <span className="text-slate-400 hidden sm:inline">Đội hình:</span>
              <span className={`font-bold ${totalPlayers === 15 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {totalPlayers}/15
              </span>
            </div>

            {/* Reset button */}
            <button
              onClick={() => resetLineup()}
              className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-500/50 text-slate-400 hover:text-rose-400 transition-colors"
              title="Đặt lại đội hình"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
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
            <span>Thị Trường Cầu Thủ (Player Table)</span>
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
        {/* Warning Banner if Lineup has validation errors */}
        {!validation.isValid && totalPlayers > 0 && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs sm:text-sm text-amber-300 flex items-start gap-2.5 shadow-lg">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-bold">Đội hình chưa hoàn tất yêu cầu của FPL:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-300">
                {validation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

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
                    Chọn đủ 15 cầu thủ (11 đá chính, 4 dự bị) trong ngân sách £100.0m và tối đa 3 người/CLB. Tự động lưu LocalStorage.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadSampleLineup(INITIAL_STARTING_XI, INITIAL_BENCH)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                  >
                    Tải mẫu FPL
                  </button>
                  <button
                    onClick={() => setActiveTab('players')}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:brightness-110 transition-all"
                  >
                    <span>Chợ cầu thủ</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Integrated VirtualPitch Component */}
              <VirtualPitch
                startingXI={startingXI}
                bench={bench}
                formation={formation}
                onFormationChange={setFormation}
                onSelectCaptain={setCaptain}
                onSelectViceCaptain={setViceCaptain}
                onRemovePlayer={removePlayer}
                onAddPlayerClick={handleAddPlayerClick}
              />
            </div>
          </section>
        )}

        {activeTab === 'players' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-fpl-cyan" />
                  Thị Trường Chuyển Nhượng Cầu Thủ Premier League
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Lọc theo vị trí, CLB, tìm kiếm tên tức thì và bấm <strong>+ Chọn</strong> để đưa vào đội hình.
                </p>
              </div>
            </div>

            {/* Integrated PlayerTable Component from Task P1-NG03 */}
            <PlayerTable
              players={SAMPLE_MARKET_PLAYERS}
              selectedPlayerIds={selectedPlayerIds}
              targetSlot={targetSlot}
              onCancelTargetSlot={() => setTargetSlot(null)}
              onSelectPlayer={handleSelectPlayerFromMarket}
            />
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
