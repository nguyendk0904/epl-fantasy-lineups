import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Trophy, 
  Users, 
  Sparkles, 
  GitCompare, 
  Wallet, 
  ShieldCheck, 
  Layers,
  ChevronRight
} from 'lucide-react';

export type TabType = 'pitch' | 'players' | 'optimizer' | 'compare';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('pitch');
  const [budget] = useState<number>(100.0);
  const [remainingBudget] = useState<number>(100.0);
  const [playerCount] = useState<number>(0);

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
              <span className="font-bold text-emerald-400">£{remainingBudget.toFixed(1)}m</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">£{budget.toFixed(1)}m</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg shadow-inner">
              <Users className="w-4 h-4 text-sky-400" />
              <span className="text-slate-400 hidden sm:inline">Đội hình:</span>
              <span className={`font-bold ${playerCount === 15 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {playerCount}/15
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
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
            <div className="bg-gradient-to-r from-purple-950/60 to-slate-900/60 border border-purple-800/30 rounded-2xl p-6 backdrop-blur shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-fpl-green" />
                    Đội hình thi đấu chính thức
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Chọn đủ 15 cầu thủ (11 đá chính, 4 dự bị) trong ngân sách £100.0m và tối đa 3 người/CLB.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-purple-900/40 text-purple-200 border border-purple-700/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Sơ đồ: 4-3-3 (Mặc định)
                </div>
              </div>

              {/* Placeholder for Task P1-NG02 VirtualPitch component */}
              <div className="mt-6 border-2 border-dashed border-slate-800 rounded-xl p-12 text-center bg-slate-900/30">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                  <Layers className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-white">Sân Bóng Ảo (Virtual Pitch Slot)</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">
                  Khu vực này sẵn sàng để tích hợp component <code className="text-fpl-cyan bg-slate-950 px-2 py-0.5 rounded">VirtualPitch</code> từ Task <strong>P1-NG02</strong>.
                </p>
                <div className="mt-4 inline-flex items-center text-xs text-fpl-green font-medium">
                  Sẵn sàng triển khai Task P1-NG02 <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
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

