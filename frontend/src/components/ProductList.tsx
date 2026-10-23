import React, { useEffect, useState, useCallback, useRef, Suspense, lazy } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { addToCart } from '../store/slices/cartSlice';
import WishlistButton from './WishlistButton';
import CompareButton from './CompareButton';
import QuickViewModal from './QuickViewModal';
import { type FilterState } from './FilterSidebar';
import ProductBadges from './ProductBadges';
import ErrorState from './ErrorState';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useDebounce } from '../hooks/useDebounce';
import { useCurrency } from '../context/CurrencyContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { FiArrowRight, FiCheck, FiPlus, FiSearch, FiRefreshCw, FiLoader, FiEye, FiSliders, FiX, FiLink, FiShoppingCart } from 'react-icons/fi';

// Lazy-load the FilterSidebar — it's a heavy component (fetches categories +
// brands, renders many sections) and only matters on the products page.
const FilterSidebar = lazy(() => import('./FilterSidebar'));

// Lightweight skeleton shown while the FilterSidebar chunk loads.
const FilterSidebarFallback = () => (
  <div className="space-y-4">
    <div className="skeleton h-10 w-full rounded-lg" />
    <div className="skeleton h-4 w-20" />
    <div className="skeleton h-8 w-full rounded-lg" />
    <div className="skeleton h-4 w-16" />
    <div className="skeleton h-8 w-full rounded-lg" />
    <div className="skeleton h-4 w-16" />
    <div className="skeleton h-8 w-full rounded-lg" />
  </div>
);

// Default fallback image for products without images
const FALLBACK_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';

interface Product {
  _id: string;
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  countInStock: number;
  rating: number;
  numReviews: number;
  sku: string;
  slug?: string;
  comparePrice?: number;
  badges?: string[];
}

// Lazy loaded image component with loading state
const LazyImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className = '' }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      {!loaded && !error && (
        <div className="absolute inset-0 skeleton animate-pulse" />
      )}
      <img
        ref={imgRef}
        src={error ? FALLBACK_PRODUCT_IMAGE : src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true);
          setLoaded(true);
        }}
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      />
    </div>
  );
};

const ProductList: React.FC = () => {
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { formatPrice } = useCurrency();
  useDocumentMeta({
    title: 'Shop All Products',
    description: 'Browse our full catalog. Filter by price, brand, rating, and more. Compare products side by side.',
  });
  const [products, setProducts] = useState<Product[]>([]);

  const [status, setStatus] = useState<'idle' | 'loading' | 'loadingMore' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 12,
  });
  
  // Get initial search from URL params
  // Read all filters from the URL on mount / back-forward navigation so filter
  // state is shareable and survives reloads. Falls back to defaults.
  const readFiltersFromUrl = (): FilterState & { search: string; limit: number } => ({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    brand: searchParams.get('brand') || '',
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    minRating: searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined,
    inStock: searchParams.get('inStock') === 'true',
    sort: searchParams.get('sort') || 'newest',
    badges: searchParams.get('badges') || '',
    limit: Number(searchParams.get('limit')) || 12,
  });

  const [filters, setFilters] = useState<FilterState & { search: string; limit: number }>(readFiltersFromUrl);
  // debounce search to avoid firing an API request on every keystroke
  const debouncedSearch = useDebounce(filters.search, 350);
  const [addedToCart, setAddedToCart] = useState<string | null>(null);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      // clipboard may be blocked — non-fatal
    }
  };

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // keyboard shortcut: press "/" to focus search (unless already in an input)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Build the canonical URL param object from the current filter state.
  // Empty/default values are omitted so URLs stay clean.
  const buildUrlParams = (f: typeof filters): Record<string, string> => {
    const params: Record<string, string> = {};
    if (f.search) params.search = f.search;
    if (f.category) params.category = f.category;
    if (f.brand) params.brand = f.brand;
    if (f.minPrice !== undefined) params.minPrice = String(f.minPrice);
    if (f.maxPrice !== undefined) params.maxPrice = String(f.maxPrice);
    if (f.minRating !== undefined) params.minRating = String(f.minRating);
    if (f.inStock) params.inStock = 'true';
    if (f.sort && f.sort !== 'newest') params.sort = f.sort;
    if (f.badges) params.badges = f.badges;
    return params;
  };

  // Sync filters from URL on back/forward navigation. We compare the URL's
  // canonical params to what the state would produce to avoid loops with the
  // write effect below.
  useEffect(() => {
    const urlParams = buildUrlParams(readFiltersFromUrl());
    const stateParams = buildUrlParams({ ...filters, search: debouncedSearch });
    const urlStr = new URLSearchParams(urlParams).toString();
    const stateStr = new URLSearchParams(stateParams).toString();
    if (urlStr !== stateStr) {
      setFilters(readFiltersFromUrl());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Write the filter state to the URL whenever it changes so filter URLs are
  // shareable. Uses replace to avoid polluting browser history on every keystroke.
  useEffect(() => {
    const params = buildUrlParams({ ...filters, search: debouncedSearch });
    const next = new URLSearchParams(params);
    const current = new URLSearchParams(searchParams);
    if (next.toString() !== current.toString()) {
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters.category, filters.brand, filters.minPrice, filters.maxPrice, filters.minRating, filters.inStock, filters.sort, filters.badges]);

  const handleSearchChange = (newSearch: string) => {
    setFilters(prev => ({ ...prev, search: newSearch }));
  };

  const fetchProducts = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      setStatus(append ? 'loadingMore' : 'loading');
      const response = await api.getProducts(
        pageNum,
        filters.limit,
        filters.category || undefined,
        filters.minPrice,
        filters.maxPrice,
        debouncedSearch || undefined,
        filters.sort,
        filters.brand || undefined,
        filters.minRating,
        filters.inStock,
        filters.badges || undefined
      );

      const payload = response.data;
      const newProducts = payload.data || [];
      
      if (append) {
        setProducts(prev => [...prev, ...newProducts]);
      } else {
        setProducts(newProducts);
      }
      
      const paginationData = payload.pagination || { 
        page: pageNum, 
        pages: 1, 
        total: newProducts.length, 
        limit: filters.limit 
      };
      
      setPagination(paginationData);
      setHasMore(pageNum < paginationData.pages);
      setStatus('idle');
      setError(null);
    } catch (err: any) {
      setStatus('error');
      setError(err.response?.data?.error || 'Unable to load products');
    }
  }, [filters.limit, filters.category, debouncedSearch, filters.sort, filters.brand, filters.minPrice, filters.maxPrice, filters.minRating, filters.inStock, filters.badges]);

  useEffect(() => {
    setPage(1);
    setProducts([]);
    fetchProducts(1, false);
  }, [fetchProducts]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && status === 'idle') {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchProducts(nextPage, true);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, status, page, fetchProducts]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Reset to page 1 and clear products - useEffect will trigger fetch
    setPage(1);
    setProducts([]);
  };

  const handleAddToCart = (product: Product) => {
    dispatch(
      addToCart({
        id: product._id || product.id,
        name: product.name,
        price: product.price,
        image: product.images?.[0] || FALLBACK_PRODUCT_IMAGE,
        quantity: 1,
        countInStock: product.countInStock,
      })
    );
    setAddedToCart(product._id);
    setTimeout(() => setAddedToCart(null), 2000);

    // rich toast with a view-cart action
    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <FiCheck className="text-white" size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm">Added to bag</p>
            <p className="text-xs text-neutral-300 truncate">{product.name}</p>
          </div>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              window.location.href = '/cart';
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-neutral-900 text-xs font-semibold hover:bg-neutral-100 transition-colors flex-shrink-0"
          >
            <FiShoppingCart size={12} />
            View
          </button>
        </div>
      ),
      { duration: 3500 }
    );
  };

  const renderProducts = () => {
    // Initial Loading State
    if (status === 'loading' && products.length === 0) {
      return (
        <div className="masonry-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div 
              key={i} 
              className="card p-0 overflow-hidden animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="skeleton aspect-[4/5]" />
              <div className="p-5 space-y-3">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
                <div className="flex gap-2 mt-4">
                  <div className="skeleton h-3 w-3" />
                  <div className="skeleton h-3 w-3" />
                  <div className="skeleton h-3 w-3" />
                  <div className="skeleton h-3 w-3" />
                  <div className="skeleton h-3 w-3" />
                </div>
                <div className="skeleton h-6 w-1/3 mt-2" />
                <div className="flex gap-2 mt-4">
                  <div className="skeleton h-10 flex-1" />
                  <div className="skeleton h-10 flex-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Empty State
    if (products.length === 0) {
      const hasActiveFilters = !!(filters.category || filters.brand || filters.minPrice !== undefined || filters.maxPrice !== undefined || filters.minRating !== undefined || filters.inStock || filters.badges || filters.search);
      return (
        <div className="text-center py-20 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full mb-6">
            <FiSearch className="w-8 h-8 text-neutral-400 dark:text-neutral-500" />
          </div>
          <h3 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            {hasActiveFilters ? 'No products match your filters' : 'No products found'}
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-8 max-w-md mx-auto">
            {hasActiveFilters
              ? 'Try removing some filters or broadening your search to see more results.'
              : 'We\'re stocking up! Check back soon for new arrivals.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {hasActiveFilters && (
              <button
                onClick={() => {
                  handleSearchChange('');
                  setFilters({
                    search: '',
                    category: '',
                    brand: '',
                    minPrice: undefined,
                    maxPrice: undefined,
                    minRating: undefined,
                    inStock: false,
                    sort: 'newest',
                    badges: '',
                    limit: 12,
                  });
                  setPage(1);
                }}
                className="btn btn-secondary inline-flex items-center gap-2"
              >
                <FiRefreshCw className="w-4 h-4" />
                Clear all filters
              </button>
            )}
            <Link
              to="/products"
              onClick={() => {
                setFilters({
                  search: '',
                  category: '',
                  brand: '',
                  minPrice: undefined,
                  maxPrice: undefined,
                  minRating: undefined,
                  inStock: false,
                  sort: 'newest',
                  badges: '',
                  limit: 12,
                });
              }}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <FiSearch className="w-4 h-4" />
              Browse all products
            </Link>
          </div>
        </div>
      );
    }

    // Products Grid - Masonry style with staggered animations
    return (
      <>
        <div className="masonry-grid">
          {products.map((product, index) => (
            <div
              key={product._id}
              className="card card-interactive relative p-0 overflow-hidden group animate-fade-in"
              style={{ animationDelay: `${(index % 12) * 30}ms` }}
            >
              {/* Image */}
              <Link to={`/products/${product._id}`} className="block">
                <div className="relative aspect-[4/5] bg-neutral-100 overflow-hidden">
                  <LazyImage
                    src={product.images?.[0] || FALLBACK_PRODUCT_IMAGE}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Merchandising badges */}
                  <ProductBadges badges={product.badges} variant="overlay" className="top-9" />

                  {/* Category */}
                  <div className="absolute top-3 left-3">
                    <span className="pill bg-white/90 backdrop-blur-sm text-neutral-700 text-xs shadow-sm">
                      {product.category}
                    </span>
                  </div>
                  
                  {/* Stock Status */}
                  {product.countInStock > 0 ? (
                    <div className="absolute bottom-3 right-3">
                      <span className="pill bg-neutral-900/90 text-white text-xs shadow-sm">
                        <FiCheck className="w-3 h-3" />
                        In Stock
                      </span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-neutral-950/60 flex items-center justify-center backdrop-blur-sm">
                      <span className="text-white font-semibold px-4 py-2 bg-neutral-900/80 rounded-full">Out of Stock</span>
                    </div>
                  )}
                  
                  {/* Discount Badge */}
                  {product.comparePrice && product.comparePrice > product.price && (
                    <div className="absolute bottom-3 left-3">
                      <span className="pill bg-neutral-900/90 text-white text-xs shadow-sm">
                        -{Math.round((1 - product.price / product.comparePrice) * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Quick View button — appears on hover */}
                  {product.countInStock > 0 && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setQuickViewId(product._id);
                      }}
                      className="absolute left-1/2 bottom-3 -translate-x-1/2 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 text-xs font-semibold shadow-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800"
                      aria-label={`Quick view ${product.name}`}
                    >
                      <FiEye size={14} />
                      Quick View
                    </button>
                  )}
                </div>
              </Link>

              {/* Wishlist heart — top-right corner, sibling of Link so the
                  button stays valid HTML (not nested inside an <a>). */}
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
                <WishlistButton productId={product._id} variant="icon" />
                <CompareButton
                  productId={product._id}
                  name={product.name}
                  price={product.price}
                  image={product.images?.[0] || ''}
                  variant="icon"
                />
              </div>

              {/* Content */}
              <div className="p-4 sm:p-5">
                <Link to={`/products/${product._id}`}>
                  <h3 className="font-semibold text-neutral-900 mb-1 line-clamp-2 group-hover:text-neutral-600 transition-colors">
                    {product.name}
                  </h3>
                </Link>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={`text-sm ${
                          i < Math.floor(product.rating)
                            ? 'text-neutral-900'
                            : 'text-neutral-300'
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-neutral-500 font-medium">
                    {product.rating.toFixed(1)} ({product.numReviews})
                  </span>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-xl font-bold text-neutral-950">
                    {formatPrice(product.price)}
                  </span>
                  {product.comparePrice && product.comparePrice > product.price && (
                    <span className="text-sm text-neutral-400 line-through">
                      {formatPrice(product.comparePrice)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    to={`/products/${product._id}`}
                    className="flex-1 btn btn-secondary py-2.5 text-sm justify-center group/btn font-medium border border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 transition-all duration-200 active:scale-95"
                  >
                    View
                    <FiArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform duration-200" />
                  </Link>
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.countInStock === 0}
                    className={`flex-1 btn py-2.5 text-sm justify-center font-medium transition-all duration-300 active:scale-95 ${
                      addedToCart === product._id
                        ? 'bg-neutral-800 hover:bg-neutral-900 text-white shadow-lg shadow-black/20 border border-neutral-900'
                        : 'bg-black text-white hover:bg-neutral-900 shadow-lg shadow-black/20 border border-black hover:border-neutral-900'
                    } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:shadow-none`}
                  >
                    {addedToCart === product._id ? (
                      <>
                        <FiCheck className="w-4 h-4 mr-1.5" />
                        <span>Added!</span>
                      </>
                    ) : (
                      <>
                        <FiPlus className="w-4 h-4 mr-1.5 group-hover:rotate-90 transition-transform duration-300" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Infinite Scroll + Load More Button */}
        <div ref={loadMoreRef} className="h-20 flex flex-col items-center justify-center gap-3">
          {status === 'loadingMore' && (
            <div className="flex items-center gap-3 text-neutral-500">
              <FiLoader className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Loading more products...</span>
            </div>
          )}
          {hasMore && status === 'idle' && products.length > 0 && (
            <button
              onClick={() => fetchProducts(page + 1, true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              Load more products
            </button>
          )}
          {!hasMore && products.length > 0 && (
            <p className="text-sm text-neutral-400 dark:text-neutral-500">You've seen all {pagination.total} products</p>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="container section">
        {/* Header */}
        <div className="mb-8">
          <p className="text-meta text-neutral-500 mb-2">COLLECTION</p>
          <h1 className="text-headline text-neutral-950 mb-2">Shop</h1>
          <p className="text-body">Browse our curated selection of quality products</p>
        </div>

        {/* Search + mobile filter toggle */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products...  (press / to focus)"
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="input pl-10"
            />
          </form>
          {/* mobile filter toggle */}
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors relative"
          >
            <FiSliders size={16} />
            Filters
            {(() => {
              const count = [filters.category, filters.brand, filters.minPrice !== undefined, filters.maxPrice !== undefined, filters.minRating !== undefined, filters.inStock, filters.badges, filters.sort !== 'newest'].filter(Boolean).length;
              return count > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black dark:bg-neutral-100 text-white dark:text-neutral-900 text-[10px] font-bold flex items-center justify-center">
                  {count}
                </span>
              ) : null;
            })()}
          </button>
        </div>

        {/* Sidebar + products layout */}
        <div className="flex gap-8">
          {/* desktop sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
              <Suspense fallback={<FilterSidebarFallback />}>
                <FilterSidebar
                  filters={filters}
                  onChange={(next) => {
                    setFilters({ ...filters, ...next });
                  }}
                />
              </Suspense>
            </div>
          </aside>

          {/* mobile filter drawer */}
          {mobileFiltersOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setMobileFiltersOpen(false)}
              />
              <div className="relative ml-auto w-80 max-w-[85vw] bg-white dark:bg-neutral-900 h-full overflow-y-auto p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">Filters</h2>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500"
                  >
                    <FiX size={18} />
                  </button>
                </div>
                <Suspense fallback={<FilterSidebarFallback />}>
                  <FilterSidebar
                    filters={filters}
                    onChange={(next) => setFilters({ ...filters, ...next })}
                  />
                </Suspense>
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="mt-6 w-full px-4 py-3 rounded-xl bg-black text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold text-sm"
                >
                  Show {pagination.total} results
                </button>
              </div>
            </div>
          )}

          {/* products column */}
          <div className="flex-1 min-w-0">
            {/* Results Info */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {pagination.total > 0 ? (
                  <>Showing {products.length} of {pagination.total} products</>
                ) : (
                  'No products found'
                )}
              </p>
              <div className="flex items-center gap-3">
                {status === 'loading' && products.length > 0 && (
                  <span className="flex items-center gap-2 text-sm text-neutral-500">
                    <FiLoader className="w-4 h-4 animate-spin" />
                    Refreshing...
                  </span>
                )}
                {/* Share filtered URL — only show when there are active filters */}
                {(filters.category || filters.brand || filters.minPrice !== undefined || filters.maxPrice !== undefined || filters.minRating !== undefined || filters.inStock || filters.sort !== 'newest' || filters.badges) && (
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    title="Copy filtered URL"
                  >
                    {copiedShare ? (
                      <>
                        <FiCheck size={13} className="text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <FiLink size={13} />
                        Share
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Active filter chips */}
            <ActiveFilterChips filters={filters} onChange={(next) => setFilters({ ...filters, ...next })} />

            {/* Error State */}
            {status === 'error' && (
              <div className="mb-6">
                <ErrorState
                  title="Couldn’t load products"
                  message={error || 'There was a problem reaching the server.'}
                  onRetry={() => fetchProducts(1, false)}
                />
              </div>
            )}

            {/* Products */}
            {renderProducts()}
          </div>
        </div>
      </div>

      {/* Quick view modal */}
      <QuickViewModal productId={quickViewId} onClose={() => setQuickViewId(null)} />
    </div>
  );
};

// Active filter chips — removable pills showing the current filter state.
// Renders above the grid; "Clear all" resets everything except search.
const ActiveFilterChips: React.FC<{
  filters: FilterState & { search: string; limit: number };
  onChange: (next: Partial<FilterState & { search: string; limit: number }>) => void;
}> = ({ filters, onChange }) => {
  const chips: { label: string; clear: () => void }[] = [];

  if (filters.category) {
    chips.push({
      label: filters.category,
      clear: () => onChange({ category: '' }),
    });
  }
  if (filters.brand) {
    filters.brand.split(',').filter(Boolean).forEach((b) => {
      const remaining = filters.brand.split(',').filter((x) => x.trim() !== b.trim()).join(',');
      chips.push({
        label: b.trim(),
        clear: () => onChange({ brand: remaining }),
      });
    });
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const min = filters.minPrice !== undefined ? `$${filters.minPrice}` : '$0';
    const max = filters.maxPrice !== undefined ? `$${filters.maxPrice}` : '∞';
    chips.push({
      label: `${min} – ${max}`,
      clear: () => onChange({ minPrice: undefined, maxPrice: undefined }),
    });
  }
  if (filters.minRating !== undefined) {
    chips.push({
      label: `${filters.minRating}★ & up`,
      clear: () => onChange({ minRating: undefined }),
    });
  }
  if (filters.inStock) {
    chips.push({
      label: 'In stock',
      clear: () => onChange({ inStock: false }),
    });
  }
  if (filters.badges) {
    filters.badges.split(',').filter(Boolean).forEach((badge) => {
      const remaining = filters.badges.split(',').filter((x) => x.trim() !== badge.trim()).join(',');
      const badgeLabels: Record<string, string> = {
        'Sale': 'On Sale',
        'New': 'New',
        'Top Rated': 'Top Rated',
        'Bestseller': 'Bestseller',
        'Low Stock': 'Low Stock',
      };
      chips.push({
        label: badgeLabels[badge.trim()] || badge.trim(),
        clear: () => onChange({ badges: remaining }),
      });
    });
  }
  if (filters.sort && filters.sort !== 'newest') {
    const sortLabels: Record<string, string> = {
      'price-asc': 'Price ↑',
      'price-desc': 'Price ↓',
      'rating': 'Top Rated',
      'oldest': 'Oldest',
    };
    chips.push({
      label: `Sort: ${sortLabels[filters.sort] || filters.sort}`,
      clear: () => onChange({ sort: 'newest' }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {chips.map((chip, i) => (
        <button
          key={i}
          onClick={chip.clear}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-200 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors group"
        >
          {chip.label}
          <FiX size={12} className="text-gray-400 group-hover:text-red-500 transition-colors" />
        </button>
      ))}
      <button
        onClick={() =>
          onChange({
            category: '',
            brand: '',
            minPrice: undefined,
            maxPrice: undefined,
            minRating: undefined,
            inStock: false,
            sort: 'newest',
            badges: '',
          })
        }
        className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2 ml-1"
      >
        Clear all
      </button>
    </div>
  );
};

export default ProductList;
