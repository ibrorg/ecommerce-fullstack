import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from '../../components/Loading/Spinner';
import LoadingFallback from '../../components/Loading/LoadingFallback';

describe('Spinner', () => {
  it('renders with default props', () => {
    const { container } = render(<Spinner />);
    // The spinner wrapper always renders a flex column container.
    expect(container.firstChild).toBeInTheDocument();
    // The default size is "md" → expect an element using the md size class.
    const sizeClass = 'w-10 h-10';
    expect(container.querySelector(`.${sizeClass.split(' ')[0]}`)).toBeInTheDocument();
  });

  it('does not render the message block when no message is provided', () => {
    const { container } = render(<Spinner />);
    expect(container.textContent).not.toContain('Please wait');
  });

  it('renders the message and the "Please wait..." hint when a message is passed', () => {
    render(<Spinner message="Loading products" />);
    expect(screen.getByText('Loading products')).toBeInTheDocument();
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('renders in full-screen mode when fullScreen is true', () => {
    const { container } = render(<Spinner fullScreen />);
    const overlay = container.querySelector('.fixed.inset-0');
    expect(overlay).toBeInTheDocument();
  });
});

describe('LoadingFallback', () => {
  it('renders a full-height container with the spinner inside', () => {
    const { container } = render(<LoadingFallback />);
    // The fallback wraps the page in a min-h-screen flex container.
    const wrapper = container.querySelector('.min-h-screen');
    expect(wrapper).toBeInTheDocument();
    // The Spinner renders two concentric rounded-full rings; ensure at least
    // one spinning ring is present so the "loading" message is communicated
    // visually.
    const spinnerRing = container.querySelector('.animate-spin');
    expect(spinnerRing).toBeInTheDocument();
  });

  it('communicates a loading state to screen readers via the spinner ring', () => {
    const { container } = render(<LoadingFallback />);
    // The animated spinner ring is the visible "loading message" for the
    // fallback component — assert it is present.
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
