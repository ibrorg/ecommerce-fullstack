import express from 'express';
import { protect, authorize } from '../middleware/auth';
import adminService from '../services/adminService';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';

const router = express.Router();

// All admin routes require admin authentication
router.use(protect, authorize('admin'));

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Private/Admin
router.get(
  '/dashboard',
  asyncHandler(async (req: any, res: any) => {
    const stats = await adminService.getPlatformStats();
    sendSuccess(res, 200, stats, 'Dashboard stats retrieved');
  })
);

// @route   GET /api/admin/revenue-trends
// @desc    Get revenue trends
// @access  Private/Admin
router.get(
  '/revenue-trends',
  asyncHandler(async (req: any, res: any) => {
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const trends = await adminService.getRevenueTrends(days);
    sendSuccess(res, 200, trends, 'Revenue trends retrieved');
  })
);

// @route   GET /api/admin/top-products
// @desc    Get top selling products
// @access  Private/Admin
router.get(
  '/top-products',
  asyncHandler(async (req: any, res: any) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const products = await adminService.getTopProducts(limit);
    sendSuccess(res, 200, products, 'Top products retrieved');
  })
);

// @route   GET /api/admin/user-growth
// @desc    Get user growth metrics
// @access  Private/Admin
router.get(
  '/user-growth',
  asyncHandler(async (req: any, res: any) => {
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const growth = await adminService.getUserGrowth(days);
    sendSuccess(res, 200, growth, 'User growth data retrieved');
  })
);

// @route   GET /api/admin/categories
// @desc    Get category performance
// @access  Private/Admin
router.get(
  '/categories',
  asyncHandler(async (req: any, res: any) => {
    const categories = await adminService.getCategoryPerformance();
    sendSuccess(res, 200, categories, 'Category performance retrieved');
  })
);

// @route   GET /api/admin/top-sellers
// @desc    Get top sellers
// @access  Private/Admin
router.get(
  '/top-sellers',
  asyncHandler(async (req: any, res: any) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const sellers = await adminService.getTopSellers(limit);
    sendSuccess(res, 200, sellers, 'Top sellers retrieved');
  })
);

// @route   GET /api/admin/order-status
// @desc    Get order status distribution
// @access  Private/Admin
router.get(
  '/order-status',
  asyncHandler(async (req: any, res: any) => {
    const distribution = await adminService.getOrderStatusDistribution();
    sendSuccess(res, 200, distribution, 'Order status distribution retrieved');
  })
);

// @route   GET /api/admin/customers
// @desc    Get customer insights
// @access  Private/Admin
router.get(
  '/customers',
  asyncHandler(async (req: any, res: any) => {
    const insights = await adminService.getCustomerInsights();
    sendSuccess(res, 200, insights, 'Customer insights retrieved');
  })
);

// @route   GET /api/admin/verifications
// @desc    Get pending store verifications
// @access  Private/Admin
router.get(
  '/verifications',
  asyncHandler(async (req: any, res: any) => {
    const pending = await adminService.getPendingVerifications();
    sendSuccess(res, 200, pending, 'Pending verifications retrieved');
  })
);

// @route   PUT /api/admin/verify-store/:storeId
// @desc    Verify seller store
// @access  Private/Admin
router.put(
  '/verify-store/:storeId',
  asyncHandler(async (req: any, res: any) => {
    const store = await adminService.verifyStore(req.params.storeId);
    sendSuccess(res, 200, store, 'Store verified successfully');
  })
);

// @route   GET /api/admin/payments
// @desc    Get payment metrics
// @access  Private/Admin
router.get(
  '/payments',
  asyncHandler(async (req: any, res: any) => {
    const metrics = await adminService.getPaymentMetrics();
    sendSuccess(res, 200, metrics, 'Payment metrics retrieved');
  })
);

export default router;
