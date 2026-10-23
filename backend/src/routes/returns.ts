import express, { Response } from 'express';
import { protect, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import { body, validationResult } from 'express-validator';
import returnService from '../services/returnService';

const router = express.Router();

// @route   POST /api/returns
// @desc    Buyer creates a return request
// @access  Private
router.post(
  '/',
  protect,
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('reason').notEmpty().isLength({ max: 500 }).withMessage('Reason required (max 500 chars)')
  ],
  asyncHandler(async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }

    const returnRequest = await returnService.createReturn(
      req.user._id.toString(),
      req.body.orderId,
      req.body.items,
      req.body.reason,
      req.body.photos || []
    );
    sendSuccess(res, 201, returnRequest, 'Return request created');
  })
);

// @route   GET /api/returns/my-returns
// @desc    Buyer gets their return requests
// @access  Private
router.get(
  '/my-returns',
  protect,
  asyncHandler(async (req: any, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await returnService.getUserReturns(req.user._id.toString(), page, limit);
    sendSuccess(res, 200, result, 'Returns retrieved');
  })
);

// @route   PUT /api/returns/:id/cancel
// @desc    Buyer cancels their return
// @access  Private
router.put(
  '/:id/cancel',
  protect,
  asyncHandler(async (req: any, res: Response) => {
    const result = await returnService.cancelReturn(req.params.id, req.user._id.toString());
    sendSuccess(res, 200, result, 'Return cancelled');
  })
);

// @route   GET /api/returns
// @desc    Admin gets all return requests
// @access  Private/Admin
router.get(
  '/',
  protect,
  authorize('admin'),
  asyncHandler(async (req: any, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const result = await returnService.getAllReturns(page, limit, status);
    sendSuccess(res, 200, result, 'Returns retrieved');
  })
);

// @route   PUT /api/returns/:id/approve
// @desc    Admin approves a return (triggers refund + stock reversal)
// @access  Private/Admin
router.put(
  '/:id/approve',
  protect,
  authorize('admin'),
  asyncHandler(async (req: any, res: Response) => {
    const result = await returnService.approveReturn(
      req.params.id,
      req.user._id.toString(),
      req.body.refundAmount
    );
    sendSuccess(res, 200, result, 'Return approved and refund processed');
  })
);

// @route   PUT /api/returns/:id/reject
// @desc    Admin rejects a return
// @access  Private/Admin
router.put(
  '/:id/reject',
  protect,
  authorize('admin'),
  [
    body('adminNotes').notEmpty().withMessage('Rejection reason required')
  ],
  asyncHandler(async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }
    const result = await returnService.rejectReturn(
      req.params.id,
      req.user._id.toString(),
      req.body.adminNotes
    );
    sendSuccess(res, 200, result, 'Return rejected');
  })
);

export default router;
