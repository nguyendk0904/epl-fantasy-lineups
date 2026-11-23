import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight,
  Clock,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { calculateTransfers, MAX_FREE_TRANSFERS, useLineupStore } from '../../stores/lineupStore';
import { TransferSummaryModal } from './TransferSummaryModal';

export { calculateTransfers, MAX_FREE_TRANSFERS } from '../../stores/lineupStore';

export interface TransferControlProps {
  className?: string;
  deadlineTarget?: Date | string;
  onConfirmSuccess?: () => void;
}

export const TransferControl: React.FC<TransferControlProps> = ({
  className = '',
  deadlineTarget,
  onConfirmSuccess,
}) => {
  const {
    startingXI,
    bench,
    baselineSquad,
    transfersMadeThisWeek,
    resetToBaseline,
    commitTransfers,
    syncTransferWeek,
    setBaselineSquad,
    getRemainingBudget,
  } = useLineupStore();

  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);


  // Tính toán thời gian đếm ngược đến Deadline Gameweek
  const [today, setToday] = useState(() => new Date().toDateString());
  const targetDeadline = useMemo(() => {
    if (deadlineTarget !== undefined) return new Date(deadlineTarget instanceof Date ? deadlineTarget.getTime() : deadlineTarget).getTime();
    // Demo weeks run Sunday to Saturday; Saturday stays closed after 11:30.
    const saturday = new Date(today);
    saturday.setDate(saturday.getDate() + 6 - saturday.getDay());
    saturday.setHours(11, 30, 0, 0);
    return saturday.getTime();
  }, [today, deadlineTarget]);

  useEffect(() => {
    syncTransferWeek(targetDeadline);
    setIsSummaryModalOpen(false);
  }, [targetDeadline, syncTransferWeek]);

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
      setToday(new Date(now).toDateString());
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
  useEffect(() => {
    if (!baselineSquad.length && currentSquad.length === 15) setBaselineSquad(currentSquad);
  }, [baselineSquad.length, currentSquad, setBaselineSquad]);
  const isSquadComplete = totalPlayers === 15;

  const transferStats = useMemo(() => {
    return calculateTransfers(currentSquad, baselineSquad, transfersMadeThisWeek);
  }, [currentSquad, baselineSquad, transfersMadeThisWeek]);

  const remainingBudget = getRemainingBudget();
  const hasTransfers = transferStats.transfersCount > 0;

  // Xác nhận chuyển nhượng
  const closed = timeLeft.isPassed || !Number.isFinite(targetDeadline) || Date.now() >= targetDeadline;
  const overLimit = transferStats.totalTransfers > MAX_FREE_TRANSFERS;
  const handleConfirmTransfers = () => {
    if (commitTransfers(targetDeadline)) {
      setIsSummaryModalOpen(false);
      onConfirmSuccess?.();
    }
  };

  return (
    <div
      className={`rounded-2xl border border-brand-border/90 shadow-2xl overflow-hidden bg-gradient-to-b from-brand-card/95 via-brand-dark/95 to-brand-darker/95 backdrop-blur-md ${className}`}
      data-testid="transfer-control"
    >
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
                {deadlineTarget === undefined ? 'LỊCH DEMO' : 'GAMEWEEK'}
              </span>
            </div>
            <p className="text-[11px] text-brand-muted hidden sm:block">
              Khóa sổ chuyển nhượng 90 phút trước trận đấu mở màn của vòng
            </p>
          </div>
        </div>

        {/* Đồng hồ LED kỹ thuật số (Digital Countdown Blocks) */}
        <div className="flex items-center gap-1.5 sm:gap-2 self-center">
          {timeLeft.isPassed ? (
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
                Còn lại: {transferStats.remainingTransfers} / {MAX_FREE_TRANSFERS} lượt
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
          {hasTransfers && (
            <button
              onClick={resetToBaseline}
              className="px-3.5 py-2 rounded-xl bg-brand-darker hover:bg-brand-card border border-brand-border text-xs font-bold text-brand-muted hover:text-white transition-all flex items-center gap-1.5"
              title="Khôi phục đội hình trước khi chuyển nhượng"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Khôi phục</span>
            </button>
          )}

          <button
            onClick={() => setIsSummaryModalOpen(true)}
            disabled={!hasTransfers || overLimit || closed}
            title={
              !hasTransfers
                ? 'Chưa có thay đổi cầu thủ nào'
                : 'Mở màn hình trung tâm chuyển nhượng'
            }
            className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-brand-skyblue to-brand-skyblue-light hover:brightness-110 text-brand-darker font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-brand-skyblue/25 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 transition-all"
          >
            <span>
              {!isSquadComplete && hasTransfers
                ? `Xem Chuyển Nhượng (${totalPlayers}/15)`
                : `Chốt Chuyển Nhượng${hasTransfers ? ` (${transferStats.transfersCount})` : ''}`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Tóm Tắt & Xác Nhận Chuyển Nhượng */}
      <TransferSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
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
      />
    </div>
  );
};
