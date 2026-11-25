import React, { useState } from 'react';
import { Clock, CheckCircle2, Shield } from 'lucide-react';
import { getPlayerKitUrl } from '../pitch/PlayerPitchSlot';

export interface FixtureTeamInfo {
  id: number;
  name: string;
  short_name: string;
  code?: number;
}

export interface FixtureItem {
  id: number;
  gameweek: number;
  kickoff_time: string; // ISO string e.g. "2026-11-23T15:00:00Z" hoặc "15:00"
  kickoff_date?: string; // e.g. "Thứ Bảy, 23/11"
  home_team: FixtureTeamInfo;
  away_team: FixtureTeamInfo;
  team_h_score?: number | null;
  team_a_score?: number | null;
  team_h_difficulty: number; // FDR 1-5 cho đội nhà
  team_a_difficulty: number; // FDR 1-5 cho đội khách
  finished: boolean;
  minutes?: number;
}

export interface FdrConfig {
  rating: number;
  label: string;
  badgeClass: string;
  textClass: string;
  bgClass: string;
  multiplier: number;
}

export function getFdrConfig(rating: number): FdrConfig {
  const numericRating = rating !== null && rating !== undefined && !isNaN(rating) ? rating : 3;
  const normalized = Math.max(1, Math.min(5, Math.round(numericRating)));
  switch (normalized) {
    case 1:
      return {
        rating: 1,
        label: 'Rất thuận lợi',
        badgeClass:
          'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 shadow-emerald-500/20',
        textClass: 'text-emerald-300',
        bgClass: 'bg-emerald-500',
        multiplier: 1.2,
      };
    case 2:
      return {
        rating: 2,
        label: 'Thuận lợi',
        badgeClass:
          'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10',
        textClass: 'text-emerald-400',
        bgClass: 'bg-emerald-400',
        multiplier: 1.15,
      };
    case 3:
      return {
        rating: 3,
        label: 'Cân bằng',
        badgeClass:
          'bg-slate-600/30 text-slate-300 border-slate-500/40 shadow-black/20',
        textClass: 'text-slate-300',
        bgClass: 'bg-slate-400',
        multiplier: 1.0,
      };
    case 4:
      return {
        rating: 4,
        label: 'Khó khăn',
        badgeClass:
          'bg-brand-hotpink/20 text-brand-hotpink-light border-brand-hotpink/50 shadow-brand-hotpink/20',
        textClass: 'text-brand-hotpink-light',
        bgClass: 'bg-brand-hotpink',
        multiplier: 0.9,
      };
    case 5:
      return {
        rating: 5,
        label: 'Rất khó',
        badgeClass:
          'bg-red-950/40 text-red-300 border-red-600/60 shadow-red-600/25',
        textClass: 'text-red-300',
        bgClass: 'bg-red-600',
        multiplier: 0.8,
      };
    default:
      return {
        rating: 3,
        label: 'Cân bằng',
        badgeClass:
          'bg-slate-600/30 text-slate-300 border-slate-500/40 shadow-black/20',
        textClass: 'text-slate-300',
        bgClass: 'bg-slate-400',
        multiplier: 1.0,
      };
  }
}

export interface FixtureCardProps {
  fixture: FixtureItem;
  className?: string;
  onSelectTeam?: (teamId: number) => void;
}

export const FixtureCard: React.FC<FixtureCardProps> = ({
  fixture,
  className = '',
  onSelectTeam,
}) => {
  const [homeImgError, setHomeImgError] = useState(false);
  const [awayImgError, setAwayImgError] = useState(false);

  const homeFdr = getFdrConfig(fixture.team_h_difficulty);
  const awayFdr = getFdrConfig(fixture.team_a_difficulty);

  const homeKitUrl = getPlayerKitUrl(
    fixture.home_team.id,
    'MID',
    fixture.home_team.code,
    fixture.home_team.short_name
  );

  const awayKitUrl = getPlayerKitUrl(
    fixture.away_team.id,
    'MID',
    fixture.away_team.code,
    fixture.away_team.short_name
  );

  // Format kickoff display
  const formatKickoff = (timeStr: string) => {
    if (!timeStr) return 'TBD';
    if (timeStr.includes('T')) {
      try {
        const d = new Date(timeStr);
        return d.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'UTC',
        });
      } catch {
        return timeStr;
      }
    }
    return timeStr;
  };

  return (
    <div
      className={`relative group bg-brand-card/80 hover:bg-brand-card-hover border border-brand-border hover:border-brand-skyblue/40 rounded-2xl p-3 sm:p-4 shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-md flex flex-col justify-between ${className}`}
      data-testid={`fixture-card-${fixture.id}`}
    >
      {/* 1. Header trận đấu: Ngày giờ & Trạng thái */}
      <div className="flex items-center justify-between text-xs text-brand-muted border-b border-brand-border/40 pb-2 mb-2.5">
        <div className="flex items-center gap-1.5 font-medium truncate">
          <Clock className="w-3.5 h-3.5 text-brand-skyblue-light shrink-0" />
          <span className="truncate">
            {fixture.kickoff_date ? `${fixture.kickoff_date} • ` : ''}
            {formatKickoff(fixture.kickoff_time)}
            {' UTC'}
          </span>
        </div>

        {fixture.finished ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
            <CheckCircle2 className="w-2.5 h-2.5" />
            FT (Hết giờ)
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-skyblue/15 text-brand-skyblue-light border border-brand-skyblue/30 uppercase tracking-wider">
            Sắp đá
          </span>
        )}
      </div>

      {/* 2. Nội dung chính: Đội nhà vs Đội khách kèm FDR Badges */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 py-1">
        {/* Đội nhà (Home Team) */}
        <div
          onClick={() => onSelectTeam && onSelectTeam(fixture.home_team.id)}
          className={`flex items-center gap-2 min-w-0 ${
            onSelectTeam ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
          }`}
          title={`Xem cầu thủ CLB ${fixture.home_team.name}`}
        >
          {/* Áo đấu Đội nhà */}
          <div className="relative shrink-0">
            {!homeImgError ? (
              <img
                src={homeKitUrl}
                alt={fixture.home_team.name}
                onError={() => setHomeImgError(true)}
                className="w-9 h-9 sm:w-11 sm:h-11 object-contain drop-shadow"
                loading="lazy"
              />
            ) : (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-brand-darker border border-brand-border flex items-center justify-center text-brand-muted">
                <Shield className="w-5 h-5" />
              </div>
            )}
          </div>

          {/* Tên & FDR Badge Đội nhà */}
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-xs sm:text-sm text-brand-white truncate">
              {fixture.home_team.short_name}
            </p>
            <p className="text-[10px] sm:text-xs text-brand-muted truncate hidden sm:block">
              {fixture.home_team.name}
            </p>

            {/* FDR Badge Đội nhà */}
            <div className="mt-1">
              <span
                className={`inline-flex items-center font-black text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md border shadow-sm ${homeFdr.badgeClass}`}
                title={`Độ khó đối đầu Đội nhà: FDR ${fixture.team_h_difficulty}/5 (${homeFdr.label}) - Hệ số xP: ${homeFdr.multiplier}x`}
              >
                FDR {fixture.team_h_difficulty}
              </span>
            </div>
          </div>
        </div>

        {/* Cột giữa: Tỉ số thực tế hoặc VS */}
        <div className="flex flex-col items-center justify-center px-2 text-center min-w-[70px]">
          {fixture.finished ? (
            <div className="flex flex-col items-center">
              <span className="text-base sm:text-xl font-black text-brand-white tracking-wider bg-brand-darker/90 px-3 py-1 rounded-xl border border-brand-border/80 shadow-inner">
                {fixture.team_h_score ?? 0} - {fixture.team_a_score ?? 0}
              </span>
              <span className="text-[9px] text-emerald-400 font-bold mt-0.5">
                Chính thức
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-xs sm:text-sm font-black text-brand-muted px-2.5 py-1 rounded-lg bg-brand-darker/80 border border-brand-border/60">
                VS
              </span>
              <span className="text-[10px] text-brand-skyblue-light font-bold mt-1">
                {formatKickoff(fixture.kickoff_time)}
              </span>
            </div>
          )}
        </div>

        {/* Đội khách (Away Team) */}
        <div
          onClick={() => onSelectTeam && onSelectTeam(fixture.away_team.id)}
          className={`flex items-center justify-end gap-2 min-w-0 text-right ${
            onSelectTeam ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
          }`}
          title={`Xem cầu thủ CLB ${fixture.away_team.name}`}
        >
          {/* Tên & FDR Badge Đội khách */}
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-xs sm:text-sm text-brand-white truncate">
              {fixture.away_team.short_name}
            </p>
            <p className="text-[10px] sm:text-xs text-brand-muted truncate hidden sm:block">
              {fixture.away_team.name}
            </p>

            {/* FDR Badge Đội khách */}
            <div className="mt-1 flex justify-end">
              <span
                className={`inline-flex items-center font-black text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md border shadow-sm ${awayFdr.badgeClass}`}
                title={`Độ khó đối đầu Đội khách: FDR ${fixture.team_a_difficulty}/5 (${awayFdr.label}) - Hệ số xP: ${awayFdr.multiplier}x`}
              >
                FDR {fixture.team_a_difficulty}
              </span>
            </div>
          </div>

          {/* Áo đấu Đội khách */}
          <div className="relative shrink-0">
            {!awayImgError ? (
              <img
                src={awayKitUrl}
                alt={fixture.away_team.name}
                onError={() => setAwayImgError(true)}
                className="w-9 h-9 sm:w-11 sm:h-11 object-contain drop-shadow"
                loading="lazy"
              />
            ) : (
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-brand-darker border border-brand-border flex items-center justify-center text-brand-muted">
                <Shield className="w-5 h-5" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
