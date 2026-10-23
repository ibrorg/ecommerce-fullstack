import express, { Response } from 'express';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import { body, validationResult } from 'express-validator';
import cartService from '../services/cartService';

const router = express.Router();

// All cart routes require auth
router.use(protect);

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get(
  '/',
  asyncHandler(async (req: any, res: Response) => {
    const cart = await cartService.getCart(req.user._id.toString());
    sendSuccess(res, 200, cart, 'Cart retrieved');
  })
);

// @route   POST /api/cart/items
// @desc    Add item to cart
// @access  Private
router.post(
  '/items',
  [
    body('productId').notEmpty().withMessage('productId required'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('quantity must be >= 1')
  ],
  asyncHandler(async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }
    const cart = await cartService.addItem(
      req.user._id.toString(),
      req.body.productId,
      req.body.quantity || 1
    );
    sendSuccess(res, 200, cart, 'Item added to cart');
  })
);

// @route   PUT /api/cart/items/:productId
// @desc    Update item quantity
// @access  Private
router.put(
  '/items/:productId',
  [body('quantity').isInt({ min: 1 }).withMessage('quantity must be >= 1')],
  asyncHandler(async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }
    const cart = await cartService.updateQuantity(
      req.user._id.toString(),
      req.params.productId,
      req.body.quantity
    );
    sendSuccess(res, 200, cart, 'Quantity updated');
  })
);

// @route   DELETE /api/cart/items/:productId
// @desc    Remove item from cart
// @access  Private
router.delete(
  '/items/:productId',
  asyncHandler(async (req: any, res: Response) => {
    const cart = await cartService.removeItem(
      req.user._id.toString(),
      req.params.productId
    );
    sendSuccess(res, 200, cart, 'Item removed');
  })
);

// @route   POST /api/cart/merge
// @desc    Merge guest cart (localStorage) into server cart on login
// @access  Private
router.post(
  '/merge',
  [body('items').isArray().withMessage('items must be an array')],
  asyncHandler(async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }
    const cart = await cartService.mergeGuestCart(
      req.user._id.toString(),
      req.body.items
    );
    sendSuccess(res, 200, cart, 'Cart merged');
  })
);

// @route   DELETE /api/cart
// @desc    Clear cart
// @access  Private
router.delete(
  '/',
  asyncHandler(async (req: any, res: Response) => {
    await cartService.clearCart(req.user._id.toString());
    sendSuccess(res, 200, null, 'Cart cleared');
  })
);

export default router;
