import express, { Response } from 'express';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import razorpayService from '../services/razorpayService';

const router = express.Router();

// All routes require auth
router.use(protect);

// @route   POST /api/razorpay/create-order/:orderId
// @desc    Create a Razorpay order for payment
// @access  Private
router.post(
  '/create-order/:orderId',
  asyncHandler(async (req: any, res: Response) => {
    const result = await razorpayService.createOrder(req.params.orderId);
    sendSuccess(res, 200, result, 'Razorpay order created');
  })
);

// @route   POST /api/razorpay/verify/:orderId
// @desc    Verify Razorpay payment signature and mark order paid
// @access  Private
router.post(
  '/verify/:orderId',
  asyncHandler(async (req: any, res: Response) => {
    const { razorpayOrderId, razorpayPaymentId, signature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !signature) {
      return sendError(res, 400, 'razorpayOrderId, razorpayPaymentId, and signature are required');
    }

    const order = await razorpayService.verifyAndCapture(
      req.params.orderId,
      razorpayOrderId,
      razorpayPaymentId,
      signature
    );

    sendSuccess(res, 200, order, 'Payment verified successfully');
  })
);

export default router;
