import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductBadges from '../../components/ProductBadges';

describe('ProductBadges', () => {
  it('should render nothing when badges array is empty', () => {
    const { container } = render(<ProductBadges badges={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when badges is undefined', () => {
    const { container } = render(<ProductBadges badges={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render badges in inline variant', () => {
    render(<ProductBadges badges={['New', 'Sale']} variant="inline" />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Sale')).toBeInTheDocument();
  });

  it('should render badges in overlay variant', () => {
    render(<ProductBadges badges={['Top Rated', 'Bestseller']} variant="overlay" />);
    expect(screen.getByText('★ Top Rated')).toBeInTheDocument();
    expect(screen.getByText('Bestseller')).toBeInTheDocument();
  });

  it('should cap at 3 badges in overlay variant', () => {
    render(<ProductBadges badges={['New', 'Sale', 'Top Rated', 'Bestseller', 'Low Stock']} variant="overlay" />);
    // overlay shows max 3
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Sale')).toBeInTheDocument();
    expect(screen.getByText('★ Top Rated')).toBeInTheDocument();
    expect(screen.queryByText('Bestseller')).not.toBeInTheDocument();
  });

  it('should filter out unknown badge names', () => {
    const { container } = render(<ProductBadges badges={['UnknownBadge']} />);
    expect(container.firstChild).toBeNull();
  });
});
