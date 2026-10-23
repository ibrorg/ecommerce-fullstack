import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';

/**
 * COMPREHENSIVE CONFIGURATION CONTEXT
 * Manages all site customization, theme, branding, features, and admin preferences
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

export interface IFeatureFlags {
  [key: string]: boolean;
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

export interface INotificationConfig {
  email: {
    enabled: boolean;
    smtpProvider: string;
    senderEmail: string;
    senderName: string;
  };
  sms: {
    enabled: boolean;
    provider?: string;
    apiKey?: string;
  };
  push: {
    enabled: boolean;
    provider?: string;
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

export interface IConfigState {
  theme: IThemeConfig;
  branding: IBrandingConfig;
  layout: ILayoutConfig;
  features: IFeatureFlags;
  notifications: INotificationConfig;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  loading: boolean;
  error: string | null;
  // Admin preferences
  adminWidgets: any[];
  adminDefaultView: string;
  adminRefreshInterval: number;
  adminItemsPerPage: number;
  savedFilters: any[];
}

export interface IConfigContextType extends IConfigState {
  // Public config methods
  fetchPublicConfig: () => Promise<void>;
  // Admin config methods
  fetchAdminConfig: () => Promise<void>;
  updateTheme: (theme: Partial<IThemeConfig>) => Promise<void>;
  updateBranding: (branding: Partial<IBrandingConfig>) => Promise<void>;
  updateLayout: (layout: Partial<ILayoutConfig>) => Promise<void>;
  updateFeatures: (features: Partial<IFeatureFlags>) => Promise<void>;
  updateNotifications: (notifications: Partial<INotificationConfig>) => Promise<void>;
  toggleFeature: (featureName: string, enabled: boolean) => Promise<void>;
  toggleMaintenanceMode: (enabled: boolean, message?: string) => Promise<void>;
  // Admin preferences
  fetchAdminPreferences: () => Promise<void>;
  updateAdminPreferences: (updates: any) => Promise<void>;
  toggleAdminWidget: (widgetId: string) => Promise<void>;
  rearrangeAdminWidgets: (widgets: any[]) => Promise<void>;
  saveAdminFilter: (name: string, type: string, filters: any) => Promise<void>;
  deleteAdminFilter: (filterName: string) => Promise<void>;
  clearError: () => void;
}

const ConfigContext = createContext<IConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [state, setState] = useState<IConfigState>({
    theme: {
      name: 'Default',
      primaryColor: '#3b82f6',
      secondaryColor: '#64748b',
      accentColor: '#f59e0b',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      borderColor: '#e5e7eb',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      errorColor: '#ef4444',
      font: { primary: 'Inter', secondary: 'system-ui' },
      isDark: false
    },
    branding: {
      storeName: 'E-Shop',
      storeDescription: 'Premium E-Commerce Platform',
      storeEmail: 'contact@ecommerce.com',
      storePhone: '',
      storeAddress: '',
      logoUrl: '',
      faviconUrl: '',
      bannerUrl: '',
      currency: 'USD',
      currencySymbol: '$',
      timezone: 'UTC',
      language: 'en',
      socialMedia: {}
    },
    layout: {
      headerStyle: 'modern',
      footerStyle: 'standard',
      sidebarPosition: 'left',
      sidebarCollapsible: true,
      showBreadcrumbs: true,
      showFooter: true,
      showChatbot: false,
      itemsPerPage: 10,
      itemsPerPageOptions: [10, 20, 50, 100],
      defaultSortBy: 'createdAt',
      defaultSortOrder: 'desc'
    },
    features: {
      sellerRegistration: true,
      reviews: true,
      ratings: true,
      wishlist: true,
      cart: true,
      checkout: true,
      payments: true,
      orders: true,
      returns: true,
      refunds: true,
      coupons: false,
      analytics: true,
      reportBuilder: true,
      customRoles: true
    },
    notifications: {
      email: {
        enabled: true,
        smtpProvider: 'gmail',
        senderEmail: 'noreply@ecommerce.com',
        senderName: 'E-Shop'
      },
      sms: { enabled: false },
      push: { enabled: false },
      eventTypes: {
        newOrder: true,
        orderShipped: true,
        orderDelivered: true,
        paymentFailed: true,
        lowStock: true,
        reviewSubmitted: false,
        sellerVerification: true,
        refundProcessed: true
      }
    },
    maintenanceMode: false,
    loading: true,
    error: null,
    adminWidgets: [],
    adminDefaultView: 'overview',
    adminRefreshInterval: 30000,
    adminItemsPerPage: 10,
    savedFilters: []
  });

  // Fetch public config on mount (with error suppression for initial load)
  useEffect(() => {
    const loadConfig = async () => {
      try {
        await fetchPublicConfig();
      } catch {
        // Suppress initial load errors - use defaults
        setState(prev => ({ ...prev, loading: false }));
      }
    };
    loadConfig();
  }, []);

  const fetchPublicConfig = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const response = await api.get('/api/config/public');
      const config = (response as any)?.data?.data;

      if (!config || typeof config !== 'object') {
        setState(prev => ({
          ...prev,
          error: 'Invalid config response',
          loading: false
        }));
        return;
      }
      
      setState(prev => ({
        ...prev,
        theme: config.theme || prev.theme,
        branding: config.branding || prev.branding,
        layout: config.layout || prev.layout,
        features: config.features || prev.features,
        notifications: config.notifications || prev.notifications,
        maintenanceMode: typeof config.maintenanceMode === 'boolean' ? config.maintenanceMode : prev.maintenanceMode,
        loading: false
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message, loading: false }));
    }
  };

  const fetchAdminConfig = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const response = await api.get('/api/config');
      const config = (response as any)?.data?.data;

      if (!config || typeof config !== 'object') {
        setState(prev => ({
          ...prev,
          error: 'Invalid config response',
          loading: false
        }));
        return;
      }
      
      setState(prev => ({
        ...prev,
        theme: config.theme || prev.theme,
        branding: config.branding || prev.branding,
        layout: config.layout || prev.layout,
        features: config.features || prev.features,
        notifications: config.notifications || prev.notifications,
        maintenanceMode: typeof config.maintenanceMode === 'boolean' ? config.maintenanceMode : prev.maintenanceMode,
        loading: false
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message, loading: false }));
    }
  };

  const updateTheme = async (theme: Partial<IThemeConfig>) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const response = await api.put('/api/config/theme', theme);
      setState(prev => ({
        ...prev,
        theme: { ...prev.theme, ...response.data.data.theme },
        loading: false
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message, loading: false }));
    }
  };

  const updateBranding = async (branding: Partial<IBrandingConfig>) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const response = await api.put('/api/config/branding', branding);
      setState(prev => ({
        ...prev,
        branding: { ...prev.branding, ...response.data.data.branding },
        loading: false
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message, loading: false }));
    }
  };

  const updateLayout = async (layout: Partial<ILayoutConfig>) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const response = await api.put('/api/config/layout', layout);
      setState(prev => ({
        ...prev,
        layout: { ...prev.layout, ...response.data.data.layout },
        loading: false
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message, loading: false }));
    }
  };

  const updateFeatures = async (features: Partial<IFeatureFlags>) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const response = await api.put('/api/config/features', features);
      setState(prev => ({
        ...prev,
        features: { ...prev.features, ...response.data.data.features },
        loading: false
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message, loading: false }));
    }
  };

  const updateNotifications = async (notifications: Partial<INotificationConfig>) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const response = await api.put('/api/config/notifications', notifications);
      setState(prev => ({
        ...prev,
        notifications: response.data.data.notifications,
        loading: false
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message, loading: false }));
    }
  };

  const toggleFeature = async (featureName: string, enabled: boolean) => {
    try {
      await api.put(`/api/config/features/${featureName}`, { enabled });
      setState(prev => ({
        ...prev,
        features: { ...prev.features, [featureName]: enabled }
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  };

  const toggleMaintenanceMode = async (enabled: boolean, message?: string) => {
    try {
      await api.post('/api/config/maintenance', { enabled, message });
      setState(prev => ({
        ...prev,
        maintenanceMode: enabled,
        maintenanceMessage: message
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  };

  // ADMIN PREFERENCES
  const fetchAdminPreferences = async () => {
    try {
      const response = await api.get('/api/config/admin/preferences');
      const prefs = response.data.data;
      setState(prev => ({
        ...prev,
        adminWidgets: prefs.dashboardWidgets || [],
        adminDefaultView: prefs.defaultView,
        adminRefreshInterval: prefs.autoRefreshInterval,
        adminItemsPerPage: prefs.itemsPerPage,
        savedFilters: prefs.savedFilters || []
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  };

  const updateAdminPreferences = async (updates: any) => {
    try {
      await api.put('/api/config/admin/preferences', updates);
      await fetchAdminPreferences();
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  };

  const toggleAdminWidget = async (widgetId: string) => {
    try {
      await api.put(`/api/config/admin/preferences/widgets/${widgetId}/toggle`);
      await fetchAdminPreferences();
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  };

  const rearrangeAdminWidgets = async (widgets: any[]) => {
    try {
      await api.put('/api/config/admin/preferences/widgets/rearrange', { widgets });
      setState(prev => ({ ...prev, adminWidgets: widgets }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  };

  const saveAdminFilter = async (name: string, type: string, filters: any) => {
    try {
      await api.post('/api/config/admin/preferences/filters', { name, type, filters });
      await fetchAdminPreferences();
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  };

  const deleteAdminFilter = async (filterName: string) => {
    try {
      await api.delete(`/api/config/admin/preferences/filters/${filterName}`);
      await fetchAdminPreferences();
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  const value: IConfigContextType = {
    ...state,
    fetchPublicConfig,
    fetchAdminConfig,
    updateTheme,
    updateBranding,
    updateLayout,
    updateFeatures,
    updateNotifications,
    toggleFeature,
    toggleMaintenanceMode,
    fetchAdminPreferences,
    updateAdminPreferences,
    toggleAdminWidget,
    rearrangeAdminWidgets,
    saveAdminFilter,
    deleteAdminFilter,
    clearError
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = (): IConfigContextType => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
};

export default ConfigContext;
