import React, { useState, useEffect } from 'react';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { login } from '../../store/slices/authSlice';
import { FiEye, FiEyeOff, FiMail, FiLock, FiArrowRight } from 'react-icons/fi';

const Login: React.FC = () => {
  const navigate = useNavigate();
  useDocumentMeta({ title: 'Login', description: 'Sign in to your E-Shop account.' });
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { isLoading, error, isAuthenticated } = useAppSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { email, password } = formData;

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!email || !password) {
      console.warn('Email or password missing');
      return;
    }

    try {
      console.log('Attempting login with email:', email);
      const result = await dispatch(login({ email, password })).unwrap();
      console.log('Login successful:', result);
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login failed:', err);
      // Error is handled by the slice
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
              Welcome back
            </h1>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-gray-900 hover:text-black transition-colors duration-200 underline-offset-4 hover:underline">
                Create one
              </Link>
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-8 p-4 sm:p-5 rounded-xl border border-red-200 bg-red-50 animate-slide-down">
              <div className="flex gap-3">
                <div className="text-red-600 text-xl flex-shrink-0">⚠</div>
                <p className="text-sm sm:text-base text-red-700 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7" noValidate>
            {/* Email Field */}
            <div className="group">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-3">
                Email address
              </label>
              <div className={`relative transition-all duration-200 ${focusedField === 'email' ? 'scale-[1.02]' : ''}`}>
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-gray-600 transition-colors duration-200 pointer-events-none" size={20} />
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

            {/* Password Field */}
            <div className="group">
              <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-3">
                Password
              </label>
              <div className={`relative transition-all duration-200 ${focusedField === 'password' ? 'scale-[1.02]' : ''}`}>
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-gray-600 transition-colors duration-200 pointer-events-none" size={20} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
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
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right -mt-2">
              <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-xl bg-black text-white hover:bg-gray-900 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 group mt-8"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <FiArrowRight className="group-hover:translate-x-1 transition-transform duration-200" size={20} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;