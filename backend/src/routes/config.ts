import express from 'express';
import { protect, authorize } from '../middleware/auth';
import configService from '../services/configService';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';

const router = express.Router();

/**
 * PUBLIC ROUTES - Get site configuration (no auth required)
 */

router.get('/public', asyncHandler(async (req: any, res: any) => {
  const config = await configService.getSiteConfig();
  sendSuccess(res, 200, config, 'Site configuration retrieved');
}));

router.get('/public/theme', asyncHandler(async (req: any, res: any) => {
  const config = await configService.getSiteConfig();
  sendSuccess(res, 200, { theme: config.theme }, 'Theme configuration retrieved');
}));

router.get('/public/branding', asyncHandler(async (req: any, res: any) => {
  const config = await configService.getSiteConfig();
  sendSuccess(res, 200, { branding: config.branding }, 'Branding configuration retrieved');
}));

router.get('/public/features', asyncHandler(async (req: any, res: any) => {
  const config = await configService.getSiteConfig();
  sendSuccess(res, 200, { features: config.features }, 'Feature flags retrieved');
}));

/**
 * ADMIN ROUTES - Require authentication and admin role
 */

router.use(protect, authorize('admin'));

// GET full site config
router.get('/', asyncHandler(async (req: any, res: any) => {
  const config = await configService.getSiteConfig();
  sendSuccess(res, 200, config, 'Site configuration retrieved');
}));

// UPDATE THEME
router.put('/theme', asyncHandler(async (req: any, res: any) => {
  const config = await configService.updateTheme(req.user._id, req.body);
  sendSuccess(res, 200, config, 'Theme updated successfully');
}));

// UPDATE BRANDING
router.put('/branding', asyncHandler(async (req: any, res: any) => {
  const config = await configService.updateBranding(req.user._id, req.body);
  sendSuccess(res, 200, config, 'Branding updated successfully');
}));

// UPDATE LAYOUT
router.put('/layout', asyncHandler(async (req: any, res: any) => {
  const config = await configService.updateLayout(req.user._id, req.body);
  sendSuccess(res, 200, config, 'Layout updated successfully');
}));

// UPDATE FEATURES
router.put('/features', asyncHandler(async (req: any, res: any) => {
  const config = await configService.updateFeatures(req.user._id, req.body);
  sendSuccess(res, 200, config, 'Features updated successfully');
}));

// UPDATE NOTIFICATIONS
router.put('/notifications', asyncHandler(async (req: any, res: any) => {
  const config = await configService.updateNotifications(req.user._id, req.body);
  sendSuccess(res, 200, config, 'Notifications updated successfully');
}));

// TOGGLE FEATURE
router.put('/features/:featureName', asyncHandler(async (req: any, res: any) => {
  const config = await configService.getSiteConfig();
  const { featureName } = req.params;
  const { enabled } = req.body;
  
  config.features[featureName] = enabled;
  await configService.updateFeatures(req.user._id, config.features);
  
  sendSuccess(res, 200, { [featureName]: enabled }, `Feature ${featureName} updated`);
}));

// TOGGLE MAINTENANCE MODE
router.post('/maintenance', asyncHandler(async (req: any, res: any) => {
  const { enabled, message } = req.body;
  const config = await configService.toggleMaintenanceMode(req.user._id, enabled, message);
  sendSuccess(res, 200, { maintenanceMode: config.maintenanceMode }, 'Maintenance mode toggled');
}));

/**
 * ADMIN PREFERENCES ROUTES
 */

// GET admin preferences
router.get('/admin/preferences', asyncHandler(async (req: any, res: any) => {
  const prefs = await configService.getAdminPreferences(req.user._id);
  sendSuccess(res, 200, prefs, 'Admin preferences retrieved');
}));

// UPDATE admin preferences
router.put('/admin/preferences', asyncHandler(async (req: any, res: any) => {
  const prefs = await configService.updateAdminPreferences(req.user._id, req.body);
  sendSuccess(res, 200, prefs, 'Admin preferences updated');
}));

// TOGGLE widget
router.put('/admin/preferences/widgets/:widgetId/toggle', asyncHandler(async (req: any, res: any) => {
  const prefs = await configService.toggleWidget(req.user._id, req.params.widgetId);
  sendSuccess(res, 200, prefs, 'Widget toggled successfully');
}));

// REARRANGE widgets
router.put('/admin/preferences/widgets/rearrange', asyncHandler(async (req: any, res: any) => {
  const prefs = await configService.rearrangeWidgets(req.user._id, req.body.widgets);
  sendSuccess(res, 200, prefs, 'Widgets rearranged successfully');
}));

// SAVE filter
router.post('/admin/preferences/filters', asyncHandler(async (req: any, res: any) => {
  const { name, type, filters } = req.body;
  const prefs = await configService.saveFilter(req.user._id, name, type, filters);
  sendSuccess(res, 200, prefs, 'Filter saved successfully');
}));

// DELETE filter
router.delete('/admin/preferences/filters/:filterName', asyncHandler(async (req: any, res: any) => {
  const prefs = await configService.deleteFilter(req.user._id, req.params.filterName);
  sendSuccess(res, 200, prefs, 'Filter deleted successfully');
}));

export default router;
