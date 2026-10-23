import express, { Response } from 'express';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import wishlistService from '../services/wishlistService';
import { Request } from 'express';

const router = express.Router();

// All wishlist routes require auth
router.use(protect);

// @route   GET /api/wishlist
// @desc    Get user's wishlist (creates one if missing)
// @access  Private
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const wishlist = await wishlistService.getWishlist(req.userId!);
    sendSuccess(res, 200, wishlist, 'Wishlist retrieved');
  })
);

// @route   POST /api/wishlist/:productId
// @desc    Add product to wishlist (idempotent — duplicates ignored)
// @access  Private
router.post(
  '/:productId',
  asyncHandler(async (req: Request, res: Response) => {
    const wishlist = await wishlistService.addItem(
      req.userId!,
      req.params.productId
    );
    sendSuccess(res, 200, wishlist, 'Product added to wishlist');
  })
);

// @route   DELETE /api/wishlist/:productId
// @desc    Remove product from wishlist
// @access  Private
router.delete(
  '/:productId',
  asyncHandler(async (req: Request, res: Response) => {
    const wishlist = await wishlistService.removeItem(
      req.userId!,
      req.params.productId
    );
    sendSuccess(res, 200, wishlist, 'Product removed from wishlist');
  })
);

// @route   DELETE /api/wishlist
// @desc    Clear all items from wishlist
// @access  Private
router.delete(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    await wishlistService.clearWishlist(req.userId!);
    sendSuccess(res, 200, null, 'Wishlist cleared');
  })
);

export default router;
