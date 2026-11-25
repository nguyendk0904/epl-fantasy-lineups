// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DreamTeamModal, getDreamTeamForGameweek } from '../../components/leaderboard/DreamTeamModal';
import { LeaderboardView } from '../../components/leaderboard/LeaderboardView';
import { FixturesView } from '../../components/fixtures/FixturesView';
import { TransferControl } from '../../components/transfers/TransferControl';
import { PlayerStatusBadge } from '../../components/common/PlayerStatusBadge';
import { useLineupStore } from '../../stores/lineupStore';
import { useTransferSession } from '../gameweekApi';
import type { LineupPlayer, PositionType } from '../../types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'X-Total-Pages': '1' },
});
const text = () => document.body.textContent ?? '';
const button = (label: string) => Array.from(document.querySelectorAll('button')).find((node) => node.textContent?.includes(label))!;
async function render(element: React.ReactNode) { await act(async () => { root.render(element); }); }
async function click(label: string) { await act(async () => { button(label).click(); }); }

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useTransferSession.setState({ token: '', gameweek: 12, pending: false, error: '', confirmation: null, baseline: [] });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('P4-NG01 / P4-NG03 API screens', () => {
  it('preserves a zero availability percentage and does not invent an unknown one (P4-NG02)', async () => {
    await render(<PlayerStatusBadge status="d" news="Awaiting assessment" chance={0} />);
    expect(text()).toContain('Nghi ngờ (0%)');
    expect(text()).toContain('Awaiting assessment');
    await render(<PlayerStatusBadge status="i" news="Ankle injury" chance={null} />);
    expect(text()).toContain('Ankle injury');
    expect(text()).not.toContain('0%');
  });
  it('shows a real empty fixture round without generating matches', async () => {
    vi.mocked(fetch).mockResolvedValue(json([]));
    await render(<FixturesView initialGameweek={12} />);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/fixtures?gameweek=12'), expect.anything());
    expect(document.querySelectorAll('[data-testid^="fixture-card-"]')).toHaveLength(0);
    expect(text()).toContain('Vòng này chưa có lịch thi đấu đủ dữ liệu.');
    expect(text()).not.toContain('dữ liệu mẫu');
  });
  it('reports fixture failure and retries on click', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json([]));
    await render(<FixturesView />);
    expect(text()).toContain('Không tải được lịch thi đấu');
    await click('Thử lại');
    expect(text()).not.toContain('Không tải được lịch thi đấu');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('renders the API Dream Team and handles an unpublished snapshot', async () => {
    const data = getDreamTeamForGameweek(11); // Explicit test fixture, never the runtime fallback.
    data.players[0].web_name = 'Cloud Goalkeeper';
    vi.mocked(fetch).mockResolvedValueOnce(json(data)).mockResolvedValueOnce(json({ detail: 'pending' }, 404));
    await render(<DreamTeamModal isOpen onClose={() => {}} gameweek={11} />);
    expect(text()).toContain('Cloud Goalkeeper');
    expect(text()).toContain('Tổng điểm Dream Team');
    await render(<DreamTeamModal isOpen onClose={() => {}} gameweek={12} />);
    expect(text()).toContain('Vòng này chưa có Dream Team');
    expect(text()).not.toContain('Cloud Goalkeeper');
  });
  it('ignores a slow response from a previously selected Dream Team round', async () => {
    let resolveOld!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(json({ detail: 'pending' }, 404));
    await render(<DreamTeamModal isOpen onClose={() => {}} gameweek={11} />);
    await render(<DreamTeamModal isOpen onClose={() => {}} gameweek={12} />);
    await act(async () => { resolveOld(json(getDreamTeamForGameweek(11))); });
    expect(text()).toContain('Vòng này chưa có Dream Team');
    expect(text()).not.toContain('Tổng điểm Dream Team');
  });
  it('keeps tied ranks, marks first entries new, and requests server sorting', async () => {
    const entries = [1, 2, 3].map((id) => ({ user_id: id, rank: id === 3 ? 3 : 1, previous_rank: 0,
      manager_name: `Real manager ${id}`, team_name: `Squad ${id}`, favorite_club: '', captain_name: 'C',
      formation: '4-3-3', gameweek_points: 50, total_points: id === 3 ? 80 : 100 }));
    vi.mocked(fetch).mockImplementation(async () => json(entries));
    await render(<LeaderboardView initialGameweek={12} />);
    expect(text()).toContain('Real manager 1');
    expect(text().match(/Mới/g)).toHaveLength(3);
    expect(text().match(/🥇 QUÁN QUÂN/g)).toHaveLength(2);
    expect(text()).not.toContain('🥈 Á QUÂN');
    await click('Điểm Tuần');
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('sort_by=gameweek'), expect.anything());
    expect(text()).not.toContain('dữ liệu mẫu');
  });
});

function seedSquad() {
  const positions: PositionType[] = ['GKP', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD', 'GKP', 'DEF', 'MID', 'MID'];
  const squad: LineupPlayer[] = positions.map((position, i) => ({ id: i + 1, web_name: `P${i + 1}`, team_id: i % 5 + 1,
    team_short_name: 'ARS', element_type: position, now_cost: 5, total_points: 0, isStarting: i < 11,
    isCaptain: i === 5, isViceCaptain: i === 8, slotIndex: i }));
  useLineupStore.setState({ startingXI: squad.slice(0, 11), bench: squad.slice(11), formation: '4-3-3', captainId: 6, viceCaptainId: 9 });
  useTransferSession.getState().setIdentity('private-test-token', 12);
}

describe('P4-NG04 transfer UI through the real API client', () => {
  it('saves an initial unchanged 15-player squad and reads server allowance/deadline', async () => {
    seedSquad();
    vi.mocked(fetch).mockImplementation(async (_url, init) => json({ ...JSON.parse(String(init?.body)),
      lineup_id: 1, user_id: 7, total_cost: 75, transfers_count: 0, transfers_used: 2,
      remaining_transfers: 1, deadline: '2030-01-01T00:00:00Z', is_locked: false }));
    await render(<TransferControl />);
    expect(text()).toContain('Số lượt: chưa xác minh');
    await click('Lưu Đội Hình');
    await click('Xác Nhận Chuyển Nhượng');
    expect(text()).toContain('Server đã lưu cho Player #7, GW 12. Còn lại: 1 / 3 lượt.');
    expect(useTransferSession.getState().baseline).toHaveLength(15);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(Object.keys(body).sort()).toEqual(['bench_player_ids', 'captain_id', 'formation', 'gameweek', 'starting_player_ids', 'vice_captain_id']);
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer private-test-token' });
    expect(localStorage.getItem('fpl_lineup_storage_v1')).not.toContain('private-test-token');
  });
  it('leaves a failed request open for retry and does not consume transfers', async () => {
    seedSquad();
    vi.mocked(fetch).mockResolvedValue(json({ detail: 'Transfer deadline has passed' }, 400));
    await render(<TransferControl />);
    await click('Lưu Đội Hình');
    await click('Xác Nhận Chuyển Nhượng');
    expect(text()).toContain('Transfer deadline has passed');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(useTransferSession.getState().confirmation).toBeNull();
    expect(useTransferSession.getState().baseline).toEqual([]);
  });
  it('disables a fourth incoming player using the acknowledged server allowance', async () => {
    seedSquad();
    vi.mocked(fetch).mockImplementation(async (_url, init) => json({ ...JSON.parse(String(init?.body)),
      lineup_id: 1, user_id: 7, total_cost: 75, transfers_count: 0, transfers_used: 3,
      remaining_transfers: 0, deadline: '2030-01-01T00:00:00Z', is_locked: false }));
    await render(<TransferControl />);
    await click('Lưu Đội Hình');
    await click('Xác Nhận Chuyển Nhượng');
    await act(async () => {
      const state = useLineupStore.getState();
      useLineupStore.setState({ bench: state.bench.map((player, i) => i === 1 ? { ...player, id: 99 } : player) });
    });
    expect((button('Chốt Chuyển Nhượng') as HTMLButtonElement).disabled).toBe(true);
    expect(text()).toContain('Vượt giới hạn 3 lượt/tuần');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('disables saving after the server-confirmed deadline', async () => {
    seedSquad();
    vi.mocked(fetch).mockImplementation(async (_url, init) => json({ ...JSON.parse(String(init?.body)),
      lineup_id: 1, user_id: 7, total_cost: 75, transfers_count: 0, transfers_used: 0,
      remaining_transfers: 3, deadline: '2000-01-01T00:00:00Z', is_locked: false }));
    await render(<TransferControl />);
    await click('Lưu Đội Hình');
    await click('Xác Nhận Chuyển Nhượng');
    expect((button('Chốt Chuyển Nhượng') as HTMLButtonElement).disabled).toBe(true);
    expect(text()).toContain('ĐÃ KHÓA SỔ GAMEWEEK');
  });
});
