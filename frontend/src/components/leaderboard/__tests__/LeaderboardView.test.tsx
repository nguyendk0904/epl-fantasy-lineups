import { describe, it, expect, vi } from 'vitest';
import { apiClient } from '../../../services/apiClient';
import { loadLeaderboard } from '../LeaderboardView';

vi.mock('../../../services/apiClient', () => ({ apiClient: { get: vi.fn() } }));
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  LeaderboardView,
  generateLeaderboardData,
} from '../LeaderboardView';
import {
  DreamTeamModal,
  getDreamTeamForGameweek,
} from '../DreamTeamModal';

describe('LeaderboardView data source', () => {
  it.each(['error', 'empty', 'live'])('labels %s data', async (source) => {
    const sample = generateLeaderboardData(11);
    const live = sample.slice(0, 1);
    if (source === 'error') vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('404'));
    else vi.mocked(apiClient.get).mockResolvedValueOnce(source === 'live' ? live : []);
    const result = await loadLeaderboard(11);
    expect(apiClient.get).toHaveBeenCalledWith('/leaderboard', { params: { gameweek: 11 } });
    expect(result).toEqual({ data: source === 'live' ? live : sample, isMock: source !== 'live' });
  });
});

describe('LeaderboardView & DreamTeamModal Unit Tests (P4-NG03)', () => {
  describe('Leaderboard Data Generator', () => {
    it('generates a valid list of 25 fantasy managers', () => {
      const data = generateLeaderboardData(11);
      expect(data).toHaveLength(25);
      expect(data[0].rank).toBe(1);
      expect(data[0].manager_name).toBeTruthy();
      expect(data[0].team_name).toBeTruthy();
      expect(data[0].gameweek_points).toBeGreaterThan(0);
      expect(data[0].total_points).toBeGreaterThan(0);
    });

    it('contains favorite clubs and captain names for managers', () => {
      const data = generateLeaderboardData(11);
      data.forEach((entry) => {
        expect(entry.favorite_club).toBeTruthy();
        expect(entry.captain_name).toBeTruthy();
        expect(entry.formation).toMatch(/^\d-\d-\d$/);
      });
    });
  });

  describe('DreamTeam Data Generator', () => {
    it('generates exactly 11 players in valid 3-4-3 formation', () => {
      const dreamTeam = getDreamTeamForGameweek(11);
      expect(dreamTeam.players).toHaveLength(11);
      expect(dreamTeam.formation).toBe('3-4-3');

      const gkp = dreamTeam.players.filter((p) => p.element_type === 'GKP');
      const def = dreamTeam.players.filter((p) => p.element_type === 'DEF');
      const mid = dreamTeam.players.filter((p) => p.element_type === 'MID');
      const fwd = dreamTeam.players.filter((p) => p.element_type === 'FWD');

      expect(gkp).toHaveLength(1);
      expect(def).toHaveLength(3);
      expect(mid).toHaveLength(4);
      expect(fwd).toHaveLength(3);
    });

    it('designates exactly one MVP with highest points', () => {
      const dreamTeam = getDreamTeamForGameweek(11);
      expect(dreamTeam.mvp).toBeDefined();
      expect(dreamTeam.mvp.points).toBeGreaterThan(0);

      const mvpPlayers = dreamTeam.players.filter((p) => p.isMvp);
      expect(mvpPlayers).toHaveLength(1);
      expect(mvpPlayers[0].web_name).toBe(dreamTeam.mvp.name);
    });

    it('computes correct total points as sum of 11 player points', () => {
      const dreamTeam = getDreamTeamForGameweek(11);
      const computedTotal = dreamTeam.players.reduce((sum, p) => sum + p.points, 0);
      expect(dreamTeam.total_points).toBe(computedTotal);
    });
  });

  describe('LeaderboardView Main Component', () => {
    it('renders header, title, and Dream Team action button', () => {
      const html = renderToStaticMarkup(<LeaderboardView initialGameweek={11} />);
      expect(html).toContain('Bảng Xếp Hạng FPL');
      expect(html).toContain('Đang hiển thị dữ liệu mẫu (API chưa sẵn sàng)');
      expect(html).toContain('Mùa Giải 2026/27');
      expect(html).toContain('Đội Hình Tiêu Biểu (Dream Team)');
    });

    it('renders Podium Top 3 cards (Gold, Silver, Bronze)', () => {
      const html = renderToStaticMarkup(<LeaderboardView initialGameweek={11} />);
      expect(html).toContain('🥇 QUÁN QUÂN');
      expect(html).toContain('🥈 Á QUÂN');
      expect(html).toContain('🥉 HẠNG BA');
    });

    it('renders search input for managers and clubs', () => {
      const html = renderToStaticMarkup(<LeaderboardView initialGameweek={11} />);
      expect(html).toContain('placeholder="Tìm kiếm theo tên Huấn Luyện Viên');
    });

    it('renders table headers and pagination controls', () => {
      const html = renderToStaticMarkup(<LeaderboardView initialGameweek={11} />);
      expect(html).toContain('Thứ Hạng');
      expect(html).toContain('Huấn Luyện Viên &amp; Đội Bóng');
      expect(html).toContain('Đội Trưởng (C)');
      expect(html).toContain('Điểm Vòng');
      expect(html).toContain('Tổng Điểm');
      expect(html).toContain('Trang 1 /');
    });
  });

  describe('DreamTeamModal Component', () => {
    it('renders nothing when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <DreamTeamModal isOpen={false} onClose={() => {}} gameweek={11} />
      );
      expect(html).toBe('');
    });

    it('renders modal with pitch and 11 player slots when isOpen is true', () => {
      const html = renderToStaticMarkup(
        <DreamTeamModal isOpen={true} onClose={() => {}} gameweek={11} />
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('Đội Hình Tiêu Biểu (Dream Team)');
      expect(html).toContain('Gameweek 11');
      expect(html).toContain('Tổng điểm Dream Team');
      expect(html).toContain('Cầu thủ xuất sắc nhất (MVP)');
      expect(html).toContain('MVP');
    });
  });
});
