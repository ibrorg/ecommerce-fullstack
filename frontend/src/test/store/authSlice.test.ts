import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API client before importing the slice — the thunks call into it
// during their payload creators. Even though these reducer tests never
// execute the thunk bodies, the module-level side effects of `api` (token
// interceptors etc.) are still loaded, so we stub it out for isolation.
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

import authReducer, {
  login,
  logout,
  getCurrentUser,
} from '../../store/slices/authSlice';

// The login thunk's fulfilled payload expects the `User` shape exported from
// `../../types` (which requires `updatedAt`). The authSlice also exports its
// own `User` interface that omits `updatedAt`, so we use a plain object
// literal that structurally satisfies both — no annotation needed.
const mockUser = {
  id: 'u-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  role: 'user' as const,
  isEmailVerified: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockLoginPayload = {
  user: mockUser,
  token: 'tok-abc-123',
  sessionId: 'sess-1',
  expiresIn: 3600,
};

describe('authSlice reducer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the initial state when called with an unknown action', () => {
    const state = authReducer(undefined, { type: 'unknown' });
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.sessionId).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.expiresIn).toBeNull();
  });

  it('login.fulfilled sets the user, token, sessionId, and isAuthenticated', () => {
    const action = login.fulfilled(mockLoginPayload, 'req-1', {
      email: 'jane@example.com',
      password: 'password',
    });
    const state = authReducer(undefined, action);

    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe('tok-abc-123');
    expect(state.sessionId).toBe('sess-1');
    expect(state.expiresIn).toBe(3600);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('logout.fulfilled clears the auth state', () => {
    // Seed an authenticated state first.
    const seeded = authReducer(undefined, login.fulfilled(mockLoginPayload, 'req-1', {
      email: 'jane@example.com',
      password: 'password',
    }));
    expect(seeded.isAuthenticated).toBe(true);

    const action = logout.fulfilled(null, 'req-2');
    const state = authReducer(seeded, action);

    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.sessionId).toBeNull();
    expect(state.expiresIn).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('getCurrentUser.fulfilled sets the user and authenticates', () => {
    const action = getCurrentUser.fulfilled(mockUser, 'req-3');
    const state = authReducer(undefined, action);

    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});
