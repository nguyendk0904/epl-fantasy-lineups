import React from 'react';
import { FormationType } from '../../types';
import { Sparkles, Users, Share2, Layers, Wallet } from 'lucide-react';

export interface MobilePitchControlsProps {
  formation: FormationType;
  onFormationChange: (formation: FormationType) => void;
  onOpenPlayerDrawer?: () => void;
  onAutoOptimize?: () => void;
  onShare?: () => void;
  remainingBudget?: number;
  totalPlayers?: number;
  className?: string;
}

const COMMON_FORMATIONS: FormationType[] = [
  '4-3-3',
  '3-4-3',
  '3-5-2',
  '4-4-2',
  '5-3-2',
  '4-5-1',
  '5-4-1',
  '5-2-3',
];

export const MobilePitchControls: React.FC<MobilePitchControlsProps> = ({
  formation,
  onFormationChange,
  onOpenPlayerDrawer,
  onAutoOptimize,
  onShare,
  remainingBudget = 0.0,
  totalPlayers = 15,
  className = '',
}) => {
  return (
    <div
      className={`w-full bg-brand-darker/90 backdrop-blur-xl border border-brand-border rounded-2xl p-3 shadow-xl space-y-3 ${className}`}
      data-testid="mobile-pitch-controls"
    >
      {/* Hàng 1: Quick Stats + Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        {/* Quick Stats Pill */}
        <div className="flex items-center gap-1.5 text-xs">
          {/* Bank */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-card/90 border border-brand-border">
            <Wallet className="w-3 h-3 text-brand-skyblue-light" />
            <span className="text-[10px] text-brand-muted uppercase font-bold">Bank:</span>
            <span
              className={`font-black text-xs ${
                remainingBudget >= 0 ? 'text-brand-skyblue-light' : 'text-brand-hotpink-light'
              }`}
            >
              £{remainingBudget.toFixed(1)}m
            </span>
          </div>

          {/* Players */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-card/90 border border-brand-border">
            <Users className="w-3 h-3 text-brand-hotpink-light" />
            <span
              className={`font-black text-xs ${
                totalPlayers === 15 ? 'text-brand-skyblue-light' : 'text-brand-hotpink-light'
              }`}
            >
              {totalPlayers}/15
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1.5">
          {onOpenPlayerDrawer && (
            <button
              onClick={onOpenPlayerDrawer}
              className="px-2.5 py-1.5 rounded-xl bg-brand-card hover:bg-brand-card-hover border border-brand-skyblue/40 text-brand-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
              title="Tìm & thêm cầu thủ"
              aria-label="Mở danh sách cầu thủ"
            >
              <Users className="w-3.5 h-3.5 text-brand-skyblue-light" />
              <span>Thêm</span>
            </button>
          )}

          {onAutoOptimize && (
            <button
              onClick={onAutoOptimize}
              className="px-2.5 py-1.5 rounded-xl bg-brand-hotpink-dark hover:bg-brand-hotpink text-brand-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-md shadow-brand-hotpink/20"
              title="Tự động tối ưu"
              aria-label="Tự động tối ưu"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tối ưu</span>
            </button>
          )}

          {onShare && (
            <button
              onClick={onShare}
              className="p-1.5 rounded-xl bg-gradient-to-r from-brand-skyblue to-brand-skyblue-light text-brand-darker font-bold text-xs flex items-center justify-center active:scale-95 transition-all shadow-md"
              title="Chia sẻ đội hình"
              aria-label="Chia sẻ đội hình"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hàng 2: Formation Chips (Scroll ngang mượt mà trên mobile) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-brand-muted px-0.5">
          <span className="flex items-center gap-1 font-semibold">
            <Layers className="w-3 h-3 text-brand-skyblue-light" />
            Sơ đồ chiến thuật
          </span>
          <span className="text-[10px] text-brand-skyblue-light font-bold">{formation}</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {COMMON_FORMATIONS.map((f) => {
            const isActive = formation === f;
            return (
              <button
                key={f}
                onClick={() => onFormationChange(f)}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 active:scale-95 ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-skyblue to-brand-skyblue-light text-brand-darker shadow-md shadow-brand-skyblue/25 ring-2 ring-brand-skyblue/50'
                    : 'bg-brand-card/80 hover:bg-brand-card text-brand-muted hover:text-brand-white border border-brand-border/60'
                }`}
                aria-pressed={isActive}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MobilePitchControls;
