import React from 'react';

export type SkeletonVariant = 'pitch-slot' | 'player-row' | 'card' | 'stat-widget' | 'text';

export interface SkeletonLoaderProps {
  variant?: SkeletonVariant;
  count?: number;
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'text',
  count = 1,
  className = '',
  width,
  height,
}) => {
  const items = Array.from({ length: count });

  const renderSkeletonItem = (index: number) => {
    switch (variant) {
      case 'pitch-slot':
        return (
          <div
            key={index}
            className={`w-[62px] min-[390px]:w-[70px] min-[440px]:w-20 sm:w-24 h-24 min-[390px]:h-28 sm:h-32 rounded-2xl bg-brand-card/40 border border-brand-border/40 p-2 flex flex-col items-center justify-between animate-pulse ${className}`}
            data-testid="skeleton-pitch-slot"
          >
            <div className="w-8 h-2.5 rounded bg-white/10" />
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/10 my-1" />
            <div className="w-12 h-3 rounded bg-white/10" />
            <div className="w-8 h-2 rounded bg-white/10" />
          </div>
        );

      case 'player-row':
        return (
          <div
            key={index}
            className={`flex items-center justify-between p-3 border-b border-brand-border/40 bg-brand-card/30 animate-pulse gap-3 ${className}`}
            data-testid="skeleton-player-row"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 shrink-0" />
              <div className="space-y-1.5">
                <div className="w-24 sm:w-32 h-3.5 rounded bg-white/10" />
                <div className="w-16 h-2.5 rounded bg-white/5" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-3.5 rounded bg-white/10" />
              <div className="w-10 h-3.5 rounded bg-white/10" />
              <div className="w-16 h-7 rounded-lg bg-white/10" />
            </div>
          </div>
        );

      case 'stat-widget':
        return (
          <div
            key={index}
            className={`flex items-center gap-2 p-2 rounded-full bg-brand-card/50 border border-brand-border/50 animate-pulse ${className}`}
            data-testid="skeleton-stat-widget"
          >
            <div className="w-7 h-7 rounded-full bg-white/10" />
            <div className="space-y-1 pr-2">
              <div className="w-8 h-2 rounded bg-white/10" />
              <div className="w-12 h-3 rounded bg-white/10" />
            </div>
          </div>
        );

      case 'card':
        return (
          <div
            key={index}
            className={`p-5 rounded-2xl bg-brand-card/50 border border-brand-border/50 animate-pulse space-y-3 ${className}`}
            data-testid="skeleton-card"
          >
            <div className="w-1/3 h-4 rounded bg-white/10" />
            <div className="w-full h-20 rounded-xl bg-white/5" />
            <div className="flex gap-2">
              <div className="w-20 h-7 rounded-lg bg-white/10" />
              <div className="w-24 h-7 rounded-lg bg-white/10" />
            </div>
          </div>
        );

      case 'text':
      default:
        return (
          <div
            key={index}
            style={{ width, height }}
            className={`h-4 rounded bg-white/10 animate-pulse ${className}`}
            data-testid="skeleton-text"
          />
        );
    }
  };

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Đang tải dữ liệu"
      className="space-y-2 w-full"
    >
      {items.map((_, i) => renderSkeletonItem(i))}
      <span className="sr-only">Đang tải nội dung...</span>
    </div>
  );
};

export default SkeletonLoader;
