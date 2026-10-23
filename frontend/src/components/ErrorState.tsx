import React from 'react';
import { FiAlertTriangle, FiRefreshCw, FiLifeBuoy } from 'react-icons/fi';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  // compact variant for inline use (e.g. inside a section)
  compact?: boolean;
  // show a "contact support" link at the bottom (default: false)
  showSupport?: boolean;
}

/**
 * ErrorState — reusable error display for failed API calls. Shows an icon,
 * message, and optional retry button. Used in place of silent empty states
 * when the failure is a network/server error rather than "no data".
 *
 * The icon container has a subtle pulse so the error is visually alive without
 * being distracting. `showSupport` adds a small "Need help?" link below the
 * retry button for high-stakes surfaces (checkout, order detail).
 */
const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We couldn’t load this right now. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  className = '',
  compact = false,
  showSupport = false,
}) => {
  if (compact) {
    return (
      <div className={`flex flex-col items-center justify-center text-center py-8 ${className}`}>
        <FiAlertTriangle className="text-amber-500 mb-3 animate-pulse-slow" size={28} />
        <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100 mb-1">{title}</p>
        <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-200 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-neutral-700 active:scale-95 transition-all"
          >
            <FiRefreshCw size={12} />
            {retryLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 ${className}`}>
      <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mb-5 animate-pulse-slow">
        <FiAlertTriangle className="text-amber-500" size={28} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-neutral-400 mb-6 max-w-sm">{message}</p>
      <div className="flex flex-col items-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white dark:bg-neutral-100 dark:text-neutral-900 text-sm font-semibold hover:bg-gray-900 dark:hover:bg-white active:scale-95 transition-all"
          >
            <FiRefreshCw size={14} />
            {retryLabel}
          </button>
        )}
        {showSupport && (
          <a
            href="https://github.com/ibrorg"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors"
          >
            <FiLifeBuoy size={12} />
            Need help? Contact support
          </a>
        )}
      </div>
    </div>
  );
};

export default ErrorState;
