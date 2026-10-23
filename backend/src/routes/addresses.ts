import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { protect } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { sendSuccess, sendValidationError } from '../utils/response';
import addressService from '../services/addressService';

const router = express.Router();

// every address route requires an authenticated user
router.use(protect);

const addressValidation = [
  body('fullName').notEmpty().withMessage('Recipient name is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('line1').notEmpty().withMessage('Address line 1 is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('postalCode').notEmpty().withMessage('Postal code is required')
];

// @route   GET /api/addresses
// @desc    List all saved addresses for the user
// @access  Private
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const addresses = await addressService.list(req.userId!);
    sendSuccess(res, 200, addresses, 'Addresses retrieved');
  })
);

// @route   POST /api/addresses
// @desc    Create a new saved address
// @access  Private
router.post(
  '/',
  addressValidation,
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array().map((e) => e.msg));
    }
    const address = await addressService.create(req.userId!, req.body);
    sendSuccess(res, 201, address, 'Address saved');
  })
);

// @route   GET /api/addresses/:id
// @desc    Get a single address
// @access  Private
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const address = await addressService.getById(req.userId!, req.params.id);
    sendSuccess(res, 200, address);
  })
);

// @route   PUT /api/addresses/:id
// @desc    Update a saved address
// @access  Private
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const address = await addressService.update(req.userId!, req.params.id, req.body);
    sendSuccess(res, 200, address, 'Address updated');
  })
);

// @route   DELETE /api/addresses/:id
// @desc    Delete a saved address
// @access  Private
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await addressService.remove(req.userId!, req.params.id);
    sendSuccess(res, 200, null, 'Address removed');
  })
);

// @route   PUT /api/addresses/:id/default-shipping
// @desc    Mark an address as the default shipping address
// @access  Private
router.put(
  '/:id/default-shipping',
  asyncHandler(async (req: Request, res: Response) => {
    const address = await addressService.setDefaultShipping(req.userId!, req.params.id);
    sendSuccess(res, 200, address, 'Default shipping address updated');
  })
);

// @route   PUT /api/addresses/:id/default-billing
// @desc    Mark an address as the default billing address
// @access  Private
router.put(
  '/:id/default-billing',
  asyncHandler(async (req: Request, res: Response) => {
    const address = await addressService.setDefaultBilling(req.userId!, req.params.id);
    sendSuccess(res, 200, address, 'Default billing address updated');
  })
);

export default router;
