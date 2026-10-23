import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import { fetchWishlist, resetWishlist } from '../../store/slices/wishlistSlice';
import ThemeToggle from '../ThemeToggle';
import { FiShoppingCart, FiUser, FiLogOut, FiMenu, FiX, FiSearch, FiHeart, FiGlobe, FiClock, FiArrowUpRight, FiTrash2 } from 'react-icons/fi';
import { useSearchHistory } from '../../hooks/useSearchHistory';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { items } = useAppSelector((state) => state.cart);
  const wishlistCount = useAppSelector((state) => state.wishlist.items.length);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { history, addSearch, removeSearch, clearHistory } = useSearchHistory();
  const [scrolled, setScrolled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const totalItems = items.reduce((total: number, item: any) => total + item.quantity, 0);

  // Add a shadow to the sticky header once the user scrolls past the top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    let ticking = false;
    const handler = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          onScroll();
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Check if currently on products page
  const isOnProductsPage = location.pathname === '/products';

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Close search on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  // Sync wishlist with server on auth transitions.
  //   false -> true: fetch the server wishlist so the heart icon and badge reflect truth.
  //   true  -> false: clear local wishlist so stale items don't leak across sessions.
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchWishlist());
    } else {
      dispatch(resetWishlist());
    }
  }, [isAuthenticated, dispatch]);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
    setMobileMenuOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      addSearch(q);
      navigate(`/products?search=${encodeURIComponent(q)}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const handleSearchToggle = () => {
    if (searchOpen) {
      setSearchOpen(false);
      setSearchQuery('');
    } else {
      setSearchOpen(true);
    }
  };

  const navItems = [
    { label: 'Collections', href: '/products' },
    ...(isAuthenticated && user?.role === 'seller' ? [{ label: 'Seller Dashboard', href: '/seller' }] : []),
    ...(isAuthenticated ? [{ label: 'Orders', href: '/orders' }] : []),
    ...(isAuthenticated && user?.role === 'admin' ? [{ label: 'Admin', href: '/admin/dashboard' }] : []),
  ];

  return (
    <header className={`sticky top-0 z-50 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 transition-all duration-300 ${scrolled ? 'shadow-md' : ''}`}>
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center gap-2.5 font-semibold text-neutral-900 dark:text-neutral-100 hover:opacity-70 transition-opacity"
          >
            <div className="h-8 w-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900 text-sm font-bold">
              E
            </div>
            <span className="hidden sm:inline tracking-tight">E-Shop</span>
          </Link>

          {/* Center Navigation */}
          <nav className="hidden md:flex items-center">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1">
            {/* Search - Hidden on products page */}
            {!isOnProductsPage && (
              <button 
                onClick={handleSearchToggle}
                className="p-2.5 text-neutral-500 hover:text-neutral-900 transition-colors"
                aria-label="Search"
              >
                <FiSearch className="w-5 h-5" />
              </button>
            )}

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Language switcher */}
            <LanguageSwitcher />

            {/* Cart */}
            <Link
              to="/cart"
              className="relative flex items-center gap-2 px-2.5 py-2 text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <FiShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 left-5 bg-neutral-900 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
              <span className="hidden sm:inline text-sm font-medium">Bag</span>
            </Link>

            {/* Wishlist — only when authenticated */}
            {isAuthenticated && (
              <Link
                to="/wishlist"
                className="relative flex items-center gap-2 px-2.5 py-2 text-neutral-500 hover:text-neutral-900 transition-colors"
                aria-label={`Wishlist with ${wishlistCount} ${wishlistCount === 1 ? 'item' : 'items'}`}
              >
                <FiHeart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 left-5 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {wishlistCount > 9 ? '9+' : wishlistCount}
                  </span>
                )}
                <span className="hidden sm:inline text-sm font-medium">Wishlist</span>
              </Link>
            )}

            {/* Auth Actions - Desktop */}
            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-1 ml-2">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  <FiUser className="w-5 h-5" />
                  <span className="text-sm font-medium max-w-[80px] truncate">
                    {user?.name?.split(' ')[0]}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2 text-neutral-500 hover:text-neutral-900 transition-colors"
                  title="Sign out"
                >
                  <FiLogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-3 ml-2">
                <Link
                  to="/login"
                  className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 border border-neutral-300 rounded-full px-4 py-2 hover:bg-neutral-50 transition-colors"
                >
                  <FiUser className="w-4 h-4" />
                  Sign up
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-neutral-500 hover:text-neutral-900 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-100 py-4 animate-fade-in">
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-sm font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 rounded-lg transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="border-t border-neutral-100 mt-4 pt-4 space-y-1">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/wishlist"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors"
                  >
                    <FiHeart className="w-5 h-5" />
                    Wishlist
                    {wishlistCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
                        {wishlistCount > 9 ? '9+' : wishlistCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors"
                  >
                    <FiUser className="w-5 h-5" />
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <FiLogOut className="w-5 h-5" />
                    Sign out
                  </button>
                </>
              ) : (
                <div className="space-y-2 px-4">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full py-2.5 text-center text-sm font-medium text-neutral-700 border border-neutral-200 rounded-full hover:bg-neutral-50 transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full py-2.5 text-center text-sm font-medium text-neutral-900 border border-neutral-300 rounded-full hover:bg-neutral-50 transition-colors"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search Overlay */}
        <div 
          className={`absolute left-0 right-0 top-full bg-white border-b border-neutral-200 shadow-lg overflow-hidden transition-all duration-300 ease-out ${
            searchOpen ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <form onSubmit={handleSearchSubmit} className="container py-4">
            <div className="relative flex items-center">
              <FiSearch className="absolute left-4 w-5 h-5 text-neutral-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-12 pr-24 py-3 text-base border border-neutral-300 rounded-full focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
              />
              <div className="absolute right-2 flex items-center gap-2">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1.5 text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!searchQuery.trim()}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-neutral-900 rounded-full hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Search
                </button>
              </div>
            </div>
          </form>

          {/* Search History dropdown — shows recent searches when input is empty */}
          {searchOpen && !searchQuery && history.length > 0 && (
            <div className="container pb-4">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Recent Searches
                  </span>
                  <button
                    onClick={clearHistory}
                    className="text-xs text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.map((entry) => (
                    <div
                      key={entry.query}
                      className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    >
                      <button
                        onClick={() => {
                          addSearch(entry.query);
                          navigate(`/products?search=${encodeURIComponent(entry.query)}`);
                          setSearchOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5"
                      >
                        <FiClock size={12} className="text-neutral-400" />
                        {entry.query}
                      </button>
                      <button
                        onClick={() => removeSearch(entry.query)}
                        className="text-neutral-400 hover:text-red-500 transition-colors"
                        aria-label={`Remove ${entry.query} from history`}
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search Backdrop */}
        {searchOpen && (
          <div 
            className="fixed inset-0 top-16 bg-black/20 z-[-1] animate-fade-in"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
          />
        )}
      </div>
    </header>
  );
};

// Language switcher — toggles between English and Hindi
const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'en';

  const toggle = () => {
    const next = currentLang === 'en' ? 'hi' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('language', next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${currentLang === 'en' ? 'Hindi' : 'English'}`}
      title={currentLang === 'en' ? 'हिन्दी' : 'English'}
      className="p-2.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1"
    >
      <FiGlobe size={18} />
      <span className="text-xs font-semibold uppercase">{currentLang}</span>
    </button>
  );
};

export default Header;
