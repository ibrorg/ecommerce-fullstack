import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import api from '../../services/api';
import TableSkeleton from '../TableSkeleton';
import {
  FiChevronDown,
  FiChevronUp,
  FiAlertCircle,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiShoppingBag,
  FiLoader,
  FiSave,
  FiMapPin,
  FiCreditCard,
} from 'react-icons/fi';

// ---- Types ----

interface OrderItem {
  name?: string;
  quantity?: number;
  price?: number;
  image?: string;
  product?: string | { _id?: string; name?: string };
}

interface OrderUser {
  _id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface ShippingAddress {
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  state?: string;
}

interface PaymentResult {
  id?: string;
  status?: string;
  update_time?: string;
  email_address?: string;
}

interface AdminOrder {
  _id: string;
  orderNumber?: string;
  totalPrice?: number;
  taxPrice?: number;
  shippingPrice?: number;
  orderStatus?: string;
  paymentMethod?: string;
  isPaid?: boolean;
  paidAt?: string;
  trackingNumber?: string;
  createdAt: string;
  user?: OrderUser | string;
  orderItems?: OrderItem[];
  shippingAddress?: ShippingAddress;
  paymentResult?: PaymentResult;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface OrdersResponse {
  orders: AdminOrder[];
  pagination: Pagination;
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface StatusUpdateState {
  status: string;
  trackingNumber: string;
}

// ---- Constants & helpers ----

const PAGE_SIZE = 20;

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';

const STATUS_OPTIONS = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
] as const;

const getOrderStatusClasses = (status?: string): string => {
  const s = (status || 'pending').toLowerCase();
  switch (s) {
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'processing':
      return 'bg-amber-100 text-amber-700';
    case 'shipped':
      return 'bg-blue-100 text-blue-700';
    case 'delivered':
      return 'bg-emerald-100 text-emerald-700';
    case 'cancelled':
    case 'canceled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getPaymentStatusClasses = (isPaid?: boolean): string =>
  isPaid
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-amber-100 text-amber-700';

const getCustomerName = (user?: OrderUser | string): string => {
  if (!user) return 'Guest';
  if (typeof user === 'string') return `User ${user.slice(-6)}`;
  if (user.name) return user.name;
  const first = user.firstName || '';
  const last = user.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || user.email || 'Customer';
};

const getItemName = (item: OrderItem): string => {
  if (item.name) return item.name;
  if (item.product && typeof item.product === 'object' && item.product.name) {
    return item.product.name;
  }
  if (typeof item.product === 'string')
    return `Product ${item.product.slice(-6)}`;
  return 'Unnamed item';
};

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

const getOrderDisplayId = (order: AdminOrder): string =>
  order.orderNumber
    ? `ORD-${order.orderNumber.replace(/^ORD-?/i, '')}`
    : `ORD-${order._id.slice(-6).toUpperCase()}`;

const formatAddress = (addr?: ShippingAddress): string => {
  if (!addr) return 'No address on file';
  const parts = [
    addr.address,
    addr.city,
    addr.state,
    addr.postalCode,
    addr.country,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'No address on file';
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

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Status update state, keyed by order id
  const [statusEdits, setStatusEdits] = useState<
    Record<string, StatusUpdateState>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const fetchOrders = useCallback(
    async (page: number, status: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (status) params.set('status', status);
        const response = await api.get(`/api/orders?${params.toString()}`);
        const data = unwrap<OrdersResponse>(response.data, {
          orders: [],
          pagination: { page, limit: PAGE_SIZE, total: 0, pages: 1 },
        });
        const list = Array.isArray(data)
          ? (data as unknown as AdminOrder[])
          : data.orders || [];
        const pg = Array.isArray(data)
          ? { page, limit: PAGE_SIZE, total: list.length, pages: 1 }
          : data.pagination || {
              page,
              limit: PAGE_SIZE,
              total: list.length,
              pages: 1,
            };
        setOrders(list);
        setPagination(pg);
      } catch (err) {
        const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
        setError(
          axiosErr.response?.data?.message ||
            axiosErr.response?.data?.error ||
            'Unable to load orders. Please try again.',
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchOrders(1, statusFilter);
  }, [fetchOrders, statusFilter]);

  const toggleExpand = (order: AdminOrder) => {
    setExpandedId((prev) => (prev === order._id ? null : order._id));
    setStatusError(null);
    // Initialize the edit buffer for this order if not present
    setStatusEdits((prev) => {
      if (prev[order._id]) return prev;
      return {
        ...prev,
        [order._id]: {
          status: order.orderStatus || 'pending',
          trackingNumber: order.trackingNumber || '',
        },
      };
    });
  };

  const handlePrev = () => {
    if (pagination.page > 1) {
      fetchOrders(pagination.page - 1, statusFilter);
    }
  };
  const handleNext = () => {
    if (pagination.page < pagination.pages) {
      fetchOrders(pagination.page + 1, statusFilter);
    }
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    setStatusEdits((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || { status: newStatus, trackingNumber: '' }),
        status: newStatus,
      },
    }));
  };

  const handleTrackingChange = (orderId: string, value: string) => {
    setStatusEdits((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || { status: 'shipped', trackingNumber: '' }),
        trackingNumber: value,
      },
    }));
  };

  const handleSaveStatus = async (order: AdminOrder) => {
    const edit = statusEdits[order._id];
    if (!edit) return;
    setSavingId(order._id);
    setStatusError(null);
    try {
      const payload: Record<string, unknown> = { status: edit.status };
      if (edit.status === 'shipped' && edit.trackingNumber.trim()) {
        payload.trackingNumber = edit.trackingNumber.trim();
      }
      const response = await api.put(
        `/api/orders/${order._id}/status`,
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
        setStatusError(msg || 'Failed to update order status');
        return;
      }
      // Update the order in local state so the UI reflects the change immediately
      setOrders((prev) =>
        prev.map((o) =>
          o._id === order._id
            ? {
                ...o,
                orderStatus: edit.status,
                trackingNumber:
                  edit.status === 'shipped' && edit.trackingNumber.trim()
                    ? edit.trackingNumber.trim()
                    : o.trackingNumber,
              }
            : o,
        ),
      );
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setStatusError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to update order status. Please try again.',
      );
    } finally {
      setSavingId(null);
    }
  };

  // ---- Render: loading ----
  if (loading && orders.length === 0) {
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
            onClick={() => fetchOrders(pagination.page, statusFilter)}
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
            / Orders
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Manage Orders
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            {pagination.total > 0
              ? `${pagination.total} order${pagination.total === 1 ? '' : 's'} in the marketplace`
              : 'All marketplace orders will appear here'}
          </p>
        </div>

        {/* Status filter tabs */}
        <div className="bg-white rounded-lg border border-gray-200 p-2 mb-4 flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                statusFilter === f.value
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {orders.length === 0 ? (
          // Empty state
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FiShoppingBag
              className="mx-auto text-gray-300 mb-4"
              size={40}
            />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No orders found
            </h3>
            <p className="text-sm text-gray-500">
              {statusFilter
                ? `No ${statusFilter} orders at the moment.`
                : 'Orders will appear here once customers check out.'}
            </p>
          </div>
        ) : (
          <>
            {/* Orders table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8" />
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Payment
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map((order) => {
                      const isExpanded = expandedId === order._id;
                      const itemCount =
                        order.orderItems?.reduce(
                          (sum, it) => sum + (it.quantity ?? 0),
                          0,
                        ) ?? 0;
                      const edit = statusEdits[order._id];
                      return (
                        <React.Fragment key={order._id}>
                          <tr
                            onClick={() => toggleExpand(order)}
                            className="hover:bg-gray-50 cursor-pointer"
                          >
                            <td className="px-4 py-3 text-gray-500">
                              {isExpanded ? (
                                <FiChevronUp size={16} />
                              ) : (
                                <FiChevronDown size={16} />
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                              {getOrderDisplayId(order)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {getCustomerName(order.user)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {itemCount} item{itemCount === 1 ? '' : 's'}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                              {formatCurrency(order.totalPrice)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getPaymentStatusClasses(
                                  order.isPaid,
                                )}`}
                              >
                                {order.isPaid ? 'Paid' : 'Unpaid'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getOrderStatusClasses(
                                  order.orderStatus,
                                )}`}
                              >
                                {order.orderStatus || 'pending'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                              {formatDate(order.createdAt)}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-gray-50">
                              <td />
                              <td colSpan={7} className="px-4 py-4">
                                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
                                  {/* Items */}
                                  <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                      Order Items
                                    </p>
                                    {order.orderItems &&
                                    order.orderItems.length > 0 ? (
                                      <ul className="space-y-3">
                                        {order.orderItems.map((item, idx) => (
                                          <li
                                            key={idx}
                                            className="flex items-center gap-3"
                                          >
                                            <img
                                              src={
                                                item.image || FALLBACK_IMAGE
                                              }
                                              alt={getItemName(item)}
                                              className="w-10 h-10 rounded-md object-cover bg-gray-100"
                                              onError={(e) => {
                                                (
                                                  e.currentTarget as HTMLImageElement
                                                ).src = FALLBACK_IMAGE;
                                              }}
                                            />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-gray-900 truncate">
                                                {getItemName(item)}
                                              </p>
                                              <p className="text-xs text-gray-500">
                                                Qty {item.quantity ?? 0} ×{' '}
                                                {formatCurrency(item.price)}
                                              </p>
                                            </div>
                                            <p className="text-sm font-medium text-gray-900">
                                              {formatCurrency(
                                                (item.quantity ?? 0) *
                                                  (item.price ?? 0),
                                              )}
                                            </p>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-sm text-gray-500">
                                        No items in this order.
                                      </p>
                                    )}
                                  </div>

                                  {/* Shipping + payment summary */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                                    <div className="flex items-start gap-2">
                                      <FiMapPin
                                        className="text-gray-400 flex-shrink-0 mt-0.5"
                                        size={16}
                                      />
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                          Shipping Address
                                        </p>
                                        <p className="text-sm text-gray-700">
                                          {formatAddress(order.shippingAddress)}
                                        </p>
                                        {order.trackingNumber && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            Tracking:{' '}
                                            <span className="font-mono">
                                              {order.trackingNumber}
                                            </span>
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <FiCreditCard
                                        className="text-gray-400 flex-shrink-0 mt-0.5"
                                        size={16}
                                      />
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                          Payment
                                        </p>
                                        <p className="text-sm text-gray-700">
                                          {order.paymentMethod || '—'}
                                        </p>
                                        {order.paymentResult && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            {order.paymentResult.id && (
                                              <>
                                                ID:{' '}
                                                <span className="font-mono">
                                                  {order.paymentResult.id}
                                                </span>{' '}
                                                ·{' '}
                                              </>
                                            )}
                                            Status:{' '}
                                            {order.paymentResult.status || '—'}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Status update */}
                                  <div className="pt-3 border-t border-gray-100">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                      Update Status
                                    </p>
                                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                                      <div className="flex-1">
                                        <label className="block text-xs text-gray-500 mb-1">
                                          Order status
                                        </label>
                                        <select
                                          value={edit?.status || 'pending'}
                                          onChange={(e) =>
                                            handleStatusChange(
                                              order._id,
                                              e.target.value,
                                            )
                                          }
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                          {STATUS_OPTIONS.map((s) => (
                                            <option key={s} value={s}>
                                              {s.charAt(0).toUpperCase() +
                                                s.slice(1)}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      {edit?.status === 'shipped' && (
                                        <div className="flex-1">
                                          <label className="block text-xs text-gray-500 mb-1">
                                            Tracking number
                                          </label>
                                          <input
                                            type="text"
                                            value={edit.trackingNumber}
                                            onChange={(e) =>
                                              handleTrackingChange(
                                                order._id,
                                                e.target.value,
                                              )
                                            }
                                            placeholder="e.g. 1Z999AA10123456784"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                          />
                                        </div>
                                      )}
                                      <button
                                        onClick={() => handleSaveStatus(order)}
                                        disabled={
                                          savingId === order._id ||
                                          !edit ||
                                          edit.status === order.orderStatus
                                        }
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                                      >
                                        {savingId === order._id ? (
                                          <>
                                            <FiLoader
                                              className="animate-spin"
                                              size={14}
                                            />
                                            Saving...
                                          </>
                                        ) : (
                                          <>
                                            <FiSave size={14} />
                                            Save
                                          </>
                                        )}
                                      </button>
                                    </div>
                                    {statusError && expandedId === order._id && (
                                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-sm text-red-700">
                                          {statusError}
                                        </p>
                                      </div>
                                    )}
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
    </div>
  );
};

export default AdminOrders;
