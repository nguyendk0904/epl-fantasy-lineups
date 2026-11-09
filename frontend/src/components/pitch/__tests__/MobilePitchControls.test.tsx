import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobilePitchControls } from '../MobilePitchControls';

describe('MobilePitchControls Component Unit Tests', () => {
  it('renders quick stats with bank and player count', () => {
    const html = renderToStaticMarkup(
      <MobilePitchControls
        formation="4-3-3"
        onFormationChange={() => {}}
        remainingBudget={12.5}
        totalPlayers={14}
      />
    );

    expect(html).toContain('£12.5m');
    expect(html).toContain('14/15');
    expect(html).toContain('4-3-3');
  });

  it('renders all common formation options', () => {
    const html = renderToStaticMarkup(
      <MobilePitchControls
        formation="3-4-3"
        onFormationChange={() => {}}
      />
    );

    expect(html).toContain('3-4-3');
    expect(html).toContain('4-3-3');
    expect(html).toContain('3-5-2');
    expect(html).toContain('4-4-2');
    expect(html).toContain('5-3-2');
    expect(html).toContain('5-4-1');
  });

  it('renders action buttons when handlers are provided', () => {
    const html = renderToStaticMarkup(
      <MobilePitchControls
        formation="4-3-3"
        onFormationChange={() => {}}
        onOpenPlayerDrawer={() => {}}
        onAutoOptimize={() => {}}
        onShare={() => {}}
      />
    );

    expect(html).toContain('Thêm');
    expect(html).toContain('Tối ưu');
    expect(html).toContain('aria-label="Chia sẻ đội hình"');
  });
});
