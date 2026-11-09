import React from 'react';

export interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Đang tải dữ liệu...',
  size = 'md',
  fullScreen = false,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4',
  }[size];

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-4 gap-3 ${className}`}
    >
      <div
        className={`${sizeClasses} border-brand-skyblue border-t-transparent rounded-full animate-spin shadow-lg shadow-brand-skyblue/20`}
      />
      {message && (
        <p className="text-xs sm:text-sm font-medium text-brand-skyblue-light tracking-wide animate-pulse">
          {message}
        </p>
      )}
      <span className="sr-only">Đang tải...</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-darker/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingSpinner;
