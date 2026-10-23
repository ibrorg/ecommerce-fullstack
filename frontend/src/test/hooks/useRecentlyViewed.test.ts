import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecentlyViewed } from '../../hooks/useRecentlyViewed';

describe('useRecentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return empty array initially', () => {
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current.getRecent()).toEqual([]);
  });

  it('should track a product view', () => {
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => {
      result.current.trackView('product-1');
    });
    expect(result.current.getRecent()).toEqual(['product-1']);
  });

  it('should move a re-viewed product to the front', () => {
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => {
      result.current.trackView('product-1');
      result.current.trackView('product-2');
      result.current.trackView('product-1');
    });
    expect(result.current.getRecent()).toEqual(['product-1', 'product-2']);
  });

  it('should cap at MAX_ITEMS (8)', () => {
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.trackView(`product-${i}`);
      }
    });
    expect(result.current.getRecent()).toHaveLength(8);
    expect(result.current.getRecent()[0]).toBe('product-9');
  });

  it('should clear all items', () => {
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => {
      result.current.trackView('product-1');
      result.current.trackView('product-2');
      result.current.clear();
    });
    expect(result.current.getRecent()).toEqual([]);
  });

  it('should persist to localStorage', () => {
    const { result, unmount } = renderHook(() => useRecentlyViewed());
    act(() => {
      result.current.trackView('product-1');
    });
    unmount();

    const stored = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    expect(stored).toEqual(['product-1']);
  });
});
