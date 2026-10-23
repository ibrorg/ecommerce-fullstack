import { useState, useCallback } from 'react';

const STORAGE_KEY = 'searchHistory';
const MAX_ITEMS = 8;

export interface SearchHistoryEntry {
  query: string;
  timestamp: number;
}

/**
 * useSearchHistory — tracks recent search queries in localStorage.
 * Provides add/remove/clear + the list itself. Most recent first.
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
    } catch {
      return [];
    }
  });

  const addSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;

    setHistory((prev) => {
      // remove duplicates + add to front
      const filtered = prev.filter((h) => h.query !== trimmed);
      const next = [{ query: trimmed, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, []);

  const removeSearch = useCallback((query: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.query !== query);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { history, addSearch, removeSearch, clearHistory };
}
