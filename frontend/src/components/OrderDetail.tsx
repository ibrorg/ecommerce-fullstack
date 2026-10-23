import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import Payment from './Payment';
import OrderDetailSkeleton from './OrderDetailSkeleton';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  FiPackage, FiTruck, FiCheck, FiClock, FiCreditCard,
  FiMapPin, FiCalendar, FiArrowLeft, FiCopy, FiCheckCircle,
  FiShoppingBag, FiBox, FiRotateCcw, FiDownload, FiFileText, FiLoader
} from 'react-icons/fi';

interface OrderItem {
  product: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

interface ShippingAddress {
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  orderItems: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  paymentResult?: {
    id: string;
    status: string;
    update_time: string;
    email_address?: string;
  };
  itemsPrice: number;
  taxPrice: number;
  shippingPrice: number;
  totalPrice: number;
  isPaid: boolean;
  paidAt?: string;
  isDelivered: boolean;
  deliveredAt?: string;
  orderStatus: string;
  trackingNumber?: string;
  createdAt: string;
}

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAppSelector((state: any) => state.auth);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState<'standard' | 'gst' | null>(null);
  const paymentSectionRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!user || !id) return;

      try {
        const response = await api.get(`/api/orders/${id}`);
        const result = response.data;
        if (result.success) {
          setOrder(result.data);
        } else {
          setError(result.message || 'Failed to fetch order');
        }
      } catch (err) {
        setError('Failed to fetch order');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id, user, token]);

  // Verify payment if returning from Stripe
  useEffect(() => {
    const verifyStripePayment = async () => {
      const paymentStatus = searchParams.get('payment');
      const sessionId = searchParams.get('session_id');

      if (paymentStatus === 'success' && sessionId && id) {
        try {
          const response = await api.verifyPayment(id, sessionId);
          if (response.data.success) {
            setPaymentMessage('Payment successful! Your order has been paid.');
            setOrder(response.data.data);
          }
        } catch (err: any) {
          console.error('Payment verification failed:', err);
        }
      } else if (paymentStatus === 'cancelled') {
        setPaymentMessage('Payment was cancelled. You can try again below.');
      }
    };

    if (!loading && order) {
      verifyStripePayment();
    }
  }, [searchParams, id, loading, order]);

  // Auto-scroll to payment section if ?pay=true
  useEffect(() => {
    if (!loading && order && !order.isPaid && searchParams.get('pay') === 'true') {
      setTimeout(() => {
        paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [loading, order, searchParams]);

  const getStatusInfo = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: FiClock, label: 'Pending' };
      case 'processing':
        return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: FiShoppingBag, label: 'Processing' };
      case 'shipped':
        return { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: FiTruck, label: 'Shipped' };
      case 'delivered':
        return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: FiCheck, label: 'Delivered' };
      case 'cancelled':
        return { color: 'bg-red-100 text-red-700 border-red-200', icon: FiClock, label: 'Cancelled' };
      default:
        return { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: FiClock, label: status };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyOrderId = () => {
    navigator.clipboard.writeText(order?.orderNumber || '');
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleDownloadInvoice = async (gst: boolean = false) => {
    if (!id) return;
    const kind: 'standard' | 'gst' = gst ? 'gst' : 'standard';
    setInvoiceLoading(kind);
    try {
      const url = `/api/orders/${id}/invoice${gst ? '/gst' : ''}`;
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `invoice-${id}${gst ? '-gst' : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(gst ? 'GST invoice downloaded' : 'Invoice downloaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download invoice';
      toast.error(message);
    } finally {
      setInvoiceLoading(null);
    }
  };

  if (loading) {
    return <OrderDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="container max-w-4xl mx-auto px-4 py-8 sm:py-16">
          <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center">
            <div className="text-4xl mb-4">😕</div>
            <p className="text-red-700 font-semibold text-lg mb-2">Something went wrong</p>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <Link
              to="/orders"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
            >
              <FiArrowLeft size={16} />
              Back to Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <FiBox className="text-gray-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-gray-500 mb-6">We couldn't find the order you're looking for.</p>
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-black text-white hover:bg-gray-800 transition-all"
          >
            <FiArrowLeft size={16} />
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(order.orderStatus);
  const StatusIcon = statusInfo.icon;

  // Return eligibility: paid, not cancelled/refunded, within 7 days of
  // delivery (or paid date / created date as fallback).
  const returnCutoff = (() => {
    const ref = order.deliveredAt || order.paidAt || order.createdAt;
    if (!ref) return null;
    const dt = new Date(ref).getTime();
    if (Number.isNaN(dt)) return null;
    return dt + 7 * 24 * 60 * 60 * 1000;
  })();
  const isReturnEligible =
    order.isPaid === true &&
    !['cancelled', 'refunded'].includes(order.orderStatus.toLowerCase()) &&
    (returnCutoff ? Date.now() <= returnCutoff : false);

  // GST invoice only makes sense for orders shipped within India.
  const isIndianOrder =
    order.shippingAddress?.country?.toLowerCase() === 'india';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container max-w-5xl mx-auto px-4 py-6 sm:py-10">
        {/* Back Button */}
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium mb-6 group"
        >
          <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={18} />
          <span>Back to Orders</span>
        </Link>

        {/* Payment Message */}
        {paymentMessage && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            paymentMessage.includes('successful') 
              ? 'bg-emerald-50 border border-emerald-200' 
              : 'bg-amber-50 border border-amber-200'
          }`}>
            {paymentMessage.includes('successful') ? (
              <FiCheckCircle className="text-emerald-600 flex-shrink-0" size={20} />
            ) : (
              <FiClock className="text-amber-600 flex-shrink-0" size={20} />
            )}
            <p className={`font-medium ${
              paymentMessage.includes('successful') ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {paymentMessage}
            </p>
          </div>
        )}

        {/* Header Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Order Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-500 font-medium">ORDER</span>
                <button 
                  onClick={copyOrderId}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <span className="text-sm font-bold text-gray-900">#{order.orderNumber}</span>
                  {copiedId ? (
                    <FiCheck size={14} className="text-emerald-600" />
                  ) : (
                    <FiCopy size={14} className="text-gray-400" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <FiCalendar size={14} />
                <span>Placed on {formatDateTime(order.createdAt)}</span>
              </div>
            </div>
            
            {/* Status Badge + Return action */}
            <div className="flex flex-wrap items-center gap-2">
              {isReturnEligible && (
                <Link
                  to={`/orders/${order._id}/return`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                  title="Request a return for this order"
                >
                  <FiRotateCcw size={16} />
                  Request Return
                </Link>
              )}
              <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border ${statusInfo.color}`}>
                <StatusIcon size={16} />
                {statusInfo.label}
              </span>
            </div>
          </div>

          {/* Invoice Downloads - only for paid orders */}
          {order.isPaid && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadInvoice(false)}
                disabled={invoiceLoading !== null}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-black text-white hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {invoiceLoading === 'standard'
                  ? <FiLoader className="animate-spin" size={16} />
                  : <FiDownload size={16} />}
                Download Invoice
              </button>
              {isIndianOrder && (
                <button
                  type="button"
                  onClick={() => handleDownloadInvoice(true)}
                  disabled={invoiceLoading !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {invoiceLoading === 'gst'
                    ? <FiLoader className="animate-spin" size={16} />
                    : <FiFileText size={16} />}
                  Download GST Invoice
                </button>
              )}
            </div>
          )}

          {/* Tracking Number */}
          {order.trackingNumber && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm">
                <FiTruck size={16} className="text-gray-400" />
                <span className="text-gray-500">Tracking:</span>
                <span className="font-semibold text-gray-900">{order.trackingNumber}</span>
              </div>
            </div>
          )}
        </div>

        {/* Status Timeline - Mobile */}
        <div className="sm:hidden mb-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="flex justify-between items-center">
              {/* Payment */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  order.isPaid ? 'bg-emerald-100' : 'bg-amber-100'
                }`}>
                  {order.isPaid ? (
                    <FiCheck className="text-emerald-600" size={18} />
                  ) : (
                    <FiClock className="text-amber-600" size={18} />
                  )}
                </div>
                <span className="text-xs font-medium text-gray-600 mt-1.5">
                  {order.isPaid ? 'Paid' : 'Unpaid'}
                </span>
              </div>
              
              {/* Line */}
              <div className={`flex-1 h-0.5 mx-2 ${order.isPaid ? 'bg-emerald-200' : 'bg-gray-200'}`} />
              
              {/* Processing */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  ['processing', 'shipped', 'delivered'].includes(order.orderStatus.toLowerCase())
                    ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <FiShoppingBag className={
                    ['processing', 'shipped', 'delivered'].includes(order.orderStatus.toLowerCase())
                      ? 'text-blue-600' : 'text-gray-400'
                  } size={18} />
                </div>
                <span className="text-xs font-medium text-gray-600 mt-1.5">Processing</span>
              </div>
              
              {/* Line */}
              <div className={`flex-1 h-0.5 mx-2 ${
                ['shipped', 'delivered'].includes(order.orderStatus.toLowerCase()) ? 'bg-purple-200' : 'bg-gray-200'
              }`} />
              
              {/* Delivered */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  order.isDelivered ? 'bg-emerald-100' : 'bg-gray-100'
                }`}>
                  <FiTruck className={order.isDelivered ? 'text-emerald-600' : 'text-gray-400'} size={18} />
                </div>
                <span className="text-xs font-medium text-gray-600 mt-1.5">
                  {order.isDelivered ? 'Delivered' : 'Delivery'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Order Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items Card */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <FiPackage size={18} />
                  Order Items ({order.orderItems.length})
                </h2>
              </div>
              
              <div className="divide-y divide-gray-100">
                {order.orderItems.map((item, index) => (
                  <div key={index} className="p-4 sm:p-5 flex gap-4">
                    <img loading="lazy" decoding="async" 
                      src={item.image || '/placeholder-product.png'} 
                      alt={item.name}
                      className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl bg-gray-100 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1 truncate">{item.name}</h3>
                      <p className="text-sm text-gray-500 mb-2">
                        ${(item.price ?? 0).toFixed(2)} × {item.quantity}
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        ${((item.price ?? 0) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Status Cards */}
            <div className="hidden sm:grid grid-cols-2 gap-4">
              {/* Payment Status */}
              <div className={`rounded-2xl p-5 border ${
                order.isPaid 
                  ? 'bg-emerald-50 border-emerald-200' 
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    order.isPaid ? 'bg-emerald-100' : 'bg-amber-100'
                  }`}>
                    {order.isPaid ? (
                      <FiCheckCircle className="text-emerald-600" size={20} />
                    ) : (
                      <FiClock className="text-amber-600" size={20} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</p>
                    <p className={`font-bold ${order.isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {order.isPaid ? 'Paid' : 'Pending'}
                    </p>
                  </div>
                </div>
                {order.isPaid && order.paidAt && (
                  <p className="text-sm text-gray-600">{formatDate(order.paidAt)}</p>
                )}
                <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-1">
                  <FiCreditCard size={14} />
                  {order.paymentMethod}
                </p>
              </div>

              {/* Delivery Status */}
              <div className={`rounded-2xl p-5 border ${
                order.isDelivered 
                  ? 'bg-emerald-50 border-emerald-200' 
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    order.isDelivered ? 'bg-emerald-100' : 'bg-blue-100'
                  }`}>
                    {order.isDelivered ? (
                      <FiCheck className="text-emerald-600" size={20} />
                    ) : (
                      <FiTruck className="text-blue-600" size={20} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Delivery</p>
                    <p className={`font-bold ${order.isDelivered ? 'text-emerald-700' : 'text-blue-700'}`}>
                      {order.isDelivered ? 'Delivered' : 'In Transit'}
                    </p>
                  </div>
                </div>
                {order.isDelivered && order.deliveredAt && (
                  <p className="text-sm text-gray-600">{formatDate(order.deliveredAt)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Summary & Payment */}
          <div className="space-y-6">
            {/* Shipping Address */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <FiMapPin size={18} />
                Shipping Address
              </h3>
              <div className="text-gray-600 space-y-1">
                <p className="font-medium text-gray-900">{order.shippingAddress.address}</p>
                <p>{order.shippingAddress.city}, {order.shippingAddress.postalCode}</p>
                <p>{order.shippingAddress.country}</p>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Order Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium text-gray-900">${(order.itemsPrice ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Shipping</span>
                  <span className="font-medium text-gray-900">${(order.shippingPrice ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax</span>
                  <span className="font-medium text-gray-900">${(order.taxPrice ?? 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex justify-between">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="text-xl font-bold text-gray-900">${(order.totalPrice ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Result */}
            {order.paymentResult && (
              <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 sm:p-5">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <FiCheckCircle className="text-emerald-600" size={18} />
                  Payment Confirmed
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Transaction ID</p>
                    <p className="font-mono text-gray-900 text-xs mt-0.5 break-all">{order.paymentResult.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Status</p>
                    <p className="font-semibold text-emerald-700 mt-0.5">{order.paymentResult.status}</p>
                  </div>
                  {order.paymentResult.email_address && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Email</p>
                      <p className="font-medium text-gray-900 mt-0.5">{order.paymentResult.email_address}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Payment Section for Unpaid Orders */}
            {!order.isPaid && (
              <div 
                ref={paymentSectionRef} 
                className="bg-amber-50 rounded-2xl border-2 border-amber-200 p-4 sm:p-5"
              >
                <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <FiCreditCard className="text-amber-600" size={18} />
                  Complete Payment
                </h3>
                <Payment
                  orderId={order._id}
                  amount={order.totalPrice ?? 0}
                  paymentMethod={order.paymentMethod}
                  onPaymentSuccess={() => {
                    window.location.reload();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;