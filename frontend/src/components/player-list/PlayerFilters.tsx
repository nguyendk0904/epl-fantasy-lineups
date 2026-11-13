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
  compact?: boolean;
}

export const PREMIER_LEAGUE_TEAMS = [
  { id: 1, short_name: 'ARS', name: 'Arsenal' },
  { id: 2, short_name: 'AVL', name: 'Aston Villa' },
  { id: 3, short_name: 'BOU', name: 'Bournemouth' },
  { id: 4, short_name: 'BRE', name: 'Brentford' },
  { id: 5, short_name: 'BHA', name: 'Brighton' },
  { id: 6, short_name: 'CHE', name: 'Chelsea' },
  { id: 7, short_name: 'COV', name: 'Coventry City' },
  { id: 8, short_name: 'CRY', name: 'Crystal Palace' },
  { id: 9, short_name: 'EVE', name: 'Everton' },
  { id: 10, short_name: 'FUL', name: 'Fulham' },
  { id: 11, short_name: 'HUL', name: 'Hull City' },
  { id: 12, short_name: 'IPS', name: 'Ipswich Town' },
  { id: 13, short_name: 'LEE', name: 'Leeds' },
  { id: 14, short_name: 'LIV', name: 'Liverpool' },
  { id: 15, short_name: 'MCI', name: 'Man City' },
  { id: 16, short_name: 'MUN', name: 'Man Utd' },
  { id: 17, short_name: 'NEW', name: 'Newcastle' },
  { id: 18, short_name: 'NFO', name: 'Nott\'m Forest' },
  { id: 19, short_name: 'TOT', name: 'Tottenham' },
  { id: 20, short_name: 'SUN', name: 'Sunderland' },
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
  compact = false,
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
    <div className={`bg-brand-card/90 border border-brand-border rounded-xl shadow-lg backdrop-blur-md ${compact ? 'p-3 space-y-2.5' : 'p-4 space-y-3'}`}>
      {/* Search Input Row */}
      <div className="relative w-full">
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

      {/* Team Dropdown & Max Price Row */}
      <div className={`flex items-center gap-2.5 ${compact ? 'flex-row' : 'flex-col md:flex-row'}`}>
        {/* Team Dropdown */}
        <div className="flex-1 min-w-0">
          <select
            value={filters.teamId}
            onChange={handleTeamChange}
            aria-label="Lọc theo CLB"
            className="w-full py-1.5 px-2.5 bg-brand-darker/70 border border-brand-border rounded-lg text-xs sm:text-sm text-brand-white focus:outline-none focus:border-brand-skyblue transition-colors truncate"
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
        <div className="flex items-center gap-1.5 bg-brand-darker/50 px-2.5 py-1.5 rounded-lg border border-brand-border shrink-0">
          <span className="text-[11px] text-brand-muted font-medium whitespace-nowrap">Tối đa:</span>
          <input
            type="range"
            min="4.0"
            max="16.0"
            step="0.5"
            value={filters.maxPrice}
            onChange={handleMaxPriceChange}
            className={`${compact ? 'w-16' : 'w-24'} accent-brand-skyblue cursor-pointer`}
            aria-label="Giá tối đa"
          />
          <span className="text-[11px] font-bold text-brand-skyblue-light min-w-10 text-right">
            £{filters.maxPrice.toFixed(1)}m
          </span>
        </div>

        {/* Reset filter button */}
        {isFiltered && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-brand-card hover:bg-brand-card-hover border border-brand-hotpink/40 text-xs text-brand-hotpink-light hover:text-brand-white transition-colors shrink-0"
            title="Đặt lại bộ lọc"
          >
            <X className="w-3.5 h-3.5" />
            {!compact && <span>Xoá lọc</span>}
          </button>
        )}
      </div>

      {/* Position Filter Pills */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-brand-border/80">
        <span className="text-[11px] text-brand-muted font-medium flex items-center gap-1 mr-1 shrink-0">
          <Filter className="w-3 h-3 text-brand-skyblue-light" /> Vị trí:
        </span>
        <div className="flex flex-wrap gap-1">
          {POSITIONS.map((pos) => {
            const isActive = filters.position === pos.value;
            return (
              <button
                key={pos.value}
                onClick={() => handlePositionChange(pos.value)}
                className={`px-2.5 py-0.5 rounded-md text-xs font-bold transition-all ${
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
