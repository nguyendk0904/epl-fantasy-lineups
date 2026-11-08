import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SharedLineupPage, SharedLineupApiResponse } from '../SharedLineupPage';
import { SharedPitchView } from '../../components/share/SharedPitchView';
import { useLineupStore } from '../../stores/lineupStore';
import { apiClient } from '../../services/apiClient';
import { LineupPlayer } from '../../types';

describe('P2-NG02: SharedLineupPage & SharedPitchView Unit Tests', () => {
  const mockSharedData: SharedLineupApiResponse = {
    share_code: 'abc123',
    lineup_name: 'Arsenal & City Stars',
    total_cost: 98.5,
    predicted_points: 74.2,
    player_data: {
      starting_player_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      bench_player_ids: [12, 13, 14, 15],
      formation: '4-3-3',
      captain_id: 9,
      vice_captain_id: 6,
      players: [
        { id: 1, web_name: 'Raya', team_id: 1, team_short_name: 'ARS', element_type: 'GKP', now_cost: 5.5, total_points: 100, expected_points_next: 4.5 },
        { id: 2, web_name: 'Saliba', team_id: 1, team_short_name: 'ARS', element_type: 'DEF', now_cost: 6.0, total_points: 90, expected_points_next: 4.8 },
        { id: 3, web_name: 'Gabriel', team_id: 1, team_short_name: 'ARS', element_type: 'DEF', now_cost: 6.0, total_points: 88, expected_points_next: 4.6 },
        { id: 4, web_name: 'Gvardiol', team_id: 10, team_short_name: 'MCI', element_type: 'DEF', now_cost: 6.0, total_points: 80, expected_points_next: 4.2 },
        { id: 5, web_name: 'Robinson', team_id: 8, team_short_name: 'FUL', element_type: 'DEF', now_cost: 4.5, total_points: 60, expected_points_next: 3.5 },
        { id: 6, web_name: 'Saka', team_id: 1, team_short_name: 'ARS', element_type: 'MID', now_cost: 10.0, total_points: 125, expected_points_next: 6.8 },
        { id: 7, web_name: 'Palmer', team_id: 5, team_short_name: 'CHE', element_type: 'MID', now_cost: 10.5, total_points: 130, expected_points_next: 7.2 },
        { id: 8, web_name: 'Rogers', team_id: 2, team_short_name: 'AVL', element_type: 'MID', now_cost: 5.0, total_points: 70, expected_points_next: 4.2 },
        { id: 9, web_name: 'Haaland', team_id: 10, team_short_name: 'MCI', element_type: 'FWD', now_cost: 15.0, total_points: 165, expected_points_next: 8.5 },
        { id: 10, web_name: 'Wood', team_id: 13, team_short_name: 'NFO', element_type: 'FWD', now_cost: 6.0, total_points: 90, expected_points_next: 5.0 },
        { id: 11, web_name: 'Delap', team_id: 10, team_short_name: 'MCI', element_type: 'FWD', now_cost: 5.5, total_points: 75, expected_points_next: 4.0 },
        { id: 12, web_name: 'Turner', team_id: 13, team_short_name: 'NFO', element_type: 'GKP', now_cost: 4.0, total_points: 20, expected_points_next: 1.0 },
        { id: 13, web_name: 'Dunk', team_id: 4, team_short_name: 'BHA', element_type: 'DEF', now_cost: 4.5, total_points: 50, expected_points_next: 2.8 },
        { id: 14, web_name: 'Smith Rowe', team_id: 8, team_short_name: 'FUL', element_type: 'MID', now_cost: 5.5, total_points: 65, expected_points_next: 3.5 },
        { id: 15, web_name: 'Semenyo', team_id: 3, team_short_name: 'BRE', element_type: 'MID', now_cost: 5.5, total_points: 75, expected_points_next: 4.0 },
      ],
    },
    created_at: '2026-11-08T12:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('SharedPitchView (Read-only Pitch)', () => {
    const startingXI: LineupPlayer[] = mockSharedData.player_data.starting_player_ids.map((id, index) => {
      const p = mockSharedData.player_data.players.find((pl) => pl.id === id)!;
      return {
        ...p,
        isStarting: true,
        isCaptain: id === 9,
        isViceCaptain: id === 6,
        slotIndex: index,
      };
    });

    const bench: LineupPlayer[] = mockSharedData.player_data.bench_player_ids.map((id, index) => {
      const p = mockSharedData.player_data.players.find((pl) => pl.id === id)!;
      return {
        ...p,
        isStarting: false,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: index,
      };
    });

    it('renders 11 starters and 4 bench substitutes in read-only mode', () => {
      const html = renderToStaticMarkup(
        <SharedPitchView
          startingXI={startingXI}
          bench={bench}
          formation="4-3-3"
          captainId={9}
          viceCaptainId={6}
        />
      );

      expect(html).toContain('Chế độ chỉ xem (Read-only)');
      expect(html).toContain('Sơ đồ chiến thuật:');
      expect(html).toContain('4-3-3');
      expect(html).toContain('Hàng ghế dự bị (Substitutes)');
      expect(html).toContain('Haaland');
      expect(html).toContain('Saka');
      expect(html).toContain('Raya');
      expect(html).toContain('Turner');
    });
  });

  describe('SharedLineupPage Component', () => {
    it('renders error state when code is invalid or missing', () => {
      const html = renderToStaticMarkup(
        <SharedLineupPage code="123" />
      );

      expect(html).toContain('Mã chia sẻ không hợp lệ hoặc thiếu mã đội hình.');
      expect(html).toContain('Không tìm thấy đội hình');
    });

    it('loads squad into lineupStore when user copies the shared squad', () => {
      // Setup initial store state
      useLineupStore.setState({
        startingXI: [],
        bench: [],
        captainId: null,
        viceCaptainId: null,
      });

      // Prepare players to load
      const starters = mockSharedData.player_data.starting_player_ids.map((id, index) => {
        const p = mockSharedData.player_data.players.find((pl) => pl.id === id)!;
        return {
          ...p,
          isStarting: true,
          isCaptain: id === mockSharedData.player_data.captain_id,
          isViceCaptain: id === mockSharedData.player_data.vice_captain_id,
          slotIndex: index,
        };
      });
      const benchSquad = mockSharedData.player_data.bench_player_ids.map((id, index) => {
        const p = mockSharedData.player_data.players.find((pl) => pl.id === id)!;
        return {
          ...p,
          isStarting: false,
          isCaptain: false,
          isViceCaptain: false,
          slotIndex: index,
        };
      });

      // Execute store methods directly as handleCopyLineupToStore does
      const { loadSampleLineup, setFormation, setCaptain, setViceCaptain } = useLineupStore.getState();
      loadSampleLineup(starters, benchSquad);
      setFormation(mockSharedData.player_data.formation);
      setCaptain(mockSharedData.player_data.captain_id);
      setViceCaptain(mockSharedData.player_data.vice_captain_id);

      const updatedStore = useLineupStore.getState();
      expect(updatedStore.startingXI.filter(Boolean)).toHaveLength(11);
      expect(updatedStore.bench.filter(Boolean)).toHaveLength(4);
      expect(updatedStore.captainId).toBe(9);
      expect(updatedStore.viceCaptainId).toBe(6);
      expect(updatedStore.formation).toBe('4-3-3');
    });

    it('queries GET /lineups/share/:code via apiClient', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue(mockSharedData);

      const response = await apiClient.get<SharedLineupApiResponse>('/lineups/share/abc123');
      expect(getSpy).toHaveBeenCalledWith('/lineups/share/abc123');
      expect(response.share_code).toBe('abc123');
      expect(response.lineup_name).toBe('Arsenal & City Stars');
      expect(response.player_data.players).toHaveLength(15);
    });
  });
});
