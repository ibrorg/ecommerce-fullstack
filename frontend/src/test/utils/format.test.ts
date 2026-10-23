import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatOrderStatus,
} from '../../utils/format';

describe('formatCurrency', () => {
  it('formats a whole number as USD by default', () => {
    expect(formatCurrency(10)).toBe('$10.00');
  });

  it('formats a fractional amount with two decimals', () => {
    expect(formatCurrency(12.5)).toBe('$12.50');
  });

  it('supports a different currency code', () => {
    expect(formatCurrency(99, 'EUR')).toBe('€99.00');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats negative amounts', () => {
    expect(formatCurrency(-5)).toBe('-$5.00');
  });
});

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    // Use a date that is unambiguous regardless of timezone interpretation.
    // new Date('2025-01-15T12:00:00Z') → "Jan 15, 2025" in en-US.
    expect(formatDate('2025-01-15T12:00:00Z')).toMatch(/Jan.*15, 2025/);
  });

  it('formats a Date instance', () => {
    const d = new Date('2025-06-01T12:00:00Z');
    expect(formatDate(d)).toMatch(/Jun.*1, 2025/);
  });

  it('returns "Invalid date" for bad input', () => {
    expect(formatDate('not-a-date')).toBe('Invalid date');
  });
});

describe('formatOrderStatus', () => {
  it('formats pending', () => {
    expect(formatOrderStatus('pending')).toBe('Pending');
  });

  it('formats processing', () => {
    expect(formatOrderStatus('processing')).toBe('Processing');
  });

  it('formats shipped', () => {
    expect(formatOrderStatus('shipped')).toBe('Shipped');
  });

  it('formats delivered', () => {
    expect(formatOrderStatus('delivered')).toBe('Delivered');
  });

  it('formats cancelled', () => {
    expect(formatOrderStatus('cancelled')).toBe('Cancelled');
  });
});
