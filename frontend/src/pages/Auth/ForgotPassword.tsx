import React, { useState } from 'react';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { FiMail, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import type { AxiosError } from 'axios';

interface ApiErrorResponse {
  message?: string;
  error?: { message?: string };
}

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  useDocumentMeta({ title: 'Forgot Password', description: 'Reset your account password.' });
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.post('/api/auth/forgot-password', { email });
      // Backend always returns 200 to prevent email enumeration.
      setSuccess(true);
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const message =
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error?.message ||
        'Unable to send reset link. Please try again later.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gray-50 rounded-full -mr-48 -mt-48 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-gray-50 rounded-full -ml-36 -mb-36 pointer-events-none" />

      <div className="flex-1 container px-4 sm:px-6 lg:px-8 py-8 sm:py-16 lg:py-24 relative">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="mb-10 sm:mb-14 animate-fade-in">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-black to-gray-800 flex items-center justify-center text-white font-bold mb-6 text-lg shadow-lg">
              E
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 leading-tight">
              Reset your password
            </h1>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Remembered it?{' '}
              <Link
                to="/login"
                className="font-semibold text-gray-900 hover:text-black transition-colors duration-200 underline-offset-4 hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          </div>

          {/* Success Alert */}
          {success && (
            <div className="mb-8 p-4 sm:p-5 rounded-xl border border-green-200 bg-green-50 animate-slide-down">
              <div className="flex gap-3">
                <FiCheckCircle className="text-green-600 text-xl flex-shrink-0" size={24} />
                <div>
                  <p className="text-sm sm:text-base text-green-700 font-medium">
                    If that email exists, a reset link has been sent.
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    Please check your inbox for further instructions.
                  </p>
                  <Link
                    to="/login"
                    className="inline-block mt-3 text-sm font-semibold text-green-700 hover:text-green-800 underline-offset-4 hover:underline"
                  >
                    Back to sign in
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-8 p-4 sm:p-5 rounded-xl border border-red-200 bg-red-50 animate-slide-down">
              <div className="flex gap-3">
                <div className="text-red-600 text-xl flex-shrink-0">⚠</div>
                <p className="text-sm sm:text-base text-red-700 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Form - hidden after success */}
          {!success && (
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7" noValidate>
              {/* Email Field */}
              <div className="group">
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-gray-900 mb-3"
                >
                  Email address
                </label>
                <div
                  className={`relative transition-all duration-200 ${
                    focusedField === 'email' ? 'scale-[1.02]' : ''
                  }`}
                >
                  <FiMail
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-gray-600 transition-colors duration-200 pointer-events-none"
                    size={20}
                  />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="name@example.com"
                    className="w-full pl-12 pr-4 py-3 sm:py-4 text-base border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none transition-all duration-200 bg-white hover:border-gray-300"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="w-full py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-xl bg-black text-white hover:bg-gray-900 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 group mt-8"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Reset Link
                    <FiArrowRight
                      className="group-hover:translate-x-1 transition-transform duration-200"
                      size={20}
                    />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Helper Info */}
          {!success && (
            <div className="mt-10 sm:mt-12 p-5 sm:p-6 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors duration-200">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">
                How it works
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">
                Enter the email associated with your account and we'll send you a link
                to reset your password. The link expires after a short time for security.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
