import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { addToCart } from '../store/slices/cartSlice';
import api from '../services/api';
import RecentlyViewed from '../components/RecentlyViewed';
import ErrorState from '../components/ErrorState';
import Reveal from '../components/Reveal';
import { useCurrency } from '../context/CurrencyContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  FiArrowRight,
  FiShoppingBag,
  FiStar,
  FiCheck,
  FiAward,
  FiTruck,
  FiRefreshCcw,
  FiShield,
  FiMail,
  FiSend,
  FiTrendingUp,
  FiUsers,
  FiPackage,
} from 'react-icons/fi';

// Import local hero image
import homepageItemImage from '../assets/homepageitem.png';

// Default fallback image for products without images
const FALLBACK_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';

// Hero product showcase image - using local asset
const HERO_IMAGE = homepageItemImage;

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  rating: number;
  numReviews: number;
  category: string;
  countInStock?: number;
}

const Home: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  useDocumentMeta({
    title: 'E-Shop — Quality Products, Fast Delivery, Easy Returns',
    description: 'Shop quality electronics, fashion, and home goods. Compare products, read reviews, and checkout with Stripe, Razorpay, or COD. Free shipping on orders over $100.',
  });
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);

  const fetchFeaturedProducts = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const response = await api.getProducts(1, 8);
      setFeaturedProducts(response.data.data?.slice(0, 8) || []);
    } catch (error) {
      console.error('Failed to fetch featured products', error);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  // Preload hero image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setHeroImageLoaded(true);
    img.src = HERO_IMAGE;
  }, []);

  const handleAddToCart = (product: Product) => {
    dispatch(
      addToCart({
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.images?.[0] || FALLBACK_PRODUCT_IMAGE,
        quantity: 1,
        countInStock: product.countInStock || 10,
      })
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Clean Split Layout */}
      <section className="relative overflow-hidden bg-gray-50">
        {/* Decorative background elements - matching Login/Register style */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gray-100 rounded-full -mr-48 -mt-48 pointer-events-none animate-float" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-gray-100 rounded-full -ml-36 -mb-36 pointer-events-none animate-float" style={{ animationDelay: '2s' }} />
        
        <div className="container relative">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 min-h-[520px] lg:min-h-[620px] items-center">
            {/* Left Content */}
            <div className="py-10 sm:py-12 lg:py-20 lg:pr-8">
              {/* Brand Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm mb-8 reveal-up reveal-visible">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-black to-gray-800 flex items-center justify-center text-white text-xs font-bold">
                  E
                </div>
                <span className="text-sm font-medium text-gray-700">Designed for everyday essentials</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-6 reveal-up reveal-visible" style={{ transitionDelay: '80ms' }}>
                {isAuthenticated ? (
                  <>Welcome back,<br /><span className="text-gray-600">{user?.name?.split(' ')[0]}.</span></>
                ) : (
                  <>Discover<br /><span className="text-gray-600">Quality Essentials.</span></>
                )}
              </h1>

              {/* Subtitle */}
              <p className="text-lg text-gray-500 mb-8 sm:mb-10 max-w-xl leading-relaxed reveal-up reveal-visible" style={{ transitionDelay: '160ms' }}>
                Curated products with exceptional quality, simplicity, and outstanding service. Shop with confidence.
              </p>

              {/* CTAs - Matching Login/Register button style */}
              <div className="flex flex-wrap gap-4 reveal-up reveal-visible" style={{ transitionDelay: '240ms' }}>
                <Link 
                  to="/products" 
                  className="inline-flex items-center justify-center gap-3 bg-black text-white text-base font-semibold rounded-xl hover:bg-gray-900 active:scale-95 transition-all duration-200 py-4 px-8 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                >
                  Explore Collections
                  <FiArrowRight className="w-5 h-5" />
                </Link>
                {!isAuthenticated && (
                  <Link 
                    to="/register" 
                    className="inline-flex items-center justify-center bg-white text-gray-900 text-base font-semibold rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 py-4 px-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                  >
                    Create Account
                  </Link>
                )}
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center gap-3 mt-10 pt-8 border-t border-gray-200 reveal-up reveal-visible" style={{ transitionDelay: '320ms' }}>
                {['Free Shipping', '30-Day Returns', 'Secure Payment'].map((label) => (
                  <div
                    key={label}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm"
                  >
                    <FiCheck className="w-4 h-4 text-gray-900" />
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Image - Hero Product Showcase */}
            <div className="relative hidden lg:flex items-center justify-center">
              <div className="relative w-full h-[500px] rounded-3xl overflow-hidden shadow-2xl bg-gray-200">
                {/* Loading skeleton */}
                {!heroImageLoaded && (
                  <div className="absolute inset-0 bg-gray-200 animate-pulse" />
                )}
                {/* Hero image */}
                <img
                  src={HERO_IMAGE}
                  alt="Featured products showcase"
                  className={`w-full h-full object-cover transition-opacity duration-500 ${heroImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setHeroImageLoaded(true)}
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
            </div>

            {/* Mobile hero image (container-based, avoids huge whitespace) */}
            <div className="lg:hidden pb-10 sm:pb-12">
              <div className="relative w-full aspect-[16/10] rounded-3xl overflow-hidden border border-gray-200 shadow-lg bg-gray-200">
                {!heroImageLoaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
                <img
                  src={HERO_IMAGE}
                  alt="Featured products showcase"
                  className={`w-full h-full object-cover transition-opacity duration-500 ${heroImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setHeroImageLoaded(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="container">
          {/* Section Header */}
          <Reveal direction="up" className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">FEATURED COLLECTION</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Trending Products</h2>
            <p className="text-gray-500 max-w-md mx-auto">Discover our most popular items, handpicked for quality and style.</p>
          </Reveal>

          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? (
              // Skeleton loading state
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                  <div className="aspect-square bg-gray-100 animate-pulse" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
                    <div className="h-6 bg-gray-100 rounded animate-pulse w-1/3" />
                  </div>
                </div>
              ))
            ) : featuredProducts.length > 0 ? (
              featuredProducts.map((product, idx) => (
                <Reveal key={product._id} direction="up" delay={idx * 60}>
                  <ProductCard 
                    product={product} 
                    onAddToCart={() => handleAddToCart(product)}
                  />
                </Reveal>
              ))
            ) : fetchError ? (
              // Network/server error — show retry, not the misleading "no products"
              <div className="col-span-full">
                <ErrorState
                  title="Couldn’t load products"
                  message="There was a problem reaching the server. Please try again."
                  onRetry={fetchFeaturedProducts}
                />
              </div>
            ) : (
              // Empty state — server reached, just no products
              <div className="col-span-full text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-neutral-800 rounded-full mb-6">
                  <FiShoppingBag className="w-7 h-7 text-gray-400 dark:text-neutral-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-neutral-100 mb-2">No products yet</h3>
                <p className="text-gray-500 dark:text-neutral-400 mb-6">Check back soon for new arrivals.</p>
                <Link 
                  to="/products" 
                  className="inline-flex items-center gap-2 text-black dark:text-neutral-100 font-semibold hover:underline"
                >
                  Browse all products
                  <FiArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>

          {/* View All Button */}
          {featuredProducts.length > 0 && (
            <div className="text-center mt-12">
              <Link 
                to="/products" 
                className="inline-flex items-center justify-center gap-2 bg-black text-white text-base font-semibold rounded-xl hover:bg-gray-900 active:scale-95 transition-all duration-200 py-4 px-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
              >
                View All Products
                <FiArrowRight className="w-5 h-5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Recently Viewed — only renders when the visitor has browsing history */}
      <RecentlyViewed />

      {/* Features Section */}
      <section className="py-16 lg:py-20 bg-gray-50 border-t border-gray-100">
        <div className="container">
          {/* Section header */}
          <Reveal direction="up" className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">WHY E-SHOP</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">A better shopping experience</h2>
            <p className="text-gray-500 max-w-2xl mx-auto mt-3">
              Premium quality products, fast delivery, and easy returns — designed to make your checkout stress‑free.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                title: 'Premium Quality',
                description: 'Carefully selected for exceptional quality and durability.',
                icon: <FiAward size={20} />,
                accent: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
              },
              {
                title: 'Fast Delivery',
                description: 'Free shipping on orders over $50. Quick and reliable.',
                icon: <FiTruck size={20} />,
                accent: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
              },
              {
                title: 'Easy Returns',
                description: '30-day hassle-free returns. Shop with confidence.',
                icon: <FiRefreshCcw size={20} />,
                accent: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
              },
              {
                title: 'Secure Payment',
                description: 'Encrypted checkout with Stripe and Razorpay.',
                icon: <FiShield size={20} />,
                accent: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
              },
            ].map((feature, idx) => (
              <Reveal key={feature.title} direction="up" delay={idx * 80}>
                <div
                  className="group bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300 hover:-translate-y-1 transition-all duration-200 h-full"
                >
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 mb-4 group-hover:scale-110 transition-transform duration-200 ${feature.accent}`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-1.5">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-neutral-900 dark:bg-black py-12">
        <div className="container">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {[
              { value: '10K+', label: 'Happy Customers', icon: <FiUsers size={20} /> },
              { value: '500+', label: 'Products', icon: <FiPackage size={20} /> },
              { value: '4.8★', label: 'Average Rating', icon: <FiStar size={20} /> },
              { value: '99%', label: 'On-time Delivery', icon: <FiTrendingUp size={20} /> },
            ].map((stat, idx) => (
              <Reveal key={stat.label} direction="scale" delay={idx * 100}>
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform">
                    {stat.icon}
                  </div>
                  <span className="text-3xl sm:text-4xl font-bold text-white">{stat.value}</span>
                  <span className="text-sm text-neutral-400 mt-1">{stat.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <NewsletterSection />
    </div>
  );
};

// Newsletter signup section with inline success state (no backend needed —
// this is a presentational CTA that captures intent locally).
const NewsletterSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setSubmitted(true);
    setEmail('');
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <section className="py-16 lg:py-24 bg-white dark:bg-neutral-950">
      <div className="container">
        <Reveal direction="scale">
          <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-800 dark:from-neutral-900 dark:to-black animate-gradient p-8 sm:p-12 lg:p-16">
            {/* decorative blobs */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 pointer-events-none animate-float" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24 pointer-events-none animate-float" style={{ animationDelay: '3s' }} />

          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-semibold mb-4">
                <FiMail size={12} />
                Newsletter
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
                Get 10% off your first order
              </h2>
              <p className="text-neutral-300 text-sm sm:text-base max-w-md">
                Subscribe for new arrivals, exclusive deals, and early access to sales. No spam, unsubscribe anytime.
              </p>
            </div>

            <div className="w-full lg:w-auto lg:min-w-[360px]">
              {submitted ? (
                <div className="flex items-center gap-3 p-5 rounded-2xl bg-green-500/20 border border-green-400/30">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <FiCheck className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-white">You're subscribed!</p>
                    <p className="text-sm text-green-100">Check your inbox for the 10% off code.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-neutral-400 focus:outline-none focus:bg-white/15 focus:border-white/40 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-neutral-900 font-bold text-sm hover:bg-neutral-100 active:scale-95 transition-all whitespace-nowrap"
                  >
                    Subscribe
                    <FiSend size={16} />
                  </button>
                </form>
              )}
              <p className="text-xs text-neutral-400 mt-3 text-center sm:text-left">
                By subscribing you agree to our Privacy Policy.
              </p>
            </div>
          </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

// Product Card Component with proper styling matching Login/Register
const ProductCard: React.FC<{ product: Product; onAddToCart: () => void }> = ({ product, onAddToCart }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const { formatPrice } = useCurrency();
  
  const imageSrc = imageError 
    ? FALLBACK_PRODUCT_IMAGE 
    : (product.images?.[0] || FALLBACK_PRODUCT_IMAGE);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCart();
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300 hover:-translate-y-1 transition-all duration-300 h-full">
      <Link
        to={`/products/${product._id}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
      >
        <div className="aspect-square bg-gray-50 overflow-hidden relative">
          {/* Loading skeleton */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gray-100 animate-pulse" />
          )}
          {/* Product image with lazy loading */}
          <img
            src={imageSrc}
            alt={product.name}
            loading="lazy"
            className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              setImageLoaded(true);
            }}
          />
          
          {/* Category badge */}
          <div className="absolute top-3 left-3 transition-transform duration-300 group-hover:-translate-y-0.5">
            <span className="inline-flex px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-gray-700 shadow-sm">
              {product.category}
            </span>
          </div>
        </div>
      </Link>

      {/* Product Info */}
      <div className="p-5">
        <Link
          to={`/products/${product._id}`}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 rounded-lg"
        >
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-gray-600 transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="flex items-center">
            <FiStar className="w-4 h-4 text-gray-900 fill-gray-900" />
            <span className="text-sm font-medium text-gray-700 ml-1">{product.rating.toFixed(1)}</span>
          </div>
          <span className="text-xs text-gray-400">({product.numReviews} reviews)</span>
        </div>

        {/* Price and Add to Cart */}
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900">
            {formatPrice(product.price)}
          </span>
          <button
            onClick={handleAddToCart}
            className={`inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl transition-all duration-200 py-2.5 px-4 ${
              addedToCart 
                ? 'bg-gray-700 text-white' 
                : 'bg-black text-white hover:bg-gray-900 active:scale-95'
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2`}
          >
            {addedToCart ? (
              <>
                <FiCheck className="w-4 h-4" />
                Added
              </>
            ) : (
              <>
                <FiShoppingBag className="w-4 h-4" />
                Add
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;

