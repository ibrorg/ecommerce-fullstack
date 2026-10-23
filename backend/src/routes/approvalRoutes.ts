import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ApprovalService } from '../services/ApprovalService';
import { ApprovalRequest, ApprovalStatus } from '../models/ApprovalRequest';
import { PermissionService } from '../services/PermissionService';
import { authenticate, requireRole, requireCapability } from '../middleware/auth';

/**
 * Approval Routes
 * 
 * Admin endpoints for managing approval workflows
 * All endpoints require authentication + admin role + specific capabilities
 * 
 * Public endpoints: None (all require admin:approve-actions)
 * Protected endpoints:
 * - GET /admin/approvals - List pending approvals
 * - GET /admin/approvals/:id - Get approval details
 * - POST /admin/approvals/:id/approve - Approve request
 * - POST /admin/approvals/:id/reject - Reject request
 * - GET /admin/approvals/user/:userId - Get user's approval requests
 * - POST /admin/approvals/:id/cancel - Cancel pending request (admin only)
 */

const router = Router();

/**
 * Middleware: Check for admin:approve-actions capability
 * Applied to all approval routes
 */
const requireApprovalPermission = (
  req: Request & { user?: any; userId?: string },
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!PermissionService.hasCapability(req.user, 'admin:approve-actions')) {
    res.status(403).json({
      error: 'Permission denied: requires admin:approve-actions capability',
    });
    return;
  }

  next();
};

// ==================== GET /admin/approvals ====================
/**
 * List pending approval requests
 * 
 * Query parameters:
 * - action: Filter by approval action type (optional)
 * - priority: Filter by priority (low, normal, high, critical)
 * - limit: Max results (default 50, max 500)
 * - sort: Sort order (createdAt, priority) (default: priority desc, then createdAt asc)
 * 
 * Response: Array of approval requests with populated approver details
 * 
 * Examples:
 * GET /admin/approvals
 * GET /admin/approvals?priority=critical&limit=20
 * GET /admin/approvals?action=SELLER_VERIFICATION&limit=50
 */
router.get(
  '/',
  authenticate,
  requireRole('admin', 'super_admin'),
  requireApprovalPermission,
  async (req: Request & { user?: any }, res: Response): Promise<void> => {
    try {
      const {
        action,
        priority,
        limit = '50',
      } = req.query;

      // Validate limit
      const limitNum = Math.min(parseInt(limit as string) || 50, 500);
      if (limitNum < 1) {
        res.status(400).json({ error: 'Invalid limit' });
        return;
      }

      // Get pending approvals with optional filters
      const filters: any = {};
      if (action && typeof action === 'string') {
        filters.action = action;
      }
      if (priority && typeof priority === 'string') {
        filters.priority = priority;
      }
      filters.limit = limitNum;

      const approvals = await ApprovalService.getPendingApprovals(filters);

      // Log this query
      // await AuditLogService.log(
      //   AuditActionEnum.ADMIN_ACTION,
      //   ResourceType.APPROVAL,
      //   null,
      //   req.user._id,
      //   req,
      //   undefined,
      //   { action: 'LIST_APPROVALS', filters }
      // );

      res.json({
        data: approvals,
        count: approvals.length,
        limit: limitNum,
      });
    } catch (error: any) {
      console.error('Error fetching approvals:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch approvals' });
    }
  }
);

// ==================== GET /admin/approvals/:id ====================
/**
 * Get detailed view of a specific approval request
 * 
 * Path parameters:
 * - id: Approval request ID (MongoDB ObjectId)
 * 
 * Response: Full approval request with populated user details
 * 
 * Example:
 * GET /admin/approvals/507f1f77bcf86cd799439011
 */
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'super_admin'),
  requireApprovalPermission,
  async (req: Request & { user?: any }, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid approval ID format' });
        return;
      }

      const approval = await ApprovalService.getApprovalById(id);
      if (!approval) {
        res.status(404).json({ error: 'Approval request not found' });
        return;
      }

      res.json(approval);
    } catch (error: any) {
      console.error('Error fetching approval:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch approval' });
    }
  }
);

// ==================== POST /admin/approvals/:id/approve ====================
/**
 * Approve an approval request
 * 
 * Path parameters:
 * - id: Approval request ID
 * 
 * Body parameters:
 * - reason: Approval notes/reason (optional, default: "Approved")
 * 
 * Response: Updated approval request with new approval decision recorded
 * 
 * Behavior:
 * - For single-approval requests: Immediately transitions to APPROVED
 * - For multi-approval requests: Records this approver's decision
 *   - If all required approvals received: Transitions to APPROVED
 *   - Otherwise: Stays PENDING awaiting other approvals
 * - Same approver cannot approve twice (returns 400)
 * - Cannot approve already approved/rejected requests (returns 400)
 * 
 * Example:
 * POST /admin/approvals/507f1f77bcf86cd799439011/approve
 * {
 *   "reason": "Seller meets all KYC requirements"
 * }
 */
router.post(
  '/:id/approve',
  authenticate,
  requireRole('admin', 'super_admin'),
  requireApprovalPermission,
  async (req: Request & { user?: any }, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason = 'Approved' } = req.body;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid approval ID format' });
        return;
      }

      // Validate reason
      if (typeof reason !== 'string' || reason.trim() === '') {
        res.status(400).json({ error: 'Reason must be a non-empty string' });
        return;
      }

      // Approve the request
      const updated = await ApprovalService.approveApprovalRequest(
        id,
        req.user._id,
        reason,
        req
      );

      res.json({
        message: `Approval ${updated.status === ApprovalStatus.APPROVED ? 'completed' : 'recorded'}`,
        data: updated,
      });
    } catch (error: any) {
      console.error('Error approving request:', error);

      // Handle specific error types
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message.includes('Cannot approve')) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message || 'Failed to approve request' });
    }
  }
);

// ==================== POST /admin/approvals/:id/reject ====================
/**
 * Reject an approval request
 * 
 * Path parameters:
 * - id: Approval request ID
 * 
 * Body parameters:
 * - reason: Reason for rejection (required)
 * 
 * Response: Updated approval request with rejection recorded
 * 
 * Behavior:
 * - One rejection immediately fails the entire request
 * - No further approvals can be added after rejection
 * - Cannot reject already approved/rejected requests
 * - Reason is required (no empty rejections)
 * 
 * Example:
 * POST /admin/approvals/507f1f77bcf86cd799439011/reject
 * {
 *   "reason": "KYC documents incomplete. Bank statement is not recent enough."
 * }
 */
router.post(
  '/:id/reject',
  authenticate,
  requireRole('admin', 'super_admin'),
  requireApprovalPermission,
  async (req: Request & { user?: any }, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid approval ID format' });
        return;
      }

      // Validate reason is provided
      if (!reason || typeof reason !== 'string' || reason.trim() === '') {
        res.status(400).json({
          error: 'Rejection reason is required and must be a non-empty string',
        });
        return;
      }

      // Reject the request
      const updated = await ApprovalService.rejectApprovalRequest(
        id,
        req.user._id,
        reason,
        req
      );

      res.json({
        message: 'Approval request rejected',
        data: updated,
      });
    } catch (error: any) {
      console.error('Error rejecting request:', error);

      // Handle specific error types
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message.includes('Cannot reject')) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message || 'Failed to reject request' });
    }
  }
);

// ==================== GET /admin/approvals/user/:userId ====================
/**
 * Get approval requests created by a specific user
 * Useful for showing user their approval history
 * 
 * Path parameters:
 * - userId: ID of the user who created the approval requests
 * 
 * Query parameters:
 * - limit: Max results (default 50, max 500)
 * 
 * Response: Array of approval requests for that user
 * 
 * Example:
 * GET /admin/approvals/user/507f1f77bcf86cd799439011?limit=20
 */
router.get(
  '/user/:userId',
  authenticate,
  requireRole('admin', 'super_admin'),
  requireApprovalPermission,
  async (req: Request & { user?: any }, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { limit = '50' } = req.query;

      // Validate userId format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400).json({ error: 'Invalid user ID format' });
        return;
      }

      // Validate limit
      const limitNum = Math.min(parseInt(limit as string) || 50, 500);
      if (limitNum < 1) {
        res.status(400).json({ error: 'Invalid limit' });
        return;
      }

      const approvals = await ApprovalService.getUserApprovals(userId, limitNum);

      res.json({
        userId,
        data: approvals,
        count: approvals.length,
      });
    } catch (error: any) {
      console.error('Error fetching user approvals:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch user approvals' });
    }
  }
);

// ==================== POST /admin/approvals/:id/cancel ====================
/**
 * Cancel a pending approval request
 * Only super_admin can cancel requests created by others
 * Can only cancel PENDING requests
 * 
 * Path parameters:
 * - id: Approval request ID
 * 
 * Body parameters:
 * - reason: Reason for cancellation (required)
 * 
 * Response: Updated approval request with status CANCELLED
 * 
 * Example:
 * POST /admin/approvals/507f1f77bcf86cd799439011/cancel
 * {
 *   "reason": "User requested cancellation"
 * }
 */
router.post(
  '/:id/cancel',
  authenticate,
  requireRole('super_admin'), // Only super_admin can cancel
  async (req: Request & { user?: any }, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ error: 'Invalid approval ID format' });
        return;
      }

      // Validate reason
      if (!reason || typeof reason !== 'string' || reason.trim() === '') {
        res.status(400).json({ error: 'Cancellation reason is required' });
        return;
      }

      const updated = await ApprovalService.cancelApprovalRequest(
        id,
        reason,
        req.user._id,
        req
      );

      res.json({
        message: 'Approval request cancelled',
        data: updated,
      });
    } catch (error: any) {
      console.error('Error cancelling request:', error);

      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message.includes('Cannot cancel')) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message || 'Failed to cancel request' });
    }
  }
);

export default router;
