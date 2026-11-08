import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  QrCode, 
  Sparkles, 
  AlertCircle, 
  ExternalLink 
} from 'lucide-react';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string | null;
  shareCode: string | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  onShare: (lineupName?: string) => Promise<string | null>;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  shareUrl,
  shareCode,
  isLoading = false,
  errorMessage = null,
  onShare,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [lineupName, setLineupName] = useState<string>('My Dream FPL XI');
  const [showQR, setShowQR] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!shareUrl) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    await onShare(lineupName);
  };

  // Free SVG QR Code generator endpoint
  const qrImageUrl = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`
    : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div 
        className="relative w-full max-w-md bg-gradient-to-b from-[#1a001f] to-[#0d0012] border border-[#00ff87]/30 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00ff87]/10 text-[#00ff87] rounded-lg">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="share-modal-title" className="text-lg font-bold text-white flex items-center gap-1.5">
                Chia sẻ Đội hình
                <Sparkles className="w-4 h-4 text-[#02efff]" />
              </h3>
              <p className="text-xs text-slate-400">Tạo liên kết công khai để bạn bè chiêm ngưỡng</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div 
            role="alert" 
            className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 text-xs"
          >
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Body content */}
        {!shareUrl ? (
          <form onSubmit={handleGenerateLink} className="space-y-4">
            <div>
              <label htmlFor="lineup-name-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                Tên đội hình chia sẻ
              </label>
              <input
                id="lineup-name-input"
                type="text"
                value={lineupName}
                onChange={(e) => setLineupName(e.target.value)}
                maxLength={100}
                placeholder="VD: Đội hình Công phá GW28"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00ff87] transition-colors"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !lineupName.trim()}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-[#00ff87] to-[#02efff] text-[#37003c] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#00ff87]/20 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#37003c] border-t-transparent rounded-full animate-spin" />
                  <span>Đang tạo snapshot trên Cloud...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Tạo liên kết chia sẻ</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Share Code badge */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-xs text-slate-400">Mã đội hình:</span>
              <span className="font-mono text-sm font-bold text-[#02efff] tracking-widest bg-[#02efff]/10 px-2.5 py-0.5 rounded border border-[#02efff]/30">
                {shareCode}
              </span>
            </div>

            {/* Link Copy Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Đường dẫn liên kết (Public Link)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-slate-200 font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="relative p-2.5 rounded-xl bg-[#00ff87] text-[#37003c] hover:bg-[#00ff87]/90 active:scale-95 transition-all font-semibold flex items-center gap-1.5"
                  title="Sao chép liên kết"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-900" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {copied && (
                <p className="text-[11px] text-[#00ff87] mt-1.5 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Đã sao chép liên kết vào bộ nhớ tạm!
                </p>
              )}
            </div>

            {/* QR Code toggle */}
            <div className="pt-2 border-t border-white/10 flex flex-col items-center">
              <button
                type="button"
                onClick={() => setShowQR((prev) => !prev)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 py-1 transition-colors"
              >
                <QrCode className="w-4 h-4 text-[#00ff87]" />
                <span>{showQR ? 'Ẩn mã QR' : 'Hiển thị mã QR để quét điện thoại'}</span>
              </button>

              {showQR && (
                <div className="mt-3 p-3 bg-white rounded-xl shadow-inner flex flex-col items-center animate-fade-in">
                  <img
                    src={qrImageUrl}
                    alt={`QR Code for ${shareUrl}`}
                    className="w-36 h-36 rounded-lg"
                    loading="lazy"
                  />
                  <span className="text-[10px] text-slate-600 mt-1.5 font-medium">Quét bằng camera điện thoại</span>
                </div>
              )}
            </div>

            {/* Direct Open Link */}
            <div className="flex justify-end gap-2 pt-2">
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#02efff] hover:underline flex items-center gap-1 py-1"
              >
                <span>Mở xem trang</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareModal;
