import express, { Response } from 'express';
import { protect, authorize } from '../middleware/auth';
import sellerService from '../services/sellerService';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// @route   POST /api/sellers/register
// @desc    Register as seller with GST details
// @access  Private (requires user to be logged in)
router.post(
  '/register',
  protect,
  asyncHandler(async (req: any, res: Response) => {
    const {
      storeName,
      businessType,
      description,
      gstNumber,
      pan,
      businessAddress,
      city,
      state,
      zipCode,
      phone,
      bankAccountNumber,
      ifscCode,
      bankName,
    } = req.body;

    // Validate required fields
    if (
      !storeName ||
      !businessType ||
      !description ||
      !gstNumber ||
      !pan ||
      !businessAddress ||
      !city ||
      !state ||
      !phone ||
      !bankAccountNumber ||
      !ifscCode ||
      !bankName
    ) {
      return sendError(res, 400, 'All fields are required');
    }

    try {
      // Create store with seller details
      const storeData = {
        name: storeName,
        description,
        businessType,
        gstNumber,
        pan,
        owner: req.user._id,
        email: req.user.email,
        phone,
        address: {
          street: businessAddress,
          city,
          state,
          country: 'India',
          zipCode,
        },
        bankDetails: {
          accountNumber: bankAccountNumber,
          ifscCode,
          bankName,
          accountName: req.user.getFullName 
            ? req.user.getFullName() 
            : `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
        },
      };

      // Use existing createStore method
      const store = await sellerService.createStore(req.user._id.toString(), storeData);

      // Update user role to seller
      await require('../models/User').default.findByIdAndUpdate(
        req.user._id,
        { role: 'seller' },
        { new: true }
      );

      return sendSuccess(
        res,
        201,
        { store, message: 'Seller registration completed successfully!' },
        'Registered as seller'
      );
    } catch (err: any) {
      return sendError(res, 400, err.message || 'Error registering as seller');
    }
  })
);

// @route   POST /api/seller/store
// @desc    Create seller store
// @access  Private
router.post(
  '/store',
  protect,
  asyncHandler(async (req: any, res: Response) => {
    const store = await sellerService.createStore(req.user._id.toString(), req.body);
    sendSuccess(res, 201, store, 'Store created successfully');
  })
);

// @route   GET /api/seller/store
// @desc    Get my store
// @access  Private
router.get(
  '/store',
  protect,
  asyncHandler(async (req: any, res: Response) => {
    const store = await sellerService.getStore(req.user._id.toString());
    sendSuccess(res, 200, store, 'Store retrieved');
  })
);

// @route   PUT /api/seller/store
// @desc    Update my store
// @access  Private/Seller
router.put(
  '/store',
  protect,
  authorize('seller', 'admin'),
  asyncHandler(async (req: any, res: Response) => {
    const store = await sellerService.updateStore(req.user._id.toString(), req.body);
    sendSuccess(res, 200, store, 'Store updated successfully');
  })
);

// @route   GET /api/seller/products
// @desc    Get my products
// @access  Private/Seller
router.get(
  '/products',
  protect,
  authorize('seller', 'admin'),
  asyncHandler(async (req: any, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const result = await sellerService.getSellerProducts(
      req.user._id.toString(),
      page,
      limit
    );
    sendSuccess(res, 200, result, 'Products retrieved');
  })
);

// @route   POST /api/seller/products
// @desc    Create a product as a seller
// @access  Private/Seller
router.post(
  '/products',
  protect,
  authorize('seller'),
  asyncHandler(async (req: any, res: Response) => {
    const product = await sellerService.createSellerProduct(
      req.user._id.toString(),
      req.body
    );
    sendSuccess(res, 201, product, 'Product created');
  })
);

// @route   DELETE /api/seller/products/:id
// @desc    Delete (soft) a product owned by the seller
// @access  Private/Seller
router.delete(
  '/products/:id',
  protect,
  authorize('seller'),
  asyncHandler(async (req: any, res: Response) => {
    const product = await sellerService.deleteSellerProduct(
      req.user._id.toString(),
      req.params.id
    );
    sendSuccess(res, 200, product, 'Product deleted');
  })
);

// @route   GET /api/seller/orders
// @desc    Get my orders
// @access  Private/Seller
router.get(
  '/orders',
  protect,
  authorize('seller', 'admin'),
  asyncHandler(async (req: any, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const result = await sellerService.getSellerOrders(
      req.user._id.toString(),
      page,
      limit
    );
    sendSuccess(res, 200, result, 'Orders retrieved');
  })
);

// @route   GET /api/seller/earnings
// @desc    Get my earnings
// @access  Private/Seller
router.get(
  '/earnings',
  protect,
  authorize('seller', 'admin'),
  asyncHandler(async (req: any, res: Response) => {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const earnings = await sellerService.getSellerEarnings(
      req.user._id.toString(),
      startDate,
      endDate
    );
    sendSuccess(res, 200, earnings, 'Earnings retrieved');
  })
);

// @route   GET /api/seller/dashboard
// @desc    Get seller dashboard
// @access  Private/Seller
router.get(
  '/dashboard',
  protect,
  authorize('seller', 'admin'),
  asyncHandler(async (req: any, res: Response) => {
    const dashboard = await sellerService.getSellerDashboard(req.user._id.toString());
    sendSuccess(res, 200, dashboard, 'Dashboard retrieved');
  })
);

// @route   POST /api/seller/withdraw
// @desc    Request withdrawal
// @access  Private/Seller
router.post(
  '/withdraw',
  protect,
  authorize('seller'),
  asyncHandler(async (req: any, res: Response) => {
    const { amount, bankDetails } = req.body;
    const withdrawal = await sellerService.requestWithdrawal(
      req.user._id.toString(),
      amount,
      bankDetails
    );
    sendSuccess(res, 201, withdrawal, 'Withdrawal requested');
  })
);

// @route   GET /api/seller/withdrawals
// @desc    Get withdrawal history
// @access  Private/Seller
router.get(
  '/withdrawals',
  protect,
  authorize('seller'),
  asyncHandler(async (req: any, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const result = await sellerService.getWithdrawals(
      req.user._id.toString(),
      page,
      limit
    );
    sendSuccess(res, 200, result, 'Withdrawals retrieved');
  })
);

// @route   GET /api/seller/store/:slug
// @desc    Get public store profile
// @access  Public
router.get(
  '/store/:slug',
  asyncHandler(async (req: any, res: Response) => {
    const store = await sellerService.getPublicStore(req.params.slug);
    sendSuccess(res, 200, store, 'Store profile retrieved');
  })
);

// @route   POST /api/seller/follow/:storeId
// @desc    Follow/Unfollow store
// @access  Private
router.post(
  '/follow/:storeId',
  protect,
  asyncHandler(async (req: any, res: Response) => {
    const result = await sellerService.toggleFollowStore(
      req.user._id.toString(),
      req.params.storeId
    );
    sendSuccess(res, 200, result, result.following ? 'Store followed' : 'Store unfollowed');
  })
);

export default router;
