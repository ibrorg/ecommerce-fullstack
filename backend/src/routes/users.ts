import express, { Response } from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { sendSuccess, sendError, sendPaginatedSuccess } from '../utils/response';
import { apiLimiter, sensitiveLimiter } from '../config/rateLimits';

const router = express.Router();

// Apply general API rate limiting to all user routes
router.use(apiLimiter);

/**
 * @route   GET /api/users/profile
 * @desc    Get current user's profile
 * @access  Private
 */
router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.user!._id).select('-passwordHash');
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    return sendSuccess(res, 200, {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      shippingAddress: user.shippingAddress,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt
    }, 'Profile retrieved successfully');
  })
);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user's profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters'),
    body('phone')
      .optional()
      .trim()
      .isLength({ max: 20 })
      .withMessage('Phone number cannot exceed 20 characters'),

    body('shippingAddress')
      .optional()
      .isObject()
      .withMessage('Shipping address must be an object'),
    body('shippingAddress.address')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Shipping street address cannot exceed 200 characters'),
    body('shippingAddress.city')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Shipping city cannot exceed 100 characters'),
    body('shippingAddress.postalCode')
      .optional()
      .trim()
      .isLength({ max: 30 })
      .withMessage('Shipping postal code cannot exceed 30 characters'),
    body('shippingAddress.country')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Shipping country cannot exceed 100 characters'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, 'Validation failed', errors.array().map((e: { msg: string }) => e.msg));
    }

    const { firstName, lastName, phone, avatar, shippingAddress } = req.body;
    
    const updateFields: Record<string, any> = {};
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (phone !== undefined) updateFields.phone = phone;
    if (avatar !== undefined) updateFields.avatar = avatar;

    if (shippingAddress && typeof shippingAddress === 'object') {
      if (shippingAddress.address !== undefined) updateFields['shippingAddress.address'] = shippingAddress.address;
      if (shippingAddress.city !== undefined) updateFields['shippingAddress.city'] = shippingAddress.city;
      if (shippingAddress.postalCode !== undefined) updateFields['shippingAddress.postalCode'] = shippingAddress.postalCode;
      if (shippingAddress.country !== undefined) updateFields['shippingAddress.country'] = shippingAddress.country;
    }

    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return sendSuccess(res, 200, {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      shippingAddress: user.shippingAddress,
      role: user.role
    }, 'Profile updated successfully');
  })
);

/**
 * @route   PUT /api/users/password
 * @desc    Change user password
 * @access  Private
 */
router.put(
  '/password',
  sensitiveLimiter,
  authenticate,
  [
    body('oldPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, 'Validation failed', errors.array().map((e: { msg: string }) => e.msg));
    }

    const { oldPassword, newPassword } = req.body;
    
    // Get user with password hash
    const user = await User.findById(req.user!._id).select('+passwordHash');
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Verify current password
    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
    }

    // Update password
    await user.setPassword(newPassword);
    await user.save();

    return sendSuccess(res, 200, null, 'Password changed successfully');
  })
);

/**
 * ADMIN ROUTES
 */

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get(
  '/',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const filter: any = { deletedAt: null };
    
    // Filter by role if provided
    if (req.query.role) {
      filter.role = req.query.role;
    }
    
    // Filter by status if provided
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments(filter)
    ]);

    return sendPaginatedSuccess(
      res,
      200,
      users.map(user => ({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      })),
      page,
      limit,
      total,
      'Users retrieved successfully'
    );
  })
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID (admin only)
 * @access  Private/Admin
 */
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.params.id).select('-passwordHash');
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return sendSuccess(res, 200, {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }, 'User retrieved successfully');
  })
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user (admin only)
 * @access  Private/Admin
 */
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 }),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 }),
    body('role')
      .optional()
      .isIn(['buyer', 'seller', 'admin'])
      .withMessage('Invalid role'),
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'suspended'])
      .withMessage('Invalid status'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, 'Validation failed', errors.array().map((e: { msg: string }) => e.msg));
    }

    const { firstName, lastName, role, status, phone } = req.body;
    
    const updateFields: Record<string, string | undefined> = {};
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (role !== undefined) updateFields.role = role;
    if (status !== undefined) updateFields.status = status;
    if (phone !== undefined) updateFields.phone = phone;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return sendSuccess(res, 200, {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status
    }, 'User updated successfully');
  })
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (soft delete, admin only)
 * @access  Private/Admin
 */
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Prevent deleting super_admin users
    if (user.role === 'super_admin') {
      throw new AppError('Cannot delete super admin users', 403, 'FORBIDDEN');
    }

    // Soft delete
    user.status = 'deleted';
    user.deletedAt = new Date();
    await user.save();

    return sendSuccess(res, 200, null, 'User deleted successfully');
  })
);

export default router;