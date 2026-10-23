import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import api from '../../services/api';
import TableSkeleton from '../TableSkeleton';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiAlertCircle,
  FiRefreshCw,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiPercent,
  FiLoader,
  FiTag,
  FiClock,
} from 'react-icons/fi';

// ---- Types ----

type CouponType = 'percentage' | 'flat';

interface Coupon {
  _id: string;
  code: string;
  description?: string;
  type: CouponType;
  value: number;
  minOrder?: number;
  maxDiscount?: number;
  usageLimit?: number | null;
  usedCount?: number;
  perUserLimit?: number;
  validFrom?: string;
  validTo?: string;
  isActive?: boolean;
  stackable?: boolean;
  categories?: string[];
  createdAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface CouponsResponse {
  coupons: Coupon[];
  pagination: Pagination;
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface CouponFormState {
  code: string;
  description: string;
  type: CouponType;
  value: string;
  minOrder: string;
  maxDiscount: string;
  usageLimit: string;
  perUserLimit: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  stackable: boolean;
  categories: string;
}

// ---- Constants & helpers ----

const PAGE_SIZE = 20;

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const EMPTY_FORM: CouponFormState = {
  code: '',
  description: '',
  type: 'percentage',
  value: '',
  minOrder: '0',
  maxDiscount: '',
  usageLimit: '',
  perUserLimit: '1',
  validFrom: todayISO(),
  validTo: '',
  isActive: true,
  stackable: false,
  categories: '',
};

const formatCurrency = (value: number | undefined | null): string => {
  const v =
    typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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

type CouponStatus = 'active' | 'expired' | 'inactive';

const getStatus = (coupon: Coupon): CouponStatus => {
  if (coupon.isActive === false) return 'inactive';
  if (coupon.validTo) {
    const end = new Date(coupon.validTo).getTime();
    if (!Number.isNaN(end) && end < Date.now()) return 'expired';
  }
  return 'active';
};

const statusBadgeClass = (status: CouponStatus): string => {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700';
    case 'expired':
      return 'bg-gray-100 text-gray-600';
    case 'inactive':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

// ---- Component ----

const AdminCoupons: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit/Create modal
  const [editTarget, setEditTarget] = useState<Coupon | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [form, setForm] = useState<CouponFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchCoupons = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      const response = await api.get(`/api/coupons?${params.toString()}`);
      const data = unwrap<CouponsResponse>(response.data, {
        coupons: [],
        pagination: { page, limit: PAGE_SIZE, total: 0, pages: 1 },
      });
      const list = Array.isArray(data)
        ? (data as unknown as Coupon[])
        : data.coupons || [];
      const pg = Array.isArray(data)
        ? { page, limit: PAGE_SIZE, total: list.length, pages: 1 }
        : data.pagination || {
            page,
            limit: PAGE_SIZE,
            total: list.length,
            pages: 1,
          };
      setCoupons(list);
      setPagination(pg);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to load coupons. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons(1);
  }, [fetchCoupons]);

  const handlePrev = () => {
    if (pagination.page > 1) fetchCoupons(pagination.page - 1);
  };
  const handleNext = () => {
    if (pagination.page < pagination.pages) fetchCoupons(pagination.page + 1);
  };

  const openCreateModal = () => {
    setEditTarget(null);
    setIsCreateMode(true);
    setForm({ ...EMPTY_FORM, validFrom: todayISO() });
    setFormError(null);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditTarget(coupon);
    setIsCreateMode(false);
    setForm({
      code: coupon.code ?? '',
      description: coupon.description ?? '',
      type: coupon.type ?? 'percentage',
      value: typeof coupon.value === 'number' ? String(coupon.value) : '',
      minOrder:
        typeof coupon.minOrder === 'number' ? String(coupon.minOrder) : '0',
      maxDiscount:
        typeof coupon.maxDiscount === 'number'
          ? String(coupon.maxDiscount)
          : '',
      usageLimit:
        typeof coupon.usageLimit === 'number' ? String(coupon.usageLimit) : '',
      perUserLimit:
        typeof coupon.perUserLimit === 'number'
          ? String(coupon.perUserLimit)
          : '1',
      validFrom: coupon.validFrom
        ? new Date(coupon.validFrom).toISOString().slice(0, 10)
        : todayISO(),
      validTo: coupon.validTo
        ? new Date(coupon.validTo).toISOString().slice(0, 10)
        : '',
      isActive: coupon.isActive !== false,
      stackable: coupon.stackable === true,
      categories: Array.isArray(coupon.categories)
        ? coupon.categories.join(', ')
        : '',
    });
    setFormError(null);
  };

  const closeEditModal = () => {
    setEditTarget(null);
    setIsCreateMode(false);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleFormChange = (
    field: keyof CouponFormState,
    value: string | boolean,
  ): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildPayload = (): Record<string, unknown> | null => {
    const code = form.code.trim().toUpperCase();
    if (code.length < 3 || code.length > 30) {
      setFormError('Code must be 3-30 characters.');
      return null;
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      setFormError('Code may only contain uppercase letters, numbers, _ or -.');
      return null;
    }

    const value = parseFloat(form.value);
    if (!form.value || Number.isNaN(value) || value < 0) {
      setFormError('A valid value is required.');
      return null;
    }
    if (form.type === 'percentage' && value > 100) {
      setFormError('Percentage value cannot exceed 100.');
      return null;
    }

    const minOrder = parseFloat(form.minOrder);
    if (Number.isNaN(minOrder) || minOrder < 0) {
      setFormError('Minimum order must be a positive number.');
      return null;
    }

    const perUserLimit = parseInt(form.perUserLimit, 10);
    if (Number.isNaN(perUserLimit) || perUserLimit < 1) {
      setFormError('Per-user limit must be at least 1.');
      return null;
    }

    if (!form.validTo) {
      setFormError('Valid-to date is required.');
      return null;
    }
    const validFromISO = new Date(form.validFrom).toISOString();
    const validToISO = new Date(`${form.validTo}T23:59:59`).toISOString();
    if (new Date(validToISO).getTime() < new Date(validFromISO).getTime()) {
      setFormError('Valid-to date must be after valid-from date.');
      return null;
    }

    const payload: Record<string, unknown> = {
      code,
      description: form.description.trim(),
      type: form.type,
      value,
      minOrder,
      perUserLimit,
      validFrom: validFromISO,
      validTo: validToISO,
      isActive: form.isActive,
      stackable: form.stackable,
    };

    if (form.usageLimit.trim()) {
      const ul = parseInt(form.usageLimit, 10);
      if (!Number.isNaN(ul) && ul >= 1) payload.usageLimit = ul;
    } else {
      payload.usageLimit = null;
    }

    if (form.type === 'percentage' && form.maxDiscount.trim()) {
      const md = parseFloat(form.maxDiscount);
      if (!Number.isNaN(md) && md >= 0) payload.maxDiscount = md;
    }

    const cats = form.categories
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cats.length > 0) payload.categories = cats;

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload = buildPayload();
    if (!payload) return;

    setSubmitting(true);
    try {
      if (isCreateMode) {
        const response = await api.post('/api/coupons', payload);
        const body = response.data;
        if (body && typeof body === 'object' && 'success' in body) {
          const env = body as ApiEnvelope<unknown>;
          if (env.success === false) {
            setFormError(env.message || env.error || 'Failed to create coupon');
            return;
          }
        }
      } else if (editTarget) {
        const response = await api.put(
          `/api/coupons/${editTarget._id}`,
          payload,
        );
        const body = response.data;
        if (body && typeof body === 'object' && 'success' in body) {
          const env = body as ApiEnvelope<unknown>;
          if (env.success === false) {
            setFormError(env.message || env.error || 'Failed to update coupon');
            return;
          }
        }
      }
      closeEditModal();
      fetchCoupons(pagination.page);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setFormError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to save coupon. Please try again.',
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
      await api.delete(`/api/coupons/${deleteTarget._id}`);
      setDeleteTarget(null);
      const remaining = coupons.length - 1;
      const targetPage =
        remaining === 0 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;
      fetchCoupons(targetPage);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setDeleteError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to delete coupon. Please try again.',
      );
    } finally {
      setDeleting(false);
    }
  };

  // ---- Render: loading ----
  if (loading && coupons.length === 0) {
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
            onClick={() => fetchCoupons(pagination.page)}
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
          <div>
            <p className="text-sm text-gray-500 mb-1">
              <Link to="/admin/dashboard" className="hover:text-gray-700">
                Admin Dashboard
              </Link>{' '}
              / Coupons
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Manage Coupons
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              {pagination.total > 0
                ? `${pagination.total} coupon${pagination.total === 1 ? '' : 's'} configured`
                : 'Create discount coupons for the marketplace'}
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <FiPlus size={16} />
            Create Coupon
          </button>
        </div>

        {coupons.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FiTag className="mx-auto text-gray-300 mb-4" size={40} />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No coupons yet
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Create your first coupon!
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <FiPlus size={16} />
              Create Coupon
            </button>
          </div>
        ) : (
          <>
            {/* Coupons table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Min Order
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Usage
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Valid Until
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
                    {coupons.map((coupon) => {
                      const status = getStatus(coupon);
                      return (
                        <tr key={coupon._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="text-sm font-mono font-semibold text-gray-900">
                              {coupon.code}
                            </p>
                            {coupon.description && (
                              <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                {coupon.description}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              {coupon.type === 'percentage' ? (
                                <FiPercent size={12} />
                              ) : (
                                <FiTag size={12} />
                              )}
                              {coupon.type === 'percentage'
                                ? 'Percentage'
                                : 'Flat'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {coupon.type === 'percentage'
                              ? `${coupon.value}%`
                              : formatCurrency(coupon.value)}
                            {coupon.type === 'percentage' &&
                              coupon.maxDiscount && (
                                <span className="block text-xs text-gray-500">
                                  max {formatCurrency(coupon.maxDiscount)}
                                </span>
                              )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {formatCurrency(coupon.minOrder || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {coupon.usedCount || 0}
                            {typeof coupon.usageLimit === 'number'
                              ? ` / ${coupon.usageLimit}`
                              : ' / ∞'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <FiClock size={12} className="text-gray-400" />
                              {formatDate(coupon.validTo)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusBadgeClass(
                                status,
                              )}`}
                            >
                              {status.charAt(0).toUpperCase() +
                                status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => openEditModal(coupon)}
                                className="inline-flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                aria-label={`Edit ${coupon.code}`}
                                title="Edit coupon"
                              >
                                <FiEdit2 size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeleteTarget(coupon);
                                }}
                                className="inline-flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                aria-label={`Delete ${coupon.code}`}
                                title="Delete coupon"
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

      {/* Create / Edit Modal */}
      {(editTarget || isCreateMode) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) closeEditModal();
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {isCreateMode ? 'Create Coupon' : 'Edit Coupon'}
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

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) =>
                      handleFormChange(
                        'code',
                        e.target.value.toUpperCase(),
                      )
                    }
                    placeholder="SUMMER20"
                    maxLength={30}
                    className={`${inputClass} font-mono uppercase`}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    3-30 chars, uppercase letters, numbers, _ or -.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      handleFormChange('type', e.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="flat">Flat amount</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    handleFormChange('description', e.target.value)
                  }
                  placeholder="Summer sale 20% off"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={form.type === 'percentage' ? 100 : undefined}
                    value={form.value}
                    onChange={(e) => handleFormChange('value', e.target.value)}
                    placeholder="0"
                    className={inputClass}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {form.type === 'percentage'
                      ? 'Percentage (0-100).'
                      : 'Amount in USD.'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Order (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.minOrder}
                    onChange={(e) =>
                      handleFormChange('minOrder', e.target.value)
                    }
                    placeholder="0.00"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Discount{' '}
                    {form.type !== 'percentage' && (
                      <span className="text-gray-400">(percentage only)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.maxDiscount}
                    onChange={(e) =>
                      handleFormChange('maxDiscount', e.target.value)
                    }
                    placeholder="Optional"
                    disabled={form.type !== 'percentage'}
                    className={`${inputClass} ${
                      form.type !== 'percentage'
                        ? 'opacity-60 cursor-not-allowed'
                        : ''
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.usageLimit}
                    onChange={(e) =>
                      handleFormChange('usageLimit', e.target.value)
                    }
                    placeholder="Leave blank = unlimited"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Per-User Limit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.perUserLimit}
                    onChange={(e) =>
                      handleFormChange('perUserLimit', e.target.value)
                    }
                    placeholder="1"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid From
                  </label>
                  <input
                    type="date"
                    value={form.validFrom}
                    onChange={(e) =>
                      handleFormChange('validFrom', e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid To <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.validTo}
                    onChange={(e) =>
                      handleFormChange('validTo', e.target.value)
                    }
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categories
                </label>
                <input
                  type="text"
                  value={form.categories}
                  onChange={(e) =>
                    handleFormChange('categories', e.target.value)
                  }
                  placeholder="Electronics, Shoes (comma-separated, optional)"
                  className={inputClass}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Restrict the coupon to specific categories. Leave blank to
                  apply to all.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Active status
                  </p>
                  <p className="text-xs text-gray-500">
                    Inactive coupons cannot be redeemed.
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

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Stackable
                  </p>
                  <p className="text-xs text-gray-500">
                    Allow this coupon to combine with other discounts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleFormChange('stackable', !form.stackable)
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.stackable ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                  aria-label="Toggle stackable"
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      form.stackable ? 'translate-x-5' : 'translate-x-1'
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
                      {isCreateMode ? 'Create Coupon' : 'Save Changes'}
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
                    Delete coupon?
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Are you sure you want to delete{' '}
                    <span className="font-mono font-medium text-gray-900">
                      {deleteTarget.code}
                    </span>
                    ? This action cannot be undone.
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

export default AdminCoupons;
