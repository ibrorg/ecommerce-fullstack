import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDebounce } from '../../hooks/useDebounce';

describe('useDebounce', () => {
  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 50), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    expect(result.current).toBe('a'); // not yet updated

    await waitFor(() => expect(result.current).toBe('ab'));
  });

  it('should reset the timer on rapid changes', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 50), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    // wait a bit but less than the delay
    await new Promise((r) => setTimeout(r, 30));
    rerender({ value: 'abc' });
    expect(result.current).toBe('a'); // timer was reset

    await waitFor(() => expect(result.current).toBe('abc'));
  });

  it('should work with numbers', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 50), {
      initialProps: { value: 0 },
    });

    rerender({ value: 42 });
    await waitFor(() => expect(result.current).toBe(42));
  });
});
