import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FixturesView,
  generate38GameweekFixtures,
  TOTAL_GAMEWEEKS,
  CURRENT_GAMEWEEK,
} from '../FixturesView';
import { FixtureCard, getFdrConfig, FixtureItem } from '../FixtureCard';

describe('FixturesView & FixtureCard Component Unit Tests (P4-NG01)', () => {
  describe('generate38GameweekFixtures Schedule Generator', () => {
    const allFixtures = generate38GameweekFixtures();

    it('generates all 38 Premier League gameweeks', () => {
      expect(Object.keys(allFixtures)).toHaveLength(38);
      for (let gw = 1; gw <= TOTAL_GAMEWEEKS; gw++) {
        expect(allFixtures[gw]).toBeDefined();
        expect(allFixtures[gw]).toHaveLength(10); // 10 matches per gameweek for 20 teams
      }
    });

    it('generates a total of exactly 380 matches', () => {
      const totalMatches = Object.values(allFixtures).reduce(
        (sum, matches) => sum + matches.length,
        0
      );
      expect(totalMatches).toBe(380);
    });

    it('marks gameweeks prior to CURRENT_GAMEWEEK as finished with scores', () => {
      const pastGw = allFixtures[1];
      expect(pastGw[0].finished).toBe(true);
      expect(pastGw[0].team_h_score).not.toBeNull();
      expect(pastGw[0].team_a_score).not.toBeNull();
    });

    it('marks future gameweeks as not finished with null scores', () => {
      const futureGw = allFixtures[20];
      expect(futureGw[0].finished).toBe(false);
      expect(futureGw[0].team_h_score).toBeNull();
      expect(futureGw[0].team_a_score).toBeNull();
    });

    it('assigns valid FDR difficulty ratings (1 to 5) to all fixtures', () => {
      Object.values(allFixtures).forEach((gwMatches) => {
        gwMatches.forEach((m) => {
          expect(m.team_h_difficulty).toBeGreaterThanOrEqual(1);
          expect(m.team_h_difficulty).toBeLessThanOrEqual(5);
          expect(m.team_a_difficulty).toBeGreaterThanOrEqual(1);
          expect(m.team_a_difficulty).toBeLessThanOrEqual(5);
        });
      });
    });
  });

  describe('getFdrConfig Helper', () => {
    it('returns proper multipliers and labels for all FDR levels', () => {
      expect(getFdrConfig(1).multiplier).toBe(1.2);
      expect(getFdrConfig(2).multiplier).toBe(1.15);
      expect(getFdrConfig(3).multiplier).toBe(1.0);
      expect(getFdrConfig(4).multiplier).toBe(0.9);
      expect(getFdrConfig(5).multiplier).toBe(0.8);
    });

    it('clamps out-of-range ratings to valid 1-5 levels', () => {
      expect(getFdrConfig(0).rating).toBe(1);
      expect(getFdrConfig(10).rating).toBe(5);
    });
  });

  describe('FixtureCard Component', () => {
    const mockFinishedFixture: FixtureItem = {
      id: 101,
      gameweek: 1,
      kickoff_time: '15:00',
      kickoff_date: 'Thứ Bảy, 15/08',
      home_team: { id: 1, name: 'Arsenal', short_name: 'ARS' },
      away_team: { id: 6, name: 'Chelsea', short_name: 'CHE' },
      team_h_score: 2,
      team_a_score: 1,
      team_h_difficulty: 4,
      team_a_difficulty: 4,
      finished: true,
    };

    const mockUpcomingFixture: FixtureItem = {
      id: 201,
      gameweek: 12,
      kickoff_time: '17:30',
      kickoff_date: 'Chủ Nhật, 30/11',
      home_team: { id: 15, name: 'Man City', short_name: 'MCI' },
      away_team: { id: 14, name: 'Liverpool', short_name: 'LIV' },
      team_h_score: null,
      team_a_score: null,
      team_h_difficulty: 4,
      team_a_difficulty: 4,
      finished: false,
    };

    it('renders finished fixture with score and FT badge', () => {
      const html = renderToStaticMarkup(
        <FixtureCard fixture={mockFinishedFixture} />
      );
      expect(html).toContain('ARS');
      expect(html).toContain('CHE');
      expect(html).toContain('2 - 1');
      expect(html).toContain('FT (Hết giờ)');
      expect(html).toContain('FDR 4');
    });

    it('renders upcoming fixture with VS and kickoff time', () => {
      const html = renderToStaticMarkup(
        <FixtureCard fixture={mockUpcomingFixture} />
      );
      expect(html).toContain('MCI');
      expect(html).toContain('LIV');
      expect(html).toContain('VS');
      expect(html).toContain('17:30');
      expect(html).toContain('Sắp đá');
    });

    it('renders FDR badges for both home and away teams', () => {
      const html = renderToStaticMarkup(
        <FixtureCard fixture={mockFinishedFixture} />
      );
      expect(html).toContain('FDR 4');
    });
  });

  describe('FixturesView Main View', () => {
    it('renders header with 38 Gameweeks label and title', () => {
      const html = renderToStaticMarkup(<FixturesView initialGameweek={10} />);
      expect(html).toContain('Lịch Thi Đấu &amp; Độ Khó FDR');
      expect(html).toContain('38 Vòng EPL');
      expect(html).toContain('Gameweek 10');
    });

    it('renders all 38 gameweek quick selector buttons', () => {
      const html = renderToStaticMarkup(<FixturesView initialGameweek={1} />);
      for (let i = 1; i <= 38; i++) {
        expect(html).toContain(`GW ${i}`);
      }
    });

    it('renders club filter selector with Premier League teams', () => {
      const html = renderToStaticMarkup(<FixturesView initialGameweek={10} />);
      expect(html).toContain('Lọc theo CLB');
      expect(html).toContain('Tất cả 20 Câu Lạc Bộ');
      expect(html).toContain('ARS - Arsenal');
      expect(html).toContain('MCI - Man City');
    });

    it('renders FDR legend button', () => {
      const html = renderToStaticMarkup(<FixturesView initialGameweek={10} />);
      expect(html).toContain('Giải thích độ khó FDR');
    });
  });
});
