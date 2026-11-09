import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, X } from 'lucide-react';

export interface OfflineBannerProps {
  forceOffline?: boolean;
  onRetry?: () => void;
  className?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  forceOffline,
  onRetry,
  className = '',
}) => {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (forceOffline !== undefined) return forceOffline;
    if (typeof navigator !== 'undefined') {
      return !navigator.onLine;
    }
    return false;
  });

  const [showRestoredNotice, setShowRestoredNotice] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (forceOffline !== undefined) {
      setIsOffline(forceOffline);
      return;
    }

    if (typeof window === 'undefined') return;

    const handleOffline = () => {
      setIsOffline(true);
      setIsDismissed(false);
      setShowRestoredNotice(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowRestoredNotice(true);
      const timer = setTimeout(() => {
        setShowRestoredNotice(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [forceOffline]);

  const handleManualCheck = () => {
    if (typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }
    if (onRetry) {
      onRetry();
    }
  };

  // Nếu đang online và không hiển thị thông báo vừa khôi phục
  if (!isOffline && !showRestoredNotice) {
    return null;
  }

  // Nếu người dùng đã bấm tắt thông báo offline tạm thời
  if (isOffline && isDismissed) {
    return null;
  }

  // Banner vừa khôi phục Internet
  if (!isOffline && showRestoredNotice) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`w-full bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-4 py-2 flex items-center justify-between text-xs sm:text-sm font-semibold shadow-lg transition-all animate-slide-down ${className}`}
        data-testid="offline-banner-restored"
      >
        <div className="flex items-center gap-2 mx-auto sm:mx-0">
          <Wifi className="w-4 h-4 text-emerald-200" />
          <span>Đã khôi phục kết nối Internet! Dữ liệu đang được đồng bộ.</span>
        </div>
        <button
          onClick={() => setShowRestoredNotice(false)}
          className="p-1 rounded-full hover:bg-white/20 transition-colors hidden sm:block"
          aria-label="Đóng thông báo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Banner đang mất mạng Offline
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm font-medium shadow-xl border-b border-white/20 transition-all animate-slide-down ${className}`}
      data-testid="offline-banner"
    >
      <div className="flex items-center gap-2.5 text-center sm:text-left">
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <WifiOff className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <span className="font-bold">Đã mất kết nối Internet:</span>{' '}
          <span className="text-white/90">
            Ứng dụng đang hoạt động ở chế độ ngoại tuyến (dữ liệu lưu trên máy LocalStorage).
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleManualCheck}
          className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
          title="Kiểm tra lại kết nối"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Kiểm tra lại</span>
        </button>

        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          title="Tạm ẩn cảnh báo"
          aria-label="Tạm ẩn cảnh báo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default OfflineBanner;
