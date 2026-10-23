import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * PageTransition — fades + slides the page content in on every route change.
 *
 * Listens to `location.pathname` and bumps a key so React remounts the
 * children with the `animate-page-enter` class. This keeps existing Suspense
 * behavior intact while adding a subtle 320ms cross-fade between routes.
 *
 * Respects prefers-reduced-motion (the CSS disables the animation).
 */
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [hasMounted, setHasMounted] = useState(false);

  // Skip the very first paint transition so the initial load is instant.
  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <div
      key={`${location.pathname}-${hasMounted ? '1' : '0'}`}
      className={hasMounted ? 'animate-page-enter' : ''}
    >
      {children}
    </div>
  );
};

export default PageTransition;
