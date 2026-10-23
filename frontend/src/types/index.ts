// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[] | Record<string, string>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Auth types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'user' | 'seller' | 'admin';
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data: User;
  token: string;
  sessionId: string;
  expiresIn: number;
}

// Product types
// Note: Both 'id' and '_id' are supported because MongoDB returns '_id' 
// while the frontend often normalizes to 'id'. Use the one available in your context.
export interface Review {
  id: string;
  _id?: string;  // MongoDB identifier
  user: User | string;
  name?: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  _id?: string;  // MongoDB identifier
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice?: number;
  images: string[];
  category: string;
  subcategory?: string;
  brand?: string;
  countInStock: number;
  isActive: boolean;
  isFeatured: boolean;
  sku: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  tags: string[];
  reviews: Review[];
  numReviews: number;
  rating: number;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
  updatedAt: string;
}

// Order types
export interface OrderItem {
  product: string | Product;
  name: string;
  quantity: number;
  price: number;
  image: string;
}

export interface ShippingAddress {
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface PaymentResult {
  id?: string;
  status?: string;
  update_time?: string;
  email_address?: string;
}

export interface Order {
  id: string;
  user: string | User;
  orderItems: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  paymentResult?: PaymentResult;
  taxPrice: number;
  shippingPrice: number;
  totalPrice: number;
  isPaid: boolean;
  paidAt?: string;
  isDelivered: boolean;
  deliveredAt?: string;
  orderStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Cart types
export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
