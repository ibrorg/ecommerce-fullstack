import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';
import api from '../services/api';
import {
  FiArrowLeft,
  FiPackage,
  FiAlertCircle,
  FiCheckCircle,
  FiLoader,
  FiRotateCcw,
  FiImage,
  FiCreditCard,
} from 'react-icons/fi';

// ---- Types ----

interface OrderItem {
  product: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
}

interface Order {
  _id: string;
  orderNumber?: string;
  orderItems: OrderItem[];
  itemsPrice?: number;
  taxPrice?: number;
  shippingPrice?: number;
  totalPrice: number;
  isPaid: boolean;
  orderStatus?: string;
  createdAt?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

type ItemReason =
  | 'damaged'
  | 'wrong_item'
  | 'not_as_described'
  | 'changed_mind'
  | 'other';

interface ItemFormState {
  selected: boolean;
  quantity: number;
  reason: ItemReason;
}

const REASON_OPTIONS: { value: ItemReason; label: string }[] = [
  { value: 'damaged', label: 'Damaged on arrival' },
  { value: 'wrong_item', label: 'Wrong item received' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'changed_mind', label: 'Changed my mind' },
  { value: 'other', label: 'Other' },
];

const REASON_LABEL: Record<ItemReason, string> = {
  damaged: 'Damaged on arrival',
  wrong_item: 'Wrong item received',
  not_as_described: 'Not as described',
  changed_mind: 'Changed my mind',
  other: 'Other',
};

const MAX_REASON_LENGTH = 500;

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

const ReturnRequest: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [itemStates, setItemStates] = useState<Record<string, ItemFormState>>({});
  const [reason, setReason] = useState<string>('');
  const [photosInput, setPhotosInput] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch order
  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/api/orders/${id}`);
        const body = response.data;
        let orderData: Order | null = null;
        if (body && typeof body === 'object' && 'success' in body) {
          const env = body as ApiEnvelope<Order>;
          orderData = env.data ?? null;
        } else {
          orderData = (body as Order | undefined) ?? null;
        }
        if (!orderData) {
          setError('Order not found');
          return;
        }
        setOrder(orderData);
        const initial: Record<string, ItemFormState> = {};
        orderData.orderItems?.forEach((item, idx) => {
          initial[`${idx}-${item.product}`] = {
            selected: false,
            quantity: 1,
            reason: 'damaged',
          };
        });
        setItemStates(initial);
      } catch (err) {
        const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
        setError(
          axiosErr.response?.data?.message ||
            axiosErr.response?.data?.error ||
            'Unable to load order. Please try again.',
        );
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const selectedItems = useMemo(() => {
    if (!order) return [];
    return order.orderItems
      .map((item, idx) => ({ item, key: `${idx}-${item.product}`, idx }))
      .filter(({ key }) => itemStates[key]?.selected);
  }, [order, itemStates]);

  const estimatedRefund = useMemo(() => {
    return selectedItems.reduce((sum, { item, key }) => {
      const qty = itemStates[key]?.quantity ?? 0;
      return sum + (item.price || 0) * qty;
    }, 0);
  }, [selectedItems, itemStates]);

  const toggleItem = (key: string) => {
    setItemStates((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        selected: !prev[key]?.selected,
        quantity: !prev[key]?.selected ? 1 : prev[key]?.quantity ?? 1,
      },
    }));
  };

  const updateItemField = (
    key: string,
    field: keyof ItemFormState,
    value: number | ItemReason,
  ) => {
    setItemStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value } as ItemFormState,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !id) return;
    setSubmitError(null);

    if (selectedItems.length === 0) {
      setSubmitError('Please select at least one item to return');
      return;
    }

    // Validate quantities
    for (const { item, key } of selectedItems) {
      const qty = itemStates[key]?.quantity ?? 0;
      if (qty < 1) {
        setSubmitError(`Quantity for "${item.name}" must be at least 1`);
        return;
      }
      if (qty > item.quantity) {
        setSubmitError(
          `Quantity for "${item.name}" cannot exceed the ordered amount (${item.quantity})`,
        );
        return;
      }
    }

    if (reason.length > MAX_REASON_LENGTH) {
      setSubmitError(`Reason must be ${MAX_REASON_LENGTH} characters or fewer`);
      return;
    }

    const itemsPayload = selectedItems.map(({ item, key }) => ({
      product: item.product,
      name: item.name,
      quantity: itemStates[key]?.quantity ?? 1,
      price: item.price,
      reason: itemStates[key]?.reason ?? 'other',
    }));

    const photos = photosInput
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    const payload: Record<string, unknown> = {
      orderId: order._id,
      items: itemsPayload,
      reason: reason.trim() || 'Customer return request',
    };
    if (photos.length > 0) payload.photos = photos;

    setSubmitting(true);
    try {
      const response = await api.post('/api/returns', payload);
      const body = response.data;
      let ok = true;
      let msg: string | undefined;
      if (body && typeof body === 'object' && 'success' in body) {
        const env = body as ApiEnvelope<unknown>;
        ok = env.success !== false;
        msg = env.message || env.error;
      }
      if (!ok) {
        setSubmitError(msg || 'Failed to submit return request');
        return;
      }
      toast.success('Return request submitted successfully');
      navigate('/orders');
    } catch (err) {
      const axiosErr = err as AxiosError<ApiEnvelope<unknown>>;
      setSubmitError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.error ||
          'Unable to submit return request. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-black" />
            <FiRotateCcw
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400"
              size={24}
            />
          </div>
          <p className="text-lg text-gray-600 font-medium">Loading order...</p>
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="container max-w-4xl mx-auto px-4 py-8 sm:py-16">
          <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center">
            <div className="text-4xl mb-4">😕</div>
            <p className="text-red-700 font-semibold text-lg mb-2">
              Something went wrong
            </p>
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
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <FiPackage className="text-gray-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Order Not Found
          </h1>
          <p className="text-gray-500 mb-6">
            We couldn't find the order you're looking for.
          </p>
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container max-w-4xl mx-auto px-4 py-6 sm:py-10">
        {/* Back Button */}
        <Link
          to={`/order/${order._id}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium mb-6 group"
        >
          <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={18} />
          <span>Back to Order</span>
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 mb-6 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <FiRotateCcw size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Request a Return
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Select the items you'd like to return and tell us why.
              </p>
            </div>
          </div>

          {/* Order summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Order #
              </p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {order.orderNumber || order._id.slice(-8).toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Placed
              </p>
              <p className="text-sm text-gray-900 mt-0.5">
                {formatDate(order.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Items
              </p>
              <p className="text-sm text-gray-900 mt-0.5">
                {order.orderItems?.length || 0}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Total
              </p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {formatCurrency(order.totalPrice)}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select items */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center">
                1
              </span>
              <h2 className="font-bold text-gray-900">Select items to return</h2>
            </div>

            <div className="space-y-3">
              {order.orderItems.map((item, idx) => {
                const key = `${idx}-${item.product}`;
                const state = itemStates[key];
                if (!state) return null;
                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-4 transition-colors ${
                      state.selected
                        ? 'border-amber-300 bg-amber-50/50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id={`item-${key}`}
                        checked={state.selected}
                        onChange={() => toggleItem(key)}
                        className="mt-1 h-4 w-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 cursor-pointer"
                      />
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-14 h-14 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`item-${key}`}
                          className="text-sm font-semibold text-gray-900 cursor-pointer"
                        >
                          {item.name}
                        </label>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatCurrency(item.price)} × {item.quantity} ordered
                        </p>
                      </div>
                    </div>

                    {state.selected && (
                      <div className="mt-4 pt-4 border-t border-amber-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Quantity to return
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={state.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              updateItemField(
                                key,
                                'quantity',
                                Number.isNaN(val) ? 1 : Math.min(Math.max(val, 1), item.quantity),
                              );
                            }}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Reason
                          </label>
                          <select
                            value={state.reason}
                            onChange={(e) =>
                              updateItemField(
                                key,
                                'reason',
                                e.target.value as ItemReason,
                              )
                            }
                            className={inputClass}
                          >
                            {REASON_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="sm:col-span-2 text-xs text-gray-500">
                          Selected reason:{' '}
                          <span className="font-medium text-gray-700">
                            {REASON_LABEL[state.reason]}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedItems.length > 0 && (
              <div className="mt-4 flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-sm text-emerald-700 font-medium flex items-center gap-1.5">
                  <FiCheckCircle size={14} />
                  {selectedItems.length} item{selectedItems.length === 1 ? '' : 's'} selected
                </span>
                <span className="text-sm font-bold text-emerald-900">
                  Est. refund: {formatCurrency(estimatedRefund)}
                </span>
              </div>
            )}
          </div>

          {/* Step 2: Overall reason */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center">
                2
              </span>
              <h2 className="font-bold text-gray-900">Tell us more</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional details <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON_LENGTH))}
                placeholder="Share any details that would help us process your return faster..."
                rows={4}
                maxLength={MAX_REASON_LENGTH}
                className={inputClass}
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {reason.length} / {MAX_REASON_LENGTH}
              </p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <FiImage size={14} />
                Photo URLs <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={photosInput}
                onChange={(e) => setPhotosInput(e.target.value)}
                placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg"
                className={inputClass}
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated URLs of any photos showing the issue.
              </p>
            </div>
          </div>

          {/* Step 3: Review & submit */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center">
                3
              </span>
              <h2 className="font-bold text-gray-900">Review & submit</h2>
            </div>

            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <FiPackage size={14} />
                  Items being returned
                </span>
                <span className="font-medium text-gray-900">
                  {selectedItems.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <FiCreditCard size={14} />
                  Estimated refund
                </span>
                <span className="font-bold text-gray-900">
                  {formatCurrency(estimatedRefund)}
                </span>
              </div>
              <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                Final refund amount is confirmed by our team once the return is
                reviewed. You'll be notified on approval.
              </p>
            </div>

            {submitError && (
              <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <FiAlertCircle
                  className="text-red-600 flex-shrink-0 mt-0.5"
                  size={16}
                />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 mt-5">
              <Link
                to={`/order/${order._id}`}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-center transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || selectedItems.length === 0}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <>
                    <FiLoader className="animate-spin" size={16} />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FiRotateCcw size={16} />
                    Submit Return Request
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReturnRequest;
