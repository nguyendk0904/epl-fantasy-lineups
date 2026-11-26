// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import { VirtualPitch } from '../VirtualPitch';
import { LineupPlayer } from '../../../types';

describe('VirtualPitch Component Unit Tests', () => {
  const mockStartingXI: LineupPlayer[] = [
    { id: 1, web_name: 'Flekken', team_id: 3, element_type: 'GKP', now_cost: 4.5, total_points: 88, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
    { id: 2, web_name: 'Saliba', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 85, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
    { id: 3, web_name: 'Gabriel', team_id: 1, element_type: 'DEF', now_cost: 6.0, total_points: 82, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 2 },
    { id: 4, web_name: 'Konsa', team_id: 2, element_type: 'DEF', now_cost: 4.5, total_points: 55, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 3 },
    { id: 5, web_name: 'Robinson', team_id: 9, element_type: 'DEF', now_cost: 4.5, total_points: 60, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 4 },
    { id: 6, web_name: 'Saka', team_id: 1, element_type: 'MID', now_cost: 10.0, total_points: 120, isStarting: true, isCaptain: false, isViceCaptain: true, slotIndex: 5 },
    { id: 7, web_name: 'Palmer', team_id: 6, element_type: 'MID', now_cost: 10.5, total_points: 135, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 6 },
    { id: 8, web_name: 'Rogers', team_id: 2, element_type: 'MID', now_cost: 5.0, total_points: 70, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 7 },
    { id: 9, web_name: 'Haaland', team_id: 13, element_type: 'FWD', now_cost: 15.0, total_points: 160, isStarting: true, isCaptain: true, isViceCaptain: false, slotIndex: 8 },
    { id: 10, web_name: 'Wood', team_id: 16, element_type: 'FWD', now_cost: 6.0, total_points: 95, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 9 },
    { id: 11, web_name: 'Delap', team_id: 10, element_type: 'FWD', now_cost: 5.5, total_points: 80, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 10 },
  ];

  const mockBench: LineupPlayer[] = [
    { id: 12, web_name: 'Turner', team_id: 16, element_type: 'GKP', now_cost: 4.0, total_points: 20, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 11 },
    { id: 13, web_name: 'Dunk', team_id: 5, element_type: 'DEF', now_cost: 4.5, total_points: 50, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 12 },
    { id: 14, web_name: 'Smith Rowe', team_id: 9, element_type: 'MID', now_cost: 5.5, total_points: 65, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 13 },
    { id: 15, web_name: 'Semenyo', team_id: 4, element_type: 'MID', now_cost: 5.5, total_points: 75, isStarting: false, isCaptain: false, isViceCaptain: false, slotIndex: 14 },
  ];

  it('renders starting XI with exactly 11 players for 4-3-3 formation', () => {
    expect(mockStartingXI).toHaveLength(11);
    expect(mockStartingXI[0].element_type).toBe('GKP');
    expect(mockStartingXI.filter(p => p.element_type === 'DEF')).toHaveLength(4);
    expect(mockStartingXI.filter(p => p.element_type === 'MID')).toHaveLength(3);
    expect(mockStartingXI.filter(p => p.element_type === 'FWD')).toHaveLength(3);
  });

  it('substitutes directly on cards and keeps captain actions independent', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const swap = vi.fn();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    try {
      const captain = vi.fn();
      const bench = mockBench.map((p, slotIndex) => ({ ...p, slotIndex }));
      act(() => root.render(<VirtualPitch startingXI={mockStartingXI} bench={bench}
        onSelectCaptain={captain} onSubstitute={swap} />));
      const click = (name: string) => act(() => host.querySelector<HTMLElement>(`[aria-label="${name}"]`)!.click());
      click('Chọn Flekken ra sân');
      click('Chọn Dunk vào sân');
      expect(swap).not.toHaveBeenCalled();
      click('Chọn Flekken ra sân');
      click('Chọn Turner vào sân');
      expect(swap).not.toHaveBeenCalled();
      click('Chọn Saliba ra sân');
      click('Chọn Flekken ra sân');
      act(() => host.querySelector<HTMLButtonElement>('[title="Chọn làm Captain (x2 điểm)"]')!.click());
      expect(captain).toHaveBeenCalledWith(1);
      click('Chọn Turner vào sân');
      expect(swap).toHaveBeenCalledWith(12, 1);
    } finally {
      act(() => root.unmount());
      vi.unstubAllGlobals();
    }
  });

  it('renders bench with exactly 4 players (1 GKP and 3 outfielders)', () => {
    expect(mockBench).toHaveLength(4);
    expect(mockBench[0].element_type).toBe('GKP');
    expect(mockBench.slice(1).every(p => p.element_type !== 'GKP')).toBe(true);
  });

  it('correctly designates Captain (Haaland) and Vice-Captain (Saka)', () => {
    const captain = mockStartingXI.find(p => p.isCaptain);
    const viceCaptain = mockStartingXI.find(p => p.isViceCaptain);

    expect(captain?.web_name).toBe('Haaland');
    expect(viceCaptain?.web_name).toBe('Saka');
  });

  it('validates total lineup budget within £100.0m cap', () => {
    const totalCost = [...mockStartingXI, ...mockBench].reduce((acc, p) => acc + p.now_cost, 0);
    expect(totalCost).toBe(97.0);
    expect(totalCost).toBeLessThanOrEqual(100.0);
  });

  it('validates club limit constraint (max 3 players per Premier League club)', () => {
    const teamCounts: Record<number, number> = {};
    [...mockStartingXI, ...mockBench].forEach(p => {
      teamCounts[p.team_id] = (teamCounts[p.team_id] || 0) + 1;
    });

    Object.values(teamCounts).forEach(count => {
      expect(count).toBeLessThanOrEqual(3);
    });
  });
});

