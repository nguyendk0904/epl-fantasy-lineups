import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full max-w-lg mx-auto my-8 p-6 rounded-2xl bg-brand-card/90 border border-brand-hotpink/40 shadow-2xl backdrop-blur-md text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-brand-hotpink/20 text-brand-hotpink-light flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-brand-hotpink" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Đã xảy ra lỗi không mong muốn</h3>
            <p className="text-xs text-brand-muted mt-1.5 leading-relaxed font-mono bg-black/30 p-2.5 rounded-lg border border-white/5 break-words">
              {this.state.error.message || 'Lỗi không xác định'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-brand-skyblue hover:bg-brand-skyblue-light text-brand-darker font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Thử lại</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-brand-card hover:bg-brand-card-hover border border-white/10 text-brand-white font-semibold text-xs transition-colors"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
