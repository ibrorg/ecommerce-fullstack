import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { addToCart } from '../store/slices/cartSlice';
import Reviews from './Reviews';
import WishlistButton from './WishlistButton';
import CompareButton from './CompareButton';
import BackInStockButton from './BackInStockButton';
import ProductBadges from './ProductBadges';
import ImageZoom from './ImageZoom';
import Breadcrumbs from './Breadcrumbs';
import ProductDetailSkeleton from './ProductDetailSkeleton';
import RecentlyViewed from './RecentlyViewed';
import RelatedProducts from './RelatedProducts';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useCurrency } from '../context/CurrencyContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { FiShoppingBag, FiCheck, FiTruck, FiArrowRight, FiShoppingCart } from 'react-icons/fi';

// Product response from MongoDB API (uses _id)
interface ProductApiResponse {
  _id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  countInStock: number;
  rating: number;
  numReviews: number;
  sku: string;
  slug: string;
  badges?: string[];
  reviews: Array<{
    _id?: string;
    id?: string;
    user: string | { name: string };
    name?: string;
    rating: number;
    comment: string;
    createdAt: string;
    photos?: string[];
    helpfulVotes?: number;
    isVerifiedPurchase?: boolean;
    sellerReply?: {
      comment: string;
      repliedAt: string;
      repliedBy: string | { name?: string };
    } | null;
  }>;
}

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { trackView } = useRecentlyViewed();
  const { formatPrice } = useCurrency();
  const [product, setProduct] = useState<ProductApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // SEO: per-product meta + Schema.org Product JSON-LD structured data
  useDocumentMeta({
    title: product ? product.name : 'Product Details',
    description: product ? product.description?.substring(0, 160) : 'View product details, reviews, and specifications.',
    ogType: 'product',
    ogImage: product?.images?.[0],
  });

  // inject + clean up Schema.org Product JSON-LD when product changes
  useEffect(() => {
    if (!product) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'product-jsonld';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      image: product.images,
      sku: product.sku,
      brand: product.badges?.includes('Bestseller') ? { '@type': 'Brand', name: product.category || 'Store' } : undefined,
      offers: {
        '@type': 'Offer',
        price: product.price,
        priceCurrency: 'USD',
        availability: product.countInStock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      },
      aggregateRating: product.numReviews > 0 ? {
        '@type': 'AggregateRating',
        ratingValue: product.rating,
        reviewCount: product.numReviews,
      } : undefined,
    });
    document.head.appendChild(script);
    return () => { document.getElementById('product-jsonld')?.remove(); };
  }, [product]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await api.getProduct(id!);
      // API returns { success, data } where data is the product
      const productData = response.data.data;
      if (productData && typeof productData === 'object' && '_id' in productData) {
        setProduct(productData as ProductApiResponse);
        // record this view for the recently-viewed widget
        trackView((productData as any)._id);
      }
      setError(null);
    } catch (err) {
      setError('Failed to fetch product');
      console.error('Error fetching product:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;

    dispatch(addToCart({
      id: product._id,
      name: product.name,
      price: product.price,
      image: product.images[0] || 'https://picsum.photos/400',
      quantity: quantity,
      countInStock: product.countInStock
    }));

    // rich toast with a view-cart action
    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <FiCheck className="text-white" size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm">
              Added {quantity} to bag
            </p>
            <p className="text-xs text-neutral-300 truncate">{product.name}</p>
          </div>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              window.location.href = '/cart';
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-neutral-900 text-xs font-semibold hover:bg-neutral-100 transition-colors flex-shrink-0"
          >
            <FiShoppingCart size={12} />
            View
          </button>
        </div>
      ),
      { duration: 3500 }
    );
  };

  if (loading) {
    return <ProductDetailSkeleton />;
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-7xl mb-6">📦</div>
          <h2 className="text-4xl font-bold text-gray-900 dark:text-neutral-100 mb-4">Product not found</h2>
          <p className="text-lg text-gray-600 dark:text-neutral-400 mb-8">{error || 'The product you are looking for does not exist.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gray-50 rounded-full -mr-48 -mt-48 pointer-events-none" />
      
      <div className="container px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 relative">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: 'Products', href: '/products' },
            ...(product.category ? [{ label: product.category, href: `/products?category=${encodeURIComponent(product.category)}` }] : []),
            { label: product.name },
          ]}
          className="mb-6"
        />
        <div className="grid grid-cols-1 gap-8 sm:gap-10 lg:gap-16 lg:grid-cols-2">
          {/* Image Gallery */}
          <div className="space-y-4 sm:space-y-6">
            {/* Main Image with hover-zoom + lightbox */}
            <div className="relative rounded-2xl bg-gray-100 aspect-square shadow-xl">
              <ImageZoom
                src={product.images[selectedImage] || 'https://picsum.photos/600'}
                alt={product.name}
                images={product.images}
                currentIndex={selectedImage}
                onIndexChange={setSelectedImage}
                className="absolute inset-0 rounded-2xl"
              />
              {/* Category & SKU Badges */}
              <div className="absolute bottom-4 left-4 flex gap-3 flex-wrap z-10 pointer-events-none">
                <span className="px-4 py-2 rounded-full bg-white text-gray-900 font-semibold text-sm shadow-lg backdrop-blur-sm">
                  {product.category}
                </span>
                <span className="px-4 py-2 rounded-full bg-black text-white font-semibold text-sm shadow-lg">
                  SKU {product.sku}
                </span>
              </div>
              
              {/* Stock Badge */}
              <div className="absolute top-4 right-4 z-10 pointer-events-none">
                {product.countInStock > 0 ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/90 text-white font-semibold text-sm backdrop-blur-sm shadow-lg">
                    <FiCheck size={18} />
                    In Stock
                  </div>
                ) : (
                  <div className="px-4 py-2 rounded-full bg-red-500/90 text-white font-semibold text-sm backdrop-blur-sm shadow-lg">
                    Out of Stock
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Gallery */}
            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 h-24 w-24 rounded-xl overflow-hidden border-2 transition-all duration-200 hover:scale-105 ${
                      selectedImage === index 
                        ? 'border-black shadow-lg scale-105 ring-2 ring-black ring-offset-2' 
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-8">
            {/* Header */}
            <div>
              <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-black"></span>
                {product.category}
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-4">
                {product.name}
              </h1>
              <ProductBadges badges={product.badges} variant="inline" className="mb-4" />
              <p className="text-lg text-gray-600 leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={`text-2xl ${i < Math.floor(product.rating) ? 'text-yellow-400' : 'text-gray-300'}`}>
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-lg font-bold text-gray-900">{product.rating.toFixed(1)}</span>
                <span className="text-sm text-gray-600 font-medium">({product.numReviews} reviews)</span>
              </div>
            </div>

            {/* Price Section */}
            <div className="space-y-4 p-8 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-800 border border-gray-200 dark:border-neutral-800">
              <div className="flex items-baseline gap-4 flex-wrap">
                <span className="text-5xl sm:text-6xl font-bold text-gray-900">
                  {formatPrice(product.price)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-base text-green-600 font-semibold">
                <FiCheck size={20} />
                Free shipping on orders over $50
              </div>
            </div>

            {/* Add to Cart Section */}
            {product.countInStock > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label htmlFor="quantity" className="text-base font-semibold text-gray-900 whitespace-nowrap">
                    Quantity:
                  </label>
                  <select
                    id="quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                    className="px-4 py-3 text-base font-semibold border-2 border-gray-300 rounded-xl focus:border-black focus:outline-none transition-colors bg-white"
                  >
                    {[...Array(Math.min(product.countInStock, 10))].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleAddToCart}
                  className="w-full py-4 px-6 text-lg font-semibold rounded-xl bg-black text-white hover:bg-gray-900 active:scale-95 transition-all duration-200 flex items-center justify-center gap-3 group shadow-lg hover:shadow-xl"
                >
                  <FiShoppingBag size={22} />
                  Add to Bag
                  <FiArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                </button>
              </div>
            )}

            {/* Wishlist toggle — always available, even when out of stock */}
            <WishlistButton
              productId={product._id}
              variant="button"
              className="w-full"
            />

            {/* Back-in-stock notification — only for out-of-stock products */}
            {product.countInStock === 0 && (
              <BackInStockButton
                productId={product._id}
                productName={product.name}
                className="w-full"
              />
            )}

            {/* Compare toggle */}
            <CompareButton
              productId={product._id}
              name={product.name}
              price={product.price}
              image={product.images?.[0] || ''}
              variant="pill"
            />

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div className="flex items-start gap-3">
                <FiTruck className="text-gray-900 flex-shrink-0 mt-1" size={24} />
                <div>
                  <p className="font-semibold text-gray-900">Fast Shipping</p>
                  <p className="text-sm text-gray-600">2-3 business days</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FiCheck className="text-gray-900 flex-shrink-0 mt-1" size={24} />
                <div>
                  <p className="font-semibold text-gray-900">Quality Guaranteed</p>
                  <p className="text-sm text-gray-600">30-day returns</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-20 pt-16 border-t border-gray-200">
          <Reviews
            productId={product._id}
            reviews={product.reviews}
            onReviewAdded={fetchProduct}
          />
        </div>
      </div>

      {/* Related products — same category cross-sell */}
      <RelatedProducts productId={product._id} category={product.category} />

      {/* Recently viewed — excludes the current product */}
      <RecentlyViewed excludeId={product._id} limit={6} />
    </div>
  );
};

export default ProductDetail;
