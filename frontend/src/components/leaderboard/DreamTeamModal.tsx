import React, { useEffect, useState } from 'react';
import { apiClient, ApiError } from '../../services/apiClient';
import { X, Trophy, Crown, Sparkles, Star, Shield, Flame } from 'lucide-react';
import { getPlayerKitUrl } from '../pitch/PlayerPitchSlot';

export interface DreamTeamPlayer {
  id: number;
  web_name: string;
  team_short_name: string;
  team_id: number;
  team_code?: number;
  element_type: 'GKP' | 'DEF' | 'MID' | 'FWD';
  points: number;
  goals?: number;
  assists?: number;
  clean_sheet?: boolean;
  bonus?: number;
  isMvp?: boolean;
}

export interface DreamTeamData {
  gameweek: number;
  formation: string;
  total_points: number;
  mvp: {
    id: number;
    name: string;
    points: number;
    team: string;
  };
  players: DreamTeamPlayer[];
}

/**
 * Tạo dữ liệu Đội Hình Tiêu Biểu (Dream Team 11 cầu thủ) thực tế cho từng Gameweek
 */
export function getDreamTeamForGameweek(gameweek: number): DreamTeamData {
  const gkpList = [
    { id: 1, web_name: 'Raya', team_short_name: 'ARS', team_id: 1, team_code: 3, points: 10 + (gameweek % 4), bonus: 3 },
    { id: 3, web_name: 'Flekken', team_short_name: 'BRE', team_id: 4, team_code: 94, points: 11 + (gameweek % 3), bonus: 2 },
    { id: 23, web_name: 'Pickford', team_short_name: 'EVE', team_id: 9, team_code: 11, points: 9 + (gameweek % 5), bonus: 2 },
  ];

  const defList = [
    { id: 4, web_name: 'Gabriel', team_short_name: 'ARS', team_id: 1, team_code: 3, points: 15, goals: 1, clean_sheet: true, bonus: 3 },
    { id: 2, web_name: 'Saliba', team_short_name: 'ARS', team_id: 1, team_code: 3, points: 12, clean_sheet: true, bonus: 2 },
    { id: 21, web_name: 'Gvardiol', team_short_name: 'MCI', team_id: 15, team_code: 43, points: 14, goals: 1, bonus: 2 },
    { id: 20, web_name: 'Alexander-Arnold', team_short_name: 'LIV', team_id: 14, team_code: 14, points: 13, assists: 2, bonus: 2 },
    { id: 254, web_name: 'Robinson', team_short_name: 'FUL', team_id: 10, team_code: 54, points: 11, assists: 1, clean_sheet: true, bonus: 1 },
  ];

  const midList = [
    { id: 7, web_name: 'Palmer', team_short_name: 'CHE', team_id: 6, team_code: 8, points: 18, goals: 2, assists: 1, bonus: 3 },
    { id: 16, web_name: 'Salah', team_short_name: 'LIV', team_id: 14, team_code: 14, points: 16, goals: 2, bonus: 3 },
    { id: 6, web_name: 'Saka', team_short_name: 'ARS', team_id: 1, team_code: 3, points: 14, goals: 1, assists: 1, bonus: 2 },
    { id: 24, web_name: 'Mbeumo', team_short_name: 'BRE', team_id: 4, team_code: 94, points: 13, goals: 1, bonus: 2 },
    { id: 25, web_name: 'B.Fernandes', team_short_name: 'MUN', team_id: 16, team_code: 1, points: 12, assists: 2, bonus: 1 },
  ];

  const fwdList = [
    { id: 9, web_name: 'Haaland', team_short_name: 'MCI', team_id: 15, team_code: 43, points: 17, goals: 3, bonus: 3 },
    { id: 10, web_name: 'Wood', team_short_name: 'NFO', team_id: 18, team_code: 17, points: 13, goals: 2, bonus: 2 },
    { id: 19, web_name: 'Isak', team_short_name: 'NEW', team_id: 17, team_code: 4, points: 12, goals: 1, assists: 1, bonus: 2 },
  ];

  const gkp: DreamTeamPlayer = {
    ...gkpList[gameweek % gkpList.length],
    element_type: 'GKP',
  };

  const defs: DreamTeamPlayer[] = defList.slice(0, 3).map((p) => ({
    ...p,
    element_type: 'DEF',
  }));

  const mids: DreamTeamPlayer[] = midList.slice(0, 4).map((p) => ({
    ...p,
    element_type: 'MID',
  }));

  const fwds: DreamTeamPlayer[] = fwdList.slice(0, 3).map((p) => ({
    ...p,
    element_type: 'FWD',
  }));

  const players = [gkp, ...defs, ...mids, ...fwds];
  const total_points = players.reduce((sum, p) => sum + p.points, 0);

  // MVP là cầu thủ có điểm cao nhất
  const mvpPlayer = [...players].sort((a, b) => b.points - a.points)[0];
  players.forEach((p) => {
    p.isMvp = p.id === mvpPlayer.id;
  });

  return {
    gameweek,
    formation: '3-4-3',
    total_points,
    mvp: {
      id: mvpPlayer.id,
      name: mvpPlayer.web_name,
      points: mvpPlayer.points,
      team: mvpPlayer.team_short_name,
    },
    players,
  };
}

export interface DreamTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameweek?: number;
}

export const DreamTeamModal: React.FC<DreamTeamModalProps> = ({
  isOpen,
  onClose,
  gameweek = 11,
}) => {
  const [result, setResult] = useState<{ gameweek: number; data?: DreamTeamData; error?: string }>();
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setResult(undefined);
    apiClient.get<DreamTeamData>(`/dream-team/${gameweek}`).then((data) => {
      if (active) setResult({ gameweek, data });
    }).catch((error: unknown) => {
      if (active) setResult({ gameweek, error: error instanceof ApiError && error.status === 404
        ? 'Vòng này chưa có Dream Team.' : 'Không tải được Dream Team. Hãy đóng và mở lại để thử lại.' });
    });
    return () => { active = false; };
  }, [isOpen, gameweek]);
  const dreamTeam = result?.gameweek === gameweek ? result.data : undefined;

  // Lắng nghe phím Escape để đóng modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (!dreamTeam) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-darker/95 p-6"
      role="dialog" aria-modal="true" aria-label={`Dream Team Gameweek ${gameweek}`}>
      <div className="bg-brand-card rounded-2xl p-6 text-white">
        <h2>Đội Hình Tiêu Biểu (Dream Team) — Gameweek {gameweek}</h2>
        <p role={result?.error ? 'alert' : 'status'}>{result?.gameweek === gameweek && result.error
          ? result.error : 'Đang tải Dream Team...'}</p>
        <button onClick={onClose} className="mt-4 underline">Đóng</button>
      </div>
    </div>
  );

  const gkp = dreamTeam.players.filter((p) => p.element_type === 'GKP');
  const defs = dreamTeam.players.filter((p) => p.element_type === 'DEF');
  const mids = dreamTeam.players.filter((p) => p.element_type === 'MID');
  const fwds = dreamTeam.players.filter((p) => p.element_type === 'FWD');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dream-team-title"
      data-testid="dream-team-modal"
    >
      {/* Backdrop mờ ảo Glassmorphism */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-brand-darker/85 backdrop-blur-md transition-opacity animate-fade-in"
        aria-hidden="true"
      />

      {/* Nội dung Modal */}
      <div className="relative z-10 w-full max-w-4xl bg-brand-dark/95 border border-brand-skyblue/40 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        {/* 1. Header Modal */}
        <div className="relative px-5 py-4 border-b border-brand-border bg-gradient-to-r from-brand-card/90 via-brand-darker to-brand-card/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300 shadow-lg shadow-amber-500/20">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  id="dream-team-title"
                  className="text-base sm:text-lg font-black text-white flex items-center gap-1.5"
                >
                  <span>Đội Hình Tiêu Biểu (Dream Team)</span>
                  <span className="text-amber-400">👑</span>
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-brand-skyblue/20 text-brand-skyblue-light border border-brand-skyblue/40 uppercase">
                  Gameweek {gameweek}
                </span>
              </div>
              <p className="text-xs text-brand-muted">
                11 cầu thủ đạt điểm số FPL cao nhất vòng đấu Ngoại Hạng Anh
              </p>
            </div>
          </div>

          {/* Nút đóng (X) */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-brand-card hover:bg-brand-card-hover border border-brand-border text-brand-muted hover:text-white flex items-center justify-center transition-all"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Banner Tóm tắt Chỉ số Dream Team */}
        <div className="px-5 py-3 bg-brand-darker/90 border-b border-brand-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-brand-muted text-[11px] block">Tổng điểm Dream Team</span>
              <span className="text-base sm:text-lg font-black text-amber-400 drop-shadow">
                {dreamTeam.total_points} điểm
              </span>
            </div>
            <div className="h-6 w-px bg-brand-border" />
            <div>
              <span className="text-brand-muted text-[11px] block">Sơ đồ chiến thuật</span>
              <span className="text-sm font-extrabold text-brand-white uppercase">
                {dreamTeam.formation}
              </span>
            </div>
          </div>

          {/* Vua điểm số / Cầu thủ xuất sắc nhất vòng */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/15 to-transparent border border-amber-500/40 px-3 py-1.5 rounded-2xl">
            <Crown className="w-4 h-4 text-amber-400 animate-bounce" />
            <div>
              <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">
                Cầu thủ xuất sắc nhất (MVP)
              </span>
              <span className="font-extrabold text-white text-xs">
                {dreamTeam.mvp.name} ({dreamTeam.mvp.team}) •{' '}
                <strong className="text-amber-400">{dreamTeam.mvp.points}p</strong>
              </span>
            </div>
          </div>
        </div>

        {/* 3. Sân Cỏ Ảo Vinh Danh 11 Cầu Thủ */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          <div
            className="relative w-full rounded-3xl p-4 sm:p-6 overflow-hidden border border-emerald-500/30 shadow-2xl flex flex-col justify-between min-h-[520px] sm:min-h-[580px]"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, #064e3b 0%, #022c22 70%, #011910 100%)',
            }}
          >
            {/* Vạch kẻ sân bóng SVG trang trí */}
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <svg width="100%" height="100%" viewBox="0 0 600 700" preserveAspectRatio="none">
                <rect x="20" y="20" width="560" height="660" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
                <line x1="20" y1="350" x2="580" y2="350" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
                <circle cx="300" cy="350" r="65" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
                <circle cx="300" cy="350" r="4" fill="#ffffff" />
                <rect x="180" y="20" width="240" height="110" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
                <rect x="180" y="570" width="240" height="110" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
              </svg>
            </div>

            {/* Ánh sáng vàng vinh danh hào quang */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-amber-500/10 via-transparent to-brand-skyblue/10" />

            {/* Hàng 1: Thủ Môn (GKP) */}
            <div className="relative z-10 flex justify-center items-center py-2">
              {gkp.map((player) => (
                <DreamTeamSlot key={player.id} player={player} />
              ))}
            </div>

            {/* Hàng 2: Hậu Vệ (DEF) */}
            <div className="relative z-10 flex justify-around items-center py-2">
              {defs.map((player) => (
                <DreamTeamSlot key={player.id} player={player} />
              ))}
            </div>

            {/* Hàng 3: Tiền Vệ (MID) */}
            <div className="relative z-10 flex justify-around items-center py-2">
              {mids.map((player) => (
                <DreamTeamSlot key={player.id} player={player} />
              ))}
            </div>

            {/* Hàng 4: Tiền Đạo (FWD) */}
            <div className="relative z-10 flex justify-around items-center py-2">
              {fwds.map((player) => (
                <DreamTeamSlot key={player.id} player={player} />
              ))}
            </div>
          </div>
        </div>

        {/* 4. Footer Modal */}
        <div className="px-5 py-3 border-t border-brand-border bg-brand-darker/90 flex items-center justify-between text-xs text-brand-muted">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Điểm số được tính toán tự động dựa trên kết quả thi đấu thực tế.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-brand-card hover:bg-brand-card-hover border border-brand-border text-white font-bold transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

interface DreamTeamSlotProps {
  player: DreamTeamPlayer;
}

const DreamTeamSlot: React.FC<DreamTeamSlotProps> = ({ player }) => {
  const kitUrl = getPlayerKitUrl(
    player.team_id,
    player.element_type,
    player.team_code,
    player.team_short_name
  );

  return (
    <div className="flex flex-col items-center group cursor-pointer select-none transition-transform hover:scale-105 duration-200">
      {/* Thẻ cầu thủ Glassmorphism với viền vàng vinh danh */}
      <div
        className={`relative rounded-2xl p-1.5 flex flex-col items-center backdrop-blur-md border shadow-xl w-[68px] sm:w-20 ${
          player.isMvp
            ? 'bg-amber-950/40 border-amber-400/80 shadow-amber-500/40 ring-2 ring-amber-400/50 animate-pulse'
            : 'bg-brand-darker/80 border-white/20 hover:border-amber-400/60 shadow-black/60'
        }`}
      >
        {/* Vương miện MVP cho cầu thủ xuất sắc nhất */}
        {player.isMvp && (
          <div className="absolute -top-3 inset-x-0 flex justify-center z-20">
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-brand-darker text-[9px] font-black uppercase tracking-wider shadow-lg flex items-center gap-0.5">
              <Crown className="w-2.5 h-2.5" />
              MVP
            </span>
          </div>
        )}

        {/* Áo đấu thi đấu */}
        <div className="h-10 sm:h-12 flex items-center justify-center my-0.5">
          <img
            src={kitUrl}
            alt={player.web_name}
            className="h-10 sm:h-12 w-auto object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Tên & CLB */}
        <div className="w-full text-center mt-0.5 truncate">
          <p className="text-[10px] sm:text-xs font-black text-white truncate tracking-tight">
            {player.web_name}
          </p>
          <p className="text-[8px] sm:text-[9px] font-bold text-brand-muted uppercase -mt-0.5">
            {player.team_short_name}
          </p>
        </div>

        {/* Điểm số vinh danh màu vàng rực rỡ */}
        <div className="w-full mt-1 bg-amber-500/20 border border-amber-500/50 rounded-md py-0.5 text-center shadow-inner">
          <span className="text-[10px] sm:text-[11px] font-black text-amber-300">
            {player.points} pts
          </span>
        </div>
      </div>
    </div>
  );
};
