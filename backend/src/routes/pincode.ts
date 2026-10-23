import express, { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import pincodeService from '../services/pincodeService';

const router = express.Router();

// @route   GET /api/pincode/:code/serviceable
// @desc    Check if a pincode is serviceable for delivery
// @access  Public
router.get(
  '/:code/serviceable',
  asyncHandler(async (req: any, res: Response) => {
    const result = pincodeService.checkServiceability(req.params.code);
    sendSuccess(res, 200, result, result.serviceable ? 'Serviceable' : 'Not serviceable');
  })
);

// @route   GET /api/pincode/:code/cod-eligible
// @desc    Check COD eligibility for a pincode and order amount
// @access  Public
router.get(
  '/:code/cod-eligible',
  asyncHandler(async (req: any, res: Response) => {
    const amount = parseFloat(req.query.amount as string) || 0;
    const result = pincodeService.isCodEligible(req.params.code, amount);
    sendSuccess(res, 200, result, result.eligible ? 'COD eligible' : result.reason || 'Not eligible');
  })
);

export default router;
