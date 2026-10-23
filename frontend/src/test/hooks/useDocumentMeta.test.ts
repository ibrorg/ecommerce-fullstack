import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

describe('useDocumentMeta', () => {
  afterEach(() => {
    document.title = 'E-Shop — Full Stack E-Commerce';
    document.head.querySelectorAll('meta[property^="og:"]').forEach((m) => m.remove());
    document.head.querySelectorAll('meta[name^="twitter:"]').forEach((m) => m.remove());
    document.head.querySelectorAll('link[rel="canonical"]').forEach((l) => l.remove());
  });

  it('should set the document title', () => {
    renderHook(() => useDocumentMeta({ title: 'Test Page' }));
    expect(document.title).toBe('Test Page — E-Shop');
  });

  it('should not double-append E-Shop if title already contains it', () => {
    renderHook(() => useDocumentMeta({ title: 'E-Shop — Home' }));
    expect(document.title).toBe('E-Shop — Home');
  });

  it('should set meta description', () => {
    renderHook(() => useDocumentMeta({ title: 'Test', description: 'A test page' }));
    const desc = document.head.querySelector('meta[name="description"]');
    expect(desc).toBeTruthy();
    expect(desc?.getAttribute('content')).toBe('A test page');
  });

  it('should set canonical link', () => {
    renderHook(() => useDocumentMeta({ title: 'Test', canonicalUrl: 'https://example.com/page' }));
    const link = document.head.querySelector('link[rel="canonical"]');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('https://example.com/page');
  });

  it('should set og:title meta tag', () => {
    renderHook(() => useDocumentMeta({ title: 'Test Page' }));
    const ogTitle = document.head.querySelector('meta[property="og:title"]');
    expect(ogTitle).toBeTruthy();
    expect(ogTitle?.getAttribute('content')).toBe('Test Page — E-Shop');
  });

  it('should reset title on unmount', () => {
    const { unmount } = renderHook(() => useDocumentMeta({ title: 'Temp' }));
    expect(document.title).toBe('Temp — E-Shop');
    unmount();
    expect(document.title).toBe('E-Shop — Full Stack E-Commerce');
  });
});
