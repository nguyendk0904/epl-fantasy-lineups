import React, { useState } from 'react';

export type PlayerStatus = 'a' | 'd' | 'i' | 's' | 'u' | 'n' | string;

export interface PlayerStatusConfig {
  type: 'available' | 'doubtful' | 'injured' | 'suspended' | 'unavailable';
  icon: string;
  label: string;
  shortLabel: string;
  badgeClass: string;
  pinClass: string;
  dotClass: string;
  description: string;
}

export function getPlayerStatusConfig(
  status?: PlayerStatus | null,
  news?: string | null,
  chance?: number | null
): PlayerStatusConfig | null {
  if (!status || status === 'a') {
    return null;
  }

  const normalizedStatus = status.toLowerCase();

  switch (normalizedStatus) {
    case 'i':
      return {
        type: 'injured',
        icon: '🚑',
        label: 'Chấn thương (0%)',
        shortLabel: 'Injured',
        badgeClass:
          'bg-brand-hotpink/20 text-brand-hotpink-light border-brand-hotpink/50 shadow-brand-hotpink/20',
        pinClass:
          'bg-brand-hotpink-dark/90 text-brand-white border-brand-hotpink shadow-brand-hotpink/50',
        dotClass: 'bg-brand-hotpink',
        description: news || 'Nghỉ thi đấu do chấn thương (Khả năng ra sân 0%)',
      };

    case 'd': {
      const chanceText = chance !== null && chance !== undefined ? `${chance}%` : 'Doubtful';
      return {
        type: 'doubtful',
        icon: '⚠️',
        label: chance !== null && chance !== undefined ? `Nghi ngờ (${chance}%)` : 'Nghi ngờ (25%-75%)',
        shortLabel: chanceText,
        badgeClass:
          'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/20',
        pinClass:
          'bg-amber-600/90 text-brand-white border-amber-400 shadow-amber-500/50',
        dotClass: 'bg-amber-400',
        description:
          news ||
          (chance !== null && chance !== undefined
            ? `Khả năng ra sân dự kiến: ${chance}%`
            : 'Đang bình phục chấn thương, nghi ngờ khả năng ra sân'),
      };
    }

    case 's':
      return {
        type: 'suspended',
        icon: '🟥',
        label: 'Treo giò',
        shortLabel: 'Suspended',
        badgeClass:
          'bg-red-900/30 text-red-300 border-red-500/50 shadow-red-500/20',
        pinClass:
          'bg-red-800/90 text-brand-white border-red-500 shadow-red-500/50',
        dotClass: 'bg-red-500',
        description: news || 'Bị treo giò thi đấu',
      };

    case 'u':
    case 'n':
      return {
        type: 'unavailable',
        icon: '❌',
        label: 'Không khả dụng',
        shortLabel: 'Out',
        badgeClass:
          'bg-slate-700/40 text-slate-300 border-slate-500/40 shadow-black/20',
        pinClass:
          'bg-slate-800/90 text-slate-200 border-slate-400 shadow-black/40',
        dotClass: 'bg-slate-400',
        description: news || 'Cầu thủ không khả dụng cho vòng đấu này',
      };

    default:
      return null;
  }
}

export interface PlayerStatusBadgeProps {
  status?: PlayerStatus | null;
  news?: string | null;
  chance?: number | null;
  variant?: 'badge' | 'pin' | 'dot';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  tooltipPosition?: 'top' | 'bottom';
  className?: string;
}

export const PlayerStatusBadge: React.FC<PlayerStatusBadgeProps> = ({
  status,
  news,
  chance,
  variant = 'badge',
  size = 'sm',
  showLabel = true,
  tooltipPosition = 'top',
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const config = getPlayerStatusConfig(status, news, chance);

  // Cầu thủ sẵn sàng thi đấu ('a') -> Không cần hiển thị cảnh báo
  if (!config) {
    return null;
  }

  // Size styling map
  const sizeClasses = {
    sm: {
      badge: 'text-[10px] px-1.5 py-0.5 gap-1',
      pin: 'w-4 h-4 text-[9px]',
      dot: 'w-2 h-2',
      iconText: 'text-[11px]',
    },
    md: {
      badge: 'text-xs px-2 py-0.5 gap-1.5',
      pin: 'w-5 h-5 text-[11px]',
      dot: 'w-2.5 h-2.5',
      iconText: 'text-xs',
    },
    lg: {
      badge: 'text-sm px-2.5 py-1 gap-2',
      pin: 'w-6 h-6 text-xs',
      dot: 'w-3 h-3',
      iconText: 'text-sm',
    },
  }[size];

  const tooltipClasses =
    tooltipPosition === 'bottom'
      ? 'top-full mt-1.5'
      : 'bottom-full mb-1.5';

  return (
    <div
      className={`relative inline-flex items-center group cursor-help select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      role="status"
      aria-label={`${config.label}: ${config.description}`}
      title={`${config.label} - ${config.description}`}
    >
      {/* 1. Variant: Badge (Icon + Nhãn văn bản ngắn) */}
      {variant === 'badge' && (
        <span
          className={`inline-flex items-center font-bold rounded-md border backdrop-blur-md transition-all duration-200 hover:scale-105 shadow-sm ${config.badgeClass} ${sizeClasses.badge}`}
        >
          <span className={sizeClasses.iconText} aria-hidden="true">
            {config.icon}
          </span>
          {showLabel && <span>{config.shortLabel}</span>}
        </span>
      )}

      {/* 2. Variant: Pin (Icon tròn nhỏ gọn gắn trên sân cỏ VirtualPitch) */}
      {variant === 'pin' && (
        <span
          className={`inline-flex items-center justify-center font-black rounded-full border shadow-md backdrop-blur-md transition-all duration-200 hover:scale-110 ${config.pinClass} ${sizeClasses.pin}`}
        >
          <span aria-hidden="true">{config.icon}</span>
        </span>
      )}

      {/* 3. Variant: Dot (Chấm tròn phát sáng) */}
      {variant === 'dot' && (
        <span className="relative flex items-center justify-center">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotClass}`}
          />
          <span
            className={`relative inline-flex rounded-full border border-white/40 shadow-sm ${config.dotClass} ${sizeClasses.dot}`}
          />
        </span>
      )}

      {/* 4. Tooltip chi tiết Glassmorphism hiển thị lý do chấn thương / treo giò */}
      <div
        role="tooltip"
        className={`absolute left-1/2 -translate-x-1/2 ${tooltipClasses} z-50 min-w-[180px] max-w-[240px] pointer-events-none transition-all duration-200 ${
          isHovered
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="bg-brand-darker/95 backdrop-blur-xl border border-brand-border/80 text-brand-white rounded-xl p-2.5 shadow-2xl ring-1 ring-white/10 text-left">
          {/* Header của tooltip */}
          <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-brand-border/40">
            <span className="text-xs" aria-hidden="true">
              {config.icon}
            </span>
            <span className="font-bold text-xs text-brand-skyblue-light">
              {config.label}
            </span>
          </div>

          {/* Nội dung tin tức chi tiết (News) */}
          <p className="text-[11px] text-brand-muted leading-tight">
            {config.description}
          </p>

          {/* Chỉ số % ra sân nếu có */}
          {chance !== null && chance !== undefined && (
            <div className="mt-1.5 flex items-center justify-between text-[10px] pt-1 border-t border-brand-border/30">
              <span className="text-brand-muted">Khả năng thi đấu:</span>
              <span
                className={`font-bold ${
                  chance === 0
                    ? 'text-brand-hotpink-light'
                    : chance <= 50
                    ? 'text-amber-400'
                    : 'text-brand-skyblue-light'
                }`}
              >
                {chance}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
