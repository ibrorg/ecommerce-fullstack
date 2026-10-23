import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  FiX,
  FiStar,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiSliders,
  FiLoader,
} from 'react-icons/fi';

export interface FilterState {
  search: string;
  category: string;
  brand: string; // comma-separated
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock: boolean;
  sort: string;
  badges: string; // comma-separated badge names (OR)
}

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  // when provided, the active category is shown as a read-only chip and the
  // category dropdown is hidden (e.g. when browsing a specific category page)
  lockedCategory?: string;
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'oldest', label: 'Oldest' },
];

const RATING_OPTIONS = [4, 3, 2, 1];

const PRICE_PRESETS = [
  { label: 'Under $25', min: undefined, max: 25 },
  { label: '$25 – $50', min: 25, max: 50 },
  { label: '$50 – $100', min: 50, max: 100 },
  { label: '$100 – $250', min: 100, max: 250 },
  { label: 'Over $250', min: 250, max: undefined },
];

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filters,
  onChange,
  lockedCategory,
}) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // collapsed section state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    category: true,
    price: true,
    brand: true,
    rating: true,
    availability: true,
    badges: true,
  });

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // fetch categories + brands once on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingMeta(true);
    Promise.all([api.getCategories(), api.getBrands()])
      .then(([catRes, brandRes]) => {
        if (cancelled) return;
        setCategories(catRes.data?.data || []);
        setBrands(brandRes.data?.data || []);
      })
      .catch(() => {
        // non-blocking — filters still work without the dropdowns
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBrands = filters.brand
    ? filters.brand.split(',').map((b) => b.trim()).filter(Boolean)
    : [];

  const toggleBrand = (brand: string) => {
    const set = new Set(selectedBrands);
    if (set.has(brand)) set.delete(brand);
    else set.add(brand);
    onChange({ ...filters, brand: Array.from(set).join(',') });
  };

  const setPricePreset = (min: number | undefined, max: number | undefined) => {
    onChange({ ...filters, minPrice: min, maxPrice: max });
  };

  const isPresetActive = (min: number | undefined, max: number | undefined) =>
    filters.minPrice === min && filters.maxPrice === max;

  const setRating = (r: number | undefined) => {
    onChange({ ...filters, minRating: filters.minRating === r ? undefined : r });
  };

  // badge filter — matches the backend computeBadges names
  const BADGE_OPTIONS = [
    { value: 'Sale', label: 'On Sale', color: 'bg-red-500' },
    { value: 'New', label: 'New Arrivals', color: 'bg-blue-500' },
    { value: 'Top Rated', label: 'Top Rated', color: 'bg-amber-500' },
    { value: 'Bestseller', label: 'Bestseller', color: 'bg-neutral-900' },
    { value: 'Low Stock', label: 'Low Stock', color: 'bg-orange-500' },
  ];

  const selectedBadges = filters.badges
    ? filters.badges.split(',').map((b) => b.trim()).filter(Boolean)
    : [];

  const toggleBadge = (badge: string) => {
    const set = new Set(selectedBadges);
    if (set.has(badge)) set.delete(badge);
    else set.add(badge);
    onChange({ ...filters, badges: Array.from(set).join(',') });
  };

  const inputClass =
    'w-full px-3 py-2 text-sm border-2 border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-300 transition-colors';

  const SectionHeader: React.FC<{ label: string; sectionKey: string }> = ({
    label,
    sectionKey,
  }) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionKey)}
      className="flex items-center justify-between w-full py-2 text-sm font-bold text-gray-900 dark:text-neutral-100 uppercase tracking-wider"
    >
      {label}
      {openSections[sectionKey] ? (
        <FiChevronUp size={16} />
      ) : (
        <FiChevronDown size={16} />
      )}
    </button>
  );

  return (
    <div className="space-y-1">
      {/* Clear all button — only shows when filters are active */}
      {(() => {
        const hasActive = !!(filters.category || filters.brand || filters.minPrice !== undefined || filters.maxPrice !== undefined || filters.minRating !== undefined || filters.inStock || filters.badges || (filters.sort && filters.sort !== 'newest'));
        if (!hasActive) return null;
        return (
          <button
            onClick={() => onChange({ search: filters.search, category: '', brand: '', minPrice: undefined, maxPrice: undefined, minRating: undefined, inStock: false, sort: 'newest', badges: '' })}
            className="w-full mb-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors flex items-center justify-center gap-1.5"
          >
            <FiX size={12} />
            Clear all filters
          </button>
        );
      })()}

      {/* Sort — always visible at the top */}
      <div className="pb-4 border-b border-gray-100 dark:border-neutral-800">
        <label className="block text-sm font-bold text-gray-900 dark:text-neutral-100 mb-2 uppercase tracking-wider">
          Sort By
        </label>
        <select
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value })}
          className={inputClass}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      {!lockedCategory && (
        <div className="py-3 border-b border-gray-100 dark:border-neutral-800">
          <SectionHeader label="Category" sectionKey="category" />
          {openSections.category && (
            <div className="pt-2 space-y-1.5">
              {loadingMeta ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <FiLoader className="animate-spin" size={12} /> Loading…
                </div>
              ) : (
                <>
                  <button
                    onClick={() => onChange({ ...filters, category: '' })}
                    className={`block w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
                      !filters.category
                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold'
                        : 'text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    All Categories
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => onChange({ ...filters, category: cat })}
                      className={`block w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
                        filters.category === cat
                          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold'
                          : 'text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Price */}
      <div className="py-3 border-b border-gray-100 dark:border-neutral-800">
        <SectionHeader label="Price" sectionKey="price" />
        {openSections.price && (
          <div className="pt-2 space-y-2">
            {PRICE_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setPricePreset(p.min, p.max)}
                className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  isPresetActive(p.min, p.max)
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold'
                    : 'text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                }`}
              >
                {p.label}
                {isPresetActive(p.min, p.max) && <FiCheck size={14} />}
              </button>
            ))}
            {/* custom range */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                placeholder="Min"
                value={filters.minPrice ?? ''}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    minPrice: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className={inputClass}
                min={0}
              />
              <span className="text-gray-400">–</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxPrice ?? ''}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    maxPrice: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className={inputClass}
                min={0}
              />
            </div>
          </div>
        )}
      </div>

      {/* Brand */}
      <div className="py-3 border-b border-gray-100 dark:border-neutral-800">
        <SectionHeader label="Brand" sectionKey="brand" />
        {openSections.brand && (
          <div className="pt-2 space-y-1 max-h-48 overflow-y-auto">
            {loadingMeta ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                <FiLoader className="animate-spin" size={12} /> Loading…
              </div>
            ) : brands.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-1">No brands available</p>
            ) : (
              brands.map((b) => {
                const checked = selectedBrands.includes(b);
                return (
                  <label
                    key={b}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBrand(b)}
                      className="w-4 h-4 accent-neutral-900 dark:accent-neutral-100"
                    />
                    <span className="text-sm text-gray-700 dark:text-neutral-200">{b}</span>
                  </label>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Rating */}
      <div className="py-3 border-b border-gray-100 dark:border-neutral-800">
        <SectionHeader label="Rating" sectionKey="rating" />
        {openSections.rating && (
          <div className="pt-2 space-y-1">
            {RATING_OPTIONS.map((r) => {
              const active = filters.minRating === r;
              return (
                <button
                  key={r}
                  onClick={() => setRating(r)}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold'
                      : 'text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <FiStar
                        key={s}
                        size={12}
                        className={
                          s <= r
                            ? active
                              ? 'text-amber-300 fill-current'
                              : 'text-amber-400 fill-current'
                            : active
                            ? 'text-white/30'
                            : 'text-gray-200 dark:text-neutral-700'
                        }
                      />
                    ))}
                  </span>
                  <span>&amp; up</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Availability */}
      <div className="py-3 border-b border-gray-100 dark:border-neutral-800">
        <SectionHeader label="Availability" sectionKey="availability" />
        {openSections.availability && (
          <div className="pt-2">
            <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.inStock}
                onChange={(e) => onChange({ ...filters, inStock: e.target.checked })}
                className="w-4 h-4 accent-neutral-900 dark:accent-neutral-100"
              />
              <span className="text-sm text-gray-700 dark:text-neutral-200">In stock only</span>
            </label>
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="py-3">
        <SectionHeader label="Highlights" sectionKey="badges" />
        {openSections.badges && (
          <div className="pt-2 space-y-1">
            {BADGE_OPTIONS.map((badge) => {
              const checked = selectedBadges.includes(badge.value);
              return (
                <label
                  key={badge.value}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBadge(badge.value)}
                    className="w-4 h-4 accent-neutral-900 dark:accent-neutral-100"
                  />
                  <span className={`w-2 h-2 rounded-full ${badge.color}`} />
                  <span className="text-sm text-gray-700 dark:text-neutral-200">{badge.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterSidebar;
