import { describe, it, expect, vi } from 'vitest';
import { calculateLineupMetrics } from '../LineupComparisonView';
import { LineupPlayer } from '../../../types';

const MOCK_LINEUP_A: LineupPlayer[] = [
  { id: 1, web_name: 'Flekken', team_id: 3, element_type: 'GKP', now_cost: 4.5, total_points: 88, expected_points_next: 4.0, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 2, web_name: 'Saliba', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 85, expected_points_next: 4.5, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 3, web_name: 'Gabriel', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 82, expected_points_next: 4.2, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 4, web_name: 'Konsa', team_id: 2, element_type: 'DEF', now_cost: 4.5, total_points: 55, expected_points_next: 3.0, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 5, web_name: 'Robinson', team_id: 9, element_type: 'DEF', now_cost: 4.5, total_points: 60, expected_points_next: 3.2, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
  { id: 6, web_name: 'Saka', team_id: 1, element_type: 'MID', now_cost: 10.0, total_points: 120, expected_points_next: 6.5, isStarting: true, isCaptain: false, isViceCaptain: true, slotIndex: 0 },
  { id: 7, web_name: 'Palmer', team_id: 5, element_type: 'MID', now_cost: 10.5, total_points: 135, expected_points_next: 7.2, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 8, web_name: 'Rogers', team_id: 2, element_type: 'MID', now_cost: 5.0, total_points: 70, expected_points_next: 4.5, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 9, web_name: 'Haaland', team_id: 10, element_type: 'FWD', now_cost: 15.0, total_points: 160, expected_points_next: 8.8, isStarting: true, isCaptain: true, isViceCaptain: false, slotIndex: 0 },
  { id: 10, web_name: 'Wood', team_id: 13, element_type: 'FWD', now_cost: 6.0, total_points: 95, expected_points_next: 5.5, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 11, web_name: 'Delap', team_id: 10, element_type: 'FWD', now_cost: 5.5, total_points: 80, expected_points_next: 4.0, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 12, web_name: 'Turner', team_id: 13, element_type: 'GKP', now_cost: 4.0, total_points: 20, expected_points_next: 1.0, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 13, web_name: 'Dunk', team_id: 4, element_type: 'DEF', now_cost: 4.5, total_points: 50, expected_points_next: 2.8, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 14, web_name: 'Smith Rowe', team_id: 9, element_type: 'MID', now_cost: 5.5, total_points: 65, expected_points_next: 3.8, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 15, web_name: 'Semenyo', team_id: 3, element_type: 'MID', now_cost: 5.5, total_points: 75, expected_points_next: 4.5, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
];

const MOCK_LINEUP_B: LineupPlayer[] = [
  ...MOCK_LINEUP_A.slice(0, 13), // 13 cầu thủ giống nhau
  { id: 16, web_name: 'Salah', team_id: 9, element_type: 'MID', now_cost: 12.8, total_points: 170, expected_points_next: 8.5, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 17, web_name: 'Son', team_id: 14, element_type: 'MID', now_cost: 9.8, total_points: 110, expected_points_next: 6.0, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
];

describe('Lineup Comparison & Metrics Calculation Tests', () => {
  it('calculates total cost and expected points accurately for Lineup A', () => {
    const metricsA = calculateLineupMetrics(MOCK_LINEUP_A);

    expect(metricsA.totalCost).toBe(97.0);
    expect(metricsA.totalXp).toBeGreaterThan(60);
    expect(metricsA.attackRating).toBeGreaterThanOrEqual(40);
    expect(metricsA.defenseRating).toBeGreaterThanOrEqual(40);
  });

  it('detects cost and xp difference correctly between two lineups', () => {
    const metricsA = calculateLineupMetrics(MOCK_LINEUP_A);
    const metricsB = calculateLineupMetrics(MOCK_LINEUP_B);

    // Lineup B replaces Smith Rowe (5.5m) and Semenyo (5.5m) with Salah (12.8m) and Son (9.8m)
    // Diff cost: (12.8 + 9.8) - (5.5 + 5.5) = +11.6m
    const costDelta = Math.round((metricsB.totalCost - metricsA.totalCost) * 10) / 10;
    expect(costDelta).toBe(11.6);
    expect(metricsB.totalXp).toBeGreaterThan(metricsA.totalXp);
  });

  it('determines common players and differential players between lineups', () => {
    const setA = new Set(MOCK_LINEUP_A.map(p => p.id));
    const setB = new Set(MOCK_LINEUP_B.map(p => p.id));

    const common = MOCK_LINEUP_A.filter(p => setB.has(p.id));
    const diffB = MOCK_LINEUP_B.filter(p => !setA.has(p.id));

    expect(common).toHaveLength(13);
    expect(diffB).toHaveLength(2);
    expect(diffB.map(p => p.web_name)).toEqual(['Salah', 'Son']);
  });

  it('handles empty lineup safely returning default zero metrics', () => {
    const metricsEmpty = calculateLineupMetrics([]);
    expect(metricsEmpty.totalCost).toBe(0);
    expect(metricsEmpty.totalXp).toBe(0);
    expect(metricsEmpty.attackRating).toBe(0);
  });
});

