import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, ApiError } from '../apiClient';
import { confirmGameweekTransfers, fetchLeaderboard, useTransferSession, TransferRequest, TransferConfirmation } from '../gameweekApi';
import type { LineupPlayer } from '../../types';

vi.mock('../apiClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn() },
  ApiError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));

const payload: TransferRequest = { gameweek: 12, starting_player_ids: Array.from({ length: 11 }, (_, i) => i + 1),
  bench_player_ids: [12, 13, 14, 15], formation: '4-3-3', captain_id: 1, vice_captain_id: 2 };
const squad = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, web_name: `P${i + 1}` })) as LineupPlayer[];
const response: TransferConfirmation = { ...payload, lineup_id: 1, user_id: 24, total_cost: 90,
  transfers_count: 0, transfers_used: 1, remaining_transfers: 2, deadline: '2030-01-01T00:00:00Z', is_locked: false };

beforeEach(() => {
  vi.resetAllMocks();
  useTransferSession.setState({ token: '', gameweek: 1, pending: false, error: '', confirmation: null, baseline: [] });
});

describe('P4-NG03 leaderboard API pagination', () => {
  it('loads all pages and preserves tied ranks and server ordering', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (_url, options) => {
      options?.onResponse?.(new Response('', { headers: { 'X-Total-Pages': '2' } }));
      return options?.params?.page === 1 ? [{ user_id: 1, rank: 1 }, { user_id: 2, rank: 1 }]
        : [{ user_id: 3, rank: 3 }];
    });
    expect(await fetchLeaderboard(12, 'gameweek')).toEqual([{ user_id: 1, rank: 1 }, { user_id: 2, rank: 1 }, { user_id: 3, rank: 3 }]);
    expect(apiClient.get).toHaveBeenLastCalledWith('/leaderboard', expect.objectContaining({ params: { gameweek: 12, sort_by: 'gameweek', page: 2, limit: 100 } }));
  });
  it('preserves a genuinely empty ranking', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);
    expect(await fetchLeaderboard(12, 'overall')).toEqual([]);
  });
  it('rejects a failed later page instead of presenting incomplete results', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(Array.from({ length: 100 }, () => ({ rank: 1 })))
      .mockRejectedValueOnce(new Error('offline'));
    await expect(fetchLeaderboard(12, 'overall')).rejects.toThrow('offline');
  });
});

describe('P4-NG04 server acknowledgements', () => {
  it('posts only contracted fields with private bearer and accepts authoritative counters', async () => {
    useTransferSession.getState().setIdentity('private-test-token', 12);
    vi.mocked(apiClient.post).mockResolvedValue(response);
    expect(await confirmGameweekTransfers(payload, squad)).toBe(true);
    expect(apiClient.post).toHaveBeenCalledWith('/transfers/confirm', payload, { headers: { Authorization: 'Bearer private-test-token' } });
    expect(useTransferSession.getState().confirmation).toEqual(response);
    expect(useTransferSession.getState().baseline).toEqual(squad);
    expect(useTransferSession.getState().baseline[0]).not.toBe(squad[0]);
  });
  it.each([400, 401, 404, 422, 503])('keeps the previous acknowledgement when server rejects with %i', async (status) => {
    useTransferSession.getState().setIdentity('test-token', 12);
    useTransferSession.setState({ confirmation: response, baseline: squad });
    vi.mocked(apiClient.post).mockRejectedValue(new ApiError(`Rejected ${status}`, status));
    expect(await confirmGameweekTransfers(payload, squad.slice(1))).toBe(false);
    expect(useTransferSession.getState()).toMatchObject({ confirmation: response, baseline: squad, pending: false, error: `Rejected ${status}` });
  });
  it('clears acknowledged counters and baseline on token or GW change', () => {
    useTransferSession.setState({ confirmation: response, baseline: squad });
    useTransferSession.getState().setIdentity('another-person', 12);
    expect(useTransferSession.getState()).toMatchObject({ confirmation: null, baseline: [] });
    useTransferSession.setState({ confirmation: response, baseline: squad });
    useTransferSession.getState().setIdentity('another-person', 13);
    expect(useTransferSession.getState()).toMatchObject({ confirmation: null, baseline: [] });
  });
  it('blocks concurrent submissions and identity changes while saving', async () => {
    useTransferSession.getState().setIdentity('test-token', 12);
    let resolve!: (data: TransferConfirmation) => void;
    vi.mocked(apiClient.post).mockReturnValue(new Promise((done) => { resolve = done; }));
    const saving = confirmGameweekTransfers(payload, squad);
    expect(await confirmGameweekTransfers(payload, squad)).toBe(false);
    useTransferSession.getState().setIdentity('other', 13);
    expect(useTransferSession.getState().token).toBe('test-token');
    resolve(response);
    expect(await saving).toBe(true);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
  it('does not send requests without a token or for another selected GW', async () => {
    expect(await confirmGameweekTransfers(payload, squad)).toBe(false);
    useTransferSession.getState().setIdentity('token', 13);
    expect(await confirmGameweekTransfers(payload, squad)).toBe(false);
    expect(apiClient.post).not.toHaveBeenCalled();
  });
  it('rejects malformed acknowledgements without advancing the local baseline', async () => {
    useTransferSession.getState().setIdentity('token', 12);
    vi.mocked(apiClient.post).mockResolvedValue({ ...response, remaining_transfers: 99 });
    expect(await confirmGameweekTransfers(payload, squad)).toBe(false);
    expect(useTransferSession.getState().confirmation).toBeNull();
    expect(useTransferSession.getState().baseline).toEqual([]);
  });
});
