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
    <div className="bg-brand-card/90 border border-brand-border rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-brand-border pb-4">
        <div>
          <h3 className="text-lg font-bold text-brand-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-skyblue-light" />
            Bảng Điều Khiển Auto-Optimizer (PuLP Solver)
          </h3>
          <p className="text-xs text-brand-muted mt-1">
            Thiết lập ngân sách, khóa trụ cột và để thuật toán 0-1 Integer Linear Programming tìm đội hình đạt điểm kỳ vọng cao nhất.
          </p>
        </div>

        <button
          onClick={handleRunOptimizer}
          disabled={isOptimizing}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-hotpink-dark hover:bg-brand-hotpink text-brand-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-hotpink/25 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isOptimizing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Đang giải bài toán...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-brand-white" />
              <span>Tối Ưu Hóa Đội Hình</span>
            </>
          )}
        </button>
      </div>

      {/* Control Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Slider Ngân sách */}
        <div className="bg-brand-darker/60 border border-brand-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-brand-white font-semibold flex items-center gap-1.5">
              <span>Ngân sách tối đa:</span>
              <span className="text-brand-muted text-xs font-normal">(FPL: £100.0m)</span>
            </span>
            <span className="font-extrabold text-brand-skyblue-light text-base">
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
            className="w-full accent-brand-skyblue cursor-pointer"
            aria-label="Ngân sách tối đa cho optimizer"
          />

          <div className="flex justify-between text-[10px] text-brand-muted">
            <span>£80.0m (Tiết kiệm)</span>
            <span>£100.0m (Chuẩn)</span>
            <span>£105.0m (Mở rộng)</span>
          </div>
        </div>

        {/* Lựa chọn Sơ đồ mong muốn */}
        <div className="bg-brand-darker/60 border border-brand-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-brand-white font-semibold">Sơ đồ chiến thuật:</span>
            <span className="text-xs font-bold text-brand-skyblue-light">
              {targetFormation === 'auto' ? 'AI Tự Động Chọn Sơ Đồ Tốt Nhất' : targetFormation}
            </span>
          </div>

          <select
            value={targetFormation}
            onChange={(e) => setTargetFormation(e.target.value as FormationType | 'auto')}
            className="w-full py-2 px-3 bg-brand-darker border border-brand-border rounded-lg text-sm text-brand-white focus:outline-none focus:border-brand-skyblue transition-colors"
            aria-label="Chọn sơ đồ chiến thuật cho optimizer"
          >
            {FORMATIONS.map((form) => (
              <option key={form} value={form} className="bg-brand-darker text-brand-white">
                {form === 'auto' ? '✨ Tự động tìm sơ đồ điểm cao nhất' : `Sơ đồ ${form}`}
              </option>
            ))}
          </select>

          <p className="text-[11px] text-brand-muted flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-brand-muted" />
            <span>Mặc định solver sẽ thử nghiệm tất cả 8 sơ đồ hợp lệ của FPL để chọn ra kết quả tối ưu.</span>
          </p>
        </div>
      </div>

      {/* Quản lý Lock & Exclude Cầu thủ */}
      <div className="bg-brand-darker/60 border border-brand-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-brand-border pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('locked')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'locked'
                  ? 'bg-brand-skyblue/20 text-brand-skyblue-light border border-brand-skyblue/40'
                  : 'text-brand-muted hover:text-brand-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Khóa cầu thủ bắt buộc giữ ({lockedPlayerIds.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('excluded')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'excluded'
                  ? 'bg-brand-hotpink/20 text-brand-hotpink-light border border-brand-hotpink/40'
                  : 'text-brand-muted hover:text-brand-white'
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
                className="flex items-center justify-between px-3 py-2 bg-brand-card/60 hover:bg-brand-card border border-brand-border/60 rounded-lg text-xs transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-brand-white">{player.web_name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-brand-darker text-brand-muted rounded">
                    {player.element_type}
                  </span>
                  <span className="text-[10px] text-brand-muted">{player.team_short_name}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-brand-muted">£{player.now_cost.toFixed(1)}m</span>
                  <span className="font-semibold text-brand-skyblue-light">{player.total_points}p</span>

                  <div className="flex items-center gap-1.5">
                    {/* Nút Lock */}
                    <button
                      onClick={() => toggleLockPlayer(player.id)}
                      className={`p-1.5 rounded-md transition-colors ${
                        isLocked
                          ? 'bg-brand-skyblue text-brand-darker shadow font-bold'
                          : 'bg-brand-card text-brand-muted hover:text-brand-skyblue-light'
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
                          ? 'bg-brand-hotpink-dark text-brand-white shadow'
                          : 'bg-brand-card text-brand-muted hover:text-brand-hotpink-light'
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
