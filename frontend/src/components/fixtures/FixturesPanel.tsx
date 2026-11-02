import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';

/**
 * Interface cho Fixture trận đấu Ngoại Hạng Anh
 */
export interface FixtureMatch {
  id: number;
  kickoff_time: string; // VD: '12:30', '15:00', '17:30'
  kickoff_date: string; // VD: 'SAT 7 NOV', 'SUN 8 NOV'
  home_team: {
    id: number;
    short_name: string;
    name: string;
  };
  away_team: {
    id: number;
    short_name: string;
    name: string;
  };
  difficulty_home?: number; // 1-5 FDR
  difficulty_away?: number;
}

// TODO: Thay thế mock data này bằng REST API GET /api/v1/fixtures khi Backend Phase 4 hoàn thành
export const MOCK_GAMEWEEK_FIXTURES: Record<number, { gameweek: number; dateRange: string; deadline: string; matches: FixtureMatch[] }> = {
  10: {
    gameweek: 10,
    dateRange: 'SAT 7 NOV - SUN 8 NOV',
    deadline: 'SAT 7 NOV, 11:30',
    matches: [
      {
        id: 101,
        kickoff_date: 'SAT 7 NOV',
        kickoff_time: '12:30',
        home_team: { id: 7, short_name: 'EVE', name: 'Everton' },
        away_team: { id: 4, short_name: 'BHA', name: 'Brighton' },
      },
      {
        id: 102,
        kickoff_date: 'SAT 7 NOV',
        kickoff_time: '15:00',
        home_team: { id: 1, short_name: 'ARS', name: 'Arsenal' },
        away_team: { id: 6, short_name: 'CHE', name: 'Chelsea' },
      },
      {
        id: 103,
        kickoff_date: 'SAT 7 NOV',
        kickoff_time: '15:00',
        home_team: { id: 8, short_name: 'FUL', name: 'Fulham' },
        away_team: { id: 12, short_name: 'NEW', name: 'Newcastle' },
      },
      {
        id: 104,
        kickoff_date: 'SAT 7 NOV',
        kickoff_time: '17:30',
        home_team: { id: 10, short_name: 'MCI', name: 'Man City' },
        away_team: { id: 2, short_name: 'AVL', name: 'Aston Villa' },
      },
      {
        id: 105,
        kickoff_date: 'SUN 8 NOV',
        kickoff_time: '14:00',
        home_team: { id: 13, short_name: 'NFO', name: "Nott'm Forest" },
        away_team: { id: 3, short_name: 'BRE', name: 'Brentford' },
      },
      {
        id: 106,
        kickoff_date: 'SUN 8 NOV',
        kickoff_time: '14:00',
        home_team: { id: 7, short_name: 'CRY', name: 'Crystal Palace' },
        away_team: { id: 9, short_name: 'LIV', name: 'Liverpool' },
      },
      {
        id: 107,
        kickoff_date: 'SUN 8 NOV',
        kickoff_time: '16:30',
        home_team: { id: 11, short_name: 'MUN', name: 'Man Utd' },
        away_team: { id: 14, short_name: 'TOT', name: 'Tottenham' },
      },
      {
        id: 108,
        kickoff_date: 'SUN 8 NOV',
        kickoff_time: '16:30',
        home_team: { id: 15, short_name: 'WHU', name: 'West Ham' },
        away_team: { id: 16, short_name: 'WOL', name: 'Wolves' },
      },
    ],
  },
};

interface FixturesPanelProps {
  className?: string;
  initialGameweek?: number;
}

export const FixturesPanel: React.FC<FixturesPanelProps> = ({
  className = '',
  initialGameweek = 10,
}) => {
  const [gameweek, setGameweek] = useState<number>(initialGameweek);
  const currentGwData = MOCK_GAMEWEEK_FIXTURES[gameweek] || MOCK_GAMEWEEK_FIXTURES[10];

  // Group matches by kickoff_date
  const groupedMatches = currentGwData.matches.reduce<Record<string, FixtureMatch[]>>((acc, match) => {
    if (!acc[match.kickoff_date]) {
      acc[match.kickoff_date] = [];
    }
    acc[match.kickoff_date].push(match);
    return acc;
  }, {});

  return (
    <div className={`bg-brand-card/90 border border-brand-border rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-border pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-skyblue/15 border border-brand-skyblue/30 flex items-center justify-center text-brand-skyblue-light">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-brand-white flex items-center gap-2">
              <span>Fixtures</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-skyblue/20 text-brand-skyblue-light border border-brand-skyblue/40 font-bold">
                EPL 2026/27
              </span>
            </h3>
            <p className="text-xs text-brand-muted">Lịch thi đấu thực tế vòng đấu</p>
          </div>
        </div>

        {/* Gameweek Selector */}
        <div className="flex items-center gap-1.5 bg-brand-darker/80 px-2 py-1 rounded-xl border border-brand-border">
          <button
            onClick={() => setGameweek((prev) => Math.max(1, prev - 1))}
            disabled={gameweek <= 1}
            className="p-1 rounded-lg text-brand-muted hover:text-brand-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Vòng trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-extrabold text-brand-white px-2">
            Gameweek {gameweek}
          </span>

          <button
            onClick={() => setGameweek((prev) => Math.min(38, prev + 1))}
            disabled={gameweek >= 38}
            className="p-1 rounded-lg text-brand-muted hover:text-brand-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Vòng sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Gameweek Deadline Banner */}
      <div className="bg-brand-darker/60 rounded-xl p-2.5 border border-brand-border flex items-center justify-between text-xs">
        <span className="text-brand-muted flex items-center gap-1.5 font-medium">
          <Clock className="w-3.5 h-3.5 text-brand-hotpink-light" />
          Hạn chót đội hình (Deadline):
        </span>
        <span className="font-extrabold text-brand-hotpink-light">
          {currentGwData.deadline}
        </span>
      </div>

      {/* Matches List grouped by day */}
      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        {Object.entries(groupedMatches).map(([date, matches]) => (
          <div key={date} className="space-y-1.5">
            <div className="text-[10px] uppercase font-bold tracking-wider text-brand-skyblue-light px-2 py-0.5 bg-brand-skyblue/10 rounded-md inline-block">
              {date}
            </div>

            <div className="space-y-1">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2 bg-brand-darker/70 hover:bg-brand-card border border-brand-border/60 hover:border-brand-skyblue/40 rounded-xl text-xs transition-all group"
                >
                  {/* Đội nhà */}
                  <div className="flex-1 text-right font-bold text-brand-white flex items-center justify-end gap-2">
                    <span className="group-hover:text-brand-skyblue-light transition-colors">{m.home_team.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-card border border-brand-border text-brand-muted font-black">
                      {m.home_team.short_name}
                    </span>
                  </div>

                  {/* Giờ đá (Score/Time Pill) */}
                  <div className="mx-3 px-2.5 py-1 rounded-lg bg-brand-card/90 border border-brand-skyblue/30 text-brand-skyblue-light font-black text-xs min-w-14 text-center shadow-inner group-hover:border-brand-skyblue">
                    {m.kickoff_time}
                  </div>

                  {/* Đội khách */}
                  <div className="flex-1 text-left font-bold text-brand-white flex items-center justify-start gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-card border border-brand-border text-brand-muted font-black">
                      {m.away_team.short_name}
                    </span>
                    <span className="group-hover:text-brand-skyblue-light transition-colors">{m.away_team.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

