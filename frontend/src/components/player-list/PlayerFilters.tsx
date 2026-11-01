import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { PositionType } from '../../types';

export interface FilterState {
  search: string;
  position: PositionType | 'ALL';
  teamId: number | 'ALL';
  maxPrice: number;
}

interface PlayerFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  teams?: { id: number; short_name: string; name: string }[];
}

export const PREMIER_LEAGUE_TEAMS = [
  { id: 1, short_name: 'ARS', name: 'Arsenal' },
  { id: 2, short_name: 'AVL', name: 'Aston Villa' },
  { id: 3, short_name: 'BRE', name: 'Brentford' },
  { id: 4, short_name: 'BHA', name: 'Brighton' },
  { id: 5, short_name: 'CHE', name: 'Chelsea' },
  { id: 6, short_name: 'CRY', name: 'Crystal Palace' },
  { id: 7, short_name: 'EVE', name: 'Everton' },
  { id: 8, short_name: 'FUL', name: 'Fulham' },
  { id: 9, short_name: 'LIV', name: 'Liverpool' },
  { id: 10, short_name: 'MCI', name: 'Man City' },
  { id: 11, short_name: 'MUN', name: 'Man Utd' },
  { id: 12, short_name: 'NEW', name: 'Newcastle' },
  { id: 13, short_name: 'NFO', name: 'Nott\'m Forest' },
  { id: 14, short_name: 'TOT', name: 'Tottenham' },
  { id: 15, short_name: 'WHU', name: 'West Ham' },
  { id: 16, short_name: 'WOL', name: 'Wolves' },
];

const POSITIONS: { label: string; value: PositionType | 'ALL' }[] = [
  { label: 'Tất cả', value: 'ALL' },
  { label: 'GKP', value: 'GKP' },
  { label: 'DEF', value: 'DEF' },
  { label: 'MID', value: 'MID' },
  { label: 'FWD', value: 'FWD' },
];

export const PlayerFilters: React.FC<PlayerFiltersProps> = ({
  filters,
  onFilterChange,
  teams = PREMIER_LEAGUE_TEAMS,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  const handlePositionChange = (position: PositionType | 'ALL') => {
    onFilterChange({ ...filters, position });
  };

  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
    onFilterChange({ ...filters, teamId: val });
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, maxPrice: Number(e.target.value) });
  };

  const handleReset = () => {
    onFilterChange({
      search: '',
      position: 'ALL',
      teamId: 'ALL',
      maxPrice: 16.0,
    });
  };

  const isFiltered = filters.search !== '' || filters.position !== 'ALL' || filters.teamId !== 'ALL' || filters.maxPrice < 16.0;

  return (
    <div className="bg-brand-card/90 border border-brand-border rounded-xl p-4 shadow-lg backdrop-blur-md space-y-3">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
          <input
            type="text"
            role="searchbox"
            aria-label="Tìm kiếm cầu thủ"
            value={filters.search}
            onChange={handleSearchChange}
            placeholder="Tìm theo tên cầu thủ (VD: Haaland, Saka...)"
            className="w-full pl-9 pr-3 py-2 bg-brand-darker/70 border border-brand-border rounded-lg text-sm text-brand-white placeholder-brand-muted focus:outline-none focus:border-brand-skyblue focus:ring-1 focus:ring-brand-skyblue transition-colors"
          />
        </div>

        {/* Team Dropdown */}
        <div className="w-full md:w-48">
          <select
            value={filters.teamId}
            onChange={handleTeamChange}
            aria-label="Lọc theo CLB"
            className="w-full py-2 px-3 bg-brand-darker/70 border border-brand-border rounded-lg text-sm text-brand-white focus:outline-none focus:border-brand-skyblue transition-colors"
          >
            <option value="ALL">Tất cả CLB ({teams.length})</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id} className="bg-brand-darker text-brand-white">
                {t.short_name} - {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Max price slider */}
        <div className="flex items-center gap-2 bg-brand-darker/50 px-3 py-1.5 rounded-lg border border-brand-border">
          <span className="text-xs text-brand-muted font-medium whitespace-nowrap">Tối đa:</span>
          <input
            type="range"
            min="4.0"
            max="16.0"
            step="0.5"
            value={filters.maxPrice}
            onChange={handleMaxPriceChange}
            className="w-24 accent-brand-skyblue cursor-pointer"
            aria-label="Giá tối đa"
          />
          <span className="text-xs font-bold text-brand-skyblue-light min-w-12 text-right">
            £{filters.maxPrice.toFixed(1)}m
          </span>
        </div>

        {/* Reset filter button */}
        {isFiltered && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-brand-card hover:bg-brand-card-hover border border-brand-hotpink/40 text-xs text-brand-hotpink-light hover:text-brand-white transition-colors"
            title="Đặt lại bộ lọc"
          >
            <X className="w-3.5 h-3.5" />
            <span>Xoá lọc</span>
          </button>
        )}
      </div>

      {/* Position Filter Pills */}
      <div className="flex items-center gap-2 pt-1 border-t border-brand-border/80">
        <span className="text-xs text-brand-muted font-medium flex items-center gap-1 mr-1">
          <Filter className="w-3 h-3 text-brand-skyblue-light" /> Vị trí:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map((pos) => {
            const isActive = filters.position === pos.value;
            return (
              <button
                key={pos.value}
                onClick={() => handlePositionChange(pos.value)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-brand-skyblue text-brand-darker shadow-md shadow-brand-skyblue/20'
                    : 'bg-brand-card text-brand-muted hover:bg-brand-card-hover hover:text-brand-white'
                }`}
              >
                {pos.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
