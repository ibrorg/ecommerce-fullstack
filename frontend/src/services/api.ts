import axios from 'axios';
import type { AxiosInstance, AxiosError, AxiosResponse, InternalAxiosRequestConfig, AxiosRequestConfig } from 'axios';
import type { AuthResponse, Product, Order, ApiResponse } from '../types';

class ApiClient {
  private client: AxiosInstance;
  private baseURL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? 'http://localhost:5000' : '');
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (token: string | null) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor() {
    if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
      // eslint-disable-next-line no-console
      console.warn(
        'VITE_API_URL is not set. In production you must set it to your backend base URL (e.g. https://your-backend.com).'
      );
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle errors with token refresh support
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        
        // Check if this is a 401 error and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          // Don't retry for login/register endpoints
          if (originalRequest.url?.includes('/auth/login') || 
              originalRequest.url?.includes('/auth/register')) {
            return Promise.reject(error);
          }

          if (this.isRefreshing) {
            // Queue this request to retry after token refresh
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                if (token) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                return this.client(originalRequest);
              })
              .catch((err) => {
                return Promise.reject(err);
              });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            // Attempt to refresh the token
            const response = await this.refreshToken();
            
            if (response?.data?.token) {
              const newToken = response.data.token;
              localStorage.setItem('token', newToken);
              
              // Update the authorization header
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              
              // Process the failed queue with the new token
              this.processQueue(null, newToken);
              
              // Retry the original request
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Token refresh failed, process queue with error
            this.processQueue(refreshError as Error, null);
            
            // Clear auth data and redirect to login
            this.clearAuthAndRedirect();
            
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        // For other 401 errors (e.g., invalid credentials on login), don't redirect
        if (error.response?.status === 401) {
          // Check if we should clear auth (token expired and refresh failed)
          const errorData = error.response?.data as { error?: { code?: string } };
          if (errorData?.error?.code === 'SESSION_INVALID' || 
              errorData?.error?.code === 'TOKEN_EXPIRED') {
            this.clearAuthAndRedirect();
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  private processQueue(error: Error | null, token: string | null) {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    this.failedQueue = [];
  }

  private clearAuthAndRedirect() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('userId');
    
    // Only redirect if not already on login page
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  private async refreshToken() {
    const sessionId = localStorage.getItem('sessionId');
    const userId = localStorage.getItem('userId');
    
    if (!sessionId || !userId) {
      throw new Error('Session data not found');
    }
    
    try {
      const response = await axios.post(
        `${this.baseURL}/api/auth/refresh`,
        { sessionId, userId },
        { 
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (response.data.success && response.data.token) {
        // Update sessionId if it changed
        if (response.data.sessionId) {
          localStorage.setItem('sessionId', response.data.sessionId);
        }
      }
      
      return response;
    } catch {
      // If refresh endpoint doesn't exist or fails, throw to trigger logout
      throw new Error('Token refresh failed');
    }
  }

  // Generic HTTP methods
  get(url: string, config?: AxiosRequestConfig) {
    return this.client.get(url, config);
  }

  post(url: string, data?: unknown) {
    return this.client.post(url, data);
  }

  put(url: string, data?: unknown) {
    return this.client.put(url, data);
  }

  delete(url: string) {
    return this.client.delete(url);
  }

  // Auth endpoints
  async register(data: { name: string; email: string; password: string }) {
    const response = await this.client.post<AuthResponse>('/api/auth/register', data);
    
    // Store tokens if returned
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    if (response.data.sessionId) {
      localStorage.setItem('sessionId', response.data.sessionId);
    }
    if (response.data.data?.id) {
      localStorage.setItem('userId', response.data.data.id);
    }
    
    return response;
  }

  async login(data: { email: string; password: string }) {
    const response = await this.client.post<AuthResponse>('/api/auth/login', data);
    
    // Store tokens if returned
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    if (response.data.sessionId) {
      localStorage.setItem('sessionId', response.data.sessionId);
    }
    if (response.data.data?.id) {
      localStorage.setItem('userId', response.data.data.id);
    }
    
    return response;
  }

  async logout() {
    try {
      await this.client.post('/api/auth/logout');
    } finally {
      // Always clear local storage on logout
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('sessionId');
      localStorage.removeItem('userId');
    }
  }

  async getCurrentUser() {
    return this.client.get('/api/auth/me');
  }

  // Product endpoints
  async getProducts(
    page: number = 1,
    limit: number = 20,
    category?: string,
    minPrice?: number,
    maxPrice?: number,
    search?: string,
    sort?: string,
    brand?: string,
    minRating?: number,
    inStock?: boolean,
    badges?: string
  ) {
    const params: Record<string, unknown> = { page, limit };
    if (category) params.category = category;
    if (minPrice !== undefined) params.minPrice = minPrice;
    if (maxPrice !== undefined) params.maxPrice = maxPrice;
    if (search) params.search = search;
    if (sort) params.sort = sort;
    if (brand) params.brand = brand;
    if (minRating !== undefined) params.minRating = minRating;
    if (inStock) params.inStock = 'true';
    if (badges) params.badges = badges;

    return this.client.get('/api/products', { params });
  }

  async getProduct(id: string): Promise<AxiosResponse<ApiResponse<Product>>> {
    return this.client.get<ApiResponse<Product>>(`/api/products/${id}`);
  }

  // related products (same category, excluding current)
  async getRelatedProducts(id: string) {
    return this.client.get(`/api/products/${id}/related`);
  }

  async searchProducts(query: string, limit: number = 10) {
    return this.client.get('/api/products/search', {
      params: { q: query, limit }
    });
  }

  async getFeaturedProducts(limit: number = 8) {
    return this.client.get('/api/products/featured', { params: { limit } });
  }

  // fetch a set of products by id (used by the recently-viewed widget)
  async getProductsByIds(ids: string[]) {
    return this.client.get('/api/products/bulk', {
      params: { ids: ids.join(',') }
    });
  }

  // fetch fuller projections for side-by-side comparison (max 4)
  async getProductsForCompare(ids: string[]) {
    return this.client.get('/api/products/compare', {
      params: { ids: ids.join(',') }
    });
  }

  async getCategories() {
    return this.client.get('/api/products/categories');
  }

  async getBrands() {
    return this.client.get('/api/products/brands');
  }

  async createProduct(data: Partial<Product>) {
    return this.client.post('/api/products', data);
  }

  async updateProduct(id: string, data: Partial<Product>) {
    return this.client.put(`/api/products/${id}`, data);
  }

  async deleteProduct(id: string) {
    return this.client.delete(`/api/products/${id}`);
  }

  async addProductReview(
    productId: string,
    data: { rating: number; comment: string; photos?: string[] }
  ) {
    return this.client.post(`/api/products/${productId}/reviews`, data);
  }

  // mark a review as helpful (one vote per user, enforced server-side)
  async voteReviewHelpful(productId: string, reviewId: string) {
    return this.client.post(
      `/api/products/${productId}/reviews/${reviewId}/vote`
    );
  }

  // seller/admin reply to a review (one reply per review)
  async replyToReview(productId: string, reviewId: string, comment: string) {
    return this.client.post(
      `/api/products/${productId}/reviews/${reviewId}/reply`,
      { comment }
    );
  }

  // Order endpoints
  async createOrder(data: Partial<Order>) {
    return this.client.post('/api/orders', data);
  }

  async getOrder(id: string) {
    return this.client.get<Order>(`/api/orders/${id}`);
  }

  async getUserOrders(page: number = 1, limit: number = 10) {
    return this.client.get('/api/orders/myorders', {
      params: { page, limit }
    });
  }

  async getAllOrders(page: number = 1, limit: number = 20) {
    return this.client.get('/api/orders', { params: { page, limit } });
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.client.put(`/api/orders/${orderId}/status`, { status });
  }

  async processPayment(orderId: string, paymentData: unknown) {
    return this.client.post(`/api/orders/${orderId}/pay`, paymentData);
  }

  async createCheckoutSession(orderId: string) {
    return this.client.post(`/api/orders/${orderId}/create-checkout-session`);
  }

  async verifyPayment(orderId: string, sessionId: string) {
    return this.client.post(`/api/orders/${orderId}/verify-payment`, { sessionId });
  }

  async cancelOrder(orderId: string) {
    return this.client.put(`/api/orders/${orderId}/cancel`);
  }

  // Upload endpoints
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.client.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }

  // User endpoints
  async updateProfile(data: Record<string, unknown>) {
    return this.client.put('/api/users/profile', data);
  }

  async changePassword(data: { oldPassword: string; newPassword: string }) {
    return this.client.put('/api/users/password', data);
  }

  async getUsers(page: number = 1, limit: number = 20) {
    return this.client.get('/api/users', { params: { page, limit } });
  }

  async updateUser(id: string, data: Record<string, unknown>) {
    return this.client.put(`/api/users/${id}`, data);
  }

  async deleteUser(id: string) {
    return this.client.delete(`/api/users/${id}`);
  }

  // Address Book endpoints
  async getAddresses() {
    return this.client.get('/api/addresses');
  }

  async getAddress(id: string) {
    return this.client.get(`/api/addresses/${id}`);
  }

  async createAddress(data: Record<string, unknown>) {
    return this.client.post('/api/addresses', data);
  }

  async updateAddress(id: string, data: Record<string, unknown>) {
    return this.client.put(`/api/addresses/${id}`, data);
  }

  async deleteAddress(id: string) {
    return this.client.delete(`/api/addresses/${id}`);
  }

  async setDefaultShippingAddress(id: string) {
    return this.client.put(`/api/addresses/${id}/default-shipping`);
  }

  async setDefaultBillingAddress(id: string) {
    return this.client.put(`/api/addresses/${id}/default-billing`);
  }
}

export default new ApiClient();
