import { useEffect, useRef, Suspense, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';

// Store
import { store } from './store';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { getCurrentUser } from './store/slices/authSlice';
import { mergeGuestCart, fetchServerCart, resetCart } from './store/slices/cartSlice';

// Layout
import { Layout } from './components/Layout';

// Loading components
import { PageLoader, LoadingFallback } from './components/Loading';

// Configuration Provider
import { ConfigProvider } from './context/ConfigContext';

// Error boundary
import { ErrorBoundary } from './components/ErrorBoundary';
import NotFound from './components/NotFound';
import ScrollToTop from './components/ScrollToTop';

// Route configuration and guards
import {
  publicRoutes,
  authRoutes,
  protectedRoutes,
  adminRoutes,
  sellerRoutes
} from './config/routes';
import type { RouteConfig } from './config/routes';

import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import SellerRoute from './components/SellerRoute';

/**
 * AppContent component - handles routing and auth logic
 */
function AppContent() {
  const dispatch = useAppDispatch();
  const { token, isAuthenticated, isLoading: authLoading } = useAppSelector((state) => state.auth);
  const [appReady, setAppReady] = useState(false);

  // Track whether we've already synced the cart for the current auth session
  // so we merge + fetch exactly once on login (and reload guest state on logout).
  const cartSyncedRef = useRef(false);

  // Get current user on mount if token exists
  useEffect(() => {
    if (token && !isAuthenticated) {
      dispatch(getCurrentUser()).finally(() => {
        setAppReady(true);
      });
    } else {
      setAppReady(true);
    }
  }, [dispatch, token, isAuthenticated]);

  // Sync cart with the server whenever the auth state transitions.
  //   false → true (login / session restore): push any guest cart to the
  //     server via mergeGuestCart, then fetch the authoritative server cart.
  //   true → false (logout): reload the cart from localStorage so the guest
  //     cart reappears if one existed before authentication.
  useEffect(() => {
    if (isAuthenticated && !cartSyncedRef.current) {
      cartSyncedRef.current = true;
      const syncCart = async () => {
        try {
          await dispatch(mergeGuestCart()).unwrap();
        } catch {
          // Merge may fail (e.g. empty cart or transient error); still
          // pull the server cart so the UI reflects the source of truth.
        }
        dispatch(fetchServerCart());
      };
      void syncCart();
    } else if (!isAuthenticated && cartSyncedRef.current) {
      cartSyncedRef.current = false;
      dispatch(resetCart());
    }
  }, [isAuthenticated, dispatch]);

  /**
   * Render route with appropriate guards
   */
  const renderRoute = (route: RouteConfig, guard?: 'admin' | 'seller') => {
    const Component = route.component;

    if (guard === 'admin') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <AdminRoute><Component /></AdminRoute>
        </Suspense>
      );
    }
    if (guard === 'seller') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <SellerRoute><Component /></SellerRoute>
        </Suspense>
      );
    }
    if (route.protected) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <PrivateRoute><Component /></PrivateRoute>
        </Suspense>
      );
    }

    // Auth routes - redirect if already authenticated
    if (authRoutes.some((r) => r.path === route.path) && isAuthenticated) {
      return <Navigate to="/" replace />;
    }

    return (
      <Suspense fallback={<LoadingFallback />}>
        <Component />
      </Suspense>
    );
  };

  return (
    <>
      <PageLoader isLoading={!appReady || authLoading} message="Loading app..." />
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Admin routes - NOT wrapped in Layout */}
          {adminRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={renderRoute(route, 'admin')} />
          ))}

          {/* All other routes wrapped in Layout */}
          {publicRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={
              <Layout>
                {renderRoute(route)}
              </Layout>
            } />
          ))}

          {/* Auth routes */}
          {authRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={
              <Layout>
                {renderRoute(route)}
              </Layout>
            } />
          ))}

          {/* Protected routes */}
          {protectedRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={
              <Layout>
                {renderRoute(route)}
              </Layout>
            } />
          ))}

          {/* Seller routes */}
          {sellerRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={
              <Layout>
                {renderRoute(route, 'seller')}
              </Layout>
            } />
          ))}

          {/* 404 fallback */}
          <Route
            path="*"
            element={
              <Layout>
                <NotFound />
              </Layout>
            }
          />
        </Routes>
      </Router>
    </>
  );
}

/**
 * Main App component - provides Redux store and Configuration Provider
 */
function App() {
  return (
    <Provider store={store}>
      <ErrorBoundary>
        <ConfigProvider>
          <AppContent />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: '#111827',
                color: '#fff',
                fontSize: '14px',
                borderRadius: '8px',
              },
              success: {
                iconTheme: { primary: '#10b981', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#fff' },
              },
            }}
          />
        </ConfigProvider>
      </ErrorBoundary>
    </Provider>
  );
}

export default App;
