import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import ProductBadges from './ProductBadges';
import { FiStar, FiLoader } from 'react-icons/fi';

interface RelatedProduct {
  _id: string;
  name: string;
  price: number;
  comparePrice?: number;
  images: string[];
  rating: number;
  numReviews: number;
  category?: string;
  badges?: string[];
}

interface RelatedProductsProps {
  productId: string;
  category?: string;
}

const RelatedProducts: React.FC<RelatedProductsProps> = ({ productId }) => {
  const [products, setProducts] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getRelatedProducts(productId);
        if (cancelled) return;
        setProducts(res.data?.data || []);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [productId]);

  if (loading) {
    return (
      <section className="py-12">
        <div className="container">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-neutral-100 mb-6">
            You might also like
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800">
                <div className="skeleton aspect-square" />
                <div className="p-4 space-y-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-6 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="py-12">
      <div className="container">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-neutral-100 mb-6">
          You might also like
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {products.slice(0, 4).map((product) => (
            <Link
              key={product._id}
              to={`/products/${product._id}`}
              className="group bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 hover:shadow-lg hover:border-gray-300 dark:hover:border-neutral-700 transition-all duration-200"
            >
              <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-neutral-800">
                <img
                  src={product.images?.[0]}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <ProductBadges badges={product.badges} variant="overlay" className="top-2" />
              </div>
              <div className="p-3 sm:p-4">
                {product.category && (
                  <p className="text-xs text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-1">
                    {product.category}
                  </p>
                )}
                <h3 className="font-semibold text-gray-900 dark:text-neutral-100 text-sm line-clamp-2 mb-2 group-hover:text-black dark:group-hover:text-white transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-center gap-1.5 mb-2">
                  <FiStar className="w-3 h-3 text-amber-400 fill-current" />
                  <span className="text-xs font-medium text-gray-600 dark:text-neutral-300">
                    {product.rating ? product.rating.toFixed(1) : 'New'}
                  </span>
                </div>
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
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RelatedProducts;
