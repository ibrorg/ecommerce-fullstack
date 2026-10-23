import express from 'express';
import {
  createOrder,
  getOrderById,
  updateOrderToPaid,
  getMyOrders,
  getOrders,
  updateOrderToDelivered,
  updateOrderStatus,
  cancelOrder,
  orderValidation,
  createCheckoutSession,
  stripeWebhook,
  verifyPayment
} from '../controllers/orderController';
import { protect, authorize } from '../middleware/auth';
import { idempotencyMiddleware } from '../middleware/idempotency';

const router = express.Router();

// @route   POST /api/orders/webhook
// @desc    Stripe webhook (must be before body parser)
// @access  Public (Stripe)
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// @route   POST /api/orders
// @desc    Create new order (supports Idempotency-Key header)
// @access  Private
router.post('/', protect, idempotencyMiddleware, orderValidation, createOrder);

// @route   GET /api/orders/myorders
// @desc    Get logged in user orders
// @access  Private
router.get('/myorders', protect, getMyOrders);

// @route   GET /api/orders
// @desc    Get all orders (Admin only)
// @access  Private/Admin
router.get('/', protect, authorize('admin'), getOrders);

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', protect, getOrderById);

// @route   PUT /api/orders/:id/pay
// @desc    Update order to paid
// @access  Private
router.put('/:id/pay', protect, updateOrderToPaid);

// @route   POST /api/orders/:id/create-checkout-session
// @desc    Create Stripe checkout session
// @access  Private
router.post('/:id/create-checkout-session', protect, createCheckoutSession);

// @route   POST /api/orders/:id/verify-payment
// @desc    Verify Stripe payment
// @access  Private
router.post('/:id/verify-payment', protect, verifyPayment);

// @route   PUT /api/orders/:id/deliver
// @desc    Update order to delivered (Admin only)
// @access  Private/Admin
router.put('/:id/deliver', protect, authorize('admin'), updateOrderToDelivered);

// @route   PUT /api/orders/:id/status
// @desc    Update order status (Admin only)
// @access  Private/Admin
router.put('/:id/status', protect, authorize('admin'), updateOrderStatus);

// @route   PUT /api/orders/:id/cancel
// @desc    Cancel order
// @access  Private
router.put('/:id/cancel', protect, cancelOrder);

// @route   POST /api/orders/:id/convert-reservations
// @desc    Convert checkout reservations to 'converted' after order placed
// @access  Private
router.post('/:id/convert-reservations', protect, async (req: any, res: any) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId required' });
  }
  try {
    const reservationService = (await import('../services/reservationService')).default;
    await reservationService.convertBySession(sessionId);
    res.json({ success: true, message: 'Reservations converted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @route   GET /api/orders/:id/invoice
// @desc    Download PDF invoice for an order (owner or admin only)
// @access  Private
router.get('/:id/invoice', protect, async (req: any, res: any) => {
  try {
    const pdfService = (await import('../services/pdfService')).default;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const pdfBuffer = await pdfService.generateInvoiceForUser(
      req.params.id,
      req.user._id.toString(),
      isAdmin
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

// @route   GET /api/orders/:id/invoice/gst
// @desc    Download GST-compliant PDF invoice (Indian tax format)
// @access  Private
router.get('/:id/invoice/gst', protect, async (req: any, res: any) => {
  try {
    const pdfService = (await import('../services/pdfService')).default;
    const Order = (await import('../models/Order')).default;
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isAdmin && order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const sellerState = process.env.SELLER_STATE || 'Maharashtra';
    const sellerGstin = process.env.SELLER_GSTIN || '27ABCDE1234F1Z5';
    const pdfBuffer = await pdfService.generateGSTInvoice(order, sellerState, sellerGstin);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="gst-invoice-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

export default router;