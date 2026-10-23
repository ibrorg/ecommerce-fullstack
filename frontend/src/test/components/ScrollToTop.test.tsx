import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ScrollToTop from '../../components/ScrollToTop';

describe('ScrollToTop', () => {
  it('should render null (no visible output)', () => {
    const { container } = render(
      <MemoryRouter>
        <ScrollToTop />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('should not throw on route change', () => {
    expect(() => {
      render(
        <MemoryRouter initialEntries={['/page1']}>
          <ScrollToTop />
          <Routes>
            <Route path="/page1" element={<div>Page 1</div>} />
            <Route path="/page2" element={<div>Page 2</div>} />
          </Routes>
        </MemoryRouter>
      );
    }).not.toThrow();
  });
});
