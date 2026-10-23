import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAppDispatch } from '../store/hooks';
import { addToCart } from '../store/slices/cartSlice';
import CompareButton from './CompareButton';
import ProductBadges from './ProductBadges';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  FiX,
  FiStar,
  FiShoppingBag,
  FiCheck,
  FiArrowRight,
  FiLoader,
  FiMinus,
  FiPlus,
  FiTruck,
} from 'react-icons/fi';

interface QuickViewProduct {
  _id: string;
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  images: string[];
  category: string;
  brand?: string;
  countInStock: number;
  rating: number;
  numReviews: number;
  sku?: string;
  badges?: string[];
}

interface QuickViewModalProps {
  productId: string | null;
  onClose: () => void;
}

const QuickViewModal: React.FC<QuickViewModalProps> = ({ productId, onClose }) => {
  const dispatch = useAppDispatch();
  const [product, setProduct] = useState<QuickViewProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, !!productId);

  // fetch the product when the modal opens for a new id
  useEffect(() => {
    if (!productId) {
      setProduct(null);
      setSelectedImage(0);
      setQuantity(1);
      setAdded(false);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getProduct(productId)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        if (data && typeof data === 'object' && '_id' in data) {
          setProduct(data as QuickViewProduct);
          setSelectedImage(0);
          setQuantity(1);
          setAdded(false);
        } else {
          setError('Product not found');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load product');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // escape to close + lock body scroll while open
  useEffect(() => {
    if (!productId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [productId, onClose]);

  const handleAddToCart = useCallback(() => {
    if (!product) return;
    dispatch(
      addToCart({
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.images?.[0] || '',
        quantity,
        countInStock: product.countInStock,
      }) as any
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }, [product, quantity, dispatch]);

  if (!productId) return null;

  const discountPct =
    product?.comparePrice && product.comparePrice > product.price
      ? Math.round((1 - product.price / product.comparePrice) * 100)
      : 0;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Quick view"
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-neutral-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/80 dark:bg-neutral-800/80 backdrop-blur hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-600 dark:text-neutral-300 transition-colors"
        >
          <FiX size={20} />
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <FiLoader className="animate-spin text-gray-400" size={32} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-neutral-100 mb-2">
              {error}
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-5 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-900"
            >
              Close
            </button>
          </div>
        ) : product ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* image column */}
            <div className="p-5">
              <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-neutral-800">
                <img
                  src={product.images?.[selectedImage] || product.images?.[0]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {discountPct > 0 && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-bold bg-red-500 text-white">
                    -{discountPct}%
                  </span>
                )}
              </div>
              {product.images && product.images.length > 1 && (
                <div className="flex gap-2 mt-3">
                  {product.images.slice(0, 5).map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImage === idx
                          ? 'border-black dark:border-white'
                          : 'border-gray-200 dark:border-neutral-700 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img loading="lazy" decoding="async" src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* info column */}
            <div className="p-6 md:p-8 flex flex-col">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-neutral-500 mb-2">
                {product.category}
              </p>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-3 leading-tight">
                {product.name}
              </h2>

              {/* merchandising badges */}
              <ProductBadges badges={product.badges} variant="inline" className="mb-4" />

              {/* rating */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <FiStar
                      key={s}
                      size={14}
                      className={
                        s <= Math.round(product.rating)
                          ? 'text-amber-400 fill-current'
                          : 'text-gray-200 dark:text-neutral-700'
                      }
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600 dark:text-neutral-300 font-medium">
                  {product.rating ? product.rating.toFixed(1) : 'New'}
                </span>
                <span className="text-sm text-gray-400 dark:text-neutral-500">
                  ({product.numReviews} reviews)
                </span>
              </div>

              {/* price */}
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold text-gray-900 dark:text-neutral-100">
                  ${product.price.toFixed(2)}
                </span>
                {product.comparePrice && product.comparePrice > product.price && (
                  <span className="text-base text-gray-400 line-through">
                    ${product.comparePrice.toFixed(2)}
                  </span>
                )}
              </div>

              {/* short description */}
              <p className="text-sm text-gray-600 dark:text-neutral-300 leading-relaxed mb-5 line-clamp-3">
                {product.description}
              </p>

              {/* stock + shipping */}
              <div className="flex items-center gap-4 mb-5 text-xs">
                {product.countInStock > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 font-semibold">
                    <FiCheck size={12} /> In stock
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 font-semibold">
                    Out of stock
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-gray-500 dark:text-neutral-400">
                  <FiTruck size={12} /> Free shipping over $100
                </span>
              </div>

              {/* quantity + add to cart */}
              {product.countInStock > 0 && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center border-2 border-gray-200 dark:border-neutral-700 rounded-xl">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="p-2.5 text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 rounded-l-xl transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <FiMinus size={14} />
                    </button>
                    <span className="w-10 text-center font-semibold text-gray-900 dark:text-neutral-100">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(product.countInStock, q + 1))}
                      className="p-2.5 text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 rounded-r-xl transition-colors"
                      aria-label="Increase quantity"
                    >
                      <FiPlus size={14} />
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                      added
                        ? 'bg-green-600 text-white'
                        : 'bg-black text-white hover:bg-gray-900 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white'
                    }`}
                  >
                    {added ? (
                      <>
                        <FiCheck size={16} /> Added
                      </>
                    ) : (
                      <>
                        <FiShoppingBag size={16} /> Add to Bag
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* compare + view full details */}
              <div className="mt-auto flex items-center gap-2">
                <CompareButton
                  productId={product._id}
                  name={product.name}
                  price={product.price}
                  image={product.images?.[0] || ''}
                  variant="pill"
                />
                <Link
                  to={`/products/${product._id}`}
                  onClick={onClose}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm border-2 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  View full details
                  <FiArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default QuickViewModal;
