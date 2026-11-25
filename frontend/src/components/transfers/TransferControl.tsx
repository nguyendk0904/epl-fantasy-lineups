import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight,
  RotateCcw,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { calculateTransfers, MAX_FREE_TRANSFERS, useLineupStore } from '../../stores/lineupStore';
import { TransferSummaryModal } from './TransferSummaryModal';
import { confirmGameweekTransfers, useTransferSession } from '../../services/gameweekApi';

export { calculateTransfers, MAX_FREE_TRANSFERS } from '../../stores/lineupStore';

export interface TransferControlProps {
  className?: string;
  onConfirmSuccess?: () => void;
}

export const TransferControl: React.FC<TransferControlProps> = ({
  className = '',
  onConfirmSuccess,
}) => {
  const {
    startingXI,
    bench,
    formation,
    captainId,
    viceCaptainId,
    getRemainingBudget,
  } = useLineupStore();

  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const { token, gameweek, pending, error, confirmation, baseline: baselineSquad, setIdentity } = useTransferSession();
  const transfersMadeThisWeek = confirmation?.transfers_used ?? 0;


  // Tính toán thời gian đếm ngược đến Deadline Gameweek
  const targetDeadline = useMemo(() => {
    return confirmation ? Date.parse(confirmation.deadline) : NaN;
  }, [confirmation]);

  useEffect(() => {
    setIsSummaryModalOpen(false);
  }, [token, gameweek]);

  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPassed: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: false });

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = targetDeadline - now;

      if (!Number.isFinite(diff) || diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isPassed: false });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [targetDeadline]);

  // Tính toán số lượt chuyển nhượng giữa đội hình hiện tại và baseline
  const currentSquad = useMemo(() => [...startingXI, ...bench], [startingXI, bench]);
  const totalPlayers = currentSquad.length;
  const isSquadComplete = startingXI.length === 11 && bench.length === 4 && new Set(currentSquad.map((player) => player.id)).size === 15;

  const transferStats = useMemo(() => {
    return calculateTransfers(currentSquad, confirmation ? baselineSquad : currentSquad, transfersMadeThisWeek);
  }, [currentSquad, baselineSquad, transfersMadeThisWeek, confirmation]);

  const remainingBudget = getRemainingBudget();
  const hasTransfers = transferStats.transfersCount > 0;

  // Xác nhận chuyển nhượng
  const closed = !!confirmation && (confirmation.is_locked || Date.now() >= targetDeadline);
  const overLimit = !!confirmation && transferStats.totalTransfers > MAX_FREE_TRANSFERS;
  const handleConfirmTransfers = async () => {
    if (pending || closed || overLimit || !isSquadComplete || !captainId || !viceCaptainId) return;
    const snapshot = currentSquad.map((player) => ({ ...player }));
    if (await confirmGameweekTransfers({ gameweek, starting_player_ids: startingXI.map((player) => player.id),
      bench_player_ids: bench.map((player) => player.id), formation, captain_id: captainId,
      vice_captain_id: viceCaptainId }, snapshot)) {
      setIsSummaryModalOpen(false);
      onConfirmSuccess?.();
    }
  };

  return (
    <div
      className={`rounded-2xl border border-brand-border/90 shadow-2xl overflow-hidden bg-gradient-to-b from-brand-card/95 via-brand-dark/95 to-brand-darker/95 backdrop-blur-md ${className}`}
      data-testid="transfer-control"
    >
      <div className="p-4 space-y-3 border-b border-brand-border text-sm">
        <label className="block text-brand-muted">Token demo cá nhân (giữ trong phiên hiện tại)
          <input type="password" autoComplete="off" value={token} disabled={pending}
            onChange={(event) => setIdentity(event.target.value, gameweek)} aria-label="Token demo cá nhân"
            className="block w-full rounded-lg bg-brand-darker border border-brand-border p-2 text-white" />
        </label>
        <label className="block text-brand-muted">Vòng cần lưu
          <select aria-label="Vòng chuyển nhượng" value={gameweek} disabled={pending}
            onChange={(event) => setIdentity(token, Number(event.target.value))}
            className="ml-3 rounded bg-brand-darker p-2 text-white">
            {Array.from({ length: 38 }, (_, i) => <option key={i + 1} value={i + 1}>GW {i + 1}</option>)}
          </select>
        </label>
        <p className="text-xs text-brand-muted">Đội hình trên sân là bản nháp của máy này. Kiểm tra đủ 15 người và C/V trước khi lưu cho token đã chọn.</p>
        {confirmation ? <p role="status" className="text-emerald-300">Server đã lưu cho Player #{confirmation.user_id}, GW {confirmation.gameweek}. Còn lại: {confirmation.remaining_transfers} / 3 lượt.</p>
          : <p role="status" className="text-amber-300">Chưa đồng bộ đội hình và số lượt với server. Server kiểm tra deadline khi xác nhận.</p>}
        {error && <p role="alert" className="text-rose-300">{error}</p>}
      </div>
      {/* 1. TOP SPOTLIGHT: GAMEWEEK DEADLINE COUNTDOWN TICKER (Làm nổi bật Gameweek Deadline) */}
      <div
        className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-amber-500/15 via-brand-darker to-brand-skyblue/15 border-b border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-3 shadow-inner"
        data-testid="deadline-spotlight"
      >
        {/* Tiêu đề & Cờ trạng thái Live Deadline */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="relative flex items-center justify-center">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 drop-shadow-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                HẠN CHỐT GAMEWEEK (DEADLINE)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200 uppercase">
                GW {gameweek}
              </span>
            </div>
            <p className="text-[11px] text-brand-muted hidden sm:block">
              Deadline chính thức do server xác nhận
            </p>
          </div>
        </div>

        {/* Đồng hồ LED kỹ thuật số (Digital Countdown Blocks) */}
        <div className="flex items-center gap-1.5 sm:gap-2 self-center">
          {!confirmation ? <span className="text-xs text-amber-300">Chưa nhận deadline từ server</span> : closed ? (
            <div className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 font-black text-xs sm:text-sm uppercase flex items-center gap-2 animate-pulse">
              <ShieldAlert className="w-4 h-4" />
              <span>ĐÃ KHÓA SỔ GAMEWEEK</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 sm:gap-1.5 font-mono">
              {/* Ngày */}
              <div className="flex flex-col items-center">
                <div className="bg-brand-darker/90 border border-amber-500/40 rounded-xl px-2.5 sm:px-3 py-1 text-center min-w-[42px] sm:min-w-[48px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                  <span className="text-sm sm:text-lg font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                    {String(timeLeft.days).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-amber-200/80 uppercase mt-0.5">Ngày</span>
              </div>

              <span className="text-amber-400 font-black text-sm pb-3">:</span>

              {/* Giờ */}
              <div className="flex flex-col items-center">
                <div className="bg-brand-darker/90 border border-amber-500/40 rounded-xl px-2.5 sm:px-3 py-1 text-center min-w-[42px] sm:min-w-[48px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                  <span className="text-sm sm:text-lg font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                    {String(timeLeft.hours).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-amber-200/80 uppercase mt-0.5">Giờ</span>
              </div>

              <span className="text-amber-400 font-black text-sm pb-3">:</span>

              {/* Phút */}
              <div className="flex flex-col items-center">
                <div className="bg-brand-darker/90 border border-amber-500/40 rounded-xl px-2.5 sm:px-3 py-1 text-center min-w-[42px] sm:min-w-[48px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                  <span className="text-sm sm:text-lg font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-amber-200/80 uppercase mt-0.5">Phút</span>
              </div>

              <span className="text-amber-400 font-black text-sm pb-3">:</span>

              {/* Giây */}
              <div className="flex flex-col items-center">
                <div className="bg-brand-darker/90 border border-amber-500/40 rounded-xl px-2.5 sm:px-3 py-1 text-center min-w-[42px] sm:min-w-[48px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                  <span className="text-sm sm:text-lg font-black text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.7)] animate-pulse">
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-amber-200/80 uppercase mt-0.5">Giây</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. BOTTOM BAR: TRANSFER STATUS & ACTION BUTTONS */}
      <div className="p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Thông tin số lượt chuyển nhượng */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Badge Số lượt chuyển nhượng còn lại */}
          <div
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border backdrop-blur-md shadow-sm transition-all ${
              transferStats.remainingTransfers === 3
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : transferStats.remainingTransfers > 0
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
            }`}
            data-testid="transfer-counter-badge"
          >
            <div className="w-8 h-8 rounded-lg bg-black/25 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <span className="font-semibold text-[11px] block text-brand-white/80">
                Lượt chuyển nhượng tuần:
              </span>
              <span className="font-black text-sm">
                {confirmation ? `Dự kiến còn: ${transferStats.remainingTransfers} / ${MAX_FREE_TRANSFERS} lượt` : 'Số lượt: chưa xác minh'}
              </span>
            </div>
          </div>

          {/* Badge Số lượt đã dùng tuần này nếu > 0 */}
          {transferStats.transfersMadeThisWeek > 0 && (
            <div className="px-2.5 py-1.5 rounded-xl bg-brand-darker/80 border border-brand-border text-brand-muted text-xs font-semibold flex items-center gap-1.5">
              <span>Đã chốt tuần này:</span>
              <span className="font-black text-white">{transferStats.transfersMadeThisWeek}/3</span>
            </div>
          )}

          {/* Cảnh báo khi vượt giới hạn tuần */}
          {overLimit && (
            <div className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-black flex items-center gap-1.5 shadow-sm animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Vượt giới hạn 3 lượt/tuần</span>
            </div>
          )}

          {/* Trạng thái thiếu cầu thủ nếu đội hình < 15 */}
          {!isSquadComplete && (
            <div
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5"
              data-testid="incomplete-squad-notice"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Thiếu {15 - totalPlayers} cầu thủ ({totalPlayers}/15)</span>
            </div>
          )}

          {/* Hiển thị tóm tắt OUT / IN nếu đang có thay đổi */}
          {hasTransfers && (
            <div className="hidden lg:flex items-center gap-2 text-xs text-brand-muted bg-brand-darker/70 px-3 py-1.5 rounded-xl border border-brand-border">
              <span className="text-rose-400 font-black">
                OUT: {transferStats.playersOut.length}
              </span>
              <span>•</span>
              <span className="text-emerald-400 font-black">
                IN: {transferStats.playersIn.length}
              </span>
            </div>
          )}
        </div>

        {/* Nút hành động Chốt & Khôi phục */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {confirmation && hasTransfers && <button disabled={pending} className="px-3 py-2 rounded-xl border border-brand-border text-brand-muted text-xs"
            onClick={() => useLineupStore.setState({ startingXI: baselineSquad.filter((player) => player.isStarting),
              bench: baselineSquad.filter((player) => !player.isStarting), formation: confirmation.formation,
              captainId: confirmation.captain_id, viceCaptainId: confirmation.vice_captain_id })}>
            <RotateCcw className="inline w-4 h-4 mr-1" />Khôi phục đội hình đã lưu
          </button>}
          <button
            onClick={() => setIsSummaryModalOpen(true)}
            disabled={!token || !isSquadComplete || !captainId || !viceCaptainId || overLimit || closed || pending}
            title={
              !hasTransfers
                ? 'Lưu đội hình ban đầu hoặc cập nhật XI, đội trưởng'
                : 'Mở màn hình trung tâm chuyển nhượng'
            }
            className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-brand-skyblue to-brand-skyblue-light hover:brightness-110 text-brand-darker font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-brand-skyblue/25 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 transition-all"
          >
            <span>
              {pending ? 'Đang xác nhận...' : !isSquadComplete && hasTransfers
                ? `Xem Chuyển Nhượng (${totalPlayers}/15)`
                : `Lưu Đội Hình / Chốt Chuyển Nhượng${hasTransfers ? ` (${transferStats.transfersCount})` : ''}`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Tóm Tắt & Xác Nhận Chuyển Nhượng */}
      <TransferSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => { if (!pending) setIsSummaryModalOpen(false); }}
        onConfirm={handleConfirmTransfers}
        playersOut={transferStats.playersOut}
        playersIn={transferStats.playersIn}
        remainingBudget={remainingBudget}
        netCostDiff={transferStats.netCostDiff}
        transfersCount={transferStats.transfersCount}
        totalTransfers={transferStats.totalTransfers}
        transfersMadeThisWeek={transferStats.transfersMadeThisWeek}
        isSquadComplete={isSquadComplete}
        totalSquadPlayers={totalPlayers}
        deadlinePassed={closed}
        allowUnchanged
        isLoading={pending}
        error={error}
        countersVerified={!!confirmation}
      />
    </div>
  );
};
