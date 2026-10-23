import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import api from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import DashboardSkeleton from '../DashboardSkeleton';
import {
  FiPackage,
  FiDollarSign,
  FiShoppingBag,
  FiStar,
  FiArrowRight,
  FiPlus,
  FiAlertCircle,
  FiRefreshCw,
  FiTrendingUp,
} from 'react-icons/fi';

// ---- Types matching the backend dashboard payload ----

interface StoreStats {
  followers: number;
  rating: number;
  totalReviews: number;
}

interface Earnings {
  totalRevenue?: number;
  platformCommission?: number;
  platformFee?: number;
  netEarnings?: number;
  totalOrders?: number;
  totalItems?: number;
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
  user?: OrderUser | string;
  isPaid?: boolean;
}

interface SellerProduct {
  _id: string;
  name: string;
  price: number;
  rating?: number;
  numReviews?: number;
  countInStock?: number;
  images?: string[];
  category?: string;
}

interface Store {
  _id?: string;
  name?: string;
  description?: string;
  rating?: number;
}

interface DashboardData {
  store: Store | null;
  earnings: Earnings;
  recentOrders: SellerOrder[];
  topProducts: SellerProduct[];
  totalProducts: number;
  storeStats: StoreStats;
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// ---- Helpers ----

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

// ---- Component ----

const SellerDashboard: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/seller/dashboard');
      const payload = response.data as ApiEnvelope<DashboardData>;
      if (payload.success && payload.data) {
        setData(payload.data);
      } else {
        setError(payload.message || payload.error || 'Failed to load dashboard');
      }
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      const msg =
        axiosErr.response?.data?.message ||
        axiosErr.response?.data?.error ||
        'Unable to load your dashboard. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const stats = [
    {
      label: 'Total Products',
      value: data?.totalProducts ?? 0,
      icon: FiPackage,
      tint: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Total Orders',
      value: data?.earnings?.totalOrders ?? 0,
      icon: FiShoppingBag,
      tint: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Net Earnings',
      value: formatCurrency(data?.earnings?.netEarnings),
      icon: FiDollarSign,
      tint: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Store Rating',
      value: `${(data?.storeStats?.rating ?? 0).toFixed(1)} ★`,
      icon: FiStar,
      tint: 'bg-amber-50 text-amber-600',
    },
  ];

  if (loading) {
    return <DashboardSkeleton statCount={4} showCharts />;
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
            onClick={fetchDashboard}
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-sm text-gray-500 mb-1">Seller Dashboard</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Welcome back, {user?.name?.split(' ')[0] || 'Seller'}
            </h1>
            <p className="text-gray-600 mt-1">
              {data?.store?.name
                ? data.store.name
                : 'Your store overview at a glance'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/seller/products"
              state={{ openAddModal: true }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <FiPlus size={16} />
              Add Product
            </Link>
            <Link
              to="/seller/products"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiPackage size={16} />
              View All Products
            </Link>
            <Link
              to="/seller/orders"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiShoppingBag size={16} />
              View All Orders
            </Link>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white rounded-lg border border-gray-200 p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    {stat.label}
                  </span>
                  <span className={`p-2 rounded-lg ${stat.tint}`}>
                    <Icon size={18} />
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Recent Orders + Top Products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Orders
              </h2>
              <Link
                to="/seller/orders"
                className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                View all <FiArrowRight size={14} />
              </Link>
            </div>
            {data?.recentOrders?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.recentOrders.map((order) => (
                      <tr key={order._id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                          #{order.orderNumber || order._id.slice(-6)}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-700">
                          {getCustomerName(order.user)}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                          {formatCurrency(order.totalPrice)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 capitalize">
                            {order.orderStatus || 'pending'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 px-4">
                <FiShoppingBag className="mx-auto text-gray-300 mb-3" size={32} />
                <p className="text-sm text-gray-500">No orders yet.</p>
              </div>
            )}
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Top Products
              </h2>
              <Link
                to="/seller/products"
                className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                View all <FiArrowRight size={14} />
              </Link>
            </div>
            {data?.topProducts?.length ? (
              <ul className="divide-y divide-gray-100">
                {data.topProducts.map((product, idx) => (
                  <li
                    key={product._id}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50"
                  >
                    <span className="w-6 text-sm font-bold text-gray-400">
                      {idx + 1}
                    </span>
                    <img
                      src={product.images?.[0] || FALLBACK_IMAGE}
                      alt={product.name}
                      className="w-10 h-10 rounded-md object-cover bg-gray-100"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          FALLBACK_IMAGE;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(product.price)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 inline-flex items-center gap-1">
                        <FiStar className="text-amber-400" size={14} />
                        {(product.rating ?? 0).toFixed(1)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {product.countInStock ?? 0} in stock
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-12 px-4">
                <FiTrendingUp className="mx-auto text-gray-300 mb-3" size={32} />
                <p className="text-sm text-gray-500">
                  No products yet. Create your first product!
                </p>
                <Link
                  to="/seller/products"
                  state={{ openAddModal: true }}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <FiPlus size={14} /> Add a product
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;
