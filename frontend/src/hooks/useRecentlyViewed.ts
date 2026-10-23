import { useCallback } from 'react';

const STORAGE_KEY = 'recentlyViewed';
const MAX_ITEMS = 8;

/**
 * useRecentlyViewed — tracks product ids the visitor has browsed, stored in
 * localStorage so it works for guests and persists across sessions.
 *
 * The list is most-recent-first, de-duplicated, capped at MAX_ITEMS.
 */
export function useRecentlyViewed() {
  const read = (): string[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
    } catch {
      return [];
    }
  };

  const write = (ids: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // ignore quota / private-mode errors
    }
  };

  // record a view: moves the id to the front, de-dupes, caps the list
  const trackView = useCallback((productId: string) => {
    if (!productId) return;
    const current = read();
    const next = [productId, ...current.filter((id) => id !== productId)].slice(0, MAX_ITEMS);
    write(next);
  }, []);

  const getRecent = useCallback((): string[] => read(), []);

  const clear = useCallback(() => write([]), []);

  return { trackView, getRecent, clear, MAX_ITEMS };
}
