import { describe, it, expect } from 'vitest';
import { MOCK_GAMEWEEK_FIXTURES } from '../FixturesPanel';

describe('FixturesPanel Component Unit Tests', () => {
  it('correctly loads Gameweek 10 fixtures with matches', () => {
    const gw10 = MOCK_GAMEWEEK_FIXTURES[10];
    expect(gw10).toBeDefined();
    expect(gw10.gameweek).toBe(10);
    expect(gw10.matches.length).toBeGreaterThan(0);
  });

  it('contains expected Premier League clubs in fixtures', () => {
    const gw10 = MOCK_GAMEWEEK_FIXTURES[10];
    const teamShortNames = gw10.matches.flatMap(m => [m.home_team.short_name, m.away_team.short_name]);
    expect(teamShortNames).toContain('ARS');
    expect(teamShortNames).toContain('MCI');
    expect(teamShortNames).toContain('LIV');
  });

  it('has valid kickoff time and dates formatted for each match', () => {
    const gw10 = MOCK_GAMEWEEK_FIXTURES[10];
    gw10.matches.forEach(m => {
      expect(m.kickoff_time).toMatch(/^\d{2}:\d{2}$/);
      expect(m.kickoff_date).toBeTruthy();
    });
  });
});

