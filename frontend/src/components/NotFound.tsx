import React from 'react';
import { Link } from 'react-router-dom';
import { FiHome, FiSearch, FiArrowLeft, FiShoppingBag } from 'react-icons/fi';

/**
 * NotFound — styled 404 page with navigation options + suggested links.
 * Used as the catch-all route in App.tsx.
 *
 * Animations: the "404" mark uses a slow animated gradient; the page mounts
 * with a fade+slide via `animate-fade-in`. All motion is disabled under
 * prefers-reduced-motion.
 */
const NotFound: React.FC = () => {
  return (
    <div className="min-h-[70vh] bg-white dark:bg-neutral-950 flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-md animate-fade-in">
        {/* Animated gradient 404 mark */}
        <div
          className="text-8xl sm:text-9xl font-bold mb-4 bg-gradient-to-r from-neutral-900 via-neutral-500 to-neutral-900 dark:from-neutral-100 dark:via-neutral-400 dark:to-neutral-100 bg-clip-text text-transparent animate-gradient"
          style={{ backgroundSize: '200% auto' }}
        >
          404
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-neutral-100 mb-3">
          Page not found
        </h1>
        <p className="text-gray-500 dark:text-neutral-400 mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>

        {/* Primary CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-black text-white dark:bg-neutral-100 dark:text-neutral-900 text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
          >
            <FiHome size={16} />
            Go home
          </Link>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <FiSearch size={16} />
            Browse products
          </Link>
        </div>

        {/* Secondary: go back */}
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors"
        >
          <FiArrowLeft size={14} />
          Go back
        </button>

        {/* Suggested quick links */}
        <div className="mt-12 pt-8 border-t border-gray-100 dark:border-neutral-800">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-neutral-500 mb-4">
            Popular destinations
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { label: 'Cart', to: '/cart', icon: <FiShoppingBag size={12} /> },
              { label: 'Login', to: '/login', icon: null },
              { label: 'Register', to: '/register', icon: null },
            ].map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 dark:bg-neutral-900 text-xs font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
