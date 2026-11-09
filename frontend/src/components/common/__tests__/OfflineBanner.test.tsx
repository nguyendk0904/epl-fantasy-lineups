import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OfflineBanner } from '../OfflineBanner';

describe('OfflineBanner Component Unit Tests', () => {
  it('renders nothing when forceOffline is false and not restored', () => {
    const html = renderToStaticMarkup(<OfflineBanner forceOffline={false} />);
    expect(html).toBe('');
  });

  it('renders alert banner when forceOffline is true', () => {
    const html = renderToStaticMarkup(<OfflineBanner forceOffline={true} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('Đã mất kết nối Internet');
    expect(html).toContain('Kiểm tra lại');
    expect(html).toContain('LocalStorage');
  });

  it('renders action buttons with retry and dismiss', () => {
    const html = renderToStaticMarkup(<OfflineBanner forceOffline={true} onRetry={() => {}} />);
    expect(html).toContain('Kiểm tra lại kết nối');
    expect(html).toContain('Tạm ẩn cảnh báo');
  });
});
