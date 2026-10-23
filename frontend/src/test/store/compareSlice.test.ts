import { describe, it, expect, beforeEach } from 'vitest';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

// Test the compareSlice reducer logic directly
import compareReducer, {
  toggleCompare,
  removeFromCompare,
  clearCompare,
  type CompareItem,
} from '../../store/slices/compareSlice';

describe('compareSlice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should start with empty items', () => {
    const state = compareReducer(undefined, { type: 'init' });
    expect(state.items).toEqual([]);
  });

  it('should add an item via toggleCompare', () => {
    const item: CompareItem = { id: '1', name: 'Product 1', price: 10, image: 'img.jpg' };
    const state = compareReducer(undefined, toggleCompare(item));
    expect(state.items).toHaveLength(1);
    expect(state.items[0].id).toBe('1');
  });

  it('should remove an item when toggled again', () => {
    const item: CompareItem = { id: '1', name: 'Product 1', price: 10, image: 'img.jpg' };
    let state = compareReducer(undefined, toggleCompare(item));
    state = compareReducer(state, toggleCompare(item));
    expect(state.items).toHaveLength(0);
  });

  it('should cap at 4 items (drops oldest)', () => {
    let state = compareReducer(undefined, { type: 'init' });
    for (let i = 0; i < 5; i++) {
      state = compareReducer(state, toggleCompare({
        id: `p-${i}`,
        name: `Product ${i}`,
        price: i * 10,
        image: 'img.jpg',
      }));
    }
    expect(state.items).toHaveLength(4);
    // oldest (p-0) should have been dropped
    expect(state.items.find((i) => i.id === 'p-0')).toBeUndefined();
    // newest (p-4) should be present
    expect(state.items.find((i) => i.id === 'p-4')).toBeDefined();
  });

  it('should remove a specific item via removeFromCompare', () => {
    const item: CompareItem = { id: '1', name: 'Product 1', price: 10, image: 'img.jpg' };
    let state = compareReducer(undefined, toggleCompare(item));
    state = compareReducer(state, removeFromCompare('1'));
    expect(state.items).toHaveLength(0);
  });

  it('should clear all items via clearCompare', () => {
    let state = compareReducer(undefined, toggleCompare({ id: '1', name: 'A', price: 1, image: '' }));
    state = compareReducer(state, toggleCompare({ id: '2', name: 'B', price: 2, image: '' }));
    state = compareReducer(state, clearCompare());
    expect(state.items).toHaveLength(0);
  });
});
