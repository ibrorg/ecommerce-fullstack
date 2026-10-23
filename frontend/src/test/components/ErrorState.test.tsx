import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorState from '../../components/ErrorState';

describe('ErrorState', () => {
  it('should render the default title and message', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/load this right now/i)).toBeInTheDocument();
  });

  it('should render a custom title and message', () => {
    render(<ErrorState title="Custom error" message="Something broke" />);
    expect(screen.getByText('Custom error')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('should render a retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    const button = screen.getByText('Try again');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should not render a retry button when onRetry is not provided', () => {
    render(<ErrorState />);
    expect(screen.queryByText('Try again')).not.toBeInTheDocument();
  });

  it('should render compact variant with smaller text', () => {
    render(<ErrorState compact title="Mini error" />);
    expect(screen.getByText('Mini error')).toBeInTheDocument();
  });
});
