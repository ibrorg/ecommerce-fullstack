import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// User interface
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'seller' | 'admin';
  avatar?: string;
  isEmailVerified: boolean;
  createdAt: string;
  shippingAddress?: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

// Auth state interface
interface AuthState {
  user: User | null;
  token: string | null;
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  expiresIn: number | null;
}

// Initial state
const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  sessionId: localStorage.getItem('sessionId'),
  isLoading: false,
  error: null,
  isAuthenticated: false,
  expiresIn: null,
};

const persistToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

const persistSessionId = (sessionId: string | null) => {
  if (sessionId) {
    localStorage.setItem('sessionId', sessionId);
  } else {
    localStorage.removeItem('sessionId');
  }
};

const persistUserId = (userId: string | null) => {
  if (userId) {
    localStorage.setItem('userId', userId);
  } else {
    localStorage.removeItem('userId');
  }
};

// Register user
export const register = createAsyncThunk(
  'auth/register',
  async (userData: { name: string; email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await api.register(userData);
      const { token, data, sessionId, expiresIn } = response.data;
      persistToken(token);
      persistSessionId(sessionId);
      persistUserId(data.id);
      return { user: data, token, sessionId, expiresIn };
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Registration failed';
      return rejectWithValue(message);
    }
  }
);

// Login user
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await api.login(credentials);

      const { token, data, success, sessionId, expiresIn } = response.data;

      if (!success) {
        return rejectWithValue('Login failed');
      }

      if (!token) {
        return rejectWithValue('No token received');
      }

      if (!data) {
        return rejectWithValue('No user data received');
      }

      persistToken(token);
      persistSessionId(sessionId);
      persistUserId(data.id);
      return { user: data, token, sessionId, expiresIn };
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Login failed';
      return rejectWithValue(message);
    }
  }
);

// Get current user
export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { auth: AuthState };
      const token = state.auth.token || localStorage.getItem('token');

      if (!token) {
        return rejectWithValue('No token available');
      }

      persistToken(token);
      const response = await api.get('/api/auth/me');
      return response.data.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Failed to get user';
      return rejectWithValue(message);
    }
  }
);

// Logout user
export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    try {
      await api.logout();
      persistToken(null);
      persistSessionId(null);
      persistUserId(null);
      return null;
    } catch (error: any) {
      persistToken(null);
      persistSessionId(null);
      persistUserId(null);
      return null;
    }
  }
);

// Update user details
export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (userData: { name: string; email: string }, { rejectWithValue }) => {
    try {
      const response = await api.put('/api/auth/updatedetails', userData);
      return response.data.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Update failed';
      return rejectWithValue(message);
    }
  }
);

// Change password
export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (passwordData: { currentPassword: string; newPassword: string }, { rejectWithValue }) => {
    try {
      const response = await api.put('/api/auth/updatepassword', passwordData);
      const { token, data, sessionId, expiresIn } = response.data;
      persistToken(token);
      persistSessionId(sessionId);
      persistUserId(data.id);
      return { user: data, token, sessionId, expiresIn };
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Password change failed';
      return rejectWithValue(message);
    }
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.sessionId = null;
      state.isAuthenticated = false;
      state.error = null;
      state.expiresIn = null;
      persistToken(null);
      persistSessionId(null);
      persistUserId(null);
    },
  },
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.sessionId = action.payload.sessionId;
        state.expiresIn = action.payload.expiresIn;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.sessionId = action.payload.sessionId;
        state.expiresIn = action.payload.expiresIn;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      // Get current user
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(getCurrentUser.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.sessionId = null;
        state.isAuthenticated = false;
        persistToken(null);
        persistSessionId(null);
        persistUserId(null);
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.sessionId = null;
        state.isAuthenticated = false;
        state.error = null;
        state.isLoading = false;
        state.expiresIn = null;
      })
      // Update profile
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Change password
      .addCase(changePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.sessionId = action.payload.sessionId;
        state.expiresIn = action.payload.expiresIn;
        state.error = null;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearAuth } = authSlice.actions;
export default authSlice.reducer;
