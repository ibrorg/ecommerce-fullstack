import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import api from '../../services/api';
import TableSkeleton from '../TableSkeleton';
import {
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiAlertCircle,
  FiRefreshCw,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiPackage,
  FiLoader,
  FiFilter,
} from 'react-icons/fi';

// ---- Types ----

interface AdminProduct {
  _id: string;
  name: string;
  description?: string;
  price: number;
  comparePrice?: number;
  category?: string;
  brand?: string;
  countInStock: number;
  sku?: string;
  images?: string[];
  isActive?: boolean;
  createdAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface ProductsResponse {
  products: AdminProduct[];
  pagination: Pagination;
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface ProductFormState {
  name: string;
  description: string;
  price: string;
  comparePrice: string;
  category: string;
  brand: string;
  countInStock: string;
  isActive: boolean;
}

// ---- Constants & helpers ----

const PAGE_SIZE = 20;

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';

const EMPTY_FORM: ProductFormState = {
  name: '',
  description: '',
  price: '',
  comparePrice: '',
  category: '',
  brand: '',
  countInStock: '',
  isActive: true,
};

const formatCurrency = (value: number | undefined): string => {
  const v = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

/**
 * Backend may return either an envelope { success, data } or a raw payload.
 */
function unwrap<T>(responseData: unknown, fallback: T): T {
  if (
    responseData &&
    typeof responseData === 'object' &&
    !Array.isArray(responseData) &&
    'success' in responseData
  ) {
    const env = responseData as ApiEnvelope<T>;
    return env.data ?? fallback;
  }
  return (responseData as T | undefined) ?? fallback;
}

// ---- Component ----

const AdminProducts: React.FC = () => {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Edit modal
  const [editTarget, setEditTarget] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchProducts = useCallback(
    async (page: number, search: string, category: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (search.trim()) params.set('search', search.trim());
        if (category.trim()) params.set('category', category.trim());
        const response = await api.get(`/api/products?${params.toString()}`);
        const data = unwrap<ProductsResponse>(response.data, {
          products: [],
          pagination: { page, limit: PAGE_SIZE, total: 0, pages: 1 },
        });
        // Defensive: backend may return an array directly or nested.
        const list = Array.isArray(data)
          ? (data as unknown as AdminProduct[])
          : data.products || [];
        const pg = Array.isArray(data)
          ? { page, limit: PAGE_SIZE, total: list.length, pages: 1 }
          : data.pagination || {
              page,
              limit: PAGE_SIZE,
              total: list.length,
              pages: 1,
            };
        setProducts(list);
        setPagination(pg);
      } catch (err) {
        const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
        setError(
          axiosErr.response?.data?.message ||
            axiosErr.response?.data?.error ||
            'Unable to load products. Please try again.',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchProducts(1, searchTerm, categoryFilter);
  }, [fetchProducts, searchTerm, categoryFilter]);

  // Unique category list derived from current page (for the filter dropdown)
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const handlePrev = () => {
    if (pagination.page > 1) {
      fetchProducts(pagination.page - 1, searchTerm, categoryFilter);
    }
  };
  const handleNext = () => {
    if (pagination.page < pagination.pages) {
      fetchProducts(pagination.page + 1, searchTerm, categoryFilter);
    }
  };

  const handleApplySearch = () => {
    setSearchTerm(searchInput.trim());
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setCategoryFilter('');
  };

  const openEditModal = (product: AdminProduct) => {
    setEditTarget(product);
    setForm({
      name: product.name ?? '',
      description: product.description ?? '',
      price:
        typeof product.price === 'number' ? String(product.price) : '',
      comparePrice:
        typeof product.comparePrice === 'number'
          ? String(product.comparePrice)
          : '',
      category: product.category ?? '',
      brand: product.brand ?? '',
      countInStock:
        typeof product.countInStock === 'number'
          ? String(product.countInStock)
          : '',
      isActive: product.isActive !== false,
    });
    setFormError(null);
  };

  const closeEditModal = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleFormChange = (
    field: keyof ProductFormState,
    value: string | boolean,
  ): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setFormError(null);

    if (!form.name.trim()) {
      setFormError('Product name is required');
      return;
    }
    const price = parseFloat(form.price);
    if (!form.price || Number.isNaN(price) || price < 0) {
      setFormError('A valid price is required');
      return;
    }
    const stock = parseInt(form.countInStock, 10);
    if (Number.isNaN(stock) || stock < 0) {
      setFormError('A valid stock count is required');
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      category: form.category.trim() || 'Uncategorized',
      countInStock: stock,
      isActive: form.isActive,
    };
    if (form.brand.trim()) payload.brand = form.brand.trim();
    if (form.comparePrice) {
      const cp = parseFloat(form.comparePrice);
      if (!Number.isNaN(cp) && cp >= 0) payload.comparePrice = cp;
    }

    setSubmitting(true);
    try {
      const response = await api.put(
        `/api/products/${editTarget._id}`,
        payload,
      );
      const body = response.data;
      let ok = true;
      let msg: string | undefined;
      if (body && typeof body === 'object' && 'success' in body) {
        const env = body as ApiEnvelope<unknown>;
        ok = env.success !== false;
        msg = env.message || env.error;
      }
      if (!ok) {
        setFormError(msg || 'Failed to update product');
        return;
      }
      closeEditModal();
      fetchProducts(pagination.page, searchTerm, categoryFilter);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setFormError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to update product. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/products/${deleteTarget._id}`);
      setDeleteTarget(null);
      const remaining = products.length - 1;
      const targetPage =
        remaining === 0 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;
      fetchProducts(targetPage, searchTerm, categoryFilter);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setDeleteError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to delete product. Please try again.',
      );
    } finally {
      setDeleting(false);
    }
  };

  // ---- Render: loading ----
  if (loading && products.length === 0) {
    return <TableSkeleton rowCount={6} titleWidth="w-56" />;
  }

  // ---- Render: error ----
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg p-6 text-center">
          <FiAlertCircle className="mx-auto text-red-600 dark:text-red-400 mb-3" size={32} />
          <h2 className="text-lg font-semibold text-red-900 mb-1">
            Something went wrong
          </h2>
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <button
            onClick={() =>
              fetchProducts(pagination.page, searchTerm, categoryFilter)
            }
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            <FiRefreshCw size={16} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-1">
            <Link to="/admin/dashboard" className="hover:text-gray-700">
              Admin Dashboard
            </Link>{' '}
            / Products
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Manage Products
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            {pagination.total > 0
              ? `${pagination.total} product${pagination.total === 1 ? '' : 's'} in the marketplace`
              : 'Search and manage all marketplace products'}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <FiSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplySearch();
              }}
              placeholder="Search by product name..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <FiFilter className="text-gray-400" size={16} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              onClick={handleApplySearch}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Search
            </button>
            {(searchTerm || categoryFilter) && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {products.length === 0 ? (
          // Empty state
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FiPackage className="mx-auto text-gray-300 mb-4" size={40} />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No products found
            </h3>
            <p className="text-sm text-gray-500">
              {searchTerm || categoryFilter
                ? 'Try adjusting your search or filter.'
                : 'Products will appear here once sellers list them.'}
            </p>
          </div>
        ) : (
          <>
            {/* Products table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Image
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((product) => (
                      <tr key={product._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <img
                            src={product.images?.[0] || FALLBACK_IMAGE}
                            alt={product.name}
                            className="w-12 h-12 rounded-md object-cover bg-gray-100"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                FALLBACK_IMAGE;
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {product.name}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {product.sku || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {formatCurrency(product.price)}
                          {product.comparePrice &&
                            product.comparePrice > product.price && (
                              <span className="ml-1 text-xs text-gray-400 line-through">
                                {formatCurrency(product.comparePrice)}
                              </span>
                            )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {product.countInStock}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {product.category || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                              product.isActive === false
                                ? 'bg-red-100 text-red-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {product.isActive === false
                              ? 'Inactive'
                              : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(product)}
                              className="inline-flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              aria-label={`Edit ${product.name}`}
                              title="Edit product"
                            >
                              <FiEdit2 size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget(product);
                              }}
                              className="inline-flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              aria-label={`Delete ${product.name}`}
                              title="Delete product"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {Math.max(pagination.pages, 1)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  disabled={pagination.page <= 1 || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <FiChevronLeft size={14} />
                  Prev
                </button>
                <button
                  onClick={handleNext}
                  disabled={pagination.page >= pagination.pages || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <FiChevronRight size={14} />
                </button>
              </div>
            </div>
            {loading && (
              <p className="mt-2 text-xs text-gray-500 inline-flex items-center gap-1">
                <FiLoader className="animate-spin" size={12} />
                Loading...
              </p>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) closeEditModal();
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit Product
              </h2>
              <button
                onClick={closeEditModal}
                disabled={submitting}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g. Wireless Headphones"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    handleFormChange('description', e.target.value)
                  }
                  placeholder="Describe the product..."
                  rows={3}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (USD) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => handleFormChange('price', e.target.value)}
                    placeholder="0.00"
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Compare-at Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.comparePrice}
                    onChange={(e) =>
                      handleFormChange('comparePrice', e.target.value)
                    }
                    placeholder="0.00"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) =>
                      handleFormChange('category', e.target.value)
                    }
                    placeholder="e.g. Electronics"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => handleFormChange('brand', e.target.value)}
                    placeholder="e.g. Acme"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Count <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.countInStock}
                  onChange={(e) =>
                    handleFormChange('countInStock', e.target.value)
                  }
                  placeholder="0"
                  className={inputClass}
                  required
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Active status
                  </p>
                  <p className="text-xs text-gray-500">
                    Inactive products are hidden from the storefront.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleFormChange('isActive', !form.isActive)
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.isActive ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                  aria-label="Toggle active status"
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      form.isActive ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {formError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <FiAlertCircle
                    className="text-red-600 flex-shrink-0 mt-0.5"
                    size={16}
                  />
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <>
                      <FiLoader className="animate-spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiEdit2 size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-red-50 rounded-lg flex-shrink-0">
                  <FiAlertCircle className="text-red-600" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Delete product?
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Are you sure you want to delete{' '}
                    <span className="font-medium text-gray-900">
                      {deleteTarget.name}
                    </span>
                    ? This action cannot be undone from this view.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{deleteError}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? (
                    <>
                      <FiLoader className="animate-spin" size={16} />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <FiTrash2 size={16} />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
