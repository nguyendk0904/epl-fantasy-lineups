import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner Component Unit Tests', () => {
  it('renders with default loading message', () => {
    const html = renderToStaticMarkup(<LoadingSpinner />);
    expect(html).toContain('Đang tải dữ liệu...');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('renders with custom message', () => {
    const html = renderToStaticMarkup(<LoadingSpinner message="Đang tối ưu đội hình..." />);
    expect(html).toContain('Đang tối ưu đội hình...');
  });

  it('renders small, medium, and large sizes', () => {
    const htmlSm = renderToStaticMarkup(<LoadingSpinner size="sm" />);
    expect(htmlSm).toContain('w-5 h-5');

    const htmlMd = renderToStaticMarkup(<LoadingSpinner size="md" />);
    expect(htmlMd).toContain('w-10 h-10');

    const htmlLg = renderToStaticMarkup(<LoadingSpinner size="lg" />);
    expect(htmlLg).toContain('w-16 h-16');
  });

  it('renders fullScreen backdrop container when fullScreen is true', () => {
    const html = renderToStaticMarkup(<LoadingSpinner fullScreen />);
    expect(html).toContain('fixed inset-0');
    expect(html).toContain('backdrop-blur-sm');
  });
});
