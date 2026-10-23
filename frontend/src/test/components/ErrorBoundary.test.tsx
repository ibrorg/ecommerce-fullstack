import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Component that always throws during render so we can exercise the boundary.
const ThrowOnRender: React.FC<{ message: string }> = ({ message }) => {
  throw new Error(message);
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught render errors to console.error — silence that noise
    // so the test output stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders the fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender message="boom" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText('An unexpected error occurred while rendering this page.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  });

  it('shows the error message from the thrown error', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender message="custom-error-message" />
      </ErrorBoundary>
    );

    expect(screen.getByText('custom-error-message')).toBeInTheDocument();
  });
});
