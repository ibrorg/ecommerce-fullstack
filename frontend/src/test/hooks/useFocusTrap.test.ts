import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

describe('useFocusTrap', () => {
  it('should not throw when container is null and inactive', () => {
    expect(() => {
      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        useFocusTrap(ref, false);
      });
    }).not.toThrow();
  });

  it('should not throw when container is null and active', () => {
    // active=true but ref.current is null — hook should handle gracefully
    expect(() => {
      renderHook(() => {
        const ref = useRef<HTMLDivElement>(null);
        useFocusTrap(ref, true);
      });
    }).not.toThrow();
  });
});
