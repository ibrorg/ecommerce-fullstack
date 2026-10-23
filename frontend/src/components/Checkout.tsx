import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearCart } from '../store/slices/cartSlice';
import { Spinner } from './Loading';
import api from '../services/api';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import toast from 'react-hot-toast';
import { FiMapPin, FiCreditCard, FiCheck, FiArrowLeft, FiArrowRight, FiLoader, FiPackage, FiTag, FiX, FiAlertCircle, FiHome, FiBriefcase } from 'react-icons/fi';

interface SavedAddress {
  _id: string;
  label: 'Home' | 'Work' | 'Other';
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
}

interface ShippingAddress {
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

type DeliveryMethod = 'delivery' | 'pickup';

interface OrderData {
  orderItems: Array<{
    product: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
  }>;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  itemsPrice: number;
  taxPrice: number;
  shippingPrice: number;
  totalPrice: number;
  couponCode?: string;
}

type CouponStatus =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'success'; message: string };

interface CouponValidatePayload {
  valid: boolean;
  discountAmount?: number;
  error?: string;
}

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { items } = useAppSelector((state: any) => state.cart);
  const { user } = useAppSelector((state: any) => state.auth);
  useDocumentMeta({ title: 'Checkout', description: 'Complete your purchase securely with Stripe, Razorpay, or COD.' });

  const [currentStep, setCurrentStep] = useState(1);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('delivery');
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    address: '',
    city: '',
    postalCode: '',
    country: ''
  });
  const [saveAddressForNextTime, setSaveAddressForNextTime] = useState(true);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressSaved, setAddressSaved] = useState(false);
  // saved addresses from the address book — used to prefill the shipping form
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('PayPal');
  const [isLoading, setIsLoading] = useState(false);

  // Reservation session — holds stock during checkout
  const [reservationSessionId, setReservationSessionId] = useState<string | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
  } | null>(null);
  const [couponStatus, setCouponStatus] = useState<CouponStatus>({ type: 'idle' });

  // Calculate prices
  const itemsPrice = items.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0);
  // tax + shipping rates must match backend orderController.createOrder
  // backend: TAX_RATE=0.08, SHIPPING_FLAT=9.99 (free over $100)
  const shippingPrice = deliveryMethod === 'pickup' ? 0 : (itemsPrice > 100 ? 0 : 9.99);
  const taxPrice = Number((0.08 * itemsPrice).toFixed(2));
  const discountAmount = appliedCoupon?.discountAmount ?? 0;
  const totalPrice = Number(
    Math.max(0, itemsPrice + shippingPrice + taxPrice - discountAmount).toFixed(2),
  );

  // If the cart contents change after a coupon was applied, clear it so the
  // discount does not go stale. The backend re-validates on order creation.
  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null);
      setCouponStatus({ type: 'idle' });
      setCouponInput('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsPrice]);

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponStatus({ type: 'error', message: 'Enter a coupon code.' });
      return;
    }
    setCouponStatus({ type: 'loading' });
    try {
      const response = await api.post('/api/coupons/validate', {
        code,
        itemsPrice,
        categories: [],
      });
      const body = response.data;
      const payload: CouponValidatePayload | undefined =
        body && typeof body === 'object' && 'data' in body
          ? (body.data as CouponValidatePayload)
          : (body as CouponValidatePayload);
      if (payload?.valid) {
        const amount = Number(payload.discountAmount) || 0;
        setAppliedCoupon({ code, discountAmount: amount });
        setCouponStatus({
          type: 'success',
          message: `Coupon applied: -$${amount.toFixed(2)}`,
        });
      } else {
        setAppliedCoupon(null);
        setCouponStatus({
          type: 'error',
          message: payload?.error || 'This coupon is invalid.',
        });
      }
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: string; message?: string }>;
      setAppliedCoupon(null);
      setCouponStatus({
        type: 'error',
        message:
          axiosErr.response?.data?.error ||
          axiosErr.response?.data?.message ||
          'Unable to validate coupon. Please try again.',
      });
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponStatus({ type: 'idle' });
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [user, items, navigate]);

  // Hold stock when entering checkout, release on leave
  useEffect(() => {
    if (!user || items.length === 0) return;

    let sessionId: string | null = null;
    let released = false;

    const holdStock = async () => {
      try {
        const sessionRes = await api.post('/api/reservations/session');
        sessionId = sessionRes.data.data.sessionId;
        setReservationSessionId(sessionId);

        await api.post('/api/reservations/hold', {
          sessionId,
          items: items.map((item: any) => ({
            productId: item.product || item._id,
            quantity: item.quantity
          }))
        });
      } catch (err) {
        // if hold fails (insufficient stock), let user see the error but don't block
        console.warn('Stock reservation failed:', err);
      }
    };

    const releaseStock = async () => {
      if (released || !sessionId) return;
      released = true;
      try {
        await api.delete(`/api/reservations/session/${sessionId}`);
      } catch {
        // ignore — TTL will clean up
      }
    };

    holdStock();

    // release on unmount (leaving checkout without ordering)
    return () => {
      releaseStock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill from saved profile shipping address
  useEffect(() => {
    const saved = user?.shippingAddress;
    if (!saved) return;

    const hasAny = [saved.address, saved.city, saved.postalCode, saved.country].some((v) => (v || '').trim().length > 0);
    if (!hasAny) return;

    setShippingAddress({
      address: saved.address || '',
      city: saved.city || '',
      postalCode: saved.postalCode || '',
      country: saved.country || ''
    });
  }, [user]);

  // Load saved addresses from the address book. The default-shipping entry
  // auto-fills the form so a returning buyer can skip typing.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.getAddresses();
        if (cancelled) return;
        const list: SavedAddress[] = res.data.data || [];
        setSavedAddresses(list);
        const def = list.find((a) => a.isDefaultShipping) || list[0];
        if (def && !shippingAddress.address) {
          setSelectedSavedId(def._id);
          setShippingAddress({
            address: [def.line1, def.line2].filter(Boolean).join(', '),
            city: def.city,
            postalCode: def.postalCode,
            country: def.country
          });
        }
      } catch (_err) {
        // non-blocking — user can still type manually
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectSavedAddress = (addr: SavedAddress) => {
    setSelectedSavedId(addr._id);
    setShippingAddress({
      address: [addr.line1, addr.line2].filter(Boolean).join(', '),
      city: addr.city,
      postalCode: addr.postalCode,
      country: addr.country
    });
  };

  useEffect(() => {
    if (!addressSaved) return;
    const t = window.setTimeout(() => setAddressSaved(false), 2500);
    return () => window.clearTimeout(t);
  }, [addressSaved]);

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (deliveryMethod === 'pickup') {
      // Order model requires a shippingAddress; use a clear placeholder.
      setShippingAddress({
        address: 'Store Pickup',
        city: 'Pickup',
        postalCode: '00000',
        country: 'Pickup'
      });
      setCurrentStep(2);
      return;
    }

    if (!(shippingAddress.address && shippingAddress.city && shippingAddress.postalCode && shippingAddress.country)) {
      return;
    }

    if (saveAddressForNextTime) {
      try {
        setIsSavingAddress(true);
        await api.updateProfile({ shippingAddress });
        setAddressSaved(true);
      } catch (err) {
        // Non-blocking: user can still proceed
        console.warn('Failed to save shipping address:', err);
      } finally {
        setIsSavingAddress(false);
      }
    }

    setCurrentStep(2);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep(3);
  };

  const handlePlaceOrder = async () => {
    setIsLoading(true);
    
    try {
      const orderData: OrderData = {
        orderItems: items.map((item: any) => ({
          product: item.id,
          name: item.name,
          image: item.image,
          price: item.price,
          quantity: item.quantity
        })),
        shippingAddress,
        paymentMethod,
        itemsPrice,
        taxPrice,
        shippingPrice,
        totalPrice,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
      };

      // Create the order first
      const orderResponse = await api.createOrder(orderData);
      const orderId = orderResponse.data.data._id;

      // Create Stripe checkout session and redirect
      try {
        const checkoutResponse = await api.createCheckoutSession(orderId);

        if (checkoutResponse.data.url) {
          // Clear cart before redirecting to payment
          dispatch(clearCart());
          // Convert reservations (stock decrement happens in order transaction)
          if (reservationSessionId) {
            try {
              await api.post(`/api/orders/${orderId}/convert-reservations`, { sessionId: reservationSessionId });
            } catch {
              // non-critical — reservations will expire + release via TTL
            }
          }
          // Redirect to Stripe checkout
          window.location.href = checkoutResponse.data.url;
        } else {
          throw new Error('No checkout URL received');
        }
      } catch (stripeError: any) {
        // If Stripe is not configured, just navigate to order page
        console.log('Stripe not configured, order created without payment:', stripeError.message);
        dispatch(clearCart());
        navigate(`/order/${orderId}`);
      }
    } catch (error: any) {
      console.error('Order creation error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to create order';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex justify-between mb-12 sm:mb-16 lg:mb-20 px-2">
      {[
        { num: 1, label: 'Shipping', icon: FiMapPin },
        { num: 2, label: 'Payment', icon: FiCreditCard },
        { num: 3, label: 'Review', icon: FiCheck }
      ].map((step, idx) => {
        const Icon = step.icon;
        return (
          <div key={step.num} className="flex-1 relative">
            {/* Connector line */}
            {idx < 2 && (
              <div
                className={`absolute top-6 sm:top-7 left-1/2 w-1/2 h-1 rounded-full transition-all duration-300 ${
                  currentStep > step.num ? 'bg-black' : 'bg-gray-200'
                }`}
              />
            )}
            
            {/* Step circle and label */}
            <div className="flex flex-col items-center relative">
              <div
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                  currentStep >= step.num
                    ? 'bg-black text-white shadow-lg scale-110'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Icon size={24} />
              </div>
              <p
                className={`text-sm font-semibold mt-3 text-center transition-colors duration-200 ${
                  currentStep >= step.num ? 'text-black' : 'text-gray-500'
                }`}
              >
                {step.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderShippingForm = () => (
    <form onSubmit={handleShippingSubmit} className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-8">
          <FiMapPin className="text-black" size={28} />
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Shipping Address</h2>
        </div>

        {/* Delivery method */}
        <div className="p-4 sm:p-5 rounded-2xl border-2 border-gray-200 bg-white mb-8">
          <p className="text-sm font-semibold text-gray-900 mb-4">Delivery method</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                deliveryMethod === 'delivery' ? 'border-black bg-black/5' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="deliveryMethod"
                value="delivery"
                checked={deliveryMethod === 'delivery'}
                onChange={() => setDeliveryMethod('delivery')}
                className="mt-1 w-5 h-5"
              />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">Delivery</p>
                <p className="text-sm text-gray-600">Ship to your address.</p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                deliveryMethod === 'pickup' ? 'border-black bg-black/5' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="deliveryMethod"
                value="pickup"
                checked={deliveryMethod === 'pickup'}
                onChange={() => setDeliveryMethod('pickup')}
                className="mt-1 w-5 h-5"
              />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  <FiPackage />
                  Pickup
                </p>
                <p className="text-sm text-gray-600">No shipping fee. Faster checkout.</p>
              </div>
            </label>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Saved address picker — only for delivery, hidden for pickup */}
          {deliveryMethod === 'delivery' && savedAddresses.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Saved Addresses
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                {savedAddresses.map((addr) => {
                  const active = selectedSavedId === addr._id;
                  const LabelIcon = addr.label === 'Home' ? FiHome : addr.label === 'Work' ? FiBriefcase : FiMapPin;
                  return (
                    <button
                      key={addr._id}
                      type="button"
                      onClick={() => selectSavedAddress(addr)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        active
                          ? 'border-black bg-black/5 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700">
                          <LabelIcon size={12} />
                          {addr.label}
                        </span>
                        {addr.isDefaultShipping && (
                          <span className="text-[10px] font-bold bg-neutral-900 text-white px-1.5 py-0.5 rounded">
                            DEFAULT
                          </span>
                        )}
                        {active && <FiCheck className="text-black" size={16} />}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{addr.fullName}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}
                      </p>
                      <p className="text-xs text-gray-600">
                        {addr.city}, {addr.state} {addr.postalCode}
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400">
                Pick a saved address to autofill, or edit the fields below.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Street Address</label>
            <input
              type="text"
              value={shippingAddress.address}
              onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
              className={`w-full px-4 py-4 text-base border-2 border-gray-300 rounded-xl focus:border-black focus:outline-none transition-colors hover:border-gray-400 bg-white ${
                deliveryMethod === 'pickup' ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              placeholder="123 Main Street"
              required={deliveryMethod === 'delivery'}
              disabled={deliveryMethod === 'pickup'}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">City</label>
              <input
                type="text"
                value={shippingAddress.city}
                onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                className={`w-full px-4 py-4 text-base border-2 border-gray-300 rounded-xl focus:border-black focus:outline-none transition-colors hover:border-gray-400 bg-white ${
                  deliveryMethod === 'pickup' ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                placeholder="New York"
                required={deliveryMethod === 'delivery'}
                disabled={deliveryMethod === 'pickup'}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Postal Code</label>
              <input
                type="text"
                value={shippingAddress.postalCode}
                onChange={(e) => setShippingAddress({ ...shippingAddress, postalCode: e.target.value })}
                className={`w-full px-4 py-4 text-base border-2 border-gray-300 rounded-xl focus:border-black focus:outline-none transition-colors hover:border-gray-400 bg-white ${
                  deliveryMethod === 'pickup' ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                placeholder="10001"
                required={deliveryMethod === 'delivery'}
                disabled={deliveryMethod === 'pickup'}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Country</label>
            <input
              type="text"
              value={shippingAddress.country}
              onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
              className={`w-full px-4 py-4 text-base border-2 border-gray-300 rounded-xl focus:border-black focus:outline-none transition-colors hover:border-gray-400 bg-white ${
                deliveryMethod === 'pickup' ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              placeholder="United States"
              required={deliveryMethod === 'delivery'}
              disabled={deliveryMethod === 'pickup'}
            />
          </div>

          {/* Save for next time */}
          {deliveryMethod === 'delivery' && (
            <div className="p-4 rounded-2xl border-2 border-gray-200 bg-white">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAddressForNextTime}
                  onChange={(e) => setSaveAddressForNextTime(e.target.checked)}
                  className="mt-1 w-5 h-5"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Save this address for next time</p>
                  <p className="text-sm text-gray-600">You can edit it later from Profile.</p>
                </div>
              </label>
              <div className="mt-3 text-sm text-gray-600">
                {isSavingAddress ? (
                  <span className="inline-flex items-center gap-2"><FiLoader className="animate-spin" /> Saving…</span>
                ) : addressSaved ? (
                  <span className="text-gray-900 font-semibold">Saved</span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <button type="submit" className="w-full py-4 px-6 text-lg font-semibold rounded-xl bg-black text-white hover:bg-gray-900 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 group shadow-lg hover:shadow-xl">
        Continue
        <FiArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
      </button>
    </form>
  );

  const renderPaymentForm = () => (
    <form onSubmit={handlePaymentSubmit} className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-8">
          <FiCreditCard className="text-black" size={28} />
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Payment Method</h2>
        </div>
        
        <div className="space-y-4">
          {['PayPal', 'Stripe'].map((method) => (
            <label
              key={method}
              className={`flex items-center p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 group ${
                paymentMethod === method
                  ? 'border-black bg-black/5 shadow-lg'
                  : 'border-gray-300 hover:border-gray-400 bg-white'
              }`}
            >
              <input
                type="radio"
                value={method}
                checked={paymentMethod === method}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-5 h-5 cursor-pointer"
              />
              <span className="ml-4 font-semibold text-lg text-gray-900">{method}</span>
              {paymentMethod === method && (
                <FiCheck className="ml-auto text-black" size={24} />
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className="flex-1 py-4 px-6 text-lg font-semibold rounded-xl bg-white border-2 border-gray-300 text-gray-900 hover:border-gray-400 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
        >
          <FiArrowLeft size={20} />
          Back
        </button>
        <button
          type="submit"
          className="flex-1 py-4 px-6 text-lg font-semibold rounded-xl bg-black text-white hover:bg-gray-900 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 group shadow-lg hover:shadow-xl"
        >
          Continue to Review
          <FiArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
        </button>
      </div>
    </form>
  );

  const renderOrderReview = () => (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <FiCheck className="text-black" size={28} />
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Review Your Order</h2>
      </div>
      
      {/* Order Items */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Items ({items.length})</h3>
        <div className="p-6 sm:p-8 space-y-4 rounded-2xl border-2 border-gray-200 bg-white">
          {items.map((item: any, index: number) => (
            <div key={item._id || `item-${index}`} className="flex items-start justify-between pb-4 border-b last:border-b-0 last:pb-0 gap-4">
              <div className="flex gap-4 flex-1 min-w-0">
                <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-xl flex-shrink-0 shadow-md" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-base text-gray-900 line-clamp-2">{item.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">Qty: <span className="font-semibold">{item.quantity}</span></p>
                </div>
              </div>
              <span className="font-bold text-lg text-gray-900 flex-shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shipping Address */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h3>
        <div className="p-6 sm:p-8 rounded-2xl border-2 border-gray-200 bg-white">
          <p className="font-semibold text-base text-gray-900">{shippingAddress.address}</p>
          <p className="text-sm text-gray-700 mt-2">{shippingAddress.city}, {shippingAddress.postalCode}</p>
          <p className="text-sm text-gray-700">{shippingAddress.country}</p>
        </div>
      </div>

      {/* Payment Method */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h3>
        <div className="p-6 sm:p-8 rounded-2xl border-2 border-gray-200 bg-white">
          <p className="font-semibold text-base text-gray-900 flex items-center gap-2">
            <FiCreditCard size={20} />
            {paymentMethod}
          </p>
        </div>
      </div>

      {/* Order Summary */}
      <div className="p-8 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Order Summary</h3>
        <div className="space-y-4">
          <div className="flex justify-between text-base text-gray-700">
            <span>Subtotal</span>
            <span>${itemsPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base text-gray-700">
            <span>Shipping</span>
            <span className={shippingPrice === 0 ? 'text-green-600 font-semibold' : ''}>${shippingPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base text-gray-700 pb-4 border-b-2 border-gray-300">
            <span>Tax (15%)</span>
            <span>${taxPrice.toFixed(2)}</span>
          </div>
          {appliedCoupon && discountAmount > 0 && (
            <div className="flex justify-between text-base text-emerald-700">
              <span>Discount ({appliedCoupon.code})</span>
              <span className="font-semibold">-${discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-4">
            <span className="text-lg font-bold text-gray-900">Total Amount</span>
            <span className="text-4xl font-bold text-gray-900">${totalPrice.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Coupon input */}
      <div className="p-6 rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <FiTag className="text-gray-700" size={18} />
          <h3 className="text-base font-semibold text-gray-900">Have a coupon code?</h3>
        </div>

        {appliedCoupon ? (
          <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 min-w-0">
              <FiCheck className="text-emerald-600 flex-shrink-0" size={16} />
              <span className="text-sm text-emerald-800 truncate">
                Coupon applied:{' '}
                <span className="font-mono font-semibold">
                  {appliedCoupon.code}
                </span>{' '}
                (-${appliedCoupon.discountAmount.toFixed(2)})
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 font-medium flex-shrink-0 ml-3"
            >
              <FiX size={14} />
              Remove
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyCoupon();
                  }
                }}
                placeholder="Enter code"
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent font-mono uppercase tracking-wide placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400"
                disabled={couponStatus.type === 'loading'}
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={
                  couponStatus.type === 'loading' || !couponInput.trim()
                }
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold bg-black text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {couponStatus.type === 'loading' ? (
                  <FiLoader className="animate-spin" size={16} />
                ) : (
                  'Apply'
                )}
              </button>
            </div>
            {couponStatus.type === 'error' && couponStatus.message && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <FiAlertCircle size={14} className="flex-shrink-0" />
                {couponStatus.message}
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => setCurrentStep(2)}
          className="flex-1 py-4 px-6 text-lg font-semibold rounded-xl bg-white border-2 border-gray-300 text-gray-900 hover:border-gray-400 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
        >
          <FiArrowLeft size={20} />
          Back
        </button>
        <button
          onClick={handlePlaceOrder}
          disabled={isLoading}
          className="flex-1 py-4 px-6 text-lg font-semibold rounded-xl bg-black text-white hover:bg-gray-900 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 group shadow-lg hover:shadow-xl"
        >
          {isLoading ? (
            <>
              <FiLoader className="animate-spin" size={20} />
              Placing Order...
            </>
          ) : (
            <>
              <FiCheck size={20} />
              Place Order
            </>
          )}
        </button>
      </div>
    </div>
  );

  if (!user || items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spinner size="lg" message="Loading checkout..." />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gray-50 rounded-full -mr-48 -mt-48 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-gray-50 rounded-full -ml-36 -mb-36 pointer-events-none" />
      
      {isLoading && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <Spinner size="lg" message="Processing your order..." />
          </div>
        </div>
      )}
      <div className="container px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 relative">
        <div className="max-w-3xl mx-auto">
          {renderStepIndicator()}
          
          <div className="px-4 sm:px-6 lg:px-8 p-8 sm:p-10 rounded-2xl bg-white border border-gray-200 shadow-sm">
            {currentStep === 1 && renderShippingForm()}
            {currentStep === 2 && renderPaymentForm()}
            {currentStep === 3 && renderOrderReview()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;