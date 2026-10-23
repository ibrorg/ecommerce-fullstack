import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import api from '../services/api';

interface FormData {
  storeName: string;
  businessType: string;
  description: string;
  gstNumber: string;
  pan: string;
  businessAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  bankAccountNumber: string;
  ifscCode: string;
  bankName: string;
}

const SellerRegistration: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/seller/register');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  const [formData, setFormData] = useState<FormData>({
    storeName: '',
    businessType: 'individual',
    description: '',
    gstNumber: '',
    pan: '',
    businessAddress: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    bankAccountNumber: '',
    ifscCode: '',
    bankName: '',
  });

  const steps = [
    { number: 1, title: 'Store Info', icon: '🏪' },
    { number: 2, title: 'GST Details', icon: '📋' },
    { number: 3, title: 'Bank Info', icon: '💳' },
    { number: 4, title: 'Review', icon: '✓' },
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.storeName.trim()) {
          setError('Store name is required');
          return false;
        }
        if (!formData.description.trim()) {
          setError('Store description is required');
          return false;
        }
        return true;
      case 2:
        if (!formData.gstNumber.trim()) {
          setError('GST number is required');
          return false;
        }
        if (!formData.pan.trim()) {
          setError('PAN is required');
          return false;
        }
        if (!formData.businessAddress.trim() || !formData.city.trim() || !formData.state.trim()) {
          setError('Complete address is required');
          return false;
        }
        return true;
      case 3:
        if (!formData.phone.trim()) {
          setError('Phone number is required');
          return false;
        }
        if (!formData.bankAccountNumber.trim()) {
          setError('Bank account number is required');
          return false;
        }
        if (!formData.ifscCode.trim()) {
          setError('IFSC code is required');
          return false;
        }
        if (!formData.bankName.trim()) {
          setError('Bank name is required');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    setError(null);
    if (validateStep()) {
      if (currentStep < 4) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!validateStep()) return;

    setLoading(true);
    try {
      const response = await api.post('/api/seller/register', formData);

      if (response.data?.success === false) {
        throw new Error(response.data?.message || 'Failed to register as seller');
      }

      navigate('/seller');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 sm:py-12 lg:py-16">
      <div className="container px-2 sm:px-4 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 sm:mb-3">
            Become a Seller
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Welcome, {user?.name}! Complete your seller registration with Indian GST details
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* Steps Indicator */}
          <div className="mb-8 sm:mb-12">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <React.Fragment key={step.number}>
                  <div
                    className={`flex flex-col items-center transition-all duration-300 ${
                      currentStep >= step.number ? 'opacity-100' : 'opacity-50'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all duration-300 ${
                        currentStep === step.number
                          ? 'bg-black text-white scale-110 shadow-lg'
                          : currentStep > step.number
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {currentStep > step.number ? '✓' : step.icon}
                    </div>
                    <p className="text-xs sm:text-sm font-semibold mt-2 text-gray-900 text-center">
                      {step.title}
                    </p>
                  </div>

                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 sm:h-1.5 mx-2 sm:mx-4 transition-all duration-300 ${
                        currentStep > step.number ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Form Content */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-6 sm:p-8 lg:p-10">
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm sm:text-base font-medium">⚠️ {error}</p>
              </div>
            )}

            {/* Step 1: Store Info */}
            {currentStep === 1 && (
              <div className="space-y-4 sm:space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
                    Tell us about your store
                  </h2>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Store Name *
                  </label>
                  <input
                    type="text"
                    name="storeName"
                    value={formData.storeName}
                    onChange={handleInputChange}
                    placeholder="Your unique store name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Business Type *
                  </label>
                  <select
                    name="businessType"
                    value={formData.businessType}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                  >
                    <option value="individual">Individual (Sole Proprietor)</option>
                    <option value="partnership">Partnership</option>
                    <option value="company">Private Limited Company</option>
                    <option value="llp">LLP (Limited Liability Partnership)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Store Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Tell customers about your store, products, and services..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 2: GST Details */}
            {currentStep === 2 && (
              <div className="space-y-4 sm:space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
                    GST & Tax Information
                  </h2>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-700">
                    📋 We require valid GST registration for Indian sellers. This helps us comply with tax regulations.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    GST Registration Number (GSTIN) *
                  </label>
                  <input
                    type="text"
                    name="gstNumber"
                    value={formData.gstNumber}
                    onChange={handleInputChange}
                    placeholder="27AAPCT1234H1Z5"
                    maxLength={15}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition font-mono"
                  />
                  <p className="text-xs text-gray-600 mt-1">Format: 2 digits + state code + 10 alphanumeric characters</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    PAN (Permanent Account Number) *
                  </label>
                  <input
                    type="text"
                    name="pan"
                    value={formData.pan}
                    onChange={handleInputChange}
                    placeholder="AAAAA0000A"
                    maxLength={10}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition font-mono"
                  />
                  <p className="text-xs text-gray-600 mt-1">Format: 5 letters + 4 digits + 1 letter</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Business Address *
                  </label>
                  <textarea
                    name="businessAddress"
                    value={formData.businessAddress}
                    onChange={handleInputChange}
                    placeholder="Complete business address"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="Mumbai"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      State *
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="Maharashtra"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    PIN Code
                  </label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleInputChange}
                    placeholder="400001"
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Bank Info */}
            {currentStep === 3 && (
              <div className="space-y-4 sm:space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
                    Bank Account Details
                  </h2>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-700">
                    🔒 Your bank details are securely encrypted and used only for seller payouts.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleInputChange}
                    placeholder="State Bank of India (SBI)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Account Number *
                  </label>
                  <input
                    type="text"
                    name="bankAccountNumber"
                    value={formData.bankAccountNumber}
                    onChange={handleInputChange}
                    placeholder="••••••••••••1234"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    IFSC Code *
                  </label>
                  <input
                    type="text"
                    name="ifscCode"
                    value={formData.ifscCode}
                    onChange={handleInputChange}
                    placeholder="SBIN0001234"
                    maxLength={11}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none transition font-mono"
                  />
                  <p className="text-xs text-gray-600 mt-1">Indian Financial System Code</p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-xs sm:text-sm text-gray-600">
                    ℹ️ Please ensure the account is in the name of the business or authorized representative.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
                    Review Your Information
                  </h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Store Information</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">STORE NAME</p>
                        <p className="text-gray-900 font-medium">{formData.storeName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">BUSINESS TYPE</p>
                        <p className="text-gray-900 font-medium capitalize">{formData.businessType}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">DESCRIPTION</p>
                        <p className="text-gray-900">{formData.description}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">GST & Tax Details</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">GSTIN</p>
                        <p className="text-gray-900 font-mono">{formData.gstNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">PAN</p>
                        <p className="text-gray-900 font-mono">{formData.pan}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">LOCATION</p>
                        <p className="text-gray-900">{formData.city}, {formData.state} {formData.zipCode}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-700">
                      ✓ All information looks good. Click submit to complete your seller registration.
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-xs sm:text-sm text-gray-600">
                      By submitting, you agree to our Seller Agreement and comply with GST and Income Tax regulations.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4 mt-8 sm:mt-10">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="flex-1 px-6 py-3 border-2 border-gray-900 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              {currentStep < 4 ? (
                <button
                  onClick={handleNext}
                  className="flex-1 px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating Store...' : '✓ Complete Registration'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default SellerRegistration;
