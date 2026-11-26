import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { OptimizerControl } from '../OptimizerControl';

it('disables optimization and explains why in demo mode', () => {
  const html = renderToStaticMarkup(<OptimizerControl availablePlayers={[]} currentSquad={[]}
    onOptimize={vi.fn()} disabled disabledReason="Dữ liệu mẫu" />);
  expect(html).toMatch(/<button[^>]*disabled=""/);
  expect(html).toContain('Dữ liệu mẫu');
});
