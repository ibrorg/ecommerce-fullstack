import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import QuickViewModal from './QuickViewModal';
import { FiClock, FiStar, FiChevronRight, FiEye } from 'react-icons/fi';

interface ProductPreview {
  _id: string;
  name: string;
  price: number;
  comparePrice?: number;
  images: string[];
  rating: number;
  numReviews: number;
  category?: string;
}

interface RecentlyViewedProps {
  // optional: exclude a product (e.g. the one currently being viewed)
  excludeId?: string;
  // optional: max number of items to show
  limit?: number;
}

const RecentlyViewed: React.FC<RecentlyViewedProps> = ({ excludeId, limit = 8 }) => {
  const { getRecent } = useRecentlyViewed();
  const [products, setProducts] = useState<ProductPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const ids = getRecent().filter((id) => id !== excludeId).slice(0, limit);
      if (ids.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }
      try {
        const res = await api.getProductsByIds(ids);
        if (cancelled) return;
        const data: ProductPreview[] = res.data.data || [];
        // preserve localStorage order (most recent first)
        const byId = new Map(data.map((p) => [p._id, p]));
        setProducts(ids.map((id) => byId.get(id)).filter(Boolean) as ProductPreview[]);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [excludeId, limit, getRecent]);

  // don't render anything until we have data, and never render when empty
  if (!loading && products.length === 0) return null;
  if (loading) return null;

  return (
    <section className="py-12 lg:py-16">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <FiClock className="text-neutral-700 dark:text-neutral-300" size={20} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-neutral-100">
                Recently Viewed
              </h2>
              <p className="text-sm text-gray-500 dark:text-neutral-400">
                Pick up where you left off
              </p>
            </div>
          </div>
        </div>

        {/* horizontal scroll row */}
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 snap-x">
          {products.map((product) => (
            <div
              key={product._id}
              className="group relative flex-shrink-0 w-64 snap-start bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden hover:shadow-lg hover:border-gray-300 dark:hover:border-neutral-700 transition-all duration-200"
            >
              <Link to={`/products/${product._id}`} className="block">
                <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-neutral-800">
                  <img
                    src={product.images?.[0]}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {product.comparePrice && product.comparePrice > product.price && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500 text-white">
                      SALE
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                    {product.category}
                  </p>
                  <h3 className="font-semibold text-gray-900 dark:text-neutral-100 text-sm line-clamp-2 mb-2 group-hover:text-black dark:group-hover:text-white transition-colors">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mb-2">
                    <FiStar className="w-3 h-3 text-amber-400 fill-current" />
                    <span className="text-xs font-medium text-gray-600 dark:text-neutral-300">
                      {product.rating ? product.rating.toFixed(1) : 'New'}
                    </span>
                    {product.numReviews > 0 && (
                      <span className="text-xs text-gray-400 dark:text-neutral-500">
                        ({product.numReviews})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-gray-900 dark:text-neutral-100">
                        ${product.price.toFixed(2)}
                      </span>
                      {product.comparePrice && product.comparePrice > product.price && (
                        <span className="text-xs text-gray-400 line-through">
                          ${product.comparePrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <FiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Link>

              {/* Quick view — sibling of the Link so HTML stays valid */}
              <button
                onClick={() => setQuickViewId(product._id)}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 text-xs font-semibold shadow-lg border border-gray-200 dark:border-neutral-700"
                aria-label={`Quick view ${product.name}`}
              >
                <FiEye size={12} />
                Quick View
              </button>
            </div>
          ))}
        </div>
      </div>

      <QuickViewModal productId={quickViewId} onClose={() => setQuickViewId(null)} />
    </section>
  );
};

export default RecentlyViewed;
