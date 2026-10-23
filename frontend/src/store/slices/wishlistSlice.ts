import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { AxiosError } from 'axios';
import api from '../../services/api';

// Product shape returned inside wishlist items (subset of full Product).
export interface WishlistProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  category?: string;
  countInStock?: number;
  rating?: number;
  numReviews?: number;
  comparePrice?: number;
}

export interface WishlistItem {
  product: WishlistProduct;
  addedAt: string;
}

interface WishlistState {
  items: WishlistItem[];
  loading: boolean;
  error: string | null;
}

const initialState: WishlistState = {
  items: [],
  loading: false,
  error: null,
};

// The backend may return items at the top level, nested under `data`, or as a
// bare array. Normalize without resorting to `any`.
const extractItems = (body: unknown): WishlistItem[] => {
  if (Array.isArray(body)) return body as WishlistItem[];
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as WishlistItem[];
    if (obj.data && typeof obj.data === 'object') {
      const data = obj.data as Record<string, unknown>;
      if (Array.isArray(data.items)) return data.items as WishlistItem[];
    }
  }
  return [];
};

const errorMessage = (error: unknown, fallback: string): string => {
  const axiosErr = error as AxiosError<{ error?: string; message?: string }>;
  return axiosErr.response?.data?.error || axiosErr.message || fallback;
};

// GET /api/wishlist — populate state with the server wishlist.
export const fetchWishlist = createAsyncThunk<WishlistItem[], void, { rejectValue: string }>(
  'wishlist/fetchWishlist',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/wishlist');
      return extractItems(response.data);
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to fetch wishlist'));
    }
  }
);

// POST /api/wishlist/:productId — add product. The backend response shape is
// not guaranteed to include the full item, so we refresh the wishlist after a
// successful add to keep the local state authoritative.
export const addToWishlist = createAsyncThunk<void, string, { rejectValue: string }>(
  'wishlist/addToWishlist',
  async (productId, { dispatch, rejectWithValue }) => {
    try {
      await api.post(`/api/wishlist/${productId}`);
      await dispatch(fetchWishlist()).unwrap();
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to add to wishlist'));
    }
  }
);

// DELETE /api/wishlist/:productId — remove product.
export const removeFromWishlist = createAsyncThunk<string, string, { rejectValue: string }>(
  'wishlist/removeFromWishlist',
  async (productId, { rejectWithValue }) => {
    try {
      await api.delete(`/api/wishlist/${productId}`);
      return productId;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to remove from wishlist'));
    }
  }
);

// DELETE /api/wishlist — clear all items.
export const clearWishlist = createAsyncThunk<void, void, { rejectValue: string }>(
  'wishlist/clearWishlist',
  async (_, { rejectWithValue }) => {
    try {
      await api.delete('/api/wishlist');
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to clear wishlist'));
    }
  }
);

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    clearWishlistError: (state) => {
      state.error = null;
    },
    // Reset wishlist (used after logout so stale items don't leak).
    resetWishlist: (state) => {
      state.items = [];
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.error = null;
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to fetch wishlist';
      })
      .addCase(removeFromWishlist.fulfilled, (state, action) => {
        state.items = state.items.filter((i) => i.product._id !== action.payload);
      })
      .addCase(removeFromWishlist.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to remove from wishlist';
      })
      .addCase(clearWishlist.fulfilled, (state) => {
        state.items = [];
      })
      .addCase(clearWishlist.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to clear wishlist';
      });
  },
});

export const { clearWishlistError, resetWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
