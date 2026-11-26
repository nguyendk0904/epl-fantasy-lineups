import { expect, it, vi } from 'vitest';
import { apiClient, ApiError } from '../apiClient';
import { solveOptimizer, mapOptimizerResponse } from '../optimizerApi';
import type { Player, PositionType } from '../../types';

const config = { budget: 96, lockedPlayerIds: [1], excludedPlayerIds: [80], targetFormation: 'auto' as const };
const signal = new AbortController().signal;
const positions: PositionType[] = ['GKP','DEF','DEF','DEF','MID','MID','MID','MID','FWD','FWD','FWD','MID','GKP','DEF','DEF'];
const market: Player[] = positions.map((element_type, i) => ({
  element_type, id: i + 1, web_name: 'Player', team_id: 1, team_short_name: 'ARS',
  now_cost: 5, total_points: 42, status: 'a', expected_points_next: 1,
}));
const rows = market.map(p => ({id: p.id, expected_points_next: 5}));
const response = { status: 'optimal' as const, starting_xi: rows.slice(0,11), bench: rows.slice(11),
  captain_id: 5, vice_captain_id: 9, total_expected_points: 60, total_cost: 75 };
const run = () => solveOptimizer(config, signal);

it('posts the configuration and maps the backend lineup in response order', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(response);
  const result = mapOptimizerResponse(await run(), market);
  expect(post).toHaveBeenCalledWith('/optimizer/solve', {budget: 96, locked_player_ids: [1],
    excluded_player_ids: [80], target_formation: null}, {signal});
  expect(result.formation).toBe('3-4-3');
  expect(result.starting_xi.map(p => p.slotIndex)).toEqual([0,0,1,2,0,1,2,3,0,1,2]);
  expect(result.bench.map(p => p.slotIndex)).toEqual([1,0,2,3]);
  expect(result.starting_xi[4]).toMatchObject({isCaptain: true, team_short_name: 'ARS', expected_points_next: 5});
  expect(result.starting_xi[8].isViceCaptain).toBe(true);
});

it('maps a full market by ID and sends an explicit formation', async () => {
  const fullMarket = Array.from({ length: 700 }, (_, i) => ({ ...market[i % 15], id: i + 1 }));
  const bench = response.bench.map(row => ({ ...row, id: row.id + 675 }));
  const post = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ ...response, bench, formation: '3-4-3' });
  const solved = await solveOptimizer({ ...config, targetFormation: '3-4-3' }, signal);
  expect(post).toHaveBeenCalledWith('/optimizer/solve', expect.objectContaining({ target_formation: '3-4-3' }), { signal });
  expect(mapOptimizerResponse(solved, fullMarket).bench.map(p => p.id)).toEqual(bench.map(p => p.id));
});

it('reports unknown IDs', () => {
  expect(() => mapOptimizerResponse(response, [])).toThrow(/chưa đồng bộ/i);
});

it('shows the infeasibility explanation', async () => {
  vi.spyOn(apiClient, 'post').mockResolvedValueOnce({status: 'infeasible', message: 'Budget too low'});
  await expect(run()).rejects.toThrow('Budget too low');
});

it.each([
  [new ApiError('', 429, null, new Headers({'Retry-After': '17'})), '17 giây'],
  [new ApiError('', 429), '60 giây'],
  [new ApiError('', 503), 'máy chủ đang bận'],
  [new DOMException('', 'AbortError'), 'máy chủ đang bận'],
] as const)('explains request failure %#', async (error, message) => {
  vi.spyOn(apiClient, 'post').mockRejectedValueOnce(error);
  await expect(run()).rejects.toThrow(new RegExp(message, 'i'));
});
