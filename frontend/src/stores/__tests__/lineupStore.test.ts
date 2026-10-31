import { describe, it, expect, beforeEach } from 'vitest';
import { useLineupStore, TOTAL_BUDGET, MAX_PLAYERS_PER_CLUB } from '../lineupStore';
import { LineupPlayer, Player } from '../../types';

const MOCK_STARTING: LineupPlayer[] = [
  { id: 1, web_name: 'Flekken', team_id: 3, element_type: 'GKP', now_cost: 4.5, total_points: 88, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 2, web_name: 'Saliba', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 85, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 3, web_name: 'Gabriel', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 82, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 4, web_name: 'Konsa', team_id: 2, element_type: 'DEF', now_cost: 4.5, total_points: 55, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 5, web_name: 'Robinson', team_id: 9, element_type: 'DEF', now_cost: 4.5, total_points: 60, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
  { id: 6, web_name: 'Saka', team_id: 1, element_type: 'MID', now_cost: 10.0, total_points: 120, isStarting: true, isCaptain: false, isViceCaptain: true, slotIndex: 0 },
  { id: 7, web_name: 'Palmer', team_id: 5, element_type: 'MID', now_cost: 10.5, total_points: 135, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 8, web_name: 'Rogers', team_id: 2, element_type: 'MID', now_cost: 5.0, total_points: 70, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 9, web_name: 'Haaland', team_id: 10, element_type: 'FWD', now_cost: 15.0, total_points: 160, isStarting: true, isCaptain: true, isViceCaptain: false, slotIndex: 0 },
  { id: 10, web_name: 'Wood', team_id: 13, element_type: 'FWD', now_cost: 6.0, total_points: 95, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 11, web_name: 'Delap', team_id: 10, element_type: 'FWD', now_cost: 5.5, total_points: 80, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
];

const MOCK_BENCH: LineupPlayer[] = [
  { id: 12, web_name: 'Turner', team_id: 13, element_type: 'GKP', now_cost: 4.0, total_points: 20, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 13, web_name: 'Dunk', team_id: 4, element_type: 'DEF', now_cost: 4.5, total_points: 50, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 14, web_name: 'Smith Rowe', team_id: 9, element_type: 'MID', now_cost: 5.5, total_points: 65, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
  { id: 15, web_name: 'Semenyo', team_id: 3, element_type: 'MID', now_cost: 5.5, total_points: 75, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
];

describe('Lineup Zustand Store', () => {
  beforeEach(() => {
    const store = useLineupStore.getState();
    store.resetLineup();
  });

  it('initializes with empty squad and full £100.0m budget', () => {
    const store = useLineupStore.getState();
    expect(store.startingXI).toHaveLength(0);
    expect(store.bench).toHaveLength(0);
    expect(store.getTotalCost()).toBe(0);
    expect(store.getRemainingBudget()).toBe(TOTAL_BUDGET);
    expect(store.getTotalPlayers()).toBe(0);
  });

  it('correctly loads sample lineup and computes live stats', () => {
    const store = useLineupStore.getState();
    store.loadSampleLineup(MOCK_STARTING, MOCK_BENCH);

    const state = useLineupStore.getState();
    expect(state.startingXI).toHaveLength(11);
    expect(state.bench).toHaveLength(4);
    expect(state.getTotalPlayers()).toBe(15);
    expect(state.getTotalCost()).toBe(97.0);
    expect(state.getRemainingBudget()).toBe(3.0);
    expect(state.captainId).toBe(9); // Haaland
    expect(state.viceCaptainId).toBe(6); // Saka

    const validation = state.validateLineup();
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('removes player and updates budget & captain accordingly', () => {
    const store = useLineupStore.getState();
    store.loadSampleLineup(MOCK_STARTING, MOCK_BENCH);

    // Remove Captain (Haaland, cost 15.0)
    store.removePlayer(9);

    const updated = useLineupStore.getState();
    expect(updated.startingXI.find((p) => p.id === 9)).toBeUndefined();
    expect(updated.captainId).toBeNull();
    expect(updated.getTotalCost()).toBe(82.0);
    expect(updated.getRemainingBudget()).toBe(18.0);
    expect(updated.getTotalPlayers()).toBe(14);
  });

  it('designates Captain and Vice-Captain without conflicts', () => {
    const store = useLineupStore.getState();
    store.loadSampleLineup(MOCK_STARTING, MOCK_BENCH);

    // Saliba id: 2 -> new Captain
    store.setCaptain(2);
    let state = useLineupStore.getState();
    expect(state.captainId).toBe(2);
    expect(state.startingXI.find((p) => p.id === 2)?.isCaptain).toBe(true);

    // Set Saliba also as Vice-Captain -> Captain status should clear from Saliba
    store.setViceCaptain(2);
    state = useLineupStore.getState();
    expect(state.viceCaptainId).toBe(2);
    expect(state.captainId).toBeNull();
  });

  it('blocks adding a player from a club that already has 3 players (FPL Rule #6)', () => {
    const store = useLineupStore.getState();
    store.loadSampleLineup(MOCK_STARTING, MOCK_BENCH);

    // Arsenal (team_id: 1) already has 3 players: Saliba, Gabriel, Saka
    const fourthArsenalPlayer: Player = {
      id: 99,
      web_name: 'Raya',
      team_id: 1,
      element_type: 'GKP',
      now_cost: 5.5,
      total_points: 100,
    };

    const added = store.addPlayerToLineup(fourthArsenalPlayer);
    expect(added).toBe(false);

    const state = useLineupStore.getState();
    expect(state.notification).toContain('tối đa 3 cầu thủ');
  });

  it('blocks adding a player when budget is insufficient (FPL Rule #5)', () => {
    const store = useLineupStore.getState();
    store.loadSampleLineup(MOCK_STARTING, MOCK_BENCH);
    // Remaining budget is 7.5

    const expensivePlayer: Player = {
      id: 100,
      web_name: 'Mbappe',
      team_id: 15,
      element_type: 'FWD',
      now_cost: 14.0, // > 7.5m
      total_points: 150,
    };

    const added = store.addPlayerToLineup(expensivePlayer);
    expect(added).toBe(false);

    const state = useLineupStore.getState();
    expect(state.notification).toContain('Không đủ ngân sách');
  });

  it('rebalances squad properly when formation changes', () => {
    const store = useLineupStore.getState();
    store.loadSampleLineup(MOCK_STARTING, MOCK_BENCH);

    // Switch from 4-3-3 to 3-5-2
    // DEF in starting should decrease from 4 to 3 (Robinson moves to bench)
    // MID in starting should increase from 3 to 5 (Smith Rowe, Semenyo move from bench to starting)
    // FWD in starting should decrease from 3 to 2 (Delap moves to bench)
    store.setFormation('3-5-2');

    const state = useLineupStore.getState();
    expect(state.formation).toBe('3-5-2');
    expect(state.startingXI).toHaveLength(11);
    expect(state.bench).toHaveLength(4);

    const startingDef = state.startingXI.filter((p) => p.element_type === 'DEF');
    const startingMid = state.startingXI.filter((p) => p.element_type === 'MID');
    const startingFwd = state.startingXI.filter((p) => p.element_type === 'FWD');

    expect(startingDef).toHaveLength(3);
    expect(startingMid).toHaveLength(5);
    expect(startingFwd).toHaveLength(2);
  });

  it('validates incomplete lineups reporting specific error messages', () => {
    const store = useLineupStore.getState();
    // Empty squad
    const validation = store.validateLineup();
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((err) => err.includes('15 cầu thủ'))).toBe(true);
    expect(validation.errors.some((err) => err.includes('Captain'))).toBe(true);
  });
});
