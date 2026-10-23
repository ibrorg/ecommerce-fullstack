import express, { Response } from 'express';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import { body, validationResult } from 'express-validator';
import reservationService from '../services/reservationService';
import crypto from 'crypto';

const router = express.Router();

// @route   POST /api/reservations/session
// @desc    Generate a checkout session ID for reservations
// @access  Private
router.post(
  '/session',
  protect,
  asyncHandler(async (req: any, res: Response) => {
    const sessionId = crypto.randomUUID();
    sendSuccess(res, 200, { sessionId }, 'Reservation session created');
  })
);

// @route   POST /api/reservations/hold
// @desc    Hold stock for items during checkout
// @access  Private
router.post(
  '/hold',
  protect,
  [
    body('sessionId').notEmpty().withMessage('Session ID required'),
    body('items').isArray({ min: 1 }).withMessage('Items required')
  ],
  asyncHandler(async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }

    const { sessionId, items } = req.body;
    const userId = req.user._id.toString();

    const reservations = [];
    for (const item of items) {
      const reservation = await reservationService.hold(
        userId,
        item.productId,
        item.quantity,
        sessionId
      );
      reservations.push(reservation);
    }

    sendSuccess(res, 201, reservations, 'Stock reserved for 10 minutes');
  })
);

// @route   GET /api/reservations/session/:sessionId
// @desc    Get active reservations for a session
// @access  Private
router.get(
  '/session/:sessionId',
  protect,
  asyncHandler(async (req: any, res: Response) => {
    const reservations = await reservationService.getSessionReservations(
      req.params.sessionId
    );
    sendSuccess(res, 200, reservations, 'Reservations retrieved');
  })
);

// @route   DELETE /api/reservations/session/:sessionId
// @desc    Release all reservations for a session (checkout abandoned)
// @access  Private
router.delete(
  '/session/:sessionId',
  protect,
  asyncHandler(async (req: any, res: Response) => {
    await reservationService.releaseBySession(req.params.sessionId);
    sendSuccess(res, 200, null, 'Reservations released');
  })
);

// @route   GET /api/reservations/available/:productId
// @desc    Get available stock (countInStock - active reservations)
// @access  Public
router.get(
  '/available/:productId',
  asyncHandler(async (req: any, res: Response) => {
    const available = await reservationService.getAvailableStock(
      req.params.productId
    );
    sendSuccess(res, 200, { available }, 'Available stock retrieved');
  })
);

export default router;
