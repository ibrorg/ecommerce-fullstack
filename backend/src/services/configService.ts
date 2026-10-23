import SiteConfig, { ISiteConfig, IThemeConfig, IBrandingConfig, ILayoutConfig, IFeatureFlags, INotificationConfig } from '../models/SiteConfig';
import AdminPreference from '../models/AdminPreference';
import Role from '../models/Role';
import { AppError } from '../middleware/errorHandler';

export class ConfigService {
  /**
   * GET SITE CONFIG
   * Retrieve the complete site configuration
   */
  async getSiteConfig(): Promise<any> {
    let config = await SiteConfig.findOne().lean();
    
    if (!config) {
      config = await this.createDefaultConfig();
    }
    
    return config;
  }

  /**
   * UPDATE THEME
   * Update only the theme colors and typography
   */
  async updateTheme(adminId: string, theme: Partial<IThemeConfig>): Promise<ISiteConfig> {
    const config = await SiteConfig.findOneAndUpdate(
      {},
      { $set: { theme, updatedAt: new Date() } },
      { new: true, upsert: true }
    );
    return config as ISiteConfig;
  }

  /**
   * UPDATE BRANDING
   * Update store name, logos, contact info
   */
  async updateBranding(adminId: string, branding: Partial<IBrandingConfig>): Promise<ISiteConfig> {
    const config = await SiteConfig.findOneAndUpdate(
      {},
      { $set: { branding, updatedAt: new Date() } },
      { new: true, upsert: true }
    );
    return config as ISiteConfig;
  }

  /**
   * UPDATE LAYOUT
   * Update UI/UX layout preferences
   */
  async updateLayout(adminId: string, layout: Partial<ILayoutConfig>): Promise<ISiteConfig> {
    const config = await SiteConfig.findOneAndUpdate(
      {},
      { $set: { layout, updatedAt: new Date() } },
      { new: true, upsert: true }
    );
    return config as ISiteConfig;
  }

  /**
   * UPDATE FEATURE FLAGS
   * Enable/disable features globally
   */
  async updateFeatures(adminId: string, features: Partial<IFeatureFlags>): Promise<ISiteConfig> {
    const config = await SiteConfig.findOneAndUpdate(
      {},
      { $set: { features, updatedAt: new Date() } },
      { new: true, upsert: true }
    );
    return config as ISiteConfig;
  }

  /**
   * UPDATE NOTIFICATIONS
   * Configure email, SMS, push notifications
   */
  async updateNotifications(adminId: string, notifications: Partial<INotificationConfig>): Promise<ISiteConfig> {
    const config = await SiteConfig.findOneAndUpdate(
      {},
      { $set: { notifications, updatedAt: new Date() } },
      { new: true, upsert: true }
    );
    return config as ISiteConfig;
  }

  /**
   * TOGGLE MAINTENANCE MODE
   * Enable/disable maintenance mode with optional message
   */
  async toggleMaintenanceMode(adminId: string, enabled: boolean, message?: string): Promise<ISiteConfig> {
    const config = await SiteConfig.findOneAndUpdate(
      {},
      { 
        $set: { 
          maintenanceMode: enabled,
          maintenanceMessage: message,
          updatedAt: new Date()
        } 
      },
      { new: true, upsert: true }
    );
    return config as ISiteConfig;
  }

  /**
   * CREATE DEFAULT CONFIG
   * Initialize default configuration
   */
  private async createDefaultConfig(): Promise<any> {
    const defaultConfig = new SiteConfig({
      version: 1,
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
      maintenanceMode: false
    });

    return await defaultConfig.save();
  }

  /**
   * ADMIN PREFERENCES - GET
   */
  async getAdminPreferences(adminId: string) {
    let prefs = await AdminPreference.findOne({ adminId });
    
    if (!prefs) {
      prefs = await AdminPreference.create({
        adminId,
        dashboardWidgets: this.getDefaultWidgets(),
        defaultView: 'overview',
        autoRefreshInterval: 30000,
        itemsPerPage: 10
      });
    }
    
    return prefs;
  }

  /**
   * ADMIN PREFERENCES - UPDATE
   */
  async updateAdminPreferences(adminId: string, updates: any) {
    return await AdminPreference.findOneAndUpdate(
      { adminId },
      { $set: { ...updates, updatedAt: new Date() } },
      { new: true, upsert: true }
    );
  }

  /**
   * ADMIN PREFERENCES - TOGGLE WIDGET
   */
  async toggleWidget(adminId: string, widgetId: string) {
    const prefs = await AdminPreference.findOne({ adminId });
    if (!prefs) throw new AppError('Admin preferences not found', 404);

    const widget = prefs.dashboardWidgets.find((w: any) => w.id === widgetId);
    if (!widget) throw new AppError('Widget not found', 404);

    widget.enabled = !widget.enabled;
    await prefs.save();
    return prefs;
  }

  /**
   * ADMIN PREFERENCES - REARRANGE WIDGETS
   */
  async rearrangeWidgets(adminId: string, widgets: any[]) {
    return await AdminPreference.findOneAndUpdate(
      { adminId },
      { $set: { dashboardWidgets: widgets, updatedAt: new Date() } },
      { new: true }
    );
  }

  /**
   * ADMIN PREFERENCES - SAVE FILTER
   */
  async saveFilter(adminId: string, filterName: string, filterType: string, filters: any) {
    const prefs = await AdminPreference.findOne({ adminId });
    if (!prefs) throw new AppError('Admin preferences not found', 404);

    prefs.savedFilters.push({ name: filterName, type: filterType, filters });
    await prefs.save();
    return prefs;
  }

  /**
   * ADMIN PREFERENCES - DELETE FILTER
   */
  async deleteFilter(adminId: string, filterName: string) {
    const prefs = await AdminPreference.findOne({ adminId });
    if (!prefs) throw new AppError('Admin preferences not found', 404);

    prefs.savedFilters = prefs.savedFilters.filter((f: any) => f.name !== filterName);
    await prefs.save();
    return prefs;
  }

  /**
   * Get default widgets
   */
  private getDefaultWidgets() {
    return [
      { id: 'revenue', name: 'Total Revenue', enabled: true, position: 1, size: 'medium' },
      { id: 'orders', name: 'Total Orders', enabled: true, position: 2, size: 'medium' },
      { id: 'products', name: 'Total Products', enabled: true, position: 3, size: 'medium' },
      { id: 'users', name: 'Total Users', enabled: true, position: 4, size: 'medium' },
      { id: 'revenue-trends', name: 'Revenue Trends', enabled: true, position: 5, size: 'large' },
      { id: 'top-products', name: 'Top Products', enabled: true, position: 6, size: 'large' }
    ];
  }
}

export default new ConfigService();
