import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../../hooks/useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('theme');
  });

  it('should default to light when no stored preference', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
  });

  it('should toggle to dark', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
  });

  it('should toggle back to light', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle()); // to dark
    act(() => result.current.toggle()); // back to light
    expect(result.current.theme).toBe('light');
  });

  it('should add dark class to documentElement when dark', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should remove dark class when toggled back to light', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle()); // dark
    act(() => result.current.toggle()); // light
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should persist theme to localStorage', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
