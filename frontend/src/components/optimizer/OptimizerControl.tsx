import React, { useState } from 'react';
import { 
  Sparkles, 
  Lock, 
  Unlock, 
  Ban, 
  CheckCircle2, 
  Slider, 
  Zap, 
  Info,
  RefreshCw
} from 'lucide-react';
import { FormationType, Player, LineupPlayer } from '../../types';

export interface OptimizerConfig {
  budget: number;
  lockedPlayerIds: number[];
  excludedPlayerIds: number[];
  targetFormation: FormationType | 'auto';
}

export interface OptimizerResult {
  status: 'optimal' | 'infeasible';
  total_cost: number;
  total_expected_points: number;
  starting_xi: LineupPlayer[];
  bench: LineupPlayer[];
  captain_id: number;
  vice_captain_id: number;
  formation: FormationType;
}

interface OptimizerControlProps {
  availablePlayers: Player[];
  currentSquad: LineupPlayer[];
  onOptimize: (config: OptimizerConfig) => Promise<OptimizerResult | null>;
  isOptimizing?: boolean;
}

const FORMATIONS: (FormationType | 'auto')[] = [
  'auto',
  '4-3-3',
  '3-4-3',
  '3-5-2',
  '4-4-2',
  '4-5-1',
  '5-3-2',
  '5-4-1',
  '5-2-3',
];

export const OptimizerControl: React.FC<OptimizerControlProps> = ({
  availablePlayers,
  currentSquad,
  onOptimize,
  isOptimizing = false,
}) => {
  const [budget, setBudget] = useState<number>(100.0);
  const [targetFormation, setTargetFormation] = useState<FormationType | 'auto'>('auto');
  const [lockedPlayerIds, setLockedPlayerIds] = useState<number[]>([]);
  const [excludedPlayerIds, setExcludedPlayerIds] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'locked' | 'excluded'>('locked');

  const toggleLockPlayer = (id: number) => {
    // Không thể vừa lock vừa exclude
    if (excludedPlayerIds.includes(id)) {
      setExcludedPlayerIds(prev => prev.filter(pId => pId !== id));
    }
    setLockedPlayerIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const toggleExcludePlayer = (id: number) => {
    // Không thể vừa lock vừa exclude
    if (lockedPlayerIds.includes(id)) {
      setLockedPlayerIds(prev => prev.filter(pId => pId !== id));
    }
    setExcludedPlayerIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleRunOptimizer = async () => {
    await onOptimize({
      budget,
      lockedPlayerIds,
      excludedPlayerIds,
      targetFormation,
    });
  };

  return (
    <div className="bg-slate-900/90 border border-purple-900/30 rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            Bảng Điều Khiển Auto-Optimizer (PuLP Solver)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Thiết lập ngân sách, khóa trụ cột và để thuật toán 0-1 Integer Linear Programming tìm đội hình đạt điểm kỳ vọng cao nhất.
          </p>
        </div>

        <button
          onClick={handleRunOptimizer}
          disabled={isOptimizing}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isOptimizing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Đang giải bài toán...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Tối Ưu Hóa Đội Hình</span>
            </>
          )}
        </button>
      </div>

      {/* Control Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Slider Ngân sách */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span>Ngân sách tối đa:</span>
              <span className="text-slate-500 text-xs font-normal">(FPL: £100.0m)</span>
            </span>
            <span className="font-extrabold text-emerald-400 text-base">
              £{budget.toFixed(1)}m
            </span>
          </div>

          <input
            type="range"
            min="80.0"
            max="105.0"
            step="0.5"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full accent-emerald-400 cursor-pointer"
            aria-label="Ngân sách tối đa cho optimizer"
          />

          <div className="flex justify-between text-[10px] text-slate-500">
            <span>£80.0m (Tiết kiệm)</span>
            <span>£100.0m (Chuẩn)</span>
            <span>£105.0m (Mở rộng)</span>
          </div>
        </div>

        {/* Lựa chọn Sơ đồ mong muốn */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-slate-300 font-semibold">Sơ đồ chiến thuật:</span>
            <span className="text-xs font-bold text-fpl-cyan">
              {targetFormation === 'auto' ? 'AI Tự Động Chọn Sơ Đồ Tốt Nhất' : targetFormation}
            </span>
          </div>

          <select
            value={targetFormation}
            onChange={(e) => setTargetFormation(e.target.value as FormationType | 'auto')}
            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
            aria-label="Chọn sơ đồ chiến thuật cho optimizer"
          >
            {FORMATIONS.map((form) => (
              <option key={form} value={form}>
                {form === 'auto' ? '✨ Tự động tìm sơ đồ điểm cao nhất' : `Sơ đồ ${form}`}
              </option>
            ))}
          </select>

          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>Mặc định solver sẽ thử nghiệm tất cả 8 sơ đồ hợp lệ của FPL để chọn ra kết quả tối ưu.</span>
          </p>
        </div>
      </div>

      {/* Quản lý Lock & Exclude Cầu thủ */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('locked')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'locked'
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Khóa cầu thủ bắt buộc giữ ({lockedPlayerIds.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('excluded')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'excluded'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Loại trừ cầu thủ không muốn chọn ({excludedPlayerIds.length})</span>
            </button>
          </div>
        </div>

        {/* Danh sách cầu thủ để người dùng bấm toggle */}
        <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5">
          {availablePlayers.slice(0, 15).map((player) => {
            const isLocked = lockedPlayerIds.includes(player.id);
            const isExcluded = excludedPlayerIds.includes(player.id);

            return (
              <div
                key={player.id}
                className="flex items-center justify-between px-3 py-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/60 rounded-lg text-xs transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200">{player.web_name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                    {player.element_type}
                  </span>
                  <span className="text-[10px] text-slate-400">{player.team_short_name}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-slate-400">£{player.now_cost.toFixed(1)}m</span>
                  <span className="font-semibold text-emerald-400">{player.total_points}p</span>

                  <div className="flex items-center gap-1.5">
                    {/* Nút Lock */}
                    <button
                      onClick={() => toggleLockPlayer(player.id)}
                      className={`p-1.5 rounded-md transition-colors ${
                        isLocked
                          ? 'bg-amber-400 text-slate-950 shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-amber-300'
                      }`}
                      title={isLocked ? 'Đã khóa cầu thủ này' : 'Khóa bắt buộc giữ'}
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>

                    {/* Nút Exclude */}
                    <button
                      onClick={() => toggleExcludePlayer(player.id)}
                      className={`p-1.5 rounded-md transition-colors ${
                        isExcluded
                          ? 'bg-rose-500 text-white shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-rose-400'
                      }`}
                      title={isExcluded ? 'Đã loại trừ cầu thủ này' : 'Loại trừ khỏi thuật toán'}
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
