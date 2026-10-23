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
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface SellerOrder {
  _id: string;
  orderNumber?: string;
  totalPrice?: number;
  orderStatus?: string;
  createdAt: string;
  isPaid?: boolean;
  user?: OrderUser | string;
  orderItems?: OrderItem[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface OrdersResponse {
  orders: SellerOrder[];
  pagination: Pagination;
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// ---- Constants & helpers ----

const PAGE_SIZE = 10;
const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';

const getCustomerName = (user?: OrderUser | string): string => {
  if (!user) return 'Guest';
  if (typeof user === 'string') return `User ${user.slice(-6)}`;
  if (user.name) return user.name;
  const first = user.firstName || '';
  const last = user.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || user.email || 'Customer';
};

const formatCurrency = (value: number | undefined): string => {
  const v = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatDate = (dateString: string): string => {
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

const getStatusClasses = (status?: string): string => {
  const s = (status || 'pending').toLowerCase();
  switch (s) {
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'processing':
      return 'bg-blue-100 text-blue-700';
    case 'shipped':
      return 'bg-purple-100 text-purple-700';
    case 'delivered':
      return 'bg-emerald-100 text-emerald-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getItemName = (item: OrderItem): string => {
  if (item.name) return item.name;
  if (item.product && typeof item.product === 'object' && item.product.name) {
    return item.product.name;
  }
  if (typeof item.product === 'string') return `Product ${item.product.slice(-6)}`;
  return 'Unnamed item';
};

// ---- Component ----

const SellerOrders: React.FC = () => {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchOrders = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(
        `/api/seller/orders?page=${page}&limit=${PAGE_SIZE}`,
      );
      const payload = response.data as ApiEnvelope<OrdersResponse>;
      if (payload.success && payload.data) {
        setOrders(payload.data.orders || []);
        setPagination(
          payload.data.pagination || {
            page,
            limit: PAGE_SIZE,
            total: 0,
            pages: 1,
          },
        );
      } else {
        setError(payload.message || payload.error || 'Failed to load orders');
      }
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
  }, []);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handlePrev = () => {
    if (pagination.page > 1) fetchOrders(pagination.page - 1);
  };
  const handleNext = () => {
    if (pagination.page < pagination.pages) fetchOrders(pagination.page + 1);
  };

  // ---- Render ----

  if (loading && orders.length === 0) {
    return <TableSkeleton rowCount={5} titleWidth="w-48" />;
  }

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
            onClick={() => fetchOrders(pagination.page)}
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
            <Link to="/seller" className="hover:text-gray-700">
              Seller Dashboard
            </Link>{' '}
            / Orders
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Customer Orders
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            {pagination.total > 0
              ? `${pagination.total} order${pagination.total === 1 ? '' : 's'} containing your products`
              : 'Orders containing your products will appear here'}
          </p>
        </div>

        {orders.length === 0 ? (
          // Empty state
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FiShoppingBag className="mx-auto text-gray-300 mb-4" size={40} />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              No orders yet
            </h3>
            <p className="text-sm text-gray-500">
              When customers buy your products, their orders will show up here.
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
                      return (
                        <React.Fragment key={order._id}>
                          <tr
                            onClick={() => toggleExpand(order._id)}
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
                              #{order.orderNumber || order._id.slice(-6)}
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
                                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getStatusClasses(
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
                              <td colSpan={6} className="px-4 py-4">
                                <div className="bg-white rounded-lg border border-gray-200 p-4">
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
                                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                                    <span className="text-gray-500">
                                      Payment status
                                    </span>
                                    <span
                                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                        order.isPaid
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}
                                    >
                                      {order.isPaid ? 'Paid' : 'Unpaid'}
                                    </span>
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

export default SellerOrders;
