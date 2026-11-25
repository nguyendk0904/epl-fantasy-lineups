import { create } from 'zustand';
import { apiClient } from './apiClient';
import type { FormationType, LineupPlayer } from '../types';
import type { LeaderboardEntry } from '../components/leaderboard/LeaderboardView';

// P4-NG03: fetch all API pages so search and local pagination cover the same ranking.
export async function fetchLeaderboard(gameweek: number, sortBy: 'overall' | 'gameweek') {
  const entries: LeaderboardEntry[] = [];
  for (let page = 1; ; page++) {
    let totalPages: number | undefined;
    const rows = await apiClient.get<LeaderboardEntry[]>('/leaderboard', {
      params: { gameweek, sort_by: sortBy, page, limit: 100 },
      onResponse: (response) => {
        const value = response.headers.get('X-Total-Pages');
        if (value !== null && Number.isInteger(Number(value)) && Number(value) >= 0) totalPages = Number(value);
      },
    });
    if (!Array.isArray(rows)) throw new Error('Invalid leaderboard response');
    entries.push(...rows);
    if (totalPages !== undefined ? page >= totalPages : rows.length < 100) return entries;
    // Refuse an unbounded or broken pagination response rather than showing a partial ranking.
    if (page >= 1000) throw new Error('Leaderboard pagination exceeded limit');
  }
}

export interface TransferRequest {
  gameweek: number;
  starting_player_ids: number[];
  bench_player_ids: number[];
  formation: FormationType;
  captain_id: number;
  vice_captain_id: number;
}
export interface TransferConfirmation extends TransferRequest {
  lineup_id: number;
  user_id: number;
  total_cost: number;
  transfers_count: number;
  transfers_used: number;
  remaining_transfers: number;
  deadline: string;
  is_locked: boolean;
}

interface TransferSession {
  token: string;
  gameweek: number;
  pending: boolean;
  error: string;
  confirmation: TransferConfirmation | null;
  baseline: LineupPlayer[];
  setIdentity: (token: string, gameweek: number) => void;
}

// P4-NG04: deliberately no persist middleware; acknowledgements belong to this token/GW only.
export const useTransferSession = create<TransferSession>((set, get) => ({
  token: '', gameweek: 1, pending: false, error: '', confirmation: null, baseline: [],
  setIdentity: (token, gameweek) => {
    if (get().pending) return;
    set({ token: token.trim(), gameweek, error: '', confirmation: null, baseline: [] });
  },
}));

export async function confirmGameweekTransfers(payload: TransferRequest, snapshot: LineupPlayer[]) {
  const session = useTransferSession.getState();
  if (session.pending || !session.token || payload.gameweek !== session.gameweek) return false;
  useTransferSession.setState({ pending: true, error: '' });
  try {
    const response = await apiClient.post<TransferConfirmation>('/transfers/confirm', payload, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!response || response.gameweek !== payload.gameweek || !Number.isFinite(Date.parse(response.deadline)) ||
      !Number.isInteger(response.user_id) || response.user_id <= 0 ||
      !Number.isInteger(response.transfers_used) || response.transfers_used < 0 || response.transfers_used > 3 ||
      response.remaining_transfers !== 3 - response.transfers_used || typeof response.is_locked !== 'boolean' ||
      JSON.stringify(response.starting_player_ids) !== JSON.stringify(payload.starting_player_ids) ||
      JSON.stringify(response.bench_player_ids) !== JSON.stringify(payload.bench_player_ids)) {
      throw new Error('Phản hồi xác nhận không hợp lệ. Hãy thử lại cùng đội hình.');
    }
    useTransferSession.setState({ confirmation: response, baseline: snapshot.map((player) => ({ ...player })) });
    return true;
  } catch (error) {
    useTransferSession.setState({ error: error instanceof Error ? error.message : 'Không thể xác nhận đội hình. Hãy thử lại.' });
    return false;
  } finally {
    useTransferSession.setState({ pending: false });
  }
}
