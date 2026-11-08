import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  ArrowLeft, 
  Copy, 
  Check, 
  AlertCircle, 
  Wallet, 
  Sparkles, 
  Calendar,
  Share2,
  ExternalLink
} from 'lucide-react';
import { SharedPitchView } from '../components/share/SharedPitchView';
import { apiClient } from '../services/apiClient';
import { useLineupStore } from '../stores/lineupStore';
import { FormationType, LineupPlayer, PositionType } from '../types';

export interface SharedPlayerApi {
  id: number;
  web_name: string;
  team_id: number;
  team_short_name: string;
  element_type: PositionType;
  now_cost: number;
  total_points: number;
  form?: number | null;
  status?: string | null;
  expected_points_next?: number | null;
}

export interface SharedPlayerDataApi {
  starting_player_ids: number[];
  bench_player_ids: number[];
  formation: FormationType;
  captain_id: number;
  vice_captain_id: number;
  players: SharedPlayerApi[];
}

export interface SharedLineupApiResponse {
  share_code: string;
  lineup_name: string;
  total_cost: number;
  predicted_points: number;
  player_data: SharedPlayerDataApi;
  created_at: string;
}

export interface SharedLineupPageProps {
  code?: string;
  onNavigateHome?: () => void;
}

export const SharedLineupPage: React.FC<SharedLineupPageProps> = ({
  code: propCode,
  onNavigateHome,
}) => {
  // Extract share_code from props or URL hash: #/share/:code
  const resolvedCode = ((): string => {
    if (propCode && propCode.trim()) return propCode.trim();
    if (typeof window !== 'undefined') {
      const hash = window.location.hash; // e.g. #/share/k8XyZ2
      const match = hash.match(/#\/share\/([A-Za-z0-9]{6})/);
      if (match && match[1]) return match[1];

      // fallback: check pathname /share/:code
      const pathMatch = window.location.pathname.match(/\/share\/([A-Za-z0-9]{6})/);
      if (pathMatch && pathMatch[1]) return pathMatch[1];
    }
    return '';
  })();

  const isInvalidCode = !resolvedCode || resolvedCode.length !== 6;
  const [isLoading, setIsLoading] = useState<boolean>(!isInvalidCode);
  const [error, setError] = useState<string | null>(
    isInvalidCode ? 'Mã chia sẻ không hợp lệ hoặc thiếu mã đội hình.' : null
  );
  const [data, setData] = useState<SharedLineupApiResponse | null>(null);
  const [copiedToStore, setCopiedToStore] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const { loadSampleLineup, setFormation, setCaptain, setViceCaptain, showToast } = useLineupStore();

  useEffect(() => {
    let isMounted = true;

    async function fetchSharedLineup() {
      if (!resolvedCode || resolvedCode.length !== 6) {
        setIsLoading(false);
        setError('Mã chia sẻ không hợp lệ hoặc thiếu mã đội hình.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<SharedLineupApiResponse>(`/lineups/share/${resolvedCode}`);
        if (isMounted) {
          setData(response);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Không tìm thấy đội hình chia sẻ.';
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchSharedLineup();

    return () => {
      isMounted = false;
    };
  }, [resolvedCode]);

  // Convert API player_data into startingXI and bench arrays
  const { startingXI, bench } = ((): { startingXI: LineupPlayer[]; bench: LineupPlayer[] } => {
    if (!data?.player_data) return { startingXI: [], bench: [] };

    const { player_data } = data;
    const playerMap = new Map(player_data.players.map((p) => [p.id, p]));

    const startingXIResult: LineupPlayer[] = player_data.starting_player_ids.map((id, index) => {
      const p = playerMap.get(id);
      return {
        id,
        web_name: p?.web_name || `Player ${id}`,
        team_id: p?.team_id || 1,
        team_short_name: p?.team_short_name || 'EPL',
        element_type: p?.element_type || 'MID',
        now_cost: p?.now_cost || 5.0,
        total_points: p?.total_points || 0,
        expected_points_next: p?.expected_points_next ?? undefined,
        form: p?.form ?? undefined,
        status: p?.status ?? undefined,
        isStarting: true,
        isCaptain: id === player_data.captain_id,
        isViceCaptain: id === player_data.vice_captain_id,
        slotIndex: index,
      };
    });

    const benchResult: LineupPlayer[] = player_data.bench_player_ids.map((id, index) => {
      const p = playerMap.get(id);
      return {
        id,
        web_name: p?.web_name || `Bench ${id}`,
        team_id: p?.team_id || 1,
        team_short_name: p?.team_short_name || 'EPL',
        element_type: p?.element_type || (index === 0 ? 'GKP' : 'DEF'),
        now_cost: p?.now_cost || 4.5,
        total_points: p?.total_points || 0,
        expected_points_next: p?.expected_points_next ?? undefined,
        form: p?.form ?? undefined,
        status: p?.status ?? undefined,
        isStarting: false,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: index,
      };
    });

    return { startingXI: startingXIResult, bench: benchResult };
  })();

  const handleCopyLineupToStore = () => {
    if (!data || startingXI.length !== 11 || bench.length !== 4) return;

    loadSampleLineup(startingXI, bench);
    setFormation(data.player_data.formation);
    setCaptain(data.player_data.captain_id);
    setViceCaptain(data.player_data.vice_captain_id);

    setCopiedToStore(true);
    showToast('Đã nạp đội hình này vào máy bạn thành công!');
    setTimeout(() => setCopiedToStore(false), 3000);

    if (onNavigateHome) {
      setTimeout(() => onNavigateHome(), 800);
    } else if (typeof window !== 'undefined') {
      window.location.hash = '';
    }
  };

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark text-brand-white flex flex-col font-sans selection:bg-brand-hotpink-dark selection:text-brand-white">
      {/* Top Header */}
      <header className="border-b border-brand-border bg-brand-darker/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => (onNavigateHome ? onNavigateHome() : (window.location.hash = ''))}
              className="p-2 rounded-xl bg-brand-card hover:bg-brand-card-hover text-brand-muted hover:text-white border border-brand-border transition-all"
              title="Quay lại ứng dụng chính"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-lg shadow-brand-darker/50 border border-brand-skyblue/30">
              <Trophy className="w-4 h-4 text-brand-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                FPL LINEUP <span className="text-brand-skyblue-light">VIEWER</span>
              </h1>
              <p className="text-[11px] text-brand-muted hidden sm:block">Đội hình chia sẻ công khai</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-full bg-brand-darker border border-brand-border hover:border-brand-skyblue/50 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-brand-skyblue-light" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Đã copy link' : 'Sao chép link'}</span>
            </button>

            {data && (
              <button
                onClick={handleCopyLineupToStore}
                className="px-4 py-1.5 rounded-full bg-gradient-to-r from-brand-skyblue to-brand-skyblue-light text-brand-darker font-bold text-xs flex items-center gap-1.5 shadow-md hover:brightness-110 active:scale-95 transition-all"
              >
                {copiedToStore ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedToStore ? 'Đã sao chép vào máy!' : 'Sao chép vào máy tôi'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-12 h-12 border-4 border-brand-skyblue border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-brand-skyblue-light">Đang tải dữ liệu đội hình từ Cloud...</p>
          </div>
        )}

        {/* Error / 404 State */}
        {!isLoading && error && (
          <div className="max-w-lg mx-auto bg-brand-card/80 border border-brand-hotpink/40 rounded-2xl p-8 text-center space-y-4 shadow-2xl backdrop-blur">
            <div className="w-12 h-12 rounded-full bg-brand-hotpink/20 text-brand-hotpink-light flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Không tìm thấy đội hình</h2>
              <p className="text-xs text-brand-muted mt-1.5 leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => (onNavigateHome ? onNavigateHome() : (window.location.hash = ''))}
              className="px-5 py-2.5 rounded-xl bg-brand-skyblue text-brand-darker font-bold text-xs hover:brightness-110 transition-all shadow-lg"
            >
              Về trang chủ tạo đội hình mới
            </button>
          </div>
        )}

        {/* Success View */}
        {!isLoading && data && (
          <div className="space-y-6">
            {/* Squad Metadata Card */}
            <div className="bg-gradient-to-r from-brand-card/90 to-brand-darker/90 border border-brand-border rounded-2xl p-5 sm:p-6 backdrop-blur shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-brand-skyblue-light bg-brand-skyblue/10 border border-brand-skyblue/30 px-2 py-0.5 rounded">
                    #{data.share_code}
                  </span>
                  <span className="text-xs text-brand-muted flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(data.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">{data.lineup_name}</h2>
                <p className="text-xs text-brand-muted mt-0.5">Sơ đồ: {data.player_data.formation} • 15 Cầu thủ</p>
              </div>

              {/* Stats pill container */}
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-xl bg-brand-darker/80 border border-brand-border text-center">
                  <div className="text-[10px] text-brand-muted uppercase font-bold flex items-center gap-1 justify-center">
                    <Wallet className="w-3 h-3 text-brand-skyblue-light" />
                    <span>Tổng giá</span>
                  </div>
                  <span className="text-sm sm:text-base font-extrabold text-brand-skyblue-light">
                    £{data.total_cost.toFixed(1)}m
                  </span>
                </div>

                <div className="px-4 py-2 rounded-xl bg-brand-darker/80 border border-brand-border text-center">
                  <div className="text-[10px] text-brand-muted uppercase font-bold flex items-center gap-1 justify-center">
                    <Sparkles className="w-3 h-3 text-brand-hotpink-light" />
                    <span>Điểm xP</span>
                  </div>
                  <span className="text-sm sm:text-base font-extrabold text-brand-hotpink-light">
                    {data.predicted_points.toFixed(1)}
                  </span>
                </div>

                <button
                  onClick={handleCopyLineupToStore}
                  className="hidden sm:flex px-4 py-3 rounded-xl bg-brand-skyblue hover:bg-brand-skyblue-light text-brand-darker font-bold text-xs items-center gap-2 shadow-lg transition-all active:scale-95"
                >
                  <Copy className="w-4 h-4" />
                  <span>Nạp vào máy tôi</span>
                </button>
              </div>
            </div>

            {/* Read-Only Virtual Pitch */}
            <SharedPitchView
              startingXI={startingXI}
              bench={bench}
              formation={data.player_data.formation}
              captainId={data.player_data.captain_id}
              viceCaptainId={data.player_data.vice_captain_id}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-brand-border bg-brand-darker/80 py-4 mt-auto text-center text-xs text-brand-muted">
        <p>Fantasy Premier League Lineup Shared Snapshot • Cloud Computing 2026</p>
      </footer>
    </div>
  );
};

export default SharedLineupPage;
