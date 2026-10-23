import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import api from '../../services/api';
import TableSkeleton from '../TableSkeleton';
import {
  FiAlertCircle,
  FiRefreshCw,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiPackage,
  FiLoader,
  FiCheckCircle,
  FiXCircle,
  FiRotateCcw,
  FiChevronDown,
  FiChevronUp,
  FiDollarSign,
  FiUser,
  FiCalendar,
  FiImage,
  FiClock,
} from 'react-icons/fi';

// ---- Types ----

type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'refunded'
  | 'rejected'
  | 'cancelled';

interface ReturnItem {
  product: string;
  name?: string;
  quantity: number;
  price: number;
  reason?: string;
}

interface OrderRef {
  _id: string;
  orderNumber?: string;
}

interface UserRef {
  _id?: string;
  name?: string;
  email?: string;
}

interface ReturnRecord {
  _id: string;
  returnNumber?: string;
  order?: OrderRef | string;
  user?: UserRef | string;
  items: ReturnItem[];
  reason?: string;
  photos?: string[];
  status: ReturnStatus;
  refundAmount?: number;
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface ReturnsResponse {
  returns: ReturnRecord[];
  pagination?: Pagination;
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface StatusTab {
  key: '' | ReturnStatus;
  label: string;
}

// ---- Constants & helpers ----

const PAGE_SIZE = 20;

const STATUS_TABS: StatusTab[] = [
  { key: '', label: 'All' },
  { key: 'requested', label: 'Requested' },
  { key: 'approved', label: 'Approved' },
  { key: 'refunded', label: 'Refunded' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE: Record<
  ReturnStatus,
  { label: string; classes: string; icon: React.ComponentType<{ size?: number }> }
> = {
  requested: {
    label: 'Requested',
    classes: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: FiClock,
  },
  approved: {
    label: 'Approved',
    classes: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: FiCheckCircle,
  },
  refunded: {
    label: 'Refunded',
    classes: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: FiDollarSign,
  },
  rejected: {
    label: 'Rejected',
    classes: 'bg-red-100 text-red-700 border-red-200',
    icon: FiXCircle,
  },
  cancelled: {
    label: 'Cancelled',
    classes: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: FiX,
  },
};

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const formatCurrency = (value: number | undefined): string => {
  const v = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};

const shortId = (id: string | undefined): string => {
  if (!id) return '—';
  return id.length > 8 ? `#${id.slice(-6).toUpperCase()}` : `#${id.toUpperCase()}`;
};

const getOrderRef = (order: ReturnRecord['order']): OrderRef | null => {
  if (!order) return null;
  if (typeof order === 'string') return { _id: order };
  return order;
};

const getUserRef = (user: ReturnRecord['user']): UserRef | null => {
  if (!user) return null;
  if (typeof user === 'string') return { _id: user };
  return user;
};

const getCustomerLabel = (user: ReturnRecord['user']): string => {
  const ref = getUserRef(user);
  if (!ref) return '—';
  return ref.name || ref.email || shortId(ref._id);
};

const calculateRefundAmount = (record: ReturnRecord): number => {
  if (!Array.isArray(record.items)) return 0;
  return record.items.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
    0,
  );
};

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

const AdminReturns: React.FC = () => {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [statusFilter, setStatusFilter] = useState<'' | ReturnStatus>('');

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Approve modal
  const [approveTarget, setApproveTarget] = useState<ReturnRecord | null>(null);
  const [refundInput, setRefundInput] = useState<string>('');
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<ReturnRecord | null>(null);
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const fetchReturns = useCallback(
    async (page: number, status: '' | ReturnStatus) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (status) params.set('status', status);
        const response = await api.get(`/api/returns?${params.toString()}`);
        const data = unwrap<ReturnsResponse | ReturnRecord[]>(
          response.data,
          [],
        );
        const list: ReturnRecord[] = Array.isArray(data)
          ? (data as ReturnRecord[])
          : data.returns || [];
        const pg: Pagination = Array.isArray(data)
          ? { page, limit: PAGE_SIZE, total: list.length, pages: 1 }
          : data.pagination || {
              page,
              limit: PAGE_SIZE,
              total: list.length,
              pages: 1,
            };
        setReturns(list);
        setPagination(pg);
      } catch (err) {
        const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
        setError(
          axiosErr.response?.data?.message ||
            axiosErr.response?.data?.error ||
            'Unable to load returns. Please try again.',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchReturns(1, statusFilter);
  }, [fetchReturns, statusFilter]);

  const handlePrev = () => {
    if (pagination.page > 1) {
      fetchReturns(pagination.page - 1, statusFilter);
    }
  };
  const handleNext = () => {
    if (pagination.page < pagination.pages) {
      fetchReturns(pagination.page + 1, statusFilter);
    }
  };

  const openApproveModal = (record: ReturnRecord) => {
    setApproveTarget(record);
    setRefundInput(String(calculateRefundAmount(record).toFixed(2)));
    setApproveError(null);
  };

  const closeApproveModal = () => {
    setApproveTarget(null);
    setRefundInput('');
    setApproveError(null);
  };

  const openRejectModal = (record: ReturnRecord) => {
    setRejectTarget(record);
    setAdminNotes('');
    setRejectError(null);
  };

  const closeRejectModal = () => {
    setRejectTarget(null);
    setAdminNotes('');
    setRejectError(null);
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveTarget) return;
    setApproveError(null);

    const refund = parseFloat(refundInput);
    if (Number.isNaN(refund) || refund < 0) {
      setApproveError('Please enter a valid refund amount');
      return;
    }

    const payload: Record<string, unknown> = {};
    // Only send refundAmount if it differs from the calculated default — backend
    // treats it as optional and will compute its own default otherwise.
    if (refund !== calculateRefundAmount(approveTarget)) {
      payload.refundAmount = refund;
    }

    setApproving(true);
    try {
      const response = await api.put(
        `/api/returns/${approveTarget._id}/approve`,
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
        setApproveError(msg || 'Failed to approve return');
        return;
      }
      closeApproveModal();
      fetchReturns(pagination.page, statusFilter);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setApproveError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to approve return. Please try again.',
      );
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    setRejectError(null);

    if (!adminNotes.trim()) {
      setRejectError('Please provide a reason for rejecting this return');
      return;
    }

    setRejecting(true);
    try {
      const response = await api.put(
        `/api/returns/${rejectTarget._id}/reject`,
        { adminNotes: adminNotes.trim() },
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
        setRejectError(msg || 'Failed to reject return');
        return;
      }
      closeRejectModal();
      fetchReturns(pagination.page, statusFilter);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setRejectError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to reject return. Please try again.',
      );
    } finally {
      setRejecting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ---- Render: loading ----
  if (loading && returns.length === 0) {
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
            onClick={() => fetchReturns(pagination.page, statusFilter)}
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
            / Returns
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FiRotateCcw size={26} />
            Manage Returns
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            {pagination.total > 0
              ? `${pagination.total} return request${pagination.total === 1 ? '' : 's'} in the marketplace`
              : 'Review and process customer return requests'}
          </p>
        </div>

        {/* Status filter tabs */}
        <div className="bg-white rounded-lg border border-gray-200 p-2 mb-4 flex flex-wrap items-center gap-1">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key || 'all'}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  active
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {returns.length === 0 ? (
          // Empty state
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FiRotateCcw className="mx-auto text-gray-300 mb-4" size={40} />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No returns found
            </h3>
            <p className="text-sm text-gray-500">
              {statusFilter
                ? `There are no ${statusFilter} return requests right now.`
                : 'Return requests from customers will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Returns table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8" />
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Return ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Order #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Refund
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Requested
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {returns.map((record) => {
                      const orderRef = getOrderRef(record.order);
                      const badge = STATUS_BADGE[record.status] || STATUS_BADGE.requested;
                      const StatusIcon = badge.icon;
                      const refund = record.refundAmount ?? calculateRefundAmount(record);
                      const isExpanded = expandedId === record._id;
                      const isRequested = record.status === 'requested';
                      return (
                        <React.Fragment key={record._id}>
                          <tr className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => toggleExpand(record._id)}
                                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                                title={isExpanded ? 'Hide details' : 'View details'}
                              >
                                {isExpanded ? (
                                  <FiChevronUp size={16} />
                                ) : (
                                  <FiChevronDown size={16} />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                              {record.returnNumber || shortId(record._id)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                              {orderRef?.orderNumber || shortId(orderRef?._id)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                              {getCustomerLabel(record.user)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {record.items?.length || 0}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                              {formatCurrency(refund)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${badge.classes}`}
                              >
                                <StatusIcon size={12} />
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                              {formatDate(record.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isRequested ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    onClick={() => openApproveModal(record)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                                    title="Approve return"
                                  >
                                    <FiCheckCircle size={14} />
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => openRejectModal(record)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                                    title="Reject return"
                                  >
                                    <FiXCircle size={14} />
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-gray-50">
                              <td colSpan={9} className="px-6 py-4">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                  {/* Items list */}
                                  <div className="lg:col-span-2">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <FiPackage size={12} />
                                      Returned Items
                                    </h4>
                                    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                                      {record.items?.length ? (
                                        record.items.map((item, idx) => (
                                          <div
                                            key={idx}
                                            className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                                          >
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-gray-900 truncate">
                                                {item.name || shortId(item.product)}
                                              </p>
                                              {item.reason && (
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                  Reason: {item.reason.replace(/_/g, ' ')}
                                                </p>
                                              )}
                                            </div>
                                            <div className="text-xs text-gray-600 whitespace-nowrap">
                                              Qty{' '}
                                              <span className="font-semibold text-gray-900">
                                                {item.quantity}
                                              </span>
                                            </div>
                                            <div className="text-xs text-gray-600 whitespace-nowrap">
                                              @ {formatCurrency(item.price)}
                                            </div>
                                            <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                              {formatCurrency(
                                                (item.price || 0) * (item.quantity || 0),
                                              )}
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <p className="p-3 text-sm text-gray-500">
                                          No items recorded.
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Buyer reason + photos */}
                                  <div className="space-y-3">
                                    <div>
                                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <FiUser size={12} />
                                        Buyer Reason
                                      </h4>
                                      <p className="text-sm text-gray-700 bg-white rounded-lg border border-gray-200 p-3">
                                        {record.reason || 'No reason provided.'}
                                      </p>
                                    </div>

                                    {record.photos && record.photos.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                          <FiImage size={12} />
                                          Photos
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                          {record.photos.map((url, idx) => (
                                            <a
                                              key={idx}
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="block w-16 h-16 rounded-md overflow-hidden border border-gray-200 hover:border-gray-400 transition-colors"
                                              title={`Photo ${idx + 1}`}
                                            >
                                              <img
                                                src={url}
                                                alt={`Return photo ${idx + 1}`}
                                                className="w-full h-full object-cover bg-gray-100"
                                                onError={(e) => {
                                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                                }}
                                              />
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {record.adminNotes && (
                                      <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                          <FiAlertCircle size={12} />
                                          Admin Notes
                                        </h4>
                                        <p className="text-sm text-gray-700 bg-white rounded-lg border border-gray-200 p-3">
                                          {record.adminNotes}
                                        </p>
                                      </div>
                                    )}

                                    <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                      <FiCalendar size={12} />
                                      Requested {formatDate(record.createdAt)}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
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

      {/* Approve Modal */}
      {approveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !approving) closeApproveModal();
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiCheckCircle className="text-emerald-600" size={20} />
                Approve Return
              </h2>
              <button
                onClick={closeApproveModal}
                disabled={approving}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleApprove} className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">
                Approving this return will trigger the refund and reverse stock
                for the {approveTarget.items?.length || 0} item(s) returned.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refund Amount (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={refundInput}
                  onChange={(e) => setRefundInput(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Calculated default:{' '}
                  <span className="font-medium text-gray-700">
                    {formatCurrency(calculateRefundAmount(approveTarget))}
                  </span>
                  . Leave as-is to use the calculated amount.
                </p>
              </div>

              {approveError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <FiAlertCircle
                    className="text-red-600 flex-shrink-0 mt-0.5"
                    size={16}
                  />
                  <p className="text-sm text-red-700">{approveError}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeApproveModal}
                  disabled={approving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {approving ? (
                    <>
                      <FiLoader className="animate-spin" size={16} />
                      Approving...
                    </>
                  ) : (
                    <>
                      <FiCheckCircle size={16} />
                      Approve Return
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !rejecting) closeRejectModal();
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiXCircle className="text-red-600" size={20} />
                Reject Return
              </h2>
              <button
                onClick={closeRejectModal}
                disabled={rejecting}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleReject} className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">
                Rejecting this return will mark it as closed. The buyer will be
                notified with the reason below.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Explain why this return is being rejected..."
                  rows={4}
                  className={inputClass}
                  required
                />
              </div>

              {rejectError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <FiAlertCircle
                    className="text-red-600 flex-shrink-0 mt-0.5"
                    size={16}
                  />
                  <p className="text-sm text-red-700">{rejectError}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeRejectModal}
                  disabled={rejecting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejecting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {rejecting ? (
                    <>
                      <FiLoader className="animate-spin" size={16} />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <FiXCircle size={16} />
                      Reject Return
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReturns;
