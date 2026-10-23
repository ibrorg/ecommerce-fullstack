import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice?: number;
  images: string[];
  category: string;
  subcategory?: string;
  brand?: string;
  countInStock: number;
  isActive: boolean;
  isFeatured: boolean;
  sku: string;
  tags: string[];
  rating: number;
  numReviews: number;
  createdAt: string;
  updatedAt: string;
}

interface ProductState {
  products: Product[];
  featuredProducts: Product[];
  product: Product | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalProducts: number;
    limit: number;
  };
  filters: {
    category: string;
    priceRange: [number, number];
    rating: number;
    brand: string;
    search: string;
  };
}

const initialState: ProductState = {
  products: [],
  featuredProducts: [],
  product: null,
  isLoading: false,
  error: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalProducts: 0,
    limit: 12,
  },
  filters: {
    category: '',
    priceRange: [0, 1000],
    rating: 0,
    brand: '',
    search: '',
  },
};

// Get all products
export const getProducts = createAsyncThunk(
  'products/getProducts',
  async (params: { page?: number; limit?: number; category?: string; search?: string }, { rejectWithValue }) => {
    try {
      const response = await api.getProducts(
        params.page,
        params.limit,
        params.category,
        undefined,
        undefined,
        params.search
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Failed to fetch products';
      return rejectWithValue(message);
    }
  }
);

// Get single product
export const getProduct = createAsyncThunk(
  'products/getProduct',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await api.getProduct(id);
      return response.data.data || null;
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Failed to fetch product';
      return rejectWithValue(message);
    }
  }
);

// Get featured products
export const getFeaturedProducts = createAsyncThunk(
  'products/getFeaturedProducts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.getFeaturedProducts(8);
      return response.data.data || response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Failed to fetch featured products';
      return rejectWithValue(message);
    }
  }
);

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get products
      .addCase(getProducts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getProducts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.products = action.payload.data;
        state.pagination = {
          currentPage: action.payload.pagination?.page || 1,
          totalPages: action.payload.pagination?.pages || 1,
          totalProducts: action.payload.pagination?.total || action.payload.data?.length || 0,
          limit: action.payload.pagination?.limit || state.pagination.limit,
        };
        state.error = null;
      })
      .addCase(getProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Get single product
      .addCase(getProduct.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getProduct.fulfilled, (state, action) => {
        state.isLoading = false;
        state.product = action.payload;
        state.error = null;
      })
      .addCase(getProduct.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Get featured products
      .addCase(getFeaturedProducts.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getFeaturedProducts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.featuredProducts = action.payload;
        state.error = null;
      })
      .addCase(getFeaturedProducts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setFilters, clearFilters } = productSlice.actions;
export default productSlice.reducer;
