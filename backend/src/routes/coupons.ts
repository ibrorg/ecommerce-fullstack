import express, { Response } from 'express';
import { protect, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import { body, validationResult } from 'express-validator';
import couponService from '../services/couponService';

const router = express.Router();

// @route   POST /api/coupons/validate
// @desc    Validate a coupon for preview (buyer)
// @access  Private
router.post(
  '/validate',
  protect,
  asyncHandler(async (req: any, res: Response) => {
    const { code, itemsPrice, categories } = req.body;
    if (!code || typeof itemsPrice !== 'number') {
      return sendError(res, 400, 'Coupon code and itemsPrice are required');
    }
    const result = await couponService.validate(
      code,
      itemsPrice,
      req.user._id.toString(),
      categories || []
    );
    return sendSuccess(res, 200, result, result.valid ? 'Coupon is valid' : result.error);
  })
);

// @route   GET /api/coupons
// @desc    List all coupons (admin)
// @access  Private/Admin
router.get(
  '/',
  protect,
  authorize('admin'),
  asyncHandler(async (req: any, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await couponService.list(page, limit);
    sendSuccess(res, 200, result, 'Coupons retrieved');
  })
);

// @route   POST /api/coupons
// @desc    Create a coupon (admin)
// @access  Private/Admin
router.post(
  '/',
  protect,
  authorize('admin'),
  [
    body('code').isLength({ min: 3, max: 30 }).withMessage('Code must be 3-30 chars'),
    body('type').isIn(['percentage', 'flat']).withMessage('Invalid type'),
    body('value').isFloat({ min: 0 }).withMessage('Value must be positive'),
    body('validTo').isISO8601().withMessage('validTo must be a date')
  ],
  asyncHandler(async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }
    const coupon = await couponService.create(req.body);
    sendSuccess(res, 201, coupon, 'Coupon created');
  })
);

// @route   PUT /api/coupons/:id
// @desc    Update a coupon (admin)
// @access  Private/Admin
router.put(
  '/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req: any, res: Response) => {
    const coupon = await couponService.update(req.params.id, req.body);
    sendSuccess(res, 200, coupon, 'Coupon updated');
  })
);

// @route   DELETE /api/coupons/:id
// @desc    Delete a coupon (admin)
// @access  Private/Admin
router.delete(
  '/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req: any, res: Response) => {
    await couponService.delete(req.params.id);
    sendSuccess(res, 200, null, 'Coupon deleted');
  })
);

export default router;
