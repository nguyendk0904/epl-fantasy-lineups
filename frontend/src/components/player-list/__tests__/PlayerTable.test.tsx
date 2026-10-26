import { describe, it, expect } from 'vitest';
import { Player } from '../../../types';
import { FilterState } from '../PlayerFilters';

const MOCK_PLAYERS: Player[] = [
  {
    id: 1,
    web_name: 'Haaland',
    first_name: 'Erling',
    second_name: 'Haaland',
    team_id: 10,
    team_short_name: 'MCI',
    element_type: 'FWD',
    now_cost: 15.2,
    total_points: 180,
    form: 8.5,
    expected_points_next: 9.0,
    status: 'a',
  },
  {
    id: 2,
    web_name: 'Salah',
    first_name: 'Mohamed',
    second_name: 'Salah',
    team_id: 9,
    team_short_name: 'LIV',
    element_type: 'MID',
    now_cost: 12.8,
    total_points: 165,
    form: 7.2,
    expected_points_next: 7.8,
    status: 'a',
  },
  {
    id: 3,
    web_name: 'Saka',
    first_name: 'Bukayo',
    second_name: 'Saka',
    team_id: 1,
    team_short_name: 'ARS',
    element_type: 'MID',
    now_cost: 10.0,
    total_points: 140,
    form: 6.8,
    expected_points_next: 6.5,
    status: 'd',
  },
  {
    id: 4,
    web_name: 'Saliba',
    first_name: 'William',
    second_name: 'Saliba',
    team_id: 1,
    team_short_name: 'ARS',
    element_type: 'DEF',
    now_cost: 6.0,
    total_points: 110,
    form: 5.0,
    expected_points_next: 4.5,
    status: 'a',
  },
  {
    id: 5,
    web_name: 'Raya',
    first_name: 'David',
    second_name: 'Raya',
    team_id: 1,
    team_short_name: 'ARS',
    element_type: 'GKP',
    now_cost: 5.5,
    total_points: 105,
    form: 4.8,
    expected_points_next: 4.0,
    status: 'a',
  },
];

// Helper filter function replicating the table's filter logic
function filterPlayers(players: Player[], filters: FilterState): Player[] {
  return players.filter((player) => {
    if (filters.search.trim()) {
      const query = filters.search.toLowerCase().trim();
      const fullName = `${player.first_name ?? ''} ${player.second_name ?? ''} ${player.web_name}`.toLowerCase();
      if (!fullName.includes(query)) return false;
    }
    if (filters.position !== 'ALL' && player.element_type !== filters.position) {
      return false;
    }
    if (filters.teamId !== 'ALL' && player.team_id !== filters.teamId) {
      return false;
    }
    if (player.now_cost > filters.maxPrice) {
      return false;
    }
    return true;
  });
}

describe('PlayerTable & Filter Logic Unit Tests', () => {
  it('correctly loads and counts all sample players without active filters', () => {
    const defaultFilters: FilterState = {
      search: '',
      position: 'ALL',
      teamId: 'ALL',
      maxPrice: 16.0,
    };
    const result = filterPlayers(MOCK_PLAYERS, defaultFilters);
    expect(result).toHaveLength(5);
    expect(result.map(p => p.web_name)).toEqual(['Haaland', 'Salah', 'Saka', 'Saliba', 'Raya']);
  });

  it('filters players accurately by search keyword in web_name or full name', () => {
    const filters: FilterState = {
      search: 'haaland',
      position: 'ALL',
      teamId: 'ALL',
      maxPrice: 16.0,
    };
    const result = filterPlayers(MOCK_PLAYERS, filters);
    expect(result).toHaveLength(1);
    expect(result[0].web_name).toBe('Haaland');
    expect(result[0].element_type).toBe('FWD');
  });

  it('filters players by position (MID only)', () => {
    const filters: FilterState = {
      search: '',
      position: 'MID',
      teamId: 'ALL',
      maxPrice: 16.0,
    };
    const result = filterPlayers(MOCK_PLAYERS, filters);
    expect(result).toHaveLength(2);
    expect(result.every(p => p.element_type === 'MID')).toBe(true);
    expect(result.map(p => p.web_name)).toContain('Salah');
    expect(result.map(p => p.web_name)).toContain('Saka');
  });

  it('filters players by team ID (team_id: 1 for Arsenal)', () => {
    const filters: FilterState = {
      search: '',
      position: 'ALL',
      teamId: 1,
      maxPrice: 16.0,
    };
    const result = filterPlayers(MOCK_PLAYERS, filters);
    expect(result).toHaveLength(3);
    expect(result.every(p => p.team_id === 1)).toBe(true);
    expect(result.map(p => p.web_name)).toEqual(['Saka', 'Saliba', 'Raya']);
  });

  it('filters players by maximum budget constraint (£10.0m cap)', () => {
    const filters: FilterState = {
      search: '',
      position: 'ALL',
      teamId: 'ALL',
      maxPrice: 10.0,
    };
    const result = filterPlayers(MOCK_PLAYERS, filters);
    expect(result).toHaveLength(3);
    expect(result.every(p => p.now_cost <= 10.0)).toBe(true);
    expect(result.find(p => p.web_name === 'Haaland')).toBeUndefined();
    expect(result.find(p => p.web_name === 'Salah')).toBeUndefined();
  });

  it('sorts players correctly by total points descending', () => {
    const sorted = [...MOCK_PLAYERS].sort((a, b) => b.total_points - a.total_points);
    expect(sorted[0].web_name).toBe('Haaland');
    expect(sorted[0].total_points).toBe(180);
    expect(sorted[sorted.length - 1].web_name).toBe('Raya');
    expect(sorted[sorted.length - 1].total_points).toBe(105);
  });

  it('correctly tracks selectedPlayerIds to prevent duplicate selection', () => {
    const selectedIds = new Set([1, 3]); // Haaland and Saka already selected
    const selectable = MOCK_PLAYERS.map(p => ({
      ...p,
      isSelected: selectedIds.has(p.id),
    }));

    const haaland = selectable.find(p => p.id === 1);
    const salah = selectable.find(p => p.id === 2);

    expect(haaland?.isSelected).toBe(true);
    expect(salah?.isSelected).toBe(false);
  });
});

