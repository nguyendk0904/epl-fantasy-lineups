import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { 
  GitCompare, 
  ArrowUpRight, 
  ArrowDownRight, 
  Check, 
  Layers, 
  ShieldCheck, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { LineupPlayer } from '../../types';

export interface LineupMetrics {
  totalCost: number;
  totalXp: number;
  attackRating: number;
  defenseRating: number;
  formRating: number;
  valueRating: number;
}

export interface LineupComparisonProps {
  lineupA: {
    title: string;
    players: LineupPlayer[];
    metrics?: LineupMetrics;
  };
  lineupB: {
    title: string;
    players: LineupPlayer[];
    metrics?: LineupMetrics;
  };
  onApplyLineupB?: () => void;
}

// Hàm tính toán metrics từ danh sách cầu thủ nếu chưa có
export function calculateLineupMetrics(players: LineupPlayer[]): LineupMetrics {
  if (players.length === 0) {
    return {
      totalCost: 0,
      totalXp: 0,
      attackRating: 0,
      defenseRating: 0,
      formRating: 0,
      valueRating: 0,
    };
  }

  const totalCost = Math.round(players.reduce((sum, p) => sum + p.now_cost, 0) * 10) / 10;
  const totalXp = Math.round(players.reduce((sum, p) => sum + (p.expected_points_next ?? p.total_points / 20), 0) * 10) / 10;

  // Tính rating chuẩn hóa thang 100
  const fwdsMids = players.filter(p => p.element_type === 'FWD' || p.element_type === 'MID');
  const defsGkps = players.filter(p => p.element_type === 'DEF' || p.element_type === 'GKP');

  const attackScore = fwdsMids.reduce((sum, p) => sum + p.total_points, 0);
  const defScore = defsGkps.reduce((sum, p) => sum + p.total_points, 0);

  const attackRating = Math.min(99, Math.round((attackScore / Math.max(1, fwdsMids.length * 150)) * 100));
  const defenseRating = Math.min(99, Math.round((defScore / Math.max(1, defsGkps.length * 110)) * 100));
  
  const avgForm = players.reduce((sum, p) => sum + (p.form ?? 5), 0) / players.length;
  const formRating = Math.min(99, Math.round((avgForm / 9) * 100));

  const valueRating = Math.min(99, Math.round((totalXp / Math.max(1, totalCost)) * 120));

  return {
    totalCost,
    totalXp,
    attackRating: Math.max(40, attackRating),
    defenseRating: Math.max(40, defenseRating),
    formRating: Math.max(40, formRating),
    valueRating: Math.max(40, valueRating),
  };
}

export const LineupComparisonView: React.FC<LineupComparisonProps> = ({
  lineupA,
  lineupB,
  onApplyLineupB,
}) => {
  const metricsA = lineupA.metrics ?? calculateLineupMetrics(lineupA.players);
  const metricsB = lineupB.metrics ?? calculateLineupMetrics(lineupB.players);

  // Radar chart data theo 5 trục năng lực
  const radarData = [
    { subject: 'Tấn Công', LineupA: metricsA.attackRating, LineupB: metricsB.attackRating, fullMark: 100 },
    { subject: 'Phòng Ngự', LineupA: metricsA.defenseRating, LineupB: metricsB.defenseRating, fullMark: 100 },
    { subject: 'Điểm Kỳ Vọng', LineupA: Math.min(99, Math.round(metricsA.totalXp)), LineupB: Math.min(99, Math.round(metricsB.totalXp)), fullMark: 100 },
    { subject: 'Phong Độ', LineupA: metricsA.formRating, LineupB: metricsB.formRating, fullMark: 100 },
    { subject: 'Hiệu Suất Giá', LineupA: metricsA.valueRating, LineupB: metricsB.valueRating, fullMark: 100 },
  ];

  // Head-to-Head Delta calculation
  const costDelta = Math.round((metricsB.totalCost - metricsA.totalCost) * 10) / 10;
  const xpDelta = Math.round((metricsB.totalXp - metricsA.totalXp) * 10) / 10;

  const setA = new Set(lineupA.players.map(p => p.id));
  const setB = new Set(lineupB.players.map(p => p.id));

  const commonPlayers = lineupA.players.filter(p => setB.has(p.id));
  const differentialPlayersB = lineupB.players.filter(p => !setA.has(p.id));

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action */}
      <div className="bg-gradient-to-r from-brand-card via-brand-darker to-brand-darker border border-brand-border rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-brand-white flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-brand-skyblue-light" />
            So Sánh Đội Hình Song Song (Head-to-Head Comparison)
          </h3>
          <p className="text-xs text-brand-muted mt-1">
            Đánh giá trực quan sức mạnh công/thủ giữa đội hình hiện tại và đội hình tối ưu của thuật toán.
          </p>
        </div>

        {onApplyLineupB && lineupB.players.length > 0 && (
          <button
            onClick={onApplyLineupB}
            className="px-4 py-2.5 rounded-xl bg-brand-hotpink-dark hover:bg-brand-hotpink text-brand-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-brand-hotpink/25 hover:brightness-110 active:scale-95 transition-all"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Áp Dụng {lineupB.title} Vào Sân Bóng</span>
          </button>
        )}
      </div>

      {/* Grid: Radar Chart & Metrics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Radar Chart (Recharts) */}
        <div className="lg:col-span-7 bg-brand-card/90 border border-brand-border rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col">
          <h4 className="text-sm font-bold text-brand-white mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-skyblue-light" />
            Biểu Đồ Radar Chỉ Số Sức Mạnh (5 Trục Năng Lực)
          </h4>

          <div className="w-full h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#164B63" />
                <PolarAngleAxis dataKey="subject" stroke="#86A9BA" tick={{ fill: '#86A9BA', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#1F6285" />
                <Radar
                  name={lineupA.title}
                  dataKey="LineupA"
                  stroke="#0593C6"
                  fill="#0593C6"
                  fillOpacity={0.35}
                />
                <Radar
                  name={lineupB.title}
                  dataKey="LineupB"
                  stroke="#D83995"
                  fill="#D83995"
                  fillOpacity={0.45}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0C2E3D', borderColor: '#164B63', borderRadius: '0.75rem', color: '#FCFFFF' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Head-to-Head Summary Cards */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-brand-card/90 border border-brand-border rounded-2xl p-5 shadow-xl backdrop-blur-md space-y-4">
            <h4 className="text-sm font-bold text-brand-white flex items-center gap-2 border-b border-brand-border pb-3">
              <ShieldCheck className="w-4 h-4 text-brand-skyblue-light" />
              Chênh Lệch Đối Đầu Trực Tiếp (Head-to-Head Delta)
            </h4>

            {/* Chi phí */}
            <div className="flex items-center justify-between p-3 bg-brand-darker/60 rounded-xl border border-brand-border">
              <div>
                <span className="text-xs text-brand-muted">Chênh lệch chi phí</span>
                <p className="text-sm font-bold text-brand-white mt-0.5">
                  £{metricsA.totalCost.toFixed(1)}m <span className="text-brand-muted font-normal">vs</span> £{metricsB.totalCost.toFixed(1)}m
                </p>
              </div>
              <div className={`flex items-center text-xs font-bold px-2.5 py-1 rounded-lg ${costDelta <= 0 ? 'bg-brand-skyblue/20 text-brand-skyblue-light' : 'bg-brand-hotpink/20 text-brand-hotpink-light'}`}>
                {costDelta <= 0 ? <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />}
                <span>{costDelta > 0 ? `+£${costDelta.toFixed(1)}m` : `£${costDelta.toFixed(1)}m`}</span>
              </div>
            </div>

            {/* Điểm kỳ vọng xP */}
            <div className="flex items-center justify-between p-3 bg-brand-darker/60 rounded-xl border border-brand-border">
              <div>
                <span className="text-xs text-brand-muted">Điểm kỳ vọng (xP)</span>
                <p className="text-sm font-bold text-brand-white mt-0.5">
                  {metricsA.totalXp.toFixed(1)} <span className="text-brand-muted font-normal">vs</span> {metricsB.totalXp.toFixed(1)}
                </p>
              </div>
              <div className={`flex items-center text-xs font-bold px-2.5 py-1 rounded-lg ${xpDelta >= 0 ? 'bg-brand-skyblue/20 text-brand-skyblue-light' : 'bg-brand-hotpink/20 text-brand-hotpink-light'}`}>
                {xpDelta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                <span>{xpDelta > 0 ? `+${xpDelta.toFixed(1)} xP` : `${xpDelta.toFixed(1)} xP`}</span>
              </div>
            </div>

            {/* Độ trùng lặp */}
            <div className="flex items-center justify-between p-3 bg-brand-darker/60 rounded-xl border border-brand-border">
              <div>
                <span className="text-xs text-brand-muted">Cầu thủ trùng nhau</span>
                <p className="text-sm font-bold text-brand-white mt-0.5">
                  {commonPlayers.length} / 15 cầu thủ
                </p>
              </div>
              <span className="text-xs font-bold text-brand-skyblue-light px-2.5 py-1 bg-brand-skyblue/10 border border-brand-skyblue/30 rounded-lg">
                {Math.round((commonPlayers.length / 15) * 100)}% giống nhau
              </span>
            </div>
          </div>

          {/* Differential Players List */}
          <div className="bg-brand-card/90 border border-brand-border rounded-2xl p-5 shadow-xl backdrop-blur-md flex-1">
            <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>Cầu thủ khác biệt nổi bật của {lineupB.title}:</span>
            </h4>
            
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {differentialPlayersB.length > 0 ? (
                differentialPlayersB.map(p => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-skyblue/15 border border-brand-skyblue/30 text-brand-skyblue-light text-xs font-semibold"
                  >
                    <span>{p.web_name}</span>
                    <span className="text-[10px] text-brand-muted">£{p.now_cost.toFixed(1)}m</span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-brand-muted italic">2 đội hình có cùng 15 cầu thủ</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
