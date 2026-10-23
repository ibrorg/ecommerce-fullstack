import React, { useState } from 'react';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api';
import { FiLock, FiEye, FiEyeOff, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import type { AxiosError } from 'axios';

interface ApiErrorResponse {
  message?: string;
  error?: { message?: string };
}

const MIN_PASSWORD_LENGTH = 6;

const ResetPassword: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  useDocumentMeta({ title: 'Reset Password', description: 'Set a new password for your account.' });

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { password, confirmPassword } = formData;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    if (validationErrors.length > 0) setValidationErrors([]);
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!password) {
      errors.push('Password is required');
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    if (!confirmPassword) {
      errors.push('Please confirm your password');
    } else if (password !== confirmPassword) {
      errors.push('Passwords do not match');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!token) {
      setError('Reset token is missing. Please request a new reset link.');
      return;
    }

    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    try {
      await api.post(`/api/auth/reset-password/${token}`, { password });
      setSuccess(true);
    } catch (err) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      const message =
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error?.message ||
        'Unable to reset password. The link may be invalid or expired.';
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
              Set a new password
            </h1>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              {success
                ? 'Your password has been updated.'
                : 'Choose a strong password you haven\u2019t used before.'}
            </p>
          </div>

          {/* Success Alert */}
          {success && (
            <div className="mb-8 p-4 sm:p-5 rounded-xl border border-green-200 bg-green-50 animate-slide-down">
              <div className="flex gap-3">
                <FiCheckCircle className="text-green-600 flex-shrink-0" size={24} />
                <div>
                  <p className="text-sm sm:text-base text-green-700 font-medium">
                    Password reset successful. Please log in.
                  </p>
                  <Link
                    to="/login"
                    className="inline-block mt-3 text-sm font-semibold text-green-700 hover:text-green-800 underline-offset-4 hover:underline"
                  >
                    Go to sign in
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
                <div>
                  <p className="text-sm sm:text-base text-red-700 font-medium">{error}</p>
                  <Link
                    to="/forgot-password"
                    className="inline-block mt-2 text-sm font-semibold text-red-700 hover:text-red-800 underline-offset-4 hover:underline"
                  >
                    Request a new reset link
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mb-8 p-4 sm:p-5 rounded-xl border border-red-200 bg-red-50 animate-slide-down">
              <ul className="space-y-2">
                {validationErrors.map((err, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-red-600 text-lg flex-shrink-0 mt-0.5">×</span>
                    <span className="text-sm text-red-700 font-medium">{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Form - hidden after success */}
          {!success && (
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7" noValidate>
              {/* New Password Field */}
              <div className="group">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-900 mb-3"
                >
                  New password
                </label>
                <div
                  className={`relative transition-all duration-200 ${
                    focusedField === 'password' ? 'scale-[1.02]' : ''
                  }`}
                >
                  <FiLock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-gray-600 transition-colors duration-200 pointer-events-none"
                    size={20}
                  />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3 sm:py-4 text-base border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none transition-all duration-200 bg-white hover:border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors duration-200 flex-shrink-0"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="group">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-semibold text-gray-900 mb-3"
                >
                  Confirm password
                </label>
                <div
                  className={`relative transition-all duration-200 ${
                    focusedField === 'confirmPassword' ? 'scale-[1.02]' : ''
                  }`}
                >
                  <FiLock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-gray-600 transition-colors duration-200 pointer-events-none"
                    size={20}
                  />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3 sm:py-4 text-base border-2 border-gray-200 rounded-xl focus:border-black focus:outline-none transition-all duration-200 bg-white hover:border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors duration-200 flex-shrink-0"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-xl bg-black text-white hover:bg-gray-900 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 group mt-8"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    Reset Password
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
                Password requirements
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">
                Use at least {MIN_PASSWORD_LENGTH} characters. Make sure both entries match.
                For your security, this reset link expires shortly after being issued.
              </p>
              <div className="mt-4">
                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-gray-900 hover:text-black transition-colors duration-200 underline-offset-4 hover:underline"
                >
                  Didn't get a link? Resend
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
