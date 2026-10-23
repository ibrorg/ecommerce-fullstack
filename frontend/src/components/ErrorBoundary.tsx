import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

// catches render errors so the whole app doesn't white-screen
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined as Error | undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 p-4">
          <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-lg shadow p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Something went wrong</h1>
            <p className="text-gray-600 dark:text-neutral-400 mb-6">
              An unexpected error occurred while rendering this page.
            </p>
            <pre className="text-xs text-left bg-gray-100 dark:bg-neutral-800 p-3 rounded mb-4 overflow-auto max-h-32">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white transition"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
