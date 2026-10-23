import React, { Suspense, lazy } from 'react';
import Header from './Header';
import Footer from './Footer';
import BackToTop from '../BackToTop';

// Lazy-load the compare drawer so it isn't in the eager bundle — it only
// matters once a buyer actually adds products to compare.
const CompareDrawer = lazy(() => import('../CompareDrawer'));

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 transition-colors">
      <div className="relative min-h-screen flex flex-col">
        {/* Skip-to-content link — visible on focus, hidden visually otherwise.
            Lets keyboard + screen-reader users jump past the header nav. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-black focus:text-white focus:text-sm focus:font-semibold"
        >
          Skip to content
        </a>
        <Header />
        <main id="main-content" className="flex-grow" tabIndex={-1}>{children}</main>
        <Footer />
        {/* Suspense fallback is null — the drawer renders nothing until loaded */}
        <Suspense fallback={null}>
          <CompareDrawer />
        </Suspense>
        <BackToTop />
      </div>
    </div>
  );
};

export default Layout;
