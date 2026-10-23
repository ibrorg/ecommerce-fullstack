import React from 'react';
import { Link } from 'react-router-dom';
import { FiHome, FiSearch, FiArrowLeft } from 'react-icons/fi';

/**
 * NotFound — styled 404 page with navigation options.
 * Used as the catch-all route in App.tsx.
 */
const NotFound: React.FC = () => {
  return (
    <div className="min-h-[70vh] bg-white dark:bg-neutral-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl sm:text-9xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
          404
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-neutral-100 mb-3">
          Page not found
        </h1>
        <p className="text-gray-500 dark:text-neutral-400 mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
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
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 mt-6 text-sm text-gray-400 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors"
        >
          <FiArrowLeft size={14} />
          Go back
        </button>
      </div>
    </div>
  );
};

export default NotFound;
