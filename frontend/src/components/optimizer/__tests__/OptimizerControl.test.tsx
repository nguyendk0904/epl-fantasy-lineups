// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { OptimizerControl } from '../OptimizerControl';

it('disables optimization and explains why in demo mode', () => {
  const html = renderToStaticMarkup(<OptimizerControl availablePlayers={[]} currentSquad={[]}
    onOptimize={vi.fn()} disabled disabledReason="Dữ liệu mẫu" />);
  expect(html).toMatch(/<button[^>]*disabled=""/);
  expect(html).toContain('Dữ liệu mẫu');
});

it('keeps locks and exclusions across searches of the full market', () => {
  const players = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1, web_name: `Player ${i + 1}`, team_id: 1, element_type: 'MID' as const,
    now_cost: 5, total_points: 10,
  }));
  const host = document.createElement('div');
  const root = createRoot(host);
  const optimize = vi.fn().mockResolvedValue(null);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  try {
    act(() => root.render(<OptimizerControl availablePlayers={players} currentSquad={[]} onOptimize={optimize} />));
    expect(host.textContent).toContain('Player 20');
    const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    function filter(name: string) {
      search.value = name;
      act(() => Simulate.change(search));
    }
    filter('PLAYER 19');
    expect(host.textContent).not.toContain('Player 20');
    act(() => host.querySelector<HTMLButtonElement>('[title="Bắt buộc đá chính"]')!.click());
    filter('Player 20');
    act(() => host.querySelector<HTMLButtonElement>('[title="Loại trừ khỏi thuật toán"]')!.click());
    act(() => Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes('Tối Ưu Hóa'))!.click());
    expect(optimize).toHaveBeenCalledWith(expect.objectContaining({ lockedPlayerIds: [19], excludedPlayerIds: [20] }));
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
