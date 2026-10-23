import React, { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../store/hooks';
import { FiCreditCard, FiCheck, FiLock, FiAlertCircle } from 'react-icons/fi';
import { SiPaypal, SiStripe } from 'react-icons/si';

// ============================================
// Types & Interfaces
// ============================================

interface PaymentMethod {
  id: 'paypal' | 'stripe' | 'credit_card';
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface OrderSummary {
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  items: Array<{
    _id: string;
    name: string;
    price: number;
    qty: number;
  }>;
}

type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

interface CardData {
  cardNumber: string;
  cardHolder: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

// PayPal & Stripe types
interface PayPalButtonProps {
  amount: number;
  orderId: string;
  onSuccess: (details: any) => void;
  onError: (error: any) => void;
}

interface StripeButtonProps {
  amount: number;
  orderId: string;
  onSuccess: (paymentIntent: any) => void;
  onError: (error: any) => void;
}

interface PaymentProps {
  orderId?: string;
  amount?: number;
  paymentMethod?: string;
  onPaymentSuccess: () => void;
  orderSummary?: OrderSummary;
}

declare global {
  interface Window {
    paypal: any;
  }
}

// ============================================
// PayPal Button Component
// ============================================

const PayPalButton: React.FC<PayPalButtonProps> = ({ amount, orderId, onSuccess, onError }) => {
  const { token } = useAppSelector((state: any) => state.auth);
  const [sdkReady, setSdkReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const addPayPalScript = async () => {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&currency=USD`;
      script.async = true;
      script.onload = () => {
        setSdkReady(true);
      };
      document.body.appendChild(script);
    };

    if (!window.paypal) {
      addPayPalScript();
    } else {
      setSdkReady(true);
    }
  }, []);

  useEffect(() => {
    if (sdkReady && window.paypal && containerRef.current) {
      containerRef.current.innerHTML = '';

      window.paypal
        .Buttons({
        createOrder: (_data: any, actions: any) => {
          return actions.order.create({
            purchase_units: [
              {
                amount: {
                  value: amount.toFixed(2)
                }
              }
            ]
          });
        },
        onApprove: async (_data: any, actions: any) => {
          try {
            const details = await actions.order.capture();
            
            // Update order payment status
            const response = await fetch(`/api/orders/${orderId}/pay`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                id: details.id,
                status: details.status,
                update_time: details.update_time,
                payer: details.payer
              })
            });

            if (response.ok) {
              onSuccess(details);
            } else {
              const errorData = await response.json();
              onError(errorData.error || 'Payment update failed');
            }
          } catch (error) {
            onError(error);
          }
        },
        onError: (error: any) => {
          onError(error);
        }
      })
        .render(containerRef.current);
    }
  }, [sdkReady, amount, orderId, token, onSuccess, onError]);

  return (
    <div>
      {!sdkReady ? (
        <div className="flex justify-center items-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          <span className="ml-2">Loading PayPal...</span>
        </div>
      ) : (
        <div ref={containerRef} />
      )}
    </div>
  );
};

// ============================================
// Stripe Button Component
// ============================================

const StripeButton: React.FC<StripeButtonProps> = ({ amount: _amount, orderId, onSuccess: _onSuccess, onError }) => {
  const { token } = useAppSelector((state: any) => state.auth);
  const [loading, setLoading] = useState(false);

  const handleStripePayment = async () => {
    setLoading(true);
    
    try {
      // Create Stripe checkout session
      const response = await fetch(`/api/orders/${orderId}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // If Stripe is configured, redirect to checkout
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        
        // If no URL (Stripe not configured), show error
        onError('Stripe payment is not configured. Please contact support.');
        setLoading(false);
      } else {
        const errorData = await response.json();
        onError(errorData.error || 'Payment failed');
        setLoading(false);
      }
    } catch (error) {
      onError(error);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleStripePayment}
      disabled={loading}
      className="w-full bg-purple-600 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          Processing Payment...
        </div>
      ) : (
        `Continue with Stripe`
      )}
    </button>
  );
};

// ============================================
// Main Payment Component
// ============================================

const Payment: React.FC<PaymentProps> = ({
  orderId = '',
  amount = 0,
  paymentMethod = 'credit_card',
  onPaymentSuccess,
  orderSummary
}) => {
  const { user } = useAppSelector((state: any) => state.auth);
  
  // State management
  const [selectedPayment, setSelectedPayment] = useState<'paypal' | 'stripe' | 'credit_card'>(
    (paymentMethod as any) || 'credit_card'
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  // Credit card form state
  const [cardData, setCardData] = useState<CardData>({
    cardNumber: '',
    cardHolder: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
  });

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'credit_card',
      name: 'Credit Card',
      icon: <FiCreditCard size={18} />,
      description: 'Pay with credit or debit card',
    },
    {
      id: 'paypal',
      name: 'PayPal',
      icon: <SiPaypal size={18} />,
      description: 'Fast checkout with PayPal',
    },
    {
      id: 'stripe',
      name: 'Stripe',
      icon: <SiStripe size={18} />,
      description: 'Redirects to Stripe Checkout',
    },
  ];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(val);
  };

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'processing':
        return 'text-blue-600 bg-blue-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setPaymentStatus('processing');

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const paymentData = {
        method: selectedPayment,
        amount: orderSummary?.total || amount,
        currency: 'USD',
        userId: user?.id,
        ...(selectedPayment === 'credit_card' && { cardData }),
      };

      console.log('Processing payment:', paymentData);

      setPaymentStatus('completed');
      setShowReceipt(true);
      setTimeout(() => {
        onPaymentSuccess();
      }, 2000);
    } catch (error) {
      console.error('Payment failed:', error);
      setPaymentStatus('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuccess = (details: any) => {
    console.log('Payment successful:', details);
    setPaymentStatus('completed');
    setShowReceipt(true);
    setTimeout(() => {
      onPaymentSuccess();
    }, 2000);
  };

  const handleError = (error: any) => {
    console.error('Payment error:', error);
    setPaymentStatus('failed');
  };

  // Show receipt if payment completed
  if (showReceipt && paymentStatus === 'completed') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Payment successful</h2>
            <p className="text-sm text-emerald-700 mt-1">Your order payment has been confirmed.</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-white/70 border border-emerald-200 flex items-center justify-center">
            <FiCheck className="text-emerald-700" size={18} />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Receipt</h3>
          
          <div className="space-y-3 mb-6">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Order ID:</span>
              <span className="font-semibold text-gray-900">#{orderId ? orderId.slice(-8) : Math.random().toString(36).slice(2, 10)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Payment Method:</span>
              <span className="font-semibold text-gray-900 capitalize">
                {selectedPayment.replace('_', ' ')}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Date:</span>
              <span className="font-semibold text-gray-900">{new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {orderSummary && (
            <>
              <h4 className="font-semibold text-gray-900 mb-3">Items</h4>
              <div className="space-y-2 mb-6">
                {orderSummary.items.map((item) => (
                  <div key={item._id} className="flex justify-between">
                    <span className="text-gray-600">{item.name} x {item.qty}</span>
                    <span className="text-gray-900">{formatCurrency(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="border-t-2 pt-4">
            <div className="flex justify-between text-lg font-bold text-gray-900">
              <span>Total:</span>
              <span className="text-green-600">{formatCurrency(orderSummary?.total || amount)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setShowReceipt(false);
            setPaymentStatus('pending');
          }}
          className="w-full mt-4 bg-emerald-600 text-white py-2.5 rounded-xl hover:bg-emerald-700 transition-colors font-semibold"
        >
          Done
        </button>
      </div>
    );
  }

  // Render payment form
  const payableAmount = orderSummary?.total || amount;

  return (
    <div className="space-y-4">
      {/* Method selector */}
      <div className="flex flex-wrap gap-3">
        {paymentMethods.map((method) => {
          const isActive = selectedPayment === method.id;

          return (
            <button
              key={method.id}
              type="button"
              onClick={() => setSelectedPayment(method.id)}
              className={
                `flex-1 min-w-56 text-left rounded-2xl border p-3 transition-colors ` +
                (isActive
                  ? 'border-amber-300 bg-white'
                  : 'border-gray-200 bg-white hover:border-gray-300')
              }
            >
              <div className="flex items-start gap-3">
                <div
                  className={
                    `h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ` +
                    (isActive ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50')
                  }
                >
                  <span className={isActive ? 'text-amber-700' : 'text-gray-700'}>{method.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900 truncate">{method.name}</p>
                    {isActive && (
                      <span className="h-6 w-6 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center">
                        <FiCheck className="text-amber-700" size={14} />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-snug">{method.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Payment content */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Amount due</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(payableAmount)}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <FiLock className="text-gray-500" size={14} />
            Secure payment
          </div>
        </div>

        <div className="mt-4">
          {/* Credit Card Form */}
          {selectedPayment === 'credit_card' && (
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                <input
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  value={cardData.cardNumber}
                  onChange={(e) => setCardData({ ...cardData, cardNumber: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Card Holder Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={cardData.cardHolder}
                  onChange={(e) => setCardData({ ...cardData, cardHolder: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                  <input
                    type="number"
                    placeholder="MM"
                    min="1"
                    max="12"
                    value={cardData.expiryMonth}
                    onChange={(e) => setCardData({ ...cardData, expiryMonth: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                  <input
                    type="number"
                    placeholder="YY"
                    min="24"
                    max="99"
                    value={cardData.expiryYear}
                    onChange={(e) => setCardData({ ...cardData, expiryYear: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                  <input
                    type="text"
                    placeholder="123"
                    value={cardData.cvv}
                    onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-amber-600 text-white py-2.5 rounded-xl hover:bg-amber-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing…' : `Pay ${formatCurrency(payableAmount)}`}
              </button>

              <p className="text-xs text-gray-500">
                Demo card form — use PayPal or Stripe for real payments.
              </p>
            </form>
          )}

          {/* PayPal Payment */}
          {selectedPayment === 'paypal' && orderId && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                You’ll be able to pay securely using your PayPal account.
              </p>
              <PayPalButton amount={payableAmount} orderId={orderId} onSuccess={handleSuccess} onError={handleError} />
            </div>
          )}

          {selectedPayment === 'paypal' && !orderId && (
            <button
              onClick={handlePaymentSubmit}
              disabled={isProcessing}
              className="w-full bg-amber-600 text-white py-2.5 rounded-xl hover:bg-amber-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing…' : 'Continue with PayPal'}
            </button>
          )}

          {/* Stripe Payment */}
          {selectedPayment === 'stripe' && orderId && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                You’ll be redirected to Stripe Checkout to complete payment.
              </p>
              <StripeButton amount={payableAmount} orderId={orderId} onSuccess={handleSuccess} onError={handleError} />
            </div>
          )}

          {selectedPayment === 'stripe' && !orderId && (
            <button
              onClick={handlePaymentSubmit}
              disabled={isProcessing}
              className="w-full bg-amber-600 text-white py-2.5 rounded-xl hover:bg-amber-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing…' : 'Continue with Stripe'}
            </button>
          )}
        </div>

        {/* Payment Status */}
        {paymentStatus !== 'pending' && paymentStatus !== 'completed' && (
          <div className={`mt-4 p-4 rounded-xl border ${getStatusColor(paymentStatus)}`}>
            <div className="flex items-start gap-2">
              <FiAlertCircle size={16} className="mt-0.5" />
              <p className="text-sm font-semibold">
                {paymentStatus === 'failed'
                  ? 'Payment failed. Please try again.'
                  : 'Processing your payment…'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payment;