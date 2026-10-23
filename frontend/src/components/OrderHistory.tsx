import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import api from '../services/api';
import OrderHistorySkeleton from './OrderHistorySkeleton';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import toast from 'react-hot-toast';
import { FiPackage, FiArrowRight, FiCheck, FiClock, FiTruck, FiShoppingBag, FiCreditCard, FiDownload, FiLoader } from 'react-icons/fi';

interface Order {
  _id: string;
  orderNumber: string;
  createdAt: string;
  totalPrice: number;
  isPaid: boolean;
  isDelivered: boolean;
  orderStatus: string;
  orderItems?: Array<{ name: string; quantity: number }>;
}

const OrderHistory: React.FC = () => {
  const { user } = useAppSelector((state: any) => state.auth);
  useDocumentMeta({ title: 'Order History', description: 'View your past orders and track deliveries.' });
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/api/orders/myorders');
        const result = response.data;
        if (result.success) {
          setOrders(result.data);
        } else {
          setError(result.message || 'Failed to fetch orders');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user, token]);

  const getStatusInfo = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: FiClock, label: 'Pending' };
      case 'processing':
        return { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: FiShoppingBag, label: 'Processing' };
      case 'shipped':
        return { color: 'bg-purple-50 text-purple-700 border-purple-200', icon: FiTruck, label: 'Shipped' };
      case 'delivered':
        return { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: FiCheck, label: 'Delivered' };
      case 'cancelled':
        return { color: 'bg-red-50 text-red-700 border-red-200', icon: FiClock, label: 'Cancelled' };
      default:
        return { color: 'bg-gray-50 text-gray-700 border-gray-200', icon: FiClock, label: status };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return formatDate(dateString);
  };

  const handleDownloadInvoice = async (orderId: string) => {
    setDownloadingId(orderId);
    try {
      const url = `/api/orders/${orderId}/invoice`;
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `invoice-${orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Invoice downloaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download invoice';
      toast.error(message);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return <OrderHistorySkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="container max-w-4xl mx-auto px-4 py-8 sm:py-16">
          <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center">
            <div className="text-4xl mb-4">😕</div>
            <p className="text-red-700 font-semibold text-lg mb-2">Something went wrong</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container max-w-4xl mx-auto px-4 py-6 sm:py-10 lg:py-14">
        {/* Header */}
        <div className="mb-8 sm:mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-black rounded-xl">
              <FiPackage className="text-white" size={24} />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">My Orders</h1>
          </div>
          <p className="text-gray-500 ml-0 sm:ml-14">Track and manage your purchases</p>
        </div>

        {orders.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12 sm:py-20 px-4">
            <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <FiShoppingBag className="text-gray-400" size={48} />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No orders yet</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              When you place an order, it will appear here for easy tracking.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-base font-semibold bg-black text-white hover:bg-gray-800 active:scale-95 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Start Shopping
              <FiArrowRight size={18} />
            </Link>
          </div>
        ) : (
          /* Orders List */
          <div className="space-y-4">
            {orders.map((order) => {
              const statusInfo = getStatusInfo(order.orderStatus);
              const StatusIcon = statusInfo.icon;
              
              return (
                <div 
                  key={order._id} 
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-300"
                >
                  {/* Mobile Card Layout */}
                  <div className="sm:hidden">
                    {/* Header with Order ID and Status */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500">ORDER</span>
                        <span className="text-sm font-bold text-gray-900">#{order.orderNumber}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.color}`}>
                        <StatusIcon size={12} />
                        {statusInfo.label}
                      </span>
                    </div>
                    
                    {/* Content */}
                    <div className="p-4">
                      {/* Date and Total */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">{getRelativeTime(order.createdAt)}</p>
                          <p className="text-2xl font-bold text-gray-900">${(order.totalPrice ?? 0).toFixed(2)}</p>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                          order.isPaid 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {order.isPaid ? <FiCheck size={14} /> : <FiClock size={14} />}
                          {order.isPaid ? 'Paid' : 'Unpaid'}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Link
                          to={`/order/${order._id}`}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-gray-100 text-gray-900 hover:bg-gray-200 active:scale-[0.98] transition-all"
                        >
                          View Details
                        </Link>
                        {order.isPaid && (
                          <button
                            type="button"
                            onClick={() => handleDownloadInvoice(order._id)}
                            disabled={downloadingId === order._id}
                            title="Download Invoice"
                            className="flex items-center justify-center w-11 h-11 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {downloadingId === order._id
                              ? <FiLoader className="animate-spin" size={16} />
                              : <FiDownload size={16} />}
                          </button>
                        )}
                        {!order.isPaid && (
                          <Link
                            to={`/order/${order._id}?pay=true`}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-black text-white hover:bg-gray-800 active:scale-[0.98] transition-all shadow-md"
                          >
                            <FiCreditCard size={16} />
                            Pay Now
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desktop/Tablet Layout */}
                  <div className="hidden sm:block p-5 lg:p-6">
                    <div className="flex items-center gap-6">
                      {/* Order Info */}
                      <div className="flex-1 grid grid-cols-4 gap-4 lg:gap-6 items-center">
                        {/* Order Number & Date */}
                        <div className="col-span-1">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Order</p>
                          <p className="text-base lg:text-lg font-bold text-gray-900">#{order.orderNumber}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.createdAt)}</p>
                        </div>

                        {/* Total */}
                        <div className="col-span-1">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total</p>
                          <p className="text-xl lg:text-2xl font-bold text-gray-900">${(order.totalPrice ?? 0).toFixed(2)}</p>
                        </div>

                        {/* Payment Status */}
                        <div className="col-span-1">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Payment</p>
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                            order.isPaid 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {order.isPaid ? <FiCheck size={14} /> : <FiClock size={14} />}
                            {order.isPaid ? 'Paid' : 'Pending'}
                          </span>
                        </div>

                        {/* Order Status */}
                        <div className="col-span-1">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${statusInfo.color}`}>
                            <StatusIcon size={14} />
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
                        <Link
                          to={`/order/${order._id}`}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all"
                        >
                          View
                          <FiArrowRight size={16} />
                        </Link>
                        {order.isPaid && (
                          <button
                            type="button"
                            onClick={() => handleDownloadInvoice(order._id)}
                            disabled={downloadingId === order._id}
                            title="Download Invoice"
                            className="flex items-center justify-center w-11 h-11 rounded-xl font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {downloadingId === order._id
                              ? <FiLoader className="animate-spin" size={16} />
                              : <FiDownload size={16} />}
                          </button>
                        )}
                        {!order.isPaid && (
                          <Link
                            to={`/order/${order._id}?pay=true`}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-black text-white hover:bg-gray-800 active:scale-95 transition-all shadow-md"
                          >
                            <FiCreditCard size={16} />
                            Pay
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Order Count Summary */}
        {orders.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Showing {orders.length} order{orders.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;