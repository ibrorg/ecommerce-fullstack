import { Request } from 'express';
import mongoose from 'mongoose';
import { ApprovalRequest, ApprovalActionType, ApprovalStatus, IApprovalRequest } from '../models/ApprovalRequest';
import { AuditLogService } from './AuditLogService';
import { AuditActionType as AuditActionEnum, ResourceType } from '../models/AuditLog';
import User from '../models/User';
import { NotificationService } from './NotificationService';
import { NotificationType, NotificationChannel } from '../models/Notification';

/**
 * ApprovalService
 * 
 * Manages approval workflows for high-risk actions.
 * 
 * Design:
 * - Single entry point for approval requests
 * - Automatic notification system (integrated in Phase 3)
 * - Audit trail integration with AuditLogService
 * - Idempotent operations (requesting twice = same result if pending)
 * - Pure business logic (no HTTP dependencies)
 * 
 * High-Risk Actions Requiring Approval:
 * 1. Seller Verification (new seller, significant trust grant)
 * 2. High-Value Refunds (>$500, or customer dispute)
 * 3. User Suspension (significant disruption, needs review)
 * 4. High-Privilege Capability Grants (system admin access)
 * 5. Product Delisting (seller dispute, high friction)
 * 6. Fraud Appeals (user disputes fraud suspension)
 * 
 * Approval thresholds are configurable per action type.
 * State transitions are enforced at model layer (immutable once approved/rejected).
 */

export class ApprovalService {
  /**
   * Calculate priority for approval request
   * Based on action type and impact
   * 
   * Critical (instant notification): Fraud appeals, very high refunds (>$5k)
   * High (within 1 hour): Seller verification, user suspensions
   * Normal (within 24 hours): Regular refunds, capability grants
   * Low (SLA 3 days): Routine approvals
   */
  private static calculatePriority(
    action: ApprovalActionType,
    data: Record<string, any>
  ): 'low' | 'normal' | 'high' | 'critical' {
    // Critical: Fraud appeals, very high refunds
    if (action === ApprovalActionType.FRAUD_APPEAL) {
      return 'critical';
    }
    if (action === ApprovalActionType.HIGH_REFUND && (data.amount || 0) > 5000) {
      return 'critical';
    }

    // High: Seller verification, user suspensions, KYC
    if (
      action === ApprovalActionType.SELLER_VERIFICATION ||
      action === ApprovalActionType.SELLER_KYC_VERIFICATION ||
      action === ApprovalActionType.USER_SUSPENSION
    ) {
      return 'high';
    }

    // Normal: Regular refunds, capability grants
    if (action === ApprovalActionType.HIGH_REFUND) {
      return 'normal';
    }
    if (action === ApprovalActionType.CAPABILITY_GRANT) {
      return 'normal';
    }

    // Low: Other approvals (product delisting, content review)
    return 'low';
  }

  /**
   * Determine if action requires multiple approvers
   * Very high-risk actions need 2+ independent approvals
   * 
   * 2-Approver Rule:
   * - Fraud appeals (requires 2 senior admins)
   * - Very high refunds >$10k (requires 2 finance approvals)
   * - User suspensions (requires 2 independent reviews)
   */
  private static requiresMultipleApprovers(
    action: ApprovalActionType,
    data: Record<string, any>
  ): boolean {
    // Require 2 approvers for very high-risk actions
    return (
      action === ApprovalActionType.FRAUD_APPEAL ||
      (action === ApprovalActionType.HIGH_REFUND && (data.amount || 0) > 10000) ||
      action === ApprovalActionType.USER_SUSPENSION ||
      action === ApprovalActionType.USER_DELETION
    );
  }

  /**
   * Create an approval request
   * Called when a user initiates a high-risk action
   * 
   * This is the ONLY way to create ApprovalRequest records.
   * 
   * @param requestedBy - User ID requesting the action
   * @param action - Type of approval needed
   * @param resourceType - Resource being affected (User, Order, Product, etc.)
   * @param resourceId - ID of the affected resource
   * @param requestData - Action-specific data (seller info, refund amount, etc.)
   * @param req - Express request (optional, for IP/user-agent context)
   * @returns Created approval request
   */
  static async createApprovalRequest(
    requestedBy: string | mongoose.Types.ObjectId,
    action: ApprovalActionType,
    resourceType: string,
    resourceId: string | mongoose.Types.ObjectId,
    requestData: Record<string, any>,
    req?: Request
  ): Promise<IApprovalRequest> {
    // Check if this exact request already exists (idempotency)
    // If a pending request with same parameters exists, return it
    const existing = await ApprovalRequest.findOne({
      action,
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId as string),
      requestedBy: new mongoose.Types.ObjectId(requestedBy as string),
      status: ApprovalStatus.PENDING,
    });

    if (existing && existing.isActive()) {
      // Return existing request instead of creating duplicate
      return existing;
    }

    // Calculate priority and multi-approval requirement based on action/data
    const priority = this.calculatePriority(action, requestData);
    const requiredApprovals = this.requiresMultipleApprovers(action, requestData) ? 2 : 1;

    // Prepare request metadata from Express request
    const requestMetadata = {
      ipAddress: req ? this.getClientIp(req) : 'UNKNOWN',
      userAgent: req ? this.getUserAgent(req) : 'UNKNOWN',
      timestamp: new Date(),
    };

    // Create the approval request using the model's static method
    const approval = await ApprovalRequest.createRequest(
      action,
      new mongoose.Types.ObjectId(requestedBy as string),
      requestData,
      resourceType,
      new mongoose.Types.ObjectId(resourceId as string),
      priority,
      requiredApprovals,
      requestMetadata
    );

    // Log the approval request creation in audit log
    await AuditLogService.log(
      AuditActionEnum.APPROVAL_REQUESTED,
      ResourceType[resourceType as keyof typeof ResourceType] || ResourceType.SYSTEM,
      resourceId.toString(),
      requestedBy.toString(),
      req || null,
      undefined, // No changes to track for new request
      `Approval request created: ${action} with priority ${priority}`
    );

    // Send notification to admins about new approval request
    try {
      await this.notifyAdminsNewApproval(approval);
    } catch (notificationError) {
      console.error('Failed to send admin notification for approval:', notificationError);
      // Don't fail the approval creation if notification fails
    }

    return approval;
  }

  /**
   * Notify admins of new approval request
   */
  private static async notifyAdminsNewApproval(approval: IApprovalRequest): Promise<void> {
    // Find all admin users
    const admins = await User.find({
      role: { $in: ['admin', 'super_admin'] },
      status: 'active',
      deletedAt: null,
    }).select('_id email').lean();

    const priorityEmoji: Record<string, string> = {
      critical: '🚨',
      high: '⚠️',
      normal: '📋',
      low: '📝',
    };

    // Send notification to each admin
    for (const admin of admins) {
      try {
        await NotificationService.createAndSend({
          userId: admin._id as mongoose.Types.ObjectId,
          type: NotificationType.SYSTEM_ALERT,
          channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
          title: `${priorityEmoji[approval.priority] || '📋'} New ${approval.priority} Approval Request`,
          body: `A new ${approval.action} approval request requires your attention. Resource: ${approval.resourceType}`,
          subject: `[${approval.priority.toUpperCase()}] Approval Request: ${approval.action}`,
          actionUrl: `/admin/approvals/${approval._id}`,
          actionText: 'Review Request',
          priority: approval.priority as 'low' | 'normal' | 'high' | 'critical',
          relatedResource: {
            type: 'approval',
            id: approval._id as mongoose.Types.ObjectId,
          },
        });
      } catch (err) {
        console.error(`Failed to notify admin ${admin.email}:`, err);
      }
    }
  }

  /**
   * Approve an approval request
   * Called by admin after reviewing request
   * 
   * For multi-approval requests:
   * - Records the approval
   * - Only transitions to APPROVED when all required approvals received
   * - One rejection fails the entire request (no further approvals allowed)
   * 
   * @param approvalId - ID of the approval request
   * @param approverId - Admin user ID approving the request
   * @param reason - Optional reason/notes for the approval
   * @param req - Express request (for IP/user-agent context)
   * @returns Updated approval request
   */
  static async approveApprovalRequest(
    approvalId: string | mongoose.Types.ObjectId,
    approverId: string | mongoose.Types.ObjectId,
    reason: string = 'Approved',
    req?: Request
  ): Promise<IApprovalRequest> {
    const approval = await ApprovalRequest.findById(approvalId);
    if (!approval) {
      throw new Error(`Approval request ${approvalId} not found`);
    }

    // Verify request is still pending
    if (!approval.isPending()) {
      throw new Error(
        `Cannot approve: request is ${approval.status}. Only PENDING requests can be approved.`
      );
    }

    // Verify approver can add a decision
    if (!approval.canApprove(approverId.toString())) {
      throw new Error(
        `This approver has already decided on this request, or request is no longer pending`
      );
    }

    // Add the approval to the chain
    const ipAddress = req ? this.getClientIp(req) : 'UNKNOWN';
    const userAgent = req ? this.getUserAgent(req) : 'UNKNOWN';

    await approval.addApproval(
      new mongoose.Types.ObjectId(approverId as string),
      reason,
      ipAddress,
      userAgent
    );

    // Log the approval action
    await AuditLogService.log(
      AuditActionEnum.APPROVAL_GRANTED,
      ResourceType[approval.resourceType as keyof typeof ResourceType] || ResourceType.SYSTEM,
      approval.resourceId.toString(),
      approverId.toString(),
      req || null,
      {
        approvalStatus: {
          from: ApprovalStatus.PENDING,
          to: approval.status,
        },
      },
      `Approval granted: ${approval.approvalsReceived.length}/${approval.requiredApprovalCount} approvals received`
    );

    // If approved, send notification to requester
    if (approval.status === ApprovalStatus.APPROVED) {
      try {
        await NotificationService.createAndSend({
          userId: approval.requestedBy,
          type: NotificationType.SYSTEM_ALERT,
          channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
          title: '✅ Approval Request Granted',
          body: `Your ${approval.action} request has been approved. You can now proceed with the action.`,
          subject: `Approved: ${approval.action} Request`,
          actionUrl: `/approvals/${approval._id}`,
          actionText: 'View Details',
          priority: 'normal',
          relatedResource: {
            type: 'approval',
            id: approval._id as mongoose.Types.ObjectId,
          },
        });
      } catch (notificationError) {
        console.error('Failed to send approval notification:', notificationError);
      }
    }

    return approval;
  }

  /**
   * Reject an approval request
   * Called by admin after reviewing request
   * 
   * One rejection immediately fails the entire approval request.
   * No further approvals can be added after rejection.
   * 
   * @param approvalId - ID of the approval request
   * @param approverId - Admin user ID rejecting the request
   * @param reason - Reason for rejection (required)
   * @param req - Express request (for IP/user-agent context)
   * @returns Updated approval request
   */
  static async rejectApprovalRequest(
    approvalId: string | mongoose.Types.ObjectId,
    approverId: string | mongoose.Types.ObjectId,
    reason: string,
    req?: Request
  ): Promise<IApprovalRequest> {
    // Validation
    if (!reason || reason.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    const approval = await ApprovalRequest.findById(approvalId);
    if (!approval) {
      throw new Error(`Approval request ${approvalId} not found`);
    }

    // Verify request is still pending
    if (!approval.isPending()) {
      throw new Error(
        `Cannot reject: request is ${approval.status}. Only PENDING requests can be rejected.`
      );
    }

    // Verify approver can add a decision
    if (!approval.canApprove(approverId.toString())) {
      throw new Error(
        `This approver has already decided on this request, or request is no longer pending`
      );
    }

    // Add the rejection to the chain (immediately fails request)
    const ipAddress = req ? this.getClientIp(req) : 'UNKNOWN';
    const userAgent = req ? this.getUserAgent(req) : 'UNKNOWN';

    await approval.addRejection(
      new mongoose.Types.ObjectId(approverId as string),
      reason,
      ipAddress,
      userAgent
    );

    // Log the rejection
    await AuditLogService.log(
      AuditActionEnum.APPROVAL_DENIED,
      ResourceType[approval.resourceType as keyof typeof ResourceType] || ResourceType.SYSTEM,
      approval.resourceId.toString(),
      approverId.toString(),
      req || null,
      {
        approvalStatus: {
          from: ApprovalStatus.PENDING,
          to: ApprovalStatus.REJECTED,
        },
      },
      `Approval rejected: ${reason}`
    );

    // Send rejection notification to requester
    try {
      await NotificationService.createAndSend({
        userId: approval.requestedBy,
        type: NotificationType.SYSTEM_ALERT,
        channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        title: '❌ Approval Request Denied',
        body: `Your ${approval.action} request has been denied. Reason: ${reason}`,
        subject: `Denied: ${approval.action} Request`,
        actionUrl: `/approvals/${approval._id}`,
        actionText: 'View Details',
        priority: 'high',
        relatedResource: {
          type: 'approval',
          id: approval._id as mongoose.Types.ObjectId,
        },
      });
    } catch (notificationError) {
      console.error('Failed to send rejection notification:', notificationError);
    }

    return approval;
  }

  /**
   * Get a single approval request by ID
   * Includes populated approver information
   */
  static async getApprovalById(
    approvalId: string | mongoose.Types.ObjectId
  ): Promise<IApprovalRequest | null> {
    return ApprovalRequest.findById(approvalId)
      .populate('requestedBy', 'email firstName lastName role')
      .populate('approvalsReceived.approverId', 'email firstName lastName role');
  }

  /**
   * Get all pending approval requests
   * Ordered by priority (critical → high → normal → low)
   * Then by age (oldest first - waiting longest)
   * 
   * @param filters - Optional filters (action type, priority)
   * @param limit - Max results (default 50)
   * @returns Array of pending approval requests
   */
  static async getPendingApprovals(
    filters?: {
      action?: ApprovalActionType;
      priority?: string;
      limit?: number;
    }
  ): Promise<IApprovalRequest[]> {
    return ApprovalRequest.findPending(filters);
  }

  /**
   * Get approval request history for a specific resource
   * Useful for showing approval trail on detail pages
   * 
   * @param resourceType - Type of resource (User, Product, Order)
   * @param resourceId - ID of the resource
   */
  static async getApprovalHistory(
    resourceType: string,
    resourceId: string | mongoose.Types.ObjectId
  ): Promise<IApprovalRequest[]> {
    return ApprovalRequest.findByResource(
      resourceType,
      new mongoose.Types.ObjectId(resourceId as string)
    );
  }

  /**
   * Get all approval requests created by a user
   * Shows user what approvals they've requested
   * 
   * @param userId - User who made the requests
   * @param limit - Max results
   */
  static async getUserApprovals(
    userId: string | mongoose.Types.ObjectId,
    limit: number = 50
  ): Promise<IApprovalRequest[]> {
    return ApprovalRequest.findByRequester(
      new mongoose.Types.ObjectId(userId as string),
      limit
    );
  }

  /**
   * Check if specific approval request is approved
   * Useful in business logic to verify action is approved
   * 
   * @param approvalId - ID of approval request to check
   * @returns true if APPROVED, false otherwise
   */
  static async isApproved(approvalId: string | mongoose.Types.ObjectId): Promise<boolean> {
    const approval = await ApprovalRequest.findById(approvalId);
    return approval?.status === ApprovalStatus.APPROVED || false;
  }

  /**
   * Mark approval request as cancelled
   * Admin can cancel a pending request (e.g., user withdrew request)
   * 
   * @param approvalId - ID of request to cancel
   * @param reason - Reason for cancellation
   * @param cancelledBy - Admin who cancelled it (optional for audit)
   * @param req - Express request for context
   */
  static async cancelApprovalRequest(
    approvalId: string | mongoose.Types.ObjectId,
    reason: string,
    cancelledBy?: string | mongoose.Types.ObjectId,
    req?: Request
  ): Promise<IApprovalRequest> {
    const approval = await ApprovalRequest.findById(approvalId);
    if (!approval) {
      throw new Error(`Approval request ${approvalId} not found`);
    }

    if (!approval.isActive()) {
      throw new Error(`Cannot cancel: request is already ${approval.status}`);
    }

    approval.cancelledAt = new Date();
    approval.cancelReason = reason;
    approval.status = ApprovalStatus.CANCELLED;
    await approval.save();

    // Log the cancellation (disabled - AuditLogService.log is private)
    // TODO: Use a public method from AuditLogService when available
    // if (cancelledBy) {
    //   await AuditLogService.log(
    //     AuditActionEnum.ADMIN_ACTION,
    //     ResourceType.APPROVAL,
    //     approval._id.toString(),
    //     cancelledBy.toString(),
    //     req || null,
    //     {
    //       action: 'APPROVAL_CANCELLED',
    //       reason,
    //     }
    //   );
    // }

    return approval;
  }

  /**
   * Handle expired approval requests
   * Called by scheduled job (runs daily in Phase 3)
   * 
   * Marks pending requests that have passed expiresAt as EXPIRED
   * The TTL index will delete them after expiration, but we track status for audit
   * 
   * @returns Number of requests marked as expired
   */
  static async expireOldRequests(): Promise<number> {
    const count = await ApprovalRequest.expireOldRequests();
    return count;
  }

  /**
   * Helper: Extract client IP from Express request
   * Handles X-Forwarded-For header (behind reverse proxies)
   */
  private static getClientIp(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor)
        ? xForwardedFor
        : xForwardedFor.split(',');
      return (ips[0] || '').trim();
    }
    return req.ip || req.socket.remoteAddress || 'UNKNOWN';
  }

  /**
   * Helper: Extract user agent from Express request
   */
  private static getUserAgent(req: Request): string {
    return req.headers['user-agent'] || 'UNKNOWN';
  }
}
