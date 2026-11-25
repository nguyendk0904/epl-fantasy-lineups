import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  TransferControl,
  calculateTransfers,
  MAX_FREE_TRANSFERS,
} from '../TransferControl';
import { TransferSummaryModal } from '../TransferSummaryModal';
import { LineupPlayer } from '../../../types';
import { useLineupStore } from '../../../stores/lineupStore';

const MOCK_BASELINE: LineupPlayer[] = [
  { id: 1, web_name: 'Raya', now_cost: 5.5, element_type: 'GKP', team_id: 1, team_short_name: 'ARS', total_points: 60, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 2, web_name: 'Saliba', now_cost: 6.0, element_type: 'DEF', team_id: 1, team_short_name: 'ARS', total_points: 55, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
  { id: 3, web_name: 'Gabriel', now_cost: 6.0, element_type: 'DEF', team_id: 1, team_short_name: 'ARS', total_points: 58, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 1 },
  { id: 4, web_name: 'Saka', now_cost: 10.0, element_type: 'MID', team_id: 1, team_short_name: 'ARS', total_points: 75, isStarting: true, isCaptain: true, isViceCaptain: false, slotIndex: 0 },
  { id: 5, web_name: 'Haaland', now_cost: 15.0, element_type: 'FWD', team_id: 15, team_short_name: 'MCI', total_points: 90, isStarting: true, isCaptain: false, isViceCaptain: true, slotIndex: 0 },
];

describe('TransferControl & TransferSummaryModal Unit Tests (P4-NG04)', () => {
  describe('calculateTransfers Logic & Weekly Transfer Deduction', () => {
    it('returns 0 transfers when current squad matches baseline squad exactly and 0 made this week', () => {
      const result = calculateTransfers(MOCK_BASELINE, MOCK_BASELINE, 0);
      expect(result.transfersCount).toBe(0);
      expect(result.totalTransfers).toBe(0);
      expect(result.remainingTransfers).toBe(MAX_FREE_TRANSFERS);
      expect(result.playersOut).toHaveLength(0);
      expect(result.playersIn).toHaveLength(0);
      expect(result.netCostDiff).toBe(0);
    });

    it('identifies 1 player OUT and 1 player IN when 1 player is swapped', () => {
      const newPlayer: LineupPlayer = {
        id: 99,
        web_name: 'Palmer',
        now_cost: 10.5,
        element_type: 'MID',
        team_id: 6,
        team_short_name: 'CHE',
        total_points: 80,
        isStarting: true,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: 0,
      };

      // Bán Saka (10.0m) mua Palmer (10.5m)
      const currentSquad = [
        ...MOCK_BASELINE.filter((p) => p.id !== 4),
        newPlayer,
      ];

      const result = calculateTransfers(currentSquad, MOCK_BASELINE, 0);
      expect(result.transfersCount).toBe(1);
      expect(result.totalTransfers).toBe(1);
      expect(result.remainingTransfers).toBe(2);
      expect(result.playersOut).toHaveLength(1);
      expect(result.playersOut[0].web_name).toBe('Saka');
      expect(result.playersIn).toHaveLength(1);
      expect(result.playersIn[0].web_name).toBe('Palmer');
      expect(result.netCostDiff).toBe(0.5); // 10.5 - 10.0 = +0.5m
    });

    it('correctly deducts remaining transfers when transfers were already made this week (Issue 2 Fix)', () => {
      // Giả sử tuần này đã chốt 1 lần (transfersMadeThisWeek = 1), giờ đổi thêm 1 người
      const newPlayer: LineupPlayer = {
        id: 99,
        web_name: 'Palmer',
        now_cost: 10.5,
        element_type: 'MID',
        team_id: 6,
        team_short_name: 'CHE',
        total_points: 80,
        isStarting: true,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: 0,
      };
      const currentSquad = [...MOCK_BASELINE.filter((p) => p.id !== 4), newPlayer];

      const result = calculateTransfers(currentSquad, MOCK_BASELINE, 1);
      expect(result.transfersCount).toBe(1); // Đang đổi 1 người
      expect(result.totalTransfers).toBe(2); // Tổng tuần này đã đổi 2 người
      expect(result.remainingTransfers).toBe(1); // Còn lại 3 - 2 = 1 lượt free
    });

    it('deducts transfer count immediately after commit in lineupStore (Issue 2 State Verification)', () => {
      const store = useLineupStore.getState();
      const fullSquad = [...MOCK_BASELINE, ...Array.from({ length: 10 }, (_, i) => ({ ...MOCK_BASELINE[0], id: 20 + i, now_cost: 4 }))];
      store.loadSampleLineup(fullSquad, []);
      const deadline = Date.now() + 60000;
      store.syncTransferWeek(deadline);

      // Lúc đầu chưa chuyển nhượng: còn 3 lượt
      let summary = store.getTransferSummary();
      expect(summary.remainingTransfers).toBe(3);
      expect(store.transfersMadeThisWeek).toBe(0);

      // Thay 1 người: xóa Saka và thêm Palmer
      store.removePlayer(4);
      const palmer: LineupPlayer = {
        ...MOCK_BASELINE[3],
        id: 99,
        web_name: 'Palmer',
        now_cost: 10.5,
        element_type: 'MID',
        team_id: 6,
        team_short_name: 'CHE',
        total_points: 80,
      };
      store.addPlayerToLineup(palmer);

      // Chốt chuyển nhượng
      store.commitTransfers(deadline);

      // Sau khi chốt: transfersMadeThisWeek phải tăng lên 1, remainingTransfers phải giảm còn 2!
      const updatedState = useLineupStore.getState();
      expect(updatedState.transfersMadeThisWeek).toBe(1);
      const newSummary = updatedState.getTransferSummary();
      expect(newSummary.transfersMadeThisWeek).toBe(1);
      expect(newSummary.remainingTransfers).toBe(2);
      expect(newSummary.transfersCount).toBe(0); // Không còn staged transfer nào
    });

    it('handles 3 free transfers without penalty points', () => {
      const newPlayers: LineupPlayer[] = [
        { id: 91, web_name: 'Flekken', now_cost: 4.5, element_type: 'GKP', team_id: 4, team_short_name: 'BRE', total_points: 50, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
        { id: 92, web_name: 'Gvardiol', now_cost: 6.0, element_type: 'DEF', team_id: 15, team_short_name: 'MCI', total_points: 52, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
        { id: 93, web_name: 'Salah', now_cost: 12.8, element_type: 'MID', team_id: 14, team_short_name: 'LIV', total_points: 88, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
      ];

      // Đổi 3 người: bỏ Raya, Saliba, Saka
      const currentSquad = [
        MOCK_BASELINE[2], // Gabriel
        MOCK_BASELINE[4], // Haaland
        ...newPlayers,
      ];

      const result = calculateTransfers(currentSquad, MOCK_BASELINE, 0);
      expect(result.transfersCount).toBe(3);
      expect(result.totalTransfers).toBe(3);
      expect(result.remainingTransfers).toBe(0);
    });

    it('counts staged and confirmed transfers against the same limit', () => {
      const newPlayers: LineupPlayer[] = [
        { id: 91, web_name: 'P1', now_cost: 5.0, element_type: 'DEF', team_id: 1, team_short_name: 'ARS', total_points: 10, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
        { id: 92, web_name: 'P2', now_cost: 5.0, element_type: 'DEF', team_id: 1, team_short_name: 'ARS', total_points: 10, isStarting: true, isCaptain: false, isViceCaptain: false, slotIndex: 0 },
      ];

      // Đã dùng 2 lượt trước đó, giờ đổi thêm 2 người -> tổng 4 lượt -> vượt giới hạn tuần
      const currentSquad = [
        MOCK_BASELINE[0],
        MOCK_BASELINE[1],
        MOCK_BASELINE[2],
        ...newPlayers,
      ];

      const result = calculateTransfers(currentSquad, MOCK_BASELINE, 2);
      expect(result.transfersCount).toBe(2);
      expect(result.totalTransfers).toBe(4);
      expect(result.remainingTransfers).toBe(0);
    });
  });

  describe('TransferControl Component (Issue 2a & Prominence)', () => {
    it('renders prominent Gameweek Deadline spotlight banner with digital countdown units', () => {
      const html = renderToStaticMarkup(<TransferControl />);
      expect(html).toContain('HẠN CHỐT GAMEWEEK (DEADLINE)');
      expect(html).not.toContain('LỊCH DEMO');
      expect(html).toContain('Chưa nhận deadline từ server');
      expect(html).toContain('Lượt chuyển nhượng tuần:');
      expect(html).toContain('Số lượt: chưa xác minh');
    });

    it('renders disabled confirm button when 0 transfers have been made', () => {
      const html = renderToStaticMarkup(<TransferControl />);
      expect(html).toContain('Chốt Chuyển Nhượng');
      expect(html).toContain('disabled=""');
    });
  });

  describe('TransferSummaryModal Component (Issue 1 Display Fixes)', () => {
    it('renders nothing when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <TransferSummaryModal
          isOpen={false}
          onClose={() => {}}
          onConfirm={() => {}}
          playersOut={[]}
          playersIn={[]}
          remainingBudget={10.0}
          netCostDiff={0}
          transfersCount={0}
        />
      );
      expect(html).toBe('');
    });

    it('renders modal with OUT, IN lists and financial summary with correct sign and formatting', () => {
      const playerOut = MOCK_BASELINE[3]; // Saka 10.0m
      const playerIn: LineupPlayer = {
        id: 99,
        web_name: 'Palmer',
        now_cost: 10.5,
        element_type: 'MID',
        team_id: 6,
        team_short_name: 'CHE',
        total_points: 80,
        isStarting: true,
        isCaptain: false,
        isViceCaptain: false,
        slotIndex: 0,
      };

      const html = renderToStaticMarkup(
        <TransferSummaryModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          playersOut={[playerOut]}
          playersIn={[playerIn]}
          remainingBudget={5.5}
          netCostDiff={0.5}
          transfersCount={1}
          totalTransfers={1}
          transfersMadeThisWeek={0}
          isSquadComplete={true}
          totalSquadPlayers={15}
        />
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('Xác Nhận Chuyển Nhượng Gameweek');
      expect(html).toContain('Cầu Thủ Bán Ra (OUT)');
      expect(html).toContain('Saka');
      expect(html).toContain('+£10.0m');

      expect(html).toContain('Cầu Thủ Mua Vào (IN)');
      expect(html).toContain('Palmer');
      expect(html).toContain('-£10.5m');

      expect(html).toContain('1 cầu thủ');
      expect(html).toContain('2 / 3 lượt');
      expect(html).toContain('£5.5m');
      expect(html).toContain('Xác Nhận Chuyển Nhượng (1)');
    });

    it('disables confirmation when total transfers exceed 3', () => {
      const html = renderToStaticMarkup(
        <TransferSummaryModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          playersOut={MOCK_BASELINE.slice(0, 4)}
          playersIn={MOCK_BASELINE.slice(0, 4)}
          remainingBudget={2.0}
          netCostDiff={0}
          transfersCount={4}
          totalTransfers={4}
          isSquadComplete={true}
          totalSquadPlayers={15}
        />
      );

      expect(html).toContain('disabled=""');
      expect(html).toContain('Vượt hạn mức');
    });

    it('displays alert and disables confirm button when squad has fewer than 15 players', () => {
      const playerOut = MOCK_BASELINE[0]; // Bán 1 người nhưng chưa mua người thay
      const html = renderToStaticMarkup(
        <TransferSummaryModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          playersOut={[playerOut]}
          playersIn={[]}
          remainingBudget={15.0}
          netCostDiff={-5.5}
          transfersCount={1}
          totalTransfers={1}
          isSquadComplete={false}
          totalSquadPlayers={14}
        />
      );

      expect(html).toContain('Đội hình chưa đủ 15 cầu thủ (14/15)!');
      expect(html).toContain('Chưa đủ 15 cầu thủ');
      expect(html).toContain('disabled=""');
    });

    it('displays warning when budget is negative and disables confirm button', () => {
      const html = renderToStaticMarkup(
        <TransferSummaryModal
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          playersOut={[]}
          playersIn={[]}
          remainingBudget={-1.5}
          netCostDiff={1.5}
          transfersCount={1}
          totalTransfers={1}
          isSquadComplete={true}
          totalSquadPlayers={15}
        />
      );

      expect(html).toContain('Vượt quá giới hạn ngân sách!');
      expect(html).toContain('Vượt ngân sách');
      expect(html).toContain('disabled=""');
    });
  });
});

describe('weekly transfer limits at confirmation', () => {
  const squad = Array.from({ length: 15 }, (_, i) => ({ ...MOCK_BASELINE[0], id: i + 1 }));
  it.each([[2, false, true], [3, false, false], [1, true, false]] as const)(
    'used=%s expired=%s accepts=%s', (used, expired, allowed) => {
      const deadline = Date.now() + (expired ? -1000 : 60000);
      const edited = [{ ...squad[0], id: 99 }, ...squad.slice(1)];
      useLineupStore.setState({ baselineSquad: squad, startingXI: edited, bench: [],
        transferWeek: deadline, transfersMadeThisWeek: used });
      expect(useLineupStore.getState().commitTransfers(deadline)).toBe(allowed);
      expect(useLineupStore.getState().transfersMadeThisWeek).toBe(used + Number(allowed));
      expect(useLineupStore.getState().baselineSquad).toEqual(allowed ? edited : squad);
    });
  it('retains quota on remount and resets once for a later week', () => {
    useLineupStore.setState({ transferWeek: 100, transfersMadeThisWeek: 3, baselineSquad: squad });
    const store = useLineupStore.getState();
    store.syncTransferWeek(100);
    expect(useLineupStore.getState().transfersMadeThisWeek).toBe(3);
    store.syncTransferWeek(200);
    expect(useLineupStore.getState().transfersMadeThisWeek).toBe(0);
    expect(useLineupStore.getState().baselineSquad).toEqual(squad);
  });
});
