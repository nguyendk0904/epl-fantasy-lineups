import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorBoundary } from '../ErrorBoundary';

describe('ErrorBoundary Component Unit Tests', () => {
  it('renders children when there is no error', () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary>
        <div data-testid="safe-child">Safe Content</div>
      </ErrorBoundary>
    );
    expect(html).toContain('Safe Content');
  });

  it('correctly updates state via getDerivedStateFromError', () => {
    const error = new Error('Lỗi kiểm thử');
    const state = ErrorBoundary.getDerivedStateFromError(error);
    expect(state.hasError).toBe(true);
    expect(state.error).toBe(error);
  });

  it('renders fallback UI when state has error', () => {
    const boundary = new ErrorBoundary({ children: <div>Safe Content</div> });
    boundary.state = { hasError: true, error: new Error('Lỗi giao diện nghiêm trọng') };
    const html = renderToStaticMarkup(boundary.render() as React.ReactElement);
    expect(html).toContain('Đã xảy ra lỗi không mong muốn');
    expect(html).toContain('Lỗi giao diện nghiêm trọng');
    expect(html).toContain('Thử lại');
  });

  it('renders custom ReactNode fallback when provided', () => {
    const boundary = new ErrorBoundary({
      children: <div>Safe Content</div>,
      fallback: <div className="custom-fallback">Custom Error Fallback</div>,
    });
    boundary.state = { hasError: true, error: new Error('Some error') };
    const html = renderToStaticMarkup(boundary.render() as React.ReactElement);
    expect(html).toContain('Custom Error Fallback');
  });

  it('renders custom function fallback when provided', () => {
    const boundary = new ErrorBoundary({
      children: <div>Safe Content</div>,
      fallback: (error) => <div className="fn-fallback">Callback: {error.message}</div>,
    });
    boundary.state = { hasError: true, error: new Error('Function error') };
    const html = renderToStaticMarkup(boundary.render() as React.ReactElement);
    expect(html).toContain('Callback: Function error');
  });

  it('invokes onReset callback when handleReset is called', () => {
    const onReset = vi.fn();
    const boundary = new ErrorBoundary({ children: <div>Safe</div>, onReset });
    boundary.setState = vi.fn((newState) => {
      Object.assign(boundary.state, newState);
    });
    boundary.state = { hasError: true, error: new Error('Error') };

    boundary.handleReset();

    expect(boundary.setState).toHaveBeenCalledWith({ hasError: false, error: null });
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
