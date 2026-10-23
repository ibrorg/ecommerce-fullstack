import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BackToTop from '../../components/BackToTop';

describe('BackToTop', () => {
  it('should render a button', () => {
    render(<BackToTop />);
    const button = screen.getByLabelText('Back to top');
    expect(button).toBeInTheDocument();
  });

  it('should be hidden initially (not visible)', () => {
    render(<BackToTop />);
    const button = screen.getByLabelText('Back to top');
    // initially hidden via opacity-0 + pointer-events-none
    expect(button.className).toContain('opacity-0');
  });

  it('should have title attribute', () => {
    render(<BackToTop />);
    const button = screen.getByLabelText('Back to top');
    expect(button).toHaveAttribute('title', 'Back to top');
  });
});
