import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShareModal } from '../ShareModal';
import { useShareLineup, validateLineupForShare } from '../../../hooks/useShareLineup';
import { useLineupStore } from '../../../stores/lineupStore';
import { apiClient } from '../../../services/apiClient';

describe('ShareModal Component & useShareLineup Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ShareModal Rendering', () => {
    it('returns empty string when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <ShareModal
          isOpen={false}
          onClose={() => {}}
          shareUrl={null}
          shareCode={null}
          onShare={async () => null}
        />
      );
      expect(html).toBe('');
    });

    it('renders modal title, form and inputs when isOpen is true and shareUrl is null', () => {
      const html = renderToStaticMarkup(
        <ShareModal
          isOpen={true}
          onClose={() => {}}
          shareUrl={null}
          shareCode={null}
          onShare={async () => null}
        />
      );

      expect(html).toContain('Chia sẻ Đội hình');
      expect(html).toContain('Tên đội hình chia sẻ');
      expect(html).toContain('Tạo liên kết chia sẻ');
      expect(html).toContain('My Dream FPL XI');
    });

    it('renders error alert when errorMessage is provided', () => {
      const html = renderToStaticMarkup(
        <ShareModal
          isOpen={true}
          onClose={() => {}}
          shareUrl={null}
          shareCode={null}
          errorMessage="Đội hình chính cần đủ 11 cầu thủ trước khi chia sẻ."
          onShare={async () => null}
        />
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain('Đội hình chính cần đủ 11 cầu thủ trước khi chia sẻ.');
    });

    it('renders share code, public link input, and copy button when shareUrl exists', () => {
      const testCode = '6k9XyZ';
      const testUrl = 'https://fantasy.premierleague.com/#/share/6k9XyZ';

      const html = renderToStaticMarkup(
        <ShareModal
          isOpen={true}
          onClose={() => {}}
          shareUrl={testUrl}
          shareCode={testCode}
          onShare={async () => null}
        />
      );

      expect(html).toContain('Mã đội hình:');
      expect(html).toContain(testCode);
      expect(html).toContain('Đường dẫn liên kết (Public Link)');
      expect(html).toContain(testUrl);
      expect(html).toContain('Sao chép liên kết');
      expect(html).toContain('Hiển thị mã QR');
    });

    it('renders loading state when isLoading is true', () => {
      const html = renderToStaticMarkup(
        <ShareModal
          isOpen={true}
          onClose={() => {}}
          shareUrl={null}
          shareCode={null}
          isLoading={true}
          onShare={async () => null}
        />
      );

      expect(html).toContain('Đang tạo snapshot trên Cloud...');
      expect(html).toContain('disabled=""');
    });
  });

  describe('validateLineupForShare Pure Validator', () => {
    it('returns error when starting XI is incomplete', () => {
      const result = validateLineupForShare(
        Array(10).fill(null),
        Array(4).fill(null),
        null,
        null,
        '4-3-3'
      );
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Đội hình chính cần đủ 11 cầu thủ trước khi chia sẻ.');
      expect(result.payload).toBeNull();
    });

    it('returns error when bench is incomplete', () => {
      const mockXI = Array.from({ length: 11 }, (_, i) => ({
        id: i + 1,
        web_name: `P${i}`,
        team_id: 1,
        element_type: 'MID' as const,
        now_cost: 5.0,
        total_points: 10,
        isStarting: true,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: i,
      }));

      const result = validateLineupForShare(
        mockXI,
        Array(3).fill(null),
        null,
        null,
        '4-3-3'
      );
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Hàng ghế dự bị cần đủ 4 cầu thủ trước khi chia sẻ.');
    });

    it('returns error when captain or vice-captain is missing', () => {
      const mockXI = Array.from({ length: 11 }, (_, i) => ({
        id: i + 1,
        web_name: `P${i}`,
        team_id: 1,
        element_type: 'MID' as const,
        now_cost: 5.0,
        total_points: 10,
        isStarting: true,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: i,
      }));
      const mockBench = Array.from({ length: 4 }, (_, i) => ({
        id: i + 12,
        web_name: `B${i}`,
        team_id: 2,
        element_type: 'DEF' as const,
        now_cost: 4.5,
        total_points: 10,
        isStarting: false,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: i,
      }));

      const result = validateLineupForShare(mockXI, mockBench, null, null, '4-3-3');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Vui lòng chọn Captain (C) và Vice-Captain (V) trước khi chia sẻ.');
    });

    it('returns error when captain and vice-captain are the same player', () => {
      const mockXI = Array.from({ length: 11 }, (_, i) => ({
        id: i + 1,
        web_name: `P${i}`,
        team_id: 1,
        element_type: 'MID' as const,
        now_cost: 5.0,
        total_points: 10,
        isStarting: true,
        isCaptain: i === 0,
        isViceCaptain: i === 0,
        slotIndex: i,
      }));
      const mockBench = Array.from({ length: 4 }, (_, i) => ({
        id: i + 12,
        web_name: `B${i}`,
        team_id: 2,
        element_type: 'DEF' as const,
        now_cost: 4.5,
        total_points: 10,
        isStarting: false,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: i,
      }));

      const result = validateLineupForShare(mockXI, mockBench, 1, 1, '4-3-3');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Captain và Vice-Captain không được trùng nhau.');
    });

    it('builds legal ShareLineupPayload when squad is completely valid', () => {
      const mockXI = Array.from({ length: 11 }, (_, i) => ({
        id: i + 1,
        web_name: `P${i}`,
        team_id: 1,
        element_type: 'MID' as const,
        now_cost: 5.0,
        total_points: 10,
        isStarting: true,
        isCaptain: i === 0,
        isViceCaptain: i === 1,
        slotIndex: i,
      }));
      const mockBench = Array.from({ length: 4 }, (_, i) => ({
        id: i + 12,
        web_name: `B${i}`,
        team_id: 2,
        element_type: 'DEF' as const,
        now_cost: 4.5,
        total_points: 10,
        isStarting: false,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: i,
      }));

      const result = validateLineupForShare(mockXI, mockBench, 1, 2, '4-3-3', 'Premier XI');
      expect(result.isValid).toBe(true);
      expect(result.errorMessage).toBeNull();
      expect(result.payload).toEqual({
        lineup_name: 'Premier XI',
        starting_player_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        bench_player_ids: [12, 13, 14, 15],
        formation: '4-3-3',
        captain_id: 1,
        vice_captain_id: 2,
      });
    });
  });

  describe('useShareLineup Hook with apiClient', () => {
    it('calls apiClient.post with valid payload and updates shareCode and shareUrl', async () => {
      useLineupStore.setState({
        startingXI: Array.from({ length: 11 }, (_, i) => ({
          id: i + 1,
          web_name: `P${i}`,
          team_id: 1,
          element_type: 'MID' as const,
          now_cost: 5.0,
          total_points: 10,
          isStarting: true,
          isCaptain: i === 0,
          isViceCaptain: i === 1,
          slotIndex: i,
        })),
        bench: Array.from({ length: 4 }, (_, i) => ({
          id: i + 12,
          web_name: `B${i}`,
          team_id: 2,
          element_type: 'DEF' as const,
          now_cost: 4.5,
          total_points: 10,
          isStarting: false,
          isCaptain: false,
          isViceCaptain: false,
          slotIndex: i,
        })),
        captainId: 1,
        viceCaptainId: 2,
        formation: '4-3-3',
      });

      const mockApiResponse = {
        share_code: 'code123',
        lineup_name: 'Super Squad',
        total_cost: 73.0,
        predicted_points: 65.0,
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(mockApiResponse);

      let hookOutput: ReturnType<typeof useShareLineup> | null = null;
      const Consumer = () => {
        hookOutput = useShareLineup();
        return null;
      };
      renderToStaticMarkup(<Consumer />);

      const code = await hookOutput!.shareLineup('Super Squad');
      expect(code).toBe('code123');
      expect(postSpy).toHaveBeenCalledWith(
        '/lineups/share',
        expect.objectContaining({
          lineup_name: 'Super Squad',
          captain_id: 1,
          vice_captain_id: 2,
        })
      );
    });
  });
});
