import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { removeFromCompare, clearCompare } from '../store/slices/compareSlice';
import api from '../services/api';
import {
  FiX,
  FiTrash2,
  FiStar,
  FiCheck,
  FiLoader,
  FiShoppingBag,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';

interface CompareProduct {
  _id: string;
  name: string;
  price: number;
  comparePrice?: number;
  images: string[];
  category: string;
  subcategory?: string;
  brand?: string;
  countInStock: number;
  rating: number;
  numReviews: number;
  sku: string;
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  tags?: string[];
}

interface RowSpec {
  label: string;
  render: (p: CompareProduct) => React.ReactNode;
  // highlight the best value across the row (lowest price, highest rating, etc.)
  best?: (p: CompareProduct) => number;
  // true = lower is better
  lowerIsBetter?: boolean;
}

const formatPrice = (v: number) => `$${v.toFixed(2)}`;

const CompareDrawer: React.FC = () => {
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.compare.items);

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [error, setError] = useState('');

  // auto-open the drawer when something is added for the first time
  useEffect(() => {
    if (items.length > 0 && !open) {
      setOpen(true);
    }
  }, [items.length, open]);

  // fetch fuller projections whenever the drawer opens or items change
  useEffect(() => {
    if (!open || items.length === 0) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getProductsForCompare(items.map((i) => i.id))
      .then((res) => {
        if (cancelled) return;
        const data: CompareProduct[] = res.data?.data || [];
        // keep order in sync with the slice
        const byId = new Map(data.map((p) => [p._id, p]));
        setProducts(items.map((i) => byId.get(i.id)).filter(Boolean) as CompareProduct[]);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load comparison');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, items]);

  const handleRemove = useCallback(
    (id: string) => {
      dispatch(removeFromCompare(id));
      if (items.length === 1) {
        setOpen(false);
        setExpanded(false);
      }
    },
    [dispatch, items.length]
  );

  // close drawer when the list empties
  useEffect(() => {
    if (items.length === 0) {
      setOpen(false);
      setExpanded(false);
    }
  }, [items.length]);

  if (items.length === 0) return null;

  // spec rows for the comparison table
  const rows: RowSpec[] = [
    {
      label: 'Price',
      render: (p) => (
        <span className="font-bold text-gray-900 dark:text-neutral-100">{formatPrice(p.price)}</span>
      ),
      best: (p) => p.price,
      lowerIsBetter: true,
    },
    {
      label: 'Rating',
      render: (p) => (
        <span className="inline-flex items-center gap-1">
          <FiStar size={12} className="text-amber-400 fill-current" />
          <span className="font-medium text-gray-700 dark:text-neutral-200">
            {p.rating ? p.rating.toFixed(1) : '—'}
          </span>
          <span className="text-xs text-gray-400">({p.numReviews})</span>
        </span>
      ),
      best: (p) => p.rating,
      lowerIsBetter: false,
    },
    {
      label: 'Brand',
      render: (p) => p.brand || '—',
    },
    {
      label: 'Category',
      render: (p) => (
        <span className="text-sm">
          {p.category}
          {p.subcategory ? ` / ${p.subcategory}` : ''}
        </span>
      ),
    },
    {
      label: 'Availability',
      render: (p) =>
        p.countInStock > 0 ? (
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
            <FiCheck size={12} /> In stock
          </span>
        ) : (
          <span className="text-red-500 font-medium">Out of stock</span>
        ),
    },
    {
      label: 'Weight',
      render: (p) => (p.weight ? `${p.weight} kg` : '—'),
    },
    {
      label: 'Dimensions',
      render: (p) =>
        p.dimensions
          ? `${p.dimensions.length} × ${p.dimensions.width} × ${p.dimensions.height}`
          : '—',
    },
    {
      label: 'SKU',
      render: (p) => <span className="text-xs font-mono text-gray-500">{p.sku}</span>,
    },
  ];

  // compute the best value per row for highlighting
  const bestIndex = (row: RowSpec): number => {
    if (!row.best || products.length < 2) return -1;
    const vals = products.map(row.best!);
    const target = row.lowerIsBetter ? Math.min(...vals) : Math.max(...vals);
    return vals.indexOf(target);
  };

  return (
    <>
      {/* collapsed bar — sits at the bottom of the viewport */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 pb-3">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl shadow-2xl overflow-hidden">
            {/* header row */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900 dark:text-neutral-100">
                  Compare ({items.length}/4)
                </span>
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors"
                >
                  {expanded ? (
                    <>
                      Collapse <FiChevronDown size={12} />
                    </>
                  ) : (
                    <>
                      Expand <FiChevronUp size={12} />
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => dispatch(clearCompare())}
                  className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear all
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Hide compare bar"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <FiX size={16} />
                </button>
              </div>
            </div>

            {/* collapsed: thumbnails strip */}
            {!expanded && (
              <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="relative flex-shrink-0 w-32 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800 flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-neutral-100 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">{formatPrice(item.price)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-neutral-200 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                      aria-label={`Remove ${item.name}`}
                    >
                      <FiX size={11} />
                    </button>
                  </div>
                ))}
                <div className="flex-shrink-0 ml-auto">
                  <button
                    onClick={() => setExpanded(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-black text-white text-xs font-semibold hover:bg-gray-900 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white transition-colors"
                  >
                    Compare now
                  </button>
                </div>
              </div>
            )}

            {/* expanded: full comparison table */}
            {expanded && (
              <div className="max-h-[70vh] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <FiLoader className="animate-spin text-gray-400" size={28} />
                  </div>
                ) : error ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-red-500 font-medium">{error}</p>
                  </div>
                ) : products.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-gray-400">No products to compare.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="sticky left-0 bg-white dark:bg-neutral-900 z-10 w-32 text-left p-3 align-bottom font-bold text-gray-500 dark:text-neutral-400 text-xs uppercase tracking-wider">
                            Product
                          </th>
                          {products.map((p) => (
                            <th key={p._id} className="p-3 align-top min-w-[160px]">
                              <div className="relative">
                                <button
                                  onClick={() => handleRemove(p._id)}
                                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-neutral-200 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors z-10"
                                  aria-label={`Remove ${p.name}`}
                                >
                                  <FiX size={11} />
                                </button>
                                <Link to={`/products/${p._id}`} onClick={() => setExpanded(false)}>
                                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800 mb-2">
                                    <img
                                      src={p.images?.[0]}
                                      alt={p.name}
                                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                                    />
                                  </div>
                                  <p className="font-semibold text-gray-900 dark:text-neutral-100 text-sm line-clamp-2 text-left hover:underline">
                                    {p.name}
                                  </p>
                                </Link>
                                <p className="font-bold text-gray-900 dark:text-neutral-100 text-left mt-1">
                                  {formatPrice(p.price)}
                                </p>
                                <Link
                                  to={`/products/${p._id}`}
                                  onClick={() => setExpanded(false)}
                                  className="mt-2 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity"
                                >
                                  <FiShoppingBag size={11} /> View
                                </Link>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, rIdx) => {
                          const bi = bestIndex(row);
                          return (
                            <tr
                              key={row.label}
                              className={rIdx % 2 === 0 ? 'bg-gray-50/50 dark:bg-neutral-800/30' : ''}
                            >
                              <td className="sticky left-0 z-10 bg-inherit p-3 font-semibold text-gray-500 dark:text-neutral-400 text-xs uppercase tracking-wider whitespace-nowrap">
                                {row.label}
                              </td>
                              {products.map((p, idx) => (
                                <td
                                  key={p._id}
                                  className={`p-3 text-center ${
                                    idx === bi
                                      ? 'bg-green-50 dark:bg-green-950/40 font-medium'
                                      : ''
                                  }`}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    {row.render(p)}
                                    {idx === bi && (
                                      <FiCheck
                                        size={12}
                                        className="text-green-600 dark:text-green-400"
                                      />
                                    )}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CompareDrawer;
