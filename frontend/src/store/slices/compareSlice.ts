import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface CompareItem {
  id: string;
  name: string;
  price: number;
  image: string;
}

interface CompareState {
  items: CompareItem[];
}

// compare list lives in localStorage so it survives reloads / sessions,
// matching the cart + recently-viewed persistence pattern.
const STORAGE_KEY = 'compareItems';
const MAX_ITEMS = 4;

const loadFromStorage = (): CompareItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
};

const saveToStorage = (items: CompareItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / private-mode errors
  }
};

const initialState: CompareState = {
  items: loadFromStorage(),
};

const compareSlice = createSlice({
  name: 'compare',
  initialState,
  reducers: {
    toggleCompare(state, action: PayloadAction<CompareItem>) {
      const item = action.payload;
      const exists = state.items.some((i) => i.id === item.id);
      if (exists) {
        state.items = state.items.filter((i) => i.id !== item.id);
      } else {
        if (state.items.length >= MAX_ITEMS) {
          // drop the oldest to make room — most-recently-added stays
          state.items = [...state.items.slice(1), item];
        } else {
          state.items = [...state.items, item];
        }
      }
      saveToStorage(state.items);
    },
    removeFromCompare(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.id !== action.payload);
      saveToStorage(state.items);
    },
    clearCompare(state) {
      state.items = [];
      saveToStorage(state.items);
    },
  },
});

export const { toggleCompare, removeFromCompare, clearCompare } = compareSlice.actions;
export default compareSlice.reducer;
