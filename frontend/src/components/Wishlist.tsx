import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addToCart } from '../store/slices/cartSlice';
import {
  fetchWishlist,
  removeFromWishlist,
  clearWishlist,
} from '../store/slices/wishlistSlice';
import type { WishlistItem } from '../store/slices/wishlistSlice';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  FiHeart,
  FiTrash2,
  FiShoppingBag,
  FiArrowRight,
  FiCheck,
  FiAlertCircle,
  FiRefreshCw,
  FiLoader,
} from 'react-icons/fi';

const FALLBACK_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';

// Full product shape for wishlist cards. The wishlist endpoint returns a
// subset of product fields; we tolerate optionals on the display side.
interface WishlistCardProduct {
  _id: string;
  name: string;
  slug?: string;
  price: number;
  images?: string[];
  category?: string;
  countInStock?: number;
  rating?: number;
  numReviews?: number;
  comparePrice?: number;
}

const toCardProduct = (item: WishlistItem): WishlistCardProduct => ({
  _id: item.product._id,
  name: item.product.name,
  slug: item.product.slug,
  price: item.product.price,
  images: item.product.images,
  category: item.product.category,
  countInStock: item.product.countInStock,
  rating: item.product.rating,
  numReviews: item.product.numReviews,
  comparePrice: item.product.comparePrice,
});

const Wishlist: React.FC = () => {
  const dispatch = useAppDispatch();
  const { items, error } = useAppSelector((state) => state.wishlist);
  useDocumentMeta({ title: 'Wishlist', description: 'Your saved products for later.' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [addedToCart, setAddedToCart] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadWishlist = useCallback(async () => {
    try {
      setStatus('loading');
      setFetchError(null);
      await dispatch(fetchWishlist()).unwrap();
      setStatus('idle');
    } catch (err) {
      const message =
        (err as { message?: string; response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (err as { message?: string })?.message ||
        'Unable to load your wishlist. Please try again.';
      setFetchError(message);
      setStatus('error');
    }
  }, [dispatch]);

  useEffect(() => {
    void loadWishlist();
  }, [loadWishlist]);

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    try {
      await dispatch(removeFromWishlist(productId)).unwrap();
    } catch {
      // Error captured in slice; keep the card visible so the user can retry.
    } finally {
      setRemovingId(null);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await dispatch(clearWishlist()).unwrap();
    } catch {
      // Slice surfaces the error; no extra UI action needed.
    } finally {
      setClearing(false);
    }
  };

  const handleAddToCart = (product: WishlistCardProduct) => {
    dispatch(
      addToCart({
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.images?.[0] || FALLBACK_PRODUCT_IMAGE,
        quantity: 1,
        countInStock: product.countInStock ?? 0,
      })
    );
    setAddedToCart(product._id);
    setTimeout(() => setAddedToCart(null), 2000);
  };

  // --- Loading skeleton ---
  if (status === 'loading' && items.length === 0) {
    return (
      <div className="bg-white min-h-screen">
        <div className="container section">
          <div className="mb-8">
            <p className="text-meta text-gray-500 mb-2">SAVED</p>
            <h1 className="text-headline text-gray-900 mb-2">My Wishlist</h1>
            <p className="text-body">Loading your saved items...</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm animate-fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="skeleton aspect-[4/5]" />
                <div className="p-4 space-y-3">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-6 w-1/3 mt-2" />
                  <div className="skeleton h-10 w-full mt-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Error state with retry ---
  if (status === 'error' && items.length === 0) {
    return (
      <div className="bg-white min-h-screen">
        <div className="container section">
          <div className="mb-8">
            <p className="text-meta text-gray-500 mb-2">SAVED</p>
            <h1 className="text-headline text-gray-900 mb-2">My Wishlist</h1>
          </div>
          <div className="max-w-md mx-auto text-center py-16 border border-red-200 bg-red-50 rounded-lg">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-red-100 rounded-full mb-4">
              <FiAlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Couldn't load wishlist</h3>
            <p className="text-sm text-gray-600 mb-6">{fetchError}</p>
            <button
              onClick={() => void loadWishlist()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Empty state ---
  if (items.length === 0) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="container section">
          <div className="max-w-md mx-auto text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
              <FiHeart className="w-9 h-9 text-gray-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Your wishlist is empty
            </h1>
            <p className="text-base text-gray-600 mb-8">
              Save items you love by tapping the heart icon. They'll show up here so you can easily
              find them later.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-800 active:scale-95 transition-all duration-200 group"
            >
              Browse Products
              <FiArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="container section">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <p className="text-meta text-gray-500 mb-2">SAVED</p>
            <h1 className="text-headline text-gray-900 mb-2">My Wishlist</h1>
            <p className="text-body">
              {items.length} {items.length === 1 ? 'item' : 'items'} saved for later
            </p>
          </div>
          <button
            onClick={() => void handleClear()}
            disabled={clearing}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {clearing ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <FiTrash2 className="w-4 h-4" />
            )}
            Clear Wishlist
          </button>
        </div>

        {/* Inline error (e.g. remove failed) */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 animate-fade-in">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, index) => {
            const product = toCardProduct(item);
            const image = product.images?.[0] || FALLBACK_PRODUCT_IMAGE;
            const inStock = (product.countInStock ?? 0) > 0;
            const isRemoving = removingId === product._id;
            const isAdded = addedToCart === product._id;
            const rating = product.rating ?? 0;
            const numReviews = product.numReviews ?? 0;
            const detailHref = product.slug
              ? `/products/${product.slug}`
              : `/products/${product._id}`;

            return (
              <div
                key={product._id}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-in flex flex-col"
                style={{ animationDelay: `${(index % 8) * 40}ms` }}
              >
                {/* Image */}
                <Link to={detailHref} className="block relative aspect-[4/5] bg-gray-100 overflow-hidden group">
                  <img
                    src={image}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {product.category && (
                    <span className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-medium shadow-sm">
                      {product.category}
                    </span>
                  )}
                  {!inStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-sm font-semibold px-3 py-1.5 bg-black/70 rounded-full">
                        Out of Stock
                      </span>
                    </div>
                  )}
                  {product.comparePrice && product.comparePrice > product.price && (
                    <span className="absolute bottom-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full bg-gray-900/90 text-white text-xs font-medium shadow-sm">
                      -{Math.round((1 - product.price / product.comparePrice) * 100)}%
                    </span>
                  )}
                </Link>

                {/* Content */}
                <div className="p-4 flex flex-col flex-1">
                  <Link to={detailHref}>
                    <h3 className="font-semibold text-gray-900 mb-1.5 line-clamp-2 hover:text-gray-700 transition-colors">
                      {product.name}
                    </h3>
                  </Link>

                  {/* Rating */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={`text-sm ${i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500 font-medium">
                      {rating.toFixed(1)} ({numReviews})
                    </span>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-2 mb-4 mt-auto">
                    <span className="text-xl font-bold text-gray-900">
                      ${product.price.toFixed(2)}
                    </span>
                    {product.comparePrice && product.comparePrice > product.price && (
                      <span className="text-sm text-gray-400 line-through">
                        ${product.comparePrice.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={!inStock}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 text-sm font-semibold rounded-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isAdded
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <FiCheck className="w-4 h-4" />
                          Added!
                        </>
                      ) : (
                        <>
                          <FiShoppingBag className="w-4 h-4" />
                          Add to Cart
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => void handleRemove(product._id)}
                      disabled={isRemoving}
                      aria-label={`Remove ${product.name} from wishlist`}
                      className="inline-flex items-center justify-center w-11 py-2.5 px-3 text-sm font-semibold rounded-lg border border-gray-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      title="Remove from wishlist"
                    >
                      {isRemoving ? (
                        <FiLoader className="w-4 h-4 animate-spin" />
                      ) : (
                        <FiHeart className="w-4 h-4 fill-current" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-gray-700 transition-colors group"
          >
            Continue shopping
            <FiArrowRight className="group-hover:translate-x-1 transition-transform" size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Wishlist;
