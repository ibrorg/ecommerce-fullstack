import mongoose, { Document, Schema } from 'mongoose';

/**
 * THEME CONFIGURATION
 * Complete theming system for the entire platform
 */
export interface IThemeConfig {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  font: {
    primary: string;
    secondary: string;
  };
  isDark: boolean;
}

/**
 * BRANDING CONFIGURATION
 * Store branding, logos, and messaging
 */
export interface IBrandingConfig {
  storeName: string;
  storeDescription: string;
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
  logoUrl: string;
  faviconUrl: string;
  bannerUrl: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  language: string;
  socialMedia: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };
}

/**
 * LAYOUT CONFIGURATION
 * UI/UX layout and navigation customization
 */
export interface ILayoutConfig {
  headerStyle: 'classic' | 'modern' | 'minimal';
  footerStyle: 'standard' | 'expanded' | 'minimal';
  sidebarPosition: 'left' | 'right';
  sidebarCollapsible: boolean;
  showBreadcrumbs: boolean;
  showFooter: boolean;
  showChatbot: boolean;
  itemsPerPage: number;
  itemsPerPageOptions: number[];
  defaultSortBy: string;
  defaultSortOrder: 'asc' | 'desc';
}

/**
 * FEATURE FLAGS
 * Control which features are enabled/disabled
 */
export interface IFeatureFlags {
  [key: string]: boolean;
  // Example features
  sellerRegistration: boolean;
  reviews: boolean;
  ratings: boolean;
  wishlist: boolean;
  cart: boolean;
  checkout: boolean;
  payments: boolean;
  orders: boolean;
  returns: boolean;
  refunds: boolean;
  coupons: boolean;
  analytics: boolean;
  reportBuilder: boolean;
  customRoles: boolean;
}

/**
 * NOTIFICATIONS CONFIGURATION
 * Email, SMS, and push notification settings
 */
export interface INotificationConfig {
  email: {
    enabled: boolean;
    smtpProvider: string;
    senderEmail: string;
    senderName: string;
  };
  sms: {
    enabled: boolean;
    provider: string;
    apiKey: string;
  };
  push: {
    enabled: boolean;
    provider: string;
  };
  eventTypes: {
    newOrder: boolean;
    orderShipped: boolean;
    orderDelivered: boolean;
    paymentFailed: boolean;
    lowStock: boolean;
    reviewSubmitted: boolean;
    sellerVerification: boolean;
    refundProcessed: boolean;
  };
}

/**
 * ADMIN PREFERENCES
 * Individual admin dashboard and interface preferences
 */
export interface IAdminWidgetConfig {
  id: string;
  name: string;
  enabled: boolean;
  position: number;
  size: 'small' | 'medium' | 'large';
}

export interface IAdminPreference {
  adminId: mongoose.Types.ObjectId;
  dashboardWidgets: IAdminWidgetConfig[];
  defaultView: 'overview' | 'products' | 'orders' | 'users' | 'sellers' | 'analytics';
  autoRefreshInterval: number;
  itemsPerPage: number;
  notifications: {
    emailDigest: boolean;
    digestFrequency: 'daily' | 'weekly' | 'monthly';
  };
  savedFilters: Array<{
    name: string;
    type: string;
    filters: Record<string, any>;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MAIN SITE CONFIG DOCUMENT
 * All-in-one configuration document for the entire site
 */
export interface ISiteConfig extends Document {
  version: number;
  theme: IThemeConfig;
  branding: IBrandingConfig;
  layout: ILayoutConfig;
  features: IFeatureFlags;
  notifications: INotificationConfig;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Theme Schema
const themeSchema = new Schema<IThemeConfig>({
  name: { type: String, default: 'Default' },
  primaryColor: { type: String, default: '#3b82f6' },
  secondaryColor: { type: String, default: '#64748b' },
  accentColor: { type: String, default: '#f59e0b' },
  backgroundColor: { type: String, default: '#ffffff' },
  textColor: { type: String, default: '#1f2937' },
  borderColor: { type: String, default: '#e5e7eb' },
  successColor: { type: String, default: '#10b981' },
  warningColor: { type: String, default: '#f59e0b' },
  errorColor: { type: String, default: '#ef4444' },
  font: {
    primary: { type: String, default: 'Inter' },
    secondary: { type: String, default: 'system-ui' }
  },
  isDark: { type: Boolean, default: false }
});

// Branding Schema
const brandingSchema = new Schema<IBrandingConfig>({
  storeName: { type: String, default: 'E-Shop', maxlength: 100 },
  storeDescription: { type: String, default: '', maxlength: 500 },
  storeEmail: { type: String, default: 'contact@ecommerce.com' },
  storePhone: { type: String, default: '' },
  storeAddress: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  faviconUrl: { type: String, default: '' },
  bannerUrl: { type: String, default: '' },
  currency: { type: String, default: 'USD' },
  currencySymbol: { type: String, default: '$' },
  timezone: { type: String, default: 'UTC' },
  language: { type: String, default: 'en' },
  socialMedia: {
    facebook: String,
    twitter: String,
    instagram: String,
    linkedin: String,
    youtube: String
  }
});

// Layout Schema
const layoutSchema = new Schema<ILayoutConfig>({
  headerStyle: { type: String, enum: ['classic', 'modern', 'minimal'], default: 'modern' },
  footerStyle: { type: String, enum: ['standard', 'expanded', 'minimal'], default: 'standard' },
  sidebarPosition: { type: String, enum: ['left', 'right'], default: 'left' },
  sidebarCollapsible: { type: Boolean, default: true },
  showBreadcrumbs: { type: Boolean, default: true },
  showFooter: { type: Boolean, default: true },
  showChatbot: { type: Boolean, default: false },
  itemsPerPage: { type: Number, default: 10 },
  itemsPerPageOptions: { type: [Number], default: [10, 20, 50, 100] },
  defaultSortBy: { type: String, default: 'createdAt' },
  defaultSortOrder: { type: String, enum: ['asc', 'desc'], default: 'desc' }
});

// Feature Flags Schema
const featureFlagsSchema = new Schema<IFeatureFlags>({
  sellerRegistration: { type: Boolean, default: true },
  reviews: { type: Boolean, default: true },
  ratings: { type: Boolean, default: true },
  wishlist: { type: Boolean, default: true },
  cart: { type: Boolean, default: true },
  checkout: { type: Boolean, default: true },
  payments: { type: Boolean, default: true },
  orders: { type: Boolean, default: true },
  returns: { type: Boolean, default: true },
  refunds: { type: Boolean, default: true },
  coupons: { type: Boolean, default: false },
  analytics: { type: Boolean, default: true },
  reportBuilder: { type: Boolean, default: true },
  customRoles: { type: Boolean, default: true }
});

// Notifications Schema
const notificationConfigSchema = new Schema<INotificationConfig>({
  email: {
    enabled: { type: Boolean, default: true },
    smtpProvider: { type: String, default: 'gmail' },
    senderEmail: { type: String, default: 'noreply@ecommerce.com' },
    senderName: { type: String, default: 'E-Shop' }
  },
  sms: {
    enabled: { type: Boolean, default: false },
    provider: String,
    apiKey: String
  },
  push: {
    enabled: { type: Boolean, default: false },
    provider: String
  },
  eventTypes: {
    newOrder: { type: Boolean, default: true },
    orderShipped: { type: Boolean, default: true },
    orderDelivered: { type: Boolean, default: true },
    paymentFailed: { type: Boolean, default: true },
    lowStock: { type: Boolean, default: true },
    reviewSubmitted: { type: Boolean, default: false },
    sellerVerification: { type: Boolean, default: true },
    refundProcessed: { type: Boolean, default: true }
  }
});

// Main Site Config Schema
const siteConfigSchema = new Schema<ISiteConfig>({
  version: { type: Number, default: 1 },
  theme: { type: themeSchema, required: true },
  branding: { type: brandingSchema, required: true },
  layout: { type: layoutSchema, required: true },
  features: { type: featureFlagsSchema, required: true },
  notifications: { type: notificationConfigSchema, required: true },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: String,
  createdBy: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
siteConfigSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<ISiteConfig>('SiteConfig', siteConfigSchema);
