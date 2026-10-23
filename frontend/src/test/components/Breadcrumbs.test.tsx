import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';

describe('Breadcrumbs', () => {
  it('should render breadcrumb items', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Products', href: '/products' }, { label: 'Product A' }]} />
      </MemoryRouter>
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Product A')).toBeInTheDocument();
  });

  it('should mark the last item as current page', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: 'Products', href: '/products' }, { label: 'Product A' }]} />
      </MemoryRouter>
    );
    const lastItem = screen.getByText('Product A');
    expect(lastItem).toHaveAttribute('aria-current', 'page');
  });

  it('should render home icon link', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: 'Products' }]} />
      </MemoryRouter>
    );
    const homeLink = screen.getByLabelText('Home');
    expect(homeLink).toBeInTheDocument();
  });
});
