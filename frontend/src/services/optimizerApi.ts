import { apiClient, ApiError } from './apiClient';
import type { OptimizerConfig, OptimizerResult } from '../components/optimizer/OptimizerControl';
import type { FormationType, LineupPlayer, Player, PositionType } from '../types';

type SolverPlayer = Pick<Player, 'id'> & { expected_points_next: number };
type Solved = Omit<OptimizerResult, 'starting_xi' | 'bench' | 'formation' | 'status'> & {
  status: 'optimal';
  starting_xi: SolverPlayer[];
  bench: SolverPlayer[];
  formation?: FormationType | null;
};

export async function solveOptimizer(config: OptimizerConfig, signal: AbortSignal): Promise<Solved> {
  let response: Solved | { status: 'infeasible'; message?: string };
  try {
    response = await apiClient.post<typeof response>('/optimizer/solve', {
      budget: config.budget,
      locked_player_ids: config.lockedPlayerIds,
      excluded_player_ids: config.excludedPlayerIds,
      target_formation: config.targetFormation === 'auto' ? null : config.targetFormation,
    }, { signal });
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      const header = error.headers?.get('Retry-After')?.trim();
      let seconds = 60;
      if (header && /^\d+$/.test(header)) seconds = Number(header);
      else if (header && Number.isFinite(Date.parse(header))) {
        seconds = Math.max(0, Math.ceil((Date.parse(header) - Date.now()) / 1000));
      }
      throw new Error(`Đã đạt giới hạn yêu cầu. Vui lòng thử lại sau ${seconds} giây.`);
    }
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError') ||
        (error instanceof ApiError && error.status === 503)) {
      throw new Error('Máy chủ đang bận. Vui lòng thử lại sau.');
    }
    throw new Error('Không thể tối ưu đội hình. Vui lòng kiểm tra kết nối và cấu hình đội.');
  }
  if (response.status === 'infeasible') {
    throw new Error(['Không tìm được đội hình phù hợp.', response.message].filter(Boolean).join(' '));
  }
  return response;
}

export function mapOptimizerResponse(response: Solved, marketPlayers: Player[]): OptimizerResult {
  const market = new Map(marketPlayers.map(player => [player.id, player]));
  const counts: Record<PositionType, number> = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  let benchSlot = 1;
  function mapPlayer(row: SolverPlayer, isStarting: boolean): LineupPlayer {
    const player = market.get(row.id);
    if (!player) throw new Error('Dữ liệu cầu thủ chưa đồng bộ. Vui lòng tải lại trang.');
    const position = player.element_type;
    const slotIndex = isStarting ? counts[position]++ : position === 'GKP' ? 0 : benchSlot++;
    return {
      ...player, expected_points_next: row.expected_points_next, slotIndex, isStarting,
      isCaptain: player.id === response.captain_id,
      isViceCaptain: player.id === response.vice_captain_id,
    };
  }
  const startingXI = response.starting_xi.map(row => mapPlayer(row, true));
  return {
    ...response, starting_xi: startingXI, bench: response.bench.map(row => mapPlayer(row, false)),
    formation: response.formation ?? `${counts.DEF}-${counts.MID}-${counts.FWD}` as FormationType,
  };
}
