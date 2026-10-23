import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import api from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import DashboardSkeleton from '../DashboardSkeleton';
import {
  FiDollarSign,
  FiShoppingBag,
  FiUsers,
  FiPackage,
  FiAlertCircle,
  FiRefreshCw,
  FiTrendingUp,
  FiCheckCircle,
  FiStar,
  FiShield,
  FiLoader,
  FiUserCheck,
  FiArrowRight,
  FiTag,
  FiRotateCcw,
} from 'react-icons/fi';

// ---- Types matching the backend admin endpoints ----

interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
}

interface RevenueTrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  _id: string;
  name: string;
  price: number;
  soldCount?: number;
  totalSold?: number;
  revenue?: number;
  totalRevenue?: number;
}

interface StoreOwner {
  _id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface TopSeller {
  _id: string;
  name?: string;
  storeName?: string;
  owner?: StoreOwner;
  earnings?: number;
  totalRevenue?: number;
  rating?: number;
}

interface OrderStatusBucket {
  _id: string;
  count: number;
}

interface StoreVerification {
  _id: string;
  name?: string;
  storeName?: string;
  description?: string;
  owner?: StoreOwner;
  createdAt?: string;
  status?: string;
  isVerified?: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface AdminDashboardData {
  dashboard: DashboardStats | null;
  revenueTrends: RevenueTrendPoint[];
  topProducts: TopProduct[];
  topSellers: TopSeller[];
  orderStatus: OrderStatusBucket[];
  verifications: StoreVerification[];
}

// ---- Helpers ----

/**
 * Unwrap an Axios body. The backend admin endpoints may return either a raw
 * payload or the standard { success, data } envelope — handle both.
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

const formatCurrency = (value: number | undefined): string => {
  const v = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatNumber = (value: number | undefined): string => {
  const v = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  return v.toLocaleString('en-US');
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

const getStoreName = (store: { name?: string; storeName?: string }): string =>
  store.name || store.storeName || 'Unnamed Store';

const getOwnerName = (owner?: StoreOwner): string => {
  if (!owner) return '—';
  if (owner.name) return owner.name;
  const first = owner.firstName || '';
  const last = owner.lastName || '';
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return owner.email || '—';
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-400',
  processing: 'bg-blue-500',
  shipped: 'bg-indigo-500',
  delivered: 'bg-emerald-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-red-400',
  canceled: 'bg-red-400',
  refunded: 'bg-purple-500',
  paid: 'bg-emerald-500',
  failed: 'bg-red-500',
};

const getStatusColor = (status: string): string =>
  STATUS_COLORS[status.toLowerCase()] || 'bg-gray-400';

// ---- Component ----

const AdminDashboard: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        dashboardRes,
        revenueRes,
        topProductsRes,
        topSellersRes,
        orderStatusRes,
        verificationsRes,
      ] = await Promise.all([
        api.get('/api/admin/dashboard'),
        api.get('/api/admin/revenue-trends?days=30'),
        api.get('/api/admin/top-products?limit=5'),
        api.get('/api/admin/top-sellers?limit=5'),
        api.get('/api/admin/order-status'),
        api.get('/api/admin/verifications'),
      ]);

      setData({
        dashboard: unwrap<DashboardStats | null>(dashboardRes.data, null),
        revenueTrends: unwrap<RevenueTrendPoint[]>(revenueRes.data, []),
        topProducts: unwrap<TopProduct[]>(topProductsRes.data, []),
        topSellers: unwrap<TopSeller[]>(topSellersRes.data, []),
        orderStatus: unwrap<OrderStatusBucket[]>(orderStatusRes.data, []),
        verifications: unwrap<StoreVerification[]>(verificationsRes.data, []),
      });
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to load admin dashboard. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleVerify = async (storeId: string): Promise<void> => {
    setVerifyingId(storeId);
    setVerifyError(null);
    try {
      const response = await api.put(`/api/admin/verify-store/${storeId}`);
      const body = response.data;
      let ok = true;
      let msg: string | undefined;
      if (body && typeof body === 'object' && 'success' in body) {
        const env = body as ApiEnvelope<unknown>;
        ok = env.success !== false;
        msg = env.message || env.error;
      }
      if (!ok) {
        setVerifyError(msg || 'Failed to verify store');
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              verifications: prev.verifications.filter((v) => v._id !== storeId),
            }
          : prev,
      );
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setVerifyError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Failed to verify store. Please try again.',
      );
    } finally {
      setVerifyingId(null);
    }
  };

  const stats = [
    {
      label: 'Total Revenue',
      value: formatCurrency(data?.dashboard?.totalRevenue),
      icon: FiDollarSign,
      tint: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Total Orders',
      value: formatNumber(data?.dashboard?.totalOrders),
      icon: FiShoppingBag,
      tint: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Total Users',
      value: formatNumber(data?.dashboard?.totalUsers),
      icon: FiUsers,
      tint: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Total Products',
      value: formatNumber(data?.dashboard?.totalProducts),
      icon: FiPackage,
      tint: 'bg-amber-50 text-amber-600',
    },
  ];

  // Revenue trends chart math
  const trends = data?.revenueTrends ?? [];
  const maxRevenue = trends.reduce(
    (max, p) => (p.revenue > max ? p.revenue : max),
    0,
  );
  const totalRevenue30d = trends.reduce((sum, p) => sum + (p.revenue || 0), 0);
  const linePoints =
    trends.length > 1
      ? trends
          .map((d, i) => {
            const x = (i / (trends.length - 1)) * 100;
            const y = 100 - (maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(' ')
      : '';

  const maxStatusCount =
    data?.orderStatus?.reduce((max, s) => (s.count > max ? s.count : max), 0) ??
    0;

  // ---- Loading state ----
  if (loading) {
    return <DashboardSkeleton statCount={4} showCharts />;
  }

  // ---- Error state ----
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
            onClick={fetchAll}
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
            <p className="text-sm text-gray-500 mb-1">Admin Dashboard</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Welcome back, {user?.name?.split(' ')[0] || 'Admin'}
            </h1>
            <p className="text-gray-600 mt-1">
              Marketplace performance and seller verification at a glance
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/config"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiShield size={16} />
              Site Configuration
            </Link>
            <button
              onClick={fetchAll}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <FiRefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm"
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

        {/* Management shortcuts */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Management
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              to="/admin/products"
              className="group bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:border-gray-300 hover:shadow transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
                    <FiPackage size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Manage Products
                    </p>
                    <p className="text-xs text-gray-500">
                      Edit, deactivate, or remove listings
                    </p>
                  </div>
                </div>
                <FiArrowRight
                  className="text-gray-300 group-hover:text-gray-500 transition-colors"
                  size={16}
                />
              </div>
            </Link>
            <Link
              to="/admin/orders"
              className="group bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:border-gray-300 hover:shadow transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <FiShoppingBag size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Manage Orders
                    </p>
                    <p className="text-xs text-gray-500">
                      Update status and tracking numbers
                    </p>
                  </div>
                </div>
                <FiArrowRight
                  className="text-gray-300 group-hover:text-gray-500 transition-colors"
                  size={16}
                />
              </div>
            </Link>
            <Link
              to="/admin/users"
              className="group bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:border-gray-300 hover:shadow transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-purple-50 text-purple-600">
                    <FiUsers size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Manage Users
                    </p>
                    <p className="text-xs text-gray-500">
                      Roles, suspensions, and account removal
                    </p>
                  </div>
                </div>
                <FiArrowRight
                  className="text-gray-300 group-hover:text-gray-500 transition-colors"
                  size={16}
                />
              </div>
            </Link>
            <Link
              to="/admin/coupons"
              className="group bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:border-gray-300 hover:shadow transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <FiTag size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Manage Coupons
                    </p>
                    <p className="text-xs text-gray-500">
                      Discount codes, usage limits, and validity
                    </p>
                  </div>
                </div>
                <FiArrowRight
                  className="text-gray-300 group-hover:text-gray-500 transition-colors"
                  size={16}
                />
              </div>
            </Link>
            <Link
              to="/admin/returns"
              className="group bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:border-gray-300 hover:shadow transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-rose-50 text-rose-600">
                    <FiRotateCcw size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Manage Returns
                    </p>
                    <p className="text-xs text-gray-500">
                      Approve or reject customer return requests
                    </p>
                  </div>
                </div>
                <FiArrowRight
                  className="text-gray-300 group-hover:text-gray-500 transition-colors"
                  size={16}
                />
              </div>
            </Link>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue trends */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Revenue Trends
              </h2>
              <span className="text-xs text-gray-500">Last 30 days</span>
            </div>
            {trends.length > 1 ? (
              <>
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">
                    {formatCurrency(totalRevenue30d)}
                  </span>
                  <span className="text-xs text-gray-500">total revenue</span>
                </div>
                <div className="w-full">
                  <div className="relative w-full h-40 text-blue-500">
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="w-full h-full"
                    >
                      <polyline
                        points={linePoints}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-400">
                    <span>{formatDate(trends[0]?.date)}</span>
                    <span>{formatDate(trends[trends.length - 1]?.date)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <FiTrendingUp className="mx-auto text-gray-300 mb-3" size={32} />
                <p className="text-sm text-gray-500">No revenue data yet.</p>
              </div>
            )}
          </div>

          {/* Order status distribution */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Order Status Distribution
            </h2>
            {data?.orderStatus && data.orderStatus.length > 0 ? (
              <div className="space-y-3">
                {data.orderStatus.map((s) => (
                  <div key={s._id} className="flex items-center gap-3">
                    <span className="w-24 text-sm text-gray-700 capitalize">
                      {s._id}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-4 rounded-full ${getStatusColor(s._id)}`}
                        style={{
                          width: `${
                            maxStatusCount > 0
                              ? (s.count / maxStatusCount) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-10 text-right">
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FiShoppingBag
                  className="mx-auto text-gray-300 mb-3"
                  size={32}
                />
                <p className="text-sm text-gray-500">No orders yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Top products + Top sellers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top products */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Top Products
              </h2>
              <span className="text-xs text-gray-500">By sales</span>
            </div>
            {data?.topProducts && data.topProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Sold
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.topProducts.map((p) => {
                      const sold = p.soldCount ?? p.totalSold ?? 0;
                      const revenue =
                        p.revenue ?? p.totalRevenue ?? p.price * sold;
                      return (
                        <tr key={p._id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate">
                            {p.name}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700 text-right whitespace-nowrap">
                            {formatCurrency(p.price)}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700 text-right">
                            {formatNumber(sold)}
                          </td>
                          <td className="px-5 py-3 text-sm font-medium text-gray-900 text-right whitespace-nowrap">
                            {formatCurrency(revenue)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 px-4">
                <FiPackage className="mx-auto text-gray-300 mb-3" size={32} />
                <p className="text-sm text-gray-500">No top products yet.</p>
              </div>
            )}
          </div>

          {/* Top sellers */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Top Sellers
              </h2>
              <span className="text-xs text-gray-500">By earnings</span>
            </div>
            {data?.topSellers && data.topSellers.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {data.topSellers.map((seller, idx) => {
                  const earnings = seller.earnings ?? seller.totalRevenue ?? 0;
                  const rating = seller.rating ?? 0;
                  return (
                    <li
                      key={seller._id}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50"
                    >
                      <span className="w-6 text-sm font-bold text-gray-400">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {getStoreName(seller)}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {getOwnerName(seller.owner)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                          {formatCurrency(earnings)}
                        </p>
                        <p className="text-xs text-gray-500 inline-flex items-center gap-1">
                          <FiStar className="text-amber-400" size={12} />
                          {rating.toFixed(1)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-12 px-4">
                <FiUsers className="mx-auto text-gray-300 mb-3" size={32} />
                <p className="text-sm text-gray-500">No sellers yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending seller verifications */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FiShield className="text-gray-500" size={18} />
              <h2 className="text-lg font-semibold text-gray-900">
                Pending Seller Verifications
              </h2>
              {data?.verifications && data.verifications.length > 0 && (
                <span className="inline-flex items-center justify-center bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {data.verifications.length}
                </span>
              )}
            </div>
          </div>

          {verifyError && (
            <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <FiAlertCircle
                className="text-red-600 flex-shrink-0 mt-0.5"
                size={16}
              />
              <span className="text-sm text-red-700">{verifyError}</span>
            </div>
          )}

          {data?.verifications && data.verifications.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {data.verifications.map((store) => (
                <li
                  key={store._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                      <FiUserCheck size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {getStoreName(store)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {getOwnerName(store.owner)} · Applied{' '}
                        {formatDate(store.createdAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleVerify(store._id)}
                    disabled={verifyingId === store._id}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {verifyingId === store._id ? (
                      <>
                        <FiLoader className="animate-spin" size={14} />
                        Verifying…
                      </>
                    ) : (
                      <>
                        <FiCheckCircle size={14} />
                        Verify Store
                      </>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12 px-4">
              <FiCheckCircle
                className="mx-auto text-emerald-300 mb-3"
                size={32}
              />
              <p className="text-sm text-gray-500">
                All caught up — no pending verifications.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
