import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { AxiosError } from 'axios';
import api from '../../services/api';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  countInStock: number;
}

interface ShippingInfo {
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  shippingInfo: ShippingInfo | null;
  loading: boolean;
  error: string | null;
}

// --- Server response shape ---
interface ServerProduct {
  _id: string;
  name: string;
  price: number;
  images?: string[];
  countInStock: number;
}

interface ServerCartItem {
  product: ServerProduct;
  quantity: number;
}

const CART_STORAGE_KEY = 'cartItems';
const SHIPPING_STORAGE_KEY = 'shippingInfo';

const loadItemsFromStorage = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
};

const loadShippingFromStorage = (): ShippingInfo | null => {
  try {
    const raw = localStorage.getItem(SHIPPING_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ShippingInfo;
  } catch {
    return null;
  }
};

const persistItems = (items: CartItem[]) => {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
};

const clearStoredItems = () => {
  localStorage.removeItem(CART_STORAGE_KEY);
};

const persistShipping = (info: ShippingInfo | null) => {
  if (info) {
    localStorage.setItem(SHIPPING_STORAGE_KEY, JSON.stringify(info));
  } else {
    localStorage.removeItem(SHIPPING_STORAGE_KEY);
  }
};

// Map a server cart item into the local CartItem shape so existing
// components (Cart, Checkout, ...) keep working unchanged.
const mapServerItem = (serverItem: ServerCartItem): CartItem => ({
  id: serverItem.product._id,
  name: serverItem.product.name,
  price: serverItem.product.price,
  image: serverItem.product.images?.[0] ?? '',
  quantity: serverItem.quantity,
  countInStock: serverItem.product.countInStock,
});

// The backend may return the items array at the top level, nested under
// `data`, or as a bare array. Normalize all shapes without resorting to `any`.
const extractServerItems = (body: unknown): ServerCartItem[] => {
  if (Array.isArray(body)) return body as ServerCartItem[];
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as ServerCartItem[];
    if (obj.data && typeof obj.data === 'object') {
      const data = obj.data as Record<string, unknown>;
      if (Array.isArray(data.items)) return data.items as ServerCartItem[];
    }
  }
  return [];
};

const calculateTotals = (items: CartItem[]) => {
  const totalItems = items.reduce((total, item) => total + item.quantity, 0);
  const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);
  return { totalItems, totalPrice };
};

const recomputeTotals = (state: CartState) => {
  const totals = calculateTotals(state.items);
  state.totalItems = totals.totalItems;
  state.totalPrice = totals.totalPrice;
};

const initialState: CartState = {
  items: loadItemsFromStorage(),
  totalItems: 0,
  totalPrice: 0,
  shippingInfo: loadShippingFromStorage(),
  loading: false,
  error: null,
};

// Seed totals from whatever was in localStorage so the UI is correct on first paint.
{
  const totals = calculateTotals(initialState.items);
  initialState.totalItems = totals.totalItems;
  initialState.totalPrice = totals.totalPrice;
}

// Narrow the root state to just the auth slice we care about. Done with a
// cast (matching the pattern in authSlice) to avoid a circular import with
// the store.
type AuthAwareState = { auth: { isAuthenticated: boolean } };

const isAuthed = (getState: () => unknown): boolean => {
  const state = getState() as AuthAwareState;
  return Boolean(state.auth?.isAuthenticated);
};

// ---------------------------------------------------------------------------
// Async thunks — server cart operations (authenticated only)
// ---------------------------------------------------------------------------

// GET /api/cart → populate state with the server cart
export const fetchServerCart = createAsyncThunk<CartItem[], void, { rejectValue: string }>(
  'cart/fetchServerCart',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/cart');
      const items = extractServerItems(response.data);
      return items.map(mapServerItem);
    } catch (error) {
      const axiosErr = error as AxiosError<{ error?: string; message?: string }>;
      return rejectWithValue(
        axiosErr.response?.data?.error || axiosErr.message || 'Failed to fetch cart'
      );
    }
  }
);

// POST /api/cart/merge — push guest (localStorage) items into the server cart,
// then clear localStorage so the server becomes the single source of truth.
export const mergeGuestCart = createAsyncThunk<void, void, { rejectValue: string }>(
  'cart/mergeGuestCart',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as { cart: CartState };
    const guestItems = state.cart.items;
    if (guestItems.length === 0) {
      clearStoredItems();
      return;
    }
    try {
      await api.post('/api/cart/merge', {
        items: guestItems.map((item) => ({
          product: item.id,
          quantity: item.quantity,
        })),
      });
      clearStoredItems();
    } catch (error) {
      const axiosErr = error as AxiosError<{ error?: string; message?: string }>;
      return rejectWithValue(
        axiosErr.response?.data?.error || axiosErr.message || 'Failed to merge cart'
      );
    }
  }
);

// POST /api/cart/items { productId, quantity }
export const serverAddToCart = createAsyncThunk<CartItem, CartItem, { rejectValue: string }>(
  'cart/serverAddToCart',
  async (item, { rejectWithValue }) => {
    try {
      await api.post('/api/cart/items', { productId: item.id, quantity: item.quantity });
      return item;
    } catch (error) {
      const axiosErr = error as AxiosError<{ error?: string; message?: string }>;
      return rejectWithValue(
        axiosErr.response?.data?.error || axiosErr.message || 'Failed to add to cart'
      );
    }
  }
);

// PUT /api/cart/items/:productId { quantity }
export const serverUpdateQuantity = createAsyncThunk<
  { id: string; quantity: number },
  { id: string; quantity: number },
  { rejectValue: string }
>('cart/serverUpdateQuantity', async (payload, { rejectWithValue }) => {
  try {
    await api.put(`/api/cart/items/${payload.id}`, { quantity: payload.quantity });
    return payload;
  } catch (error) {
    const axiosErr = error as AxiosError<{ error?: string; message?: string }>;
    return rejectWithValue(
      axiosErr.response?.data?.error || axiosErr.message || 'Failed to update quantity'
    );
  }
});

// DELETE /api/cart/items/:productId
export const serverRemoveFromCart = createAsyncThunk<string, string, { rejectValue: string }>(
  'cart/serverRemoveFromCart',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/api/cart/items/${id}`);
      return id;
    } catch (error) {
      const axiosErr = error as AxiosError<{ error?: string; message?: string }>;
      return rejectWithValue(
        axiosErr.response?.data?.error || axiosErr.message || 'Failed to remove item'
      );
    }
  }
);

// DELETE /api/cart
export const serverClearCart = createAsyncThunk<void, void, { rejectValue: string }>(
  'cart/serverClearCart',
  async (_, { rejectWithValue }) => {
    try {
      await api.delete('/api/cart');
    } catch (error) {
      const axiosErr = error as AxiosError<{ error?: string; message?: string }>;
      return rejectWithValue(
        axiosErr.response?.data?.error || axiosErr.message || 'Failed to clear cart'
      );
    }
  }
);

// ---------------------------------------------------------------------------
// Smart wrapper thunks — these are what UI components dispatch.
// Each one checks auth state and routes to the server thunk or the local
// (localStorage) reducer accordingly. The payload signatures match the
// original sync actions so callers don't need to change.
// ---------------------------------------------------------------------------

export const addToCart = createAsyncThunk<void, CartItem>(
  'cart/addToCart',
  async (item, { dispatch, getState }) => {
    if (isAuthed(getState)) {
      await dispatch(serverAddToCart(item)).unwrap();
    } else {
      dispatch(localAddToCart(item));
    }
  }
);

export const updateQuantity = createAsyncThunk<void, { id: string; quantity: number }>(
  'cart/updateQuantity',
  async (payload, { dispatch, getState }) => {
    if (isAuthed(getState)) {
      await dispatch(serverUpdateQuantity(payload)).unwrap();
    } else {
      dispatch(localUpdateQuantity(payload));
    }
  }
);

export const removeFromCart = createAsyncThunk<void, string>(
  'cart/removeFromCart',
  async (id, { dispatch, getState }) => {
    if (isAuthed(getState)) {
      await dispatch(serverRemoveFromCart(id)).unwrap();
    } else {
      dispatch(localRemoveFromCart(id));
    }
  }
);

export const clearCart = createAsyncThunk<void, void>(
  'cart/clearCart',
  async (_, { dispatch, getState }) => {
    if (isAuthed(getState)) {
      await dispatch(serverClearCart()).unwrap();
    } else {
      dispatch(localClearCart());
    }
  }
);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    // --- Local (guest) reducers: state + localStorage only ---
    localAddToCart: (state, action: PayloadAction<CartItem>) => {
      const item = action.payload;
      const existing = state.items.find((x) => x.id === item.id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        state.items.push(item);
      }
      recomputeTotals(state);
      persistItems(state.items);
    },
    localRemoveFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((i) => i.id !== action.payload);
      recomputeTotals(state);
      persistItems(state.items);
    },
    localUpdateQuantity: (state, action: PayloadAction<{ id: string; quantity: number }>) => {
      const { id, quantity } = action.payload;
      const item = state.items.find((x) => x.id === id);
      if (item) {
        item.quantity = quantity;
      }
      recomputeTotals(state);
      persistItems(state.items);
    },
    localClearCart: (state) => {
      state.items = [];
      state.totalItems = 0;
      state.totalPrice = 0;
      clearStoredItems();
    },
    saveShippingInfo: (state, action: PayloadAction<ShippingInfo | null>) => {
      state.shippingInfo = action.payload;
      persistShipping(action.payload);
    },
    // Reload cart from localStorage (used after logout so the guest cart
    // reappears if the user had one before authenticating).
    resetCart: (state) => {
      state.items = loadItemsFromStorage();
      recomputeTotals(state);
      state.loading = false;
      state.error = null;
    },
    clearCartError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchServerCart
      .addCase(fetchServerCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchServerCart.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        recomputeTotals(state);
      })
      .addCase(fetchServerCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to fetch cart';
      })
      // mergeGuestCart — localStorage is cleared inside the thunk; the
      // actual cart contents are refreshed by a follow-up fetchServerCart.
      .addCase(mergeGuestCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(mergeGuestCart.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(mergeGuestCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to merge cart';
      })
      // serverAddToCart
      .addCase(serverAddToCart.fulfilled, (state, action) => {
        const item = action.payload;
        const existing = state.items.find((x) => x.id === item.id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          state.items.push(item);
        }
        recomputeTotals(state);
      })
      .addCase(serverAddToCart.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to add to cart';
      })
      // serverUpdateQuantity
      .addCase(serverUpdateQuantity.fulfilled, (state, action) => {
        const { id, quantity } = action.payload;
        const item = state.items.find((x) => x.id === id);
        if (item) {
          item.quantity = quantity;
        }
        recomputeTotals(state);
      })
      .addCase(serverUpdateQuantity.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to update quantity';
      })
      // serverRemoveFromCart
      .addCase(serverRemoveFromCart.fulfilled, (state, action) => {
        state.items = state.items.filter((i) => i.id !== action.payload);
        recomputeTotals(state);
      })
      .addCase(serverRemoveFromCart.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to remove item';
      })
      // serverClearCart
      .addCase(serverClearCart.fulfilled, (state) => {
        state.items = [];
        state.totalItems = 0;
        state.totalPrice = 0;
      })
      .addCase(serverClearCart.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to clear cart';
      });
  },
});

export const {
  localAddToCart,
  localRemoveFromCart,
  localUpdateQuantity,
  localClearCart,
  saveShippingInfo,
  resetCart,
  clearCartError,
} = cartSlice.actions;

export default cartSlice.reducer;
