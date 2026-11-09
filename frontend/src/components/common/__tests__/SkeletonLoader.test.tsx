import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SkeletonLoader } from '../SkeletonLoader';

describe('SkeletonLoader Component Unit Tests', () => {
  it('renders default text skeleton variant', () => {
    const html = renderToStaticMarkup(<SkeletonLoader />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-testid="skeleton-text"');
    expect(html).toContain('animate-pulse');
  });

  it('renders multiple skeleton items when count > 1', () => {
    const html = renderToStaticMarkup(<SkeletonLoader count={4} variant="text" />);
    const matches = html.match(/data-testid="skeleton-text"/g);
    expect(matches?.length).toBe(4);
  });

  it('renders pitch-slot variant for virtual pitch slots', () => {
    const html = renderToStaticMarkup(<SkeletonLoader variant="pitch-slot" count={2} />);
    expect(html).toContain('data-testid="skeleton-pitch-slot"');
  });

  it('renders player-row variant for table loading state', () => {
    const html = renderToStaticMarkup(<SkeletonLoader variant="player-row" count={3} />);
    expect(html).toContain('data-testid="skeleton-player-row"');
  });

  it('renders stat-widget and card variants correctly', () => {
    const htmlWidget = renderToStaticMarkup(<SkeletonLoader variant="stat-widget" />);
    expect(htmlWidget).toContain('data-testid="skeleton-stat-widget"');

    const htmlCard = renderToStaticMarkup(<SkeletonLoader variant="card" />);
    expect(htmlCard).toContain('data-testid="skeleton-card"');
  });
});
