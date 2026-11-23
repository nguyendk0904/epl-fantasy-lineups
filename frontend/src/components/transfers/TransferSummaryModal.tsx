import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowLeftRight,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  Clock,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { LineupPlayer } from '../../types';
import { getPlayerKitUrl } from '../pitch/PlayerPitchSlot';

export interface TransferSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  playersOut: LineupPlayer[];
  playersIn: LineupPlayer[];
  remainingBudget: number;
  netCostDiff: number;
  deadlinePassed?: boolean;
  transfersCount: number;
  totalTransfers?: number;
  transfersMadeThisWeek?: number;
  isSquadComplete?: boolean;
  totalSquadPlayers?: number;
  isLoading?: boolean;
}

export const TransferSummaryModal: React.FC<TransferSummaryModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  playersOut,
  playersIn,
  remainingBudget,
  netCostDiff,
  deadlinePassed = false,
  transfersCount,
  totalTransfers = transfersCount,
  transfersMadeThisWeek = 0,
  isSquadComplete = true,
  totalSquadPlayers = 15,
  isLoading = false,
}) => {
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Đóng modal khi bấm phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Khóa cuộn trang nền khi mở màn hình chuyển nhượng
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isBudgetValid = remainingBudget >= 0;
  const remainingFreeTransfers = Math.max(0, 3 - totalTransfers);
  const isFree = totalTransfers <= 3;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 md:p-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-summary-title"
      data-testid="transfer-summary-modal"
    >
      {/* Backdrop Glassmorphism làm mờ và tối toàn bộ màn hình nền */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-xl transition-opacity animate-fade-in"
        aria-hidden="true"
      />

      {/* Container Toàn Diện - Màn Hình Trung Tâm Chuyển Nhượng */}
      <div className="relative z-10 w-full max-w-5xl h-[90vh] max-h-[860px] bg-gradient-to-b from-brand-card/95 via-brand-dark/95 to-brand-darker border border-brand-skyblue/40 rounded-3xl shadow-[0_0_60px_rgba(56,189,248,0.25)] overflow-hidden flex flex-col animate-scale-up">
        {/* 1. Header Màn Hình */}
        <div className="px-6 py-4 border-b border-brand-border bg-gradient-to-r from-brand-card/90 via-brand-darker to-brand-card/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-brand-skyblue/20 border border-brand-skyblue/40 flex items-center justify-center text-brand-skyblue-light shadow-lg shadow-brand-skyblue/10">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2
                  id="transfer-summary-title"
                  className="text-lg sm:text-xl font-black text-white tracking-wide flex items-center gap-2"
                >
                  Xác Nhận Chuyển Nhượng Gameweek (Transfer Hub)
                </h2>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-brand-skyblue/20 text-brand-skyblue-light border border-brand-skyblue/40 uppercase tracking-wider">
                  FPL OFFICIAL RULES
                </span>
              </div>
              <p className="text-xs text-brand-muted mt-0.5">
                Kiểm tra chi tiết danh sách bán & mua, hạn mức tuần và xác nhận đội hình chính thức
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-brand-darker hover:bg-brand-card border border-brand-border hover:border-brand-skyblue/40 text-brand-muted hover:text-white flex items-center justify-center transition-all shadow-sm"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Thân Màn Hình Chuyển Nhượng (Rộng rãi, cuộn mượt mà) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Cảnh báo thiếu cầu thủ */}
          {!isSquadComplete && (
            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 shadow-md">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm space-y-1">
                <p className="font-black text-amber-300">
                  Đội hình chưa đủ 15 cầu thủ ({totalSquadPlayers}/15)!
                </p>
                <p className="text-amber-200/90 leading-relaxed text-xs">
                  Bạn đã bán {playersOut.length} cầu thủ nhưng mới chọn {playersIn.length} cầu thủ thay thế.
                  Quy định FPL yêu cầu đội hình phải có đúng 15 cầu thủ để hoàn tất chốt chuyển nhượng.
                </p>
              </div>
            </div>
          )}

          {/* Cảnh báo vượt ngân sách */}
          {!isBudgetValid && (
            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 shadow-md">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm space-y-1">
                <p className="font-black text-rose-300">Vượt quá giới hạn ngân sách!</p>
                <p className="text-rose-200/90 leading-relaxed text-xs">
                  Tổng chi phí đội hình vượt ngân sách £100.0m cho phép (Âm £{Math.abs(remainingBudget).toFixed(1)}m).
                  Vui lòng chọn cầu thủ có mức giá phù hợp hơn trước khi chốt.
                </p>
              </div>
            </div>
          )}

          {/* Hai Cột So Sánh Rộng Rãi: Cầu Thủ Bán (OUT) vs Cầu Thủ Mua (IN) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* CỘT CẦU THỦ BÁN RA (OUT 🔻) */}
            <div className="bg-brand-darker/90 border border-rose-500/30 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-inner">
              <div className="flex items-center justify-between pb-3 border-b border-brand-border/70">
                <span className="text-xs sm:text-sm font-black text-rose-400 flex items-center gap-2 uppercase tracking-wider">
                  <ArrowDownRight className="w-5 h-5 text-rose-400" />
                  Cầu Thủ Bán Ra (OUT)
                </span>
                <span className="text-xs font-black text-rose-300 bg-rose-500/20 px-2.5 py-1 rounded-xl border border-rose-500/30">
                  {playersOut.length} cầu thủ
                </span>
              </div>

              {playersOut.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <ArrowDownRight className="w-8 h-8 text-brand-muted mx-auto opacity-30" />
                  <p className="text-xs text-brand-muted">
                    Chưa có cầu thủ nào bị bán ra khỏi đội hình
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {playersOut.map((p) => {
                    const kitUrl = getPlayerKitUrl(
                      p.team_id,
                      p.element_type,
                      p.team_code,
                      p.team_short_name
                    );
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-brand-card/70 border border-brand-border/80 hover:border-rose-500/40 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={kitUrl}
                            alt={p.web_name}
                            className="w-10 h-10 object-contain shrink-0"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-black text-white truncate">
                              {p.web_name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-darker text-brand-muted uppercase">
                                {p.element_type}
                              </span>
                              <span className="text-[11px] text-brand-muted">
                                {p.team_short_name}
                              </span>
                              <span className="text-[11px] text-brand-muted">•</span>
                              <span className="text-[11px] text-amber-400 font-bold">
                                {p.total_points} pts
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-emerald-400 block">
                            +£{p.now_cost.toFixed(1)}m
                          </span>
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider">
                            BÁN (OUT)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CỘT CẦU THỦ MUA VÀO (IN 🔺) */}
            <div className="bg-brand-darker/90 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-inner">
              <div className="flex items-center justify-between pb-3 border-b border-brand-border/70">
                <span className="text-xs sm:text-sm font-black text-emerald-400 flex items-center gap-2 uppercase tracking-wider">
                  <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                  Cầu Thủ Mua Vào (IN)
                </span>
                <span className="text-xs font-black text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-xl border border-emerald-500/30">
                  {playersIn.length} cầu thủ
                </span>
              </div>

              {playersIn.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <ArrowUpRight className="w-8 h-8 text-brand-muted mx-auto opacity-30" />
                  <p className="text-xs text-brand-muted">
                    Chưa chọn cầu thủ mua mới nào thay thế
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {playersIn.map((p) => {
                    const kitUrl = getPlayerKitUrl(
                      p.team_id,
                      p.element_type,
                      p.team_code,
                      p.team_short_name
                    );
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-brand-card/70 border border-brand-border/80 hover:border-emerald-500/40 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={kitUrl}
                            alt={p.web_name}
                            className="w-10 h-10 object-contain shrink-0"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-black text-white truncate">
                              {p.web_name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-darker text-brand-muted uppercase">
                                {p.element_type}
                              </span>
                              <span className="text-[11px] text-brand-muted">
                                {p.team_short_name}
                              </span>
                              <span className="text-[11px] text-brand-muted">•</span>
                              <span className="text-[11px] text-amber-400 font-bold">
                                {p.total_points} pts
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-rose-400 block">
                            -£{p.now_cost.toFixed(1)}m
                          </span>
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                            MUA (IN)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 3. Bảng Tóm Tắt Tài Chính & Hạn Mức Chuyển Nhượng */}
          <div className="bg-brand-darker/95 rounded-2xl p-4 sm:p-5 border border-brand-border/90 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-brand-skyblue-light uppercase tracking-wider">
                <Wallet className="w-4 h-4" />
                <span>BẢNG TỔNG KẾT TÀI CHÍNH &amp; LUẬT CHUYỂN NHƯỢNG GAMEWEEK</span>
              </div>
              {transfersMadeThisWeek > 0 && (
                <span className="text-xs font-bold text-brand-muted">
                  Đã chốt tuần này: <strong className="text-white">{transfersMadeThisWeek}/3 lượt</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {/* Box 1: Lượt đổi lần này */}
              <div className="bg-brand-card/70 p-3 rounded-2xl border border-brand-border/70 shadow-sm">
                <span className="text-brand-muted text-[11px] block">Lượt đổi lần này</span>
                <span className="text-base font-black text-white block mt-0.5">
                  {transfersCount} cầu thủ
                </span>
                <span className="text-[10px] text-brand-muted block mt-1">
                  Tổng tuần: {totalTransfers}/3 lượt
                </span>
              </div>

              {/* Box 2: Lượt miễn phí còn lại */}
              <div className="bg-brand-card/70 p-3 rounded-2xl border border-brand-border/70 shadow-sm">
                <span className="text-brand-muted text-[11px] block">Lượt miễn phí còn lại</span>
                <span
                  className={`text-base font-black block mt-0.5 ${
                    remainingFreeTransfers > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {remainingFreeTransfers} / 3 lượt
                </span>
                <span className="text-[10px] text-brand-muted block mt-1">
                  {isFree ? 'Miễn phí' : 'Vượt hạn mức'}
                </span>
              </div>

              {deadlinePassed && <p role="status">Đã hết hạn chốt đội hình.</p>}

              {/* Box 4: Ngân sách còn lại */}
              <div className="bg-brand-card/70 p-3 rounded-2xl border border-brand-border/70 shadow-sm">
                <span className="text-brand-muted text-[11px] block">Ngân sách còn lại</span>
                <span
                  className={`text-base font-black block mt-0.5 ${
                    isBudgetValid ? 'text-brand-skyblue-light' : 'text-rose-400'
                  }`}
                >
                  £{remainingBudget.toFixed(1)}m
                </span>
                <span className="text-[10px] text-brand-muted block mt-1">
                  {netCostDiff > 0
                    ? `Chi thêm: £${netCostDiff.toFixed(1)}m`
                    : netCostDiff < 0
                    ? `Dôi dư: +£${Math.abs(netCostDiff).toFixed(1)}m`
                    : 'Cân bằng ngân sách'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Footer Màn Hình: Nút Hành Động */}
        <div className="px-6 py-4 border-t border-brand-border bg-brand-darker flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-brand-card hover:bg-brand-card-hover border border-brand-border text-xs sm:text-sm font-bold text-brand-muted hover:text-white transition-all shadow-sm"
          >
            Quay lại chỉnh sửa đội hình
          </button>

          <button
            onClick={onConfirm}
            disabled={deadlinePassed || !isFree || !isBudgetValid || !isSquadComplete || transfersCount === 0 || isLoading}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-brand-darker font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-emerald-500/25 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-brand-darker border-t-transparent animate-spin" />
                <span>Đang lưu chuyển nhượng...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {!isSquadComplete
                    ? 'Chưa đủ 15 cầu thủ'
                    : !isBudgetValid
                    ? 'Vượt ngân sách'
                    : `Xác Nhận Chuyển Nhượng (${transfersCount})`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Gắn trực tiếp lên document.body thông qua Portal để thoát khỏi mọi container relative hay overflow-hidden
  if (mounted && typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
