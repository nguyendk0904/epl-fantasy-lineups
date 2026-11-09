import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobilePlayerDrawer } from '../MobilePlayerDrawer';
import { Player } from '../../../types';

const MOCK_PLAYERS: Player[] = [
  {
    id: 1,
    web_name: 'Haaland',
    first_name: 'Erling',
    second_name: 'Haaland',
    team_id: 10,
    team_short_name: 'MCI',
    element_type: 'FWD',
    now_cost: 15.0,
    total_points: 160,
    form: 8.5,
    expected_points_next: 8.8,
  },
  {
    id: 2,
    web_name: 'Saka',
    first_name: 'Bukayo',
    second_name: 'Saka',
    team_id: 1,
    team_short_name: 'ARS',
    element_type: 'MID',
    now_cost: 10.0,
    total_points: 120,
    form: 6.8,
    expected_points_next: 6.5,
  },
  {
    id: 3,
    web_name: 'Saliba',
    first_name: 'William',
    second_name: 'Saliba',
    team_id: 1,
    team_short_name: 'ARS',
    element_type: 'DEF',
    now_cost: 6.0,
    total_points: 85,
    form: 5.0,
    expected_points_next: 4.5,
  },
];

describe('MobilePlayerDrawer Component Unit Tests', () => {
  it('returns empty when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <MobilePlayerDrawer
        isOpen={false}
        onClose={() => {}}
        players={MOCK_PLAYERS}
        onSelectPlayer={() => {}}
      />
    );
    expect(html).toBe('');
  });

  it('renders modal dialog and search input when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <MobilePlayerDrawer
        isOpen={true}
        onClose={() => {}}
        players={MOCK_PLAYERS}
        onSelectPlayer={() => {}}
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('role="searchbox"');
    expect(html).toContain('Chọn Cầu Thủ');
    expect(html).toContain('Haaland');
    expect(html).toContain('Saka');
  });

  it('renders target slot info when targetSlot is specified', () => {
    const html = renderToStaticMarkup(
      <MobilePlayerDrawer
        isOpen={true}
        onClose={() => {}}
        targetSlot={{ position: 'MID', slotIndex: 1, isBench: false }}
        players={MOCK_PLAYERS}
        onSelectPlayer={() => {}}
      />
    );

    expect(html).toContain('Chọn MID');
    expect(html).toContain('Đá chính');
    expect(html).toContain('slot #2');
  });

  it('shows "Đã chọn" for already selected players in squad', () => {
    const html = renderToStaticMarkup(
      <MobilePlayerDrawer
        isOpen={true}
        onClose={() => {}}
        selectedPlayerIds={[1]}
        players={MOCK_PLAYERS}
        onSelectPlayer={() => {}}
      />
    );

    expect(html).toContain('Đã chọn');
  });

  it('shows club limit badge when club has reached 3 players', () => {
    const html = renderToStaticMarkup(
      <MobilePlayerDrawer
        isOpen={true}
        onClose={() => {}}
        selectedPlayerIds={[]}
        clubCounts={{ 1: 3 }} // Arsenal (ARS) has 3 players
        players={MOCK_PLAYERS}
        onSelectPlayer={() => {}}
      />
    );

    expect(html).toContain('Max 3/CLB');
  });
});
