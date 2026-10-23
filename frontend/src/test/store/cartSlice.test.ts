import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API client so importing the slice does not pull in axios.
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import cartReducer, {
  localAddToCart,
  localRemoveFromCart,
  localUpdateQuantity,
  localClearCart,
  type CartItem,
} from '../../store/slices/cartSlice';

const makeItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  id: 'p-1',
  name: 'Test Product',
  price: 10,
  image: 'img.png',
  quantity: 1,
  countInStock: 5,
  ...overrides,
});

describe('cartSlice reducer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the initial state with empty items and zero totals', () => {
    const state = cartReducer(undefined, { type: 'unknown' });
    expect(state.items).toEqual([]);
    expect(state.totalItems).toBe(0);
    expect(state.totalPrice).toBe(0);
    expect(state.shippingInfo).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('localAddToCart adds a new item and recomputes totals', () => {
    const item = makeItem({ id: 'p-1', price: 10, quantity: 2 });
    const state = cartReducer(undefined, localAddToCart(item));

    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toEqual(item);
    expect(state.totalItems).toBe(2);
    expect(state.totalPrice).toBe(20);
  });

  it('localAddToCart merges quantity when adding an existing item', () => {
    const item = makeItem({ id: 'p-1', price: 10, quantity: 1 });
    let state = cartReducer(undefined, localAddToCart(item));
    state = cartReducer(state, localAddToCart(item));

    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(2);
    expect(state.totalItems).toBe(2);
    expect(state.totalPrice).toBe(20);
  });

  it('localRemoveFromCart removes the item and recomputes totals', () => {
    const a = makeItem({ id: 'p-1', price: 10, quantity: 2 });
    const b = makeItem({ id: 'p-2', name: 'Other', price: 5, quantity: 1 });
    let state = cartReducer(undefined, localAddToCart(a));
    state = cartReducer(state, localAddToCart(b));
    expect(state.totalItems).toBe(3);

    state = cartReducer(state, localRemoveFromCart('p-1'));

    expect(state.items).toHaveLength(1);
    expect(state.items[0].id).toBe('p-2');
    expect(state.totalItems).toBe(1);
    expect(state.totalPrice).toBe(5);
  });

  it('localUpdateQuantity updates the quantity and recomputes totals', () => {
    const item = makeItem({ id: 'p-1', price: 10, quantity: 1 });
    let state = cartReducer(undefined, localAddToCart(item));

    state = cartReducer(state, localUpdateQuantity({ id: 'p-1', quantity: 5 }));

    expect(state.items[0].quantity).toBe(5);
    expect(state.totalItems).toBe(5);
    expect(state.totalPrice).toBe(50);
  });

  it('localClearCart empties items and resets totals', () => {
    const item = makeItem({ id: 'p-1', price: 10, quantity: 3 });
    let state = cartReducer(undefined, localAddToCart(item));
    expect(state.totalItems).toBe(3);

    state = cartReducer(state, localClearCart());

    expect(state.items).toEqual([]);
    expect(state.totalItems).toBe(0);
    expect(state.totalPrice).toBe(0);
  });

  it('totalItems and totalPrice are computed correctly across multiple items', () => {
    const a = makeItem({ id: 'p-1', price: 12.5, quantity: 2 });
    const b = makeItem({ id: 'p-2', name: 'Other', price: 7.25, quantity: 4 });
    let state = cartReducer(undefined, localAddToCart(a));
    state = cartReducer(state, localAddToCart(b));

    // totalItems = 2 + 4 = 6
    expect(state.totalItems).toBe(6);
    // totalPrice = 12.5*2 + 7.25*4 = 25 + 29 = 54
    expect(state.totalPrice).toBeCloseTo(54, 6);
  });
});
