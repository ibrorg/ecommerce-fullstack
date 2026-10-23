import { Request } from 'express';
import { AuditLog, AuditActionType, ResourceType, IAuditLog, ChangeObject } from '../models/AuditLog';
import User from '../models/User';

/**
 * AuditLogService
 * 
 * Handles all audit logging operations. This is the ONLY service that creates AuditLog records.
 * 
 * Design Principles:
 * 1. Service is the single point of entry for audit logging
 * 2. Automatic network context capture (IP, user agent, actor)
 * 3. Change tracking (before/after for forensics)
 * 4. No direct database access from controllers
 * 5. Pure async functions (testable, composable)
 * 
 * Usage:
 * - Called from middleware after successful state changes
 * - Called from services when resources are modified
 * - Network context captured from Express request object
 * - Changes tracked from business layer
 * 
 * Example:
 * await AuditLogService.logUserSuspension(
 *   userId,
 *   req.user._id,
 *   req,
 *   'Violation of terms of service'
 * );
 */

export class AuditLogService {
  /**
   * Get client IP address from request
   * Handles X-Forwarded-For header (reverse proxies)
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
   * Get user agent from request
   */
  private static getUserAgent(req: Request): string {
    return req.headers['user-agent'] || 'UNKNOWN';
  }

  /**
   * Core logging method
   * All other methods call this to create audit log entries
   * 
   * @param action - What action was performed
   * @param resourceType - What type of resource was affected
   * @param resourceId - ID of the affected resource
   * @param actorId - User ID of who performed the action
   * @param req - Express request (for IP, user agent context)
   * @param changes - Before/after changes for forensics
   * @param description - Human-readable description
   * @param reason - Why the action was performed
   */
  static async log(
    action: AuditActionType,
    resourceType: ResourceType,
    resourceId: string,
    actorId: string | null,
    req: Request | null,
    changes?: ChangeObject,
    description?: string,
    reason?: string
  ): Promise<IAuditLog> {
    // Get actor role if available
    let actorRole: 'buyer' | 'seller' | 'admin' | 'super_admin' | 'system' | undefined;
    if (actorId) {
      try {
        const user = await User.findById(actorId).select('role').lean();
        actorRole = user?.role as any;
      } catch (error) {
        // If user lookup fails, continue without role (important for forensics)
        console.warn(`[AuditLog] Failed to lookup user ${actorId} role:`, error);
      }
    }

    // Create the audit log entry
    const auditLog = new AuditLog({
      action,
      resourceType,
      resourceId,
      actorId: actorId || null,
      actorRole,
      changes: changes || undefined,
      ipAddress: req ? this.getClientIp(req) : undefined,
      userAgent: req ? this.getUserAgent(req) : undefined,
      description,
      reason,
    });

    await auditLog.save();
    return auditLog;
  }

  // ==================== Authentication Events ====================

  static async logLoginSuccess(
    userId: string,
    req: Request,
    deviceId?: string
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.LOGIN_SUCCESS,
      ResourceType.USER,
      userId,
      userId,
      req,
      undefined,
      `Login successful from device ${deviceId || 'unknown'}`
    );
  }

  static async logLoginFailure(
    email: string,
    req: Request,
    reason: string
  ): Promise<IAuditLog> {
    // Create a synthetic resource ID for failed login (email-based)
    const resourceId = `email:${email}`;
    return this.log(
      AuditActionType.LOGIN_FAILURE,
      ResourceType.USER,
      resourceId,
      null, // Failed login has no actor yet
      req,
      undefined,
      `Login failed for ${email}`,
      reason
    );
  }

  static async logLogout(userId: string, req: Request): Promise<IAuditLog> {
    return this.log(
      AuditActionType.LOGOUT,
      ResourceType.SESSION,
      userId, // resourceId = userId for session termination
      userId,
      req,
      undefined,
      'User logged out'
    );
  }

  static async logSessionRevoked(
    userId: string,
    sessionId: string,
    req: Request,
    reason: string
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.SESSION_REVOKED,
      ResourceType.SESSION,
      sessionId,
      userId,
      req,
      undefined,
      `Session revoked: ${reason}`,
      reason
    );
  }

  static async logPasswordChanged(
    userId: string,
    req: Request,
    description?: string
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.PASSWORD_CHANGED,
      ResourceType.USER,
      userId,
      userId,
      req,
      undefined,
      description || 'User password changed'
    );
  }

  static async logEmailChanged(
    userId: string,
    oldEmail: string,
    newEmail: string,
    req: Request
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.EMAIL_CHANGED,
      ResourceType.USER,
      userId,
      userId,
      req,
      {
        email: {
          from: oldEmail,
          to: newEmail,
        },
      },
      `Email changed from ${oldEmail} to ${newEmail}`
    );
  }

  static async logEmailVerified(userId: string): Promise<IAuditLog> {
    return this.log(
      AuditActionType.EMAIL_VERIFIED,
      ResourceType.USER,
      userId,
      userId,
      null
    );
  }

  // ==================== User Management ====================

  static async logUserCreated(
    userId: string,
    userData: any,
    createdBy?: string
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.USER_CREATED,
      ResourceType.USER,
      userId,
      createdBy || null,
      null,
      {
        user: {
          from: null,
          to: {
            email: userData.email,
            name: userData.name,
            role: userData.role || 'buyer',
          },
        },
      },
      `User account created: ${userData.email}`
    );
  }

  static async logUserSuspended(
    userId: string,
    suspendedBy: string,
    req: Request,
    reason: string
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.USER_SUSPENDED,
      ResourceType.USER,
      userId,
      suspendedBy,
      req,
      {
        status: {
          from: 'active',
          to: 'suspended',
        },
      },
      `User suspended by ${suspendedBy}`,
      reason
    );
  }

  static async logUserUnsuspended(
    userId: string,
    unsuspendedBy: string,
    req: Request,
    reason?: string
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.USER_UNSUSPENDED,
      ResourceType.USER,
      userId,
      unsuspendedBy,
      req,
      {
        status: {
          from: 'suspended',
          to: 'active',
        },
      },
      `User unsuspended by ${unsuspendedBy}`,
      reason
    );
  }

  // ==================== Permission Management ====================

  static async logCapabilityGranted(
    userId: string,
    capability: string,
    grantedBy: string,
    req: Request,
    reason?: string
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.CAPABILITY_GRANTED,
      ResourceType.USER,
      userId,
      grantedBy,
      req,
      {
        capability: {
          from: null,
          to: capability,
        },
      },
      `Capability '${capability}' granted to user`,
      reason
    );
  }

  static async logCapabilityRevoked(
    userId: string,
    capability: string,
    revokedBy: string,
    req: Request,
    reason?: string
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.CAPABILITY_REVOKED,
      ResourceType.USER,
      userId,
      revokedBy,
      req,
      {
        capability: {
          from: capability,
          to: null,
        },
      },
      `Capability '${capability}' revoked from user`,
      reason
    );
  }

  static async logRoleAssigned(
    userId: string,
    role: string,
    assignedBy: string,
    req: Request
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.ROLE_ASSIGNED,
      ResourceType.USER,
      userId,
      assignedBy,
      req,
      {
        role: {
          from: null,
          to: role,
        },
      },
      `Role '${role}' assigned to user`
    );
  }

  // ==================== Commerce Events ====================

  static async logOrderCreated(
    orderId: string,
    userId: string,
    orderData: any,
    req: Request
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.ORDER_CREATED,
      ResourceType.ORDER,
      orderId,
      userId,
      req,
      {
        order: {
          from: null,
          to: {
            total: orderData.total,
            itemCount: orderData.items?.length || 0,
            status: 'created',
          },
        },
      },
      `Order created: ${orderData.total} for ${orderData.items?.length || 0} items`
    );
  }

  static async logRefundRequested(
    orderId: string,
    userId: string,
    amount: number,
    req: Request,
    reason?: string
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.REFUND_REQUESTED,
      ResourceType.REFUND,
      orderId,
      userId,
      req,
      {
        refund: {
          from: null,
          to: {
            amount,
            status: 'pending',
          },
        },
      },
      `Refund requested: $${amount}`,
      reason
    );
  }

  static async logRefundApproved(
    refundId: string,
    orderId: string,
    approvedBy: string,
    amount: number,
    req: Request
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.REFUND_APPROVED,
      ResourceType.REFUND,
      refundId,
      approvedBy,
      req,
      {
        refund: {
          from: 'pending',
          to: 'approved',
        },
      },
      `Refund approved: $${amount} for order ${orderId}`
    );
  }

  static async logRefundDenied(
    refundId: string,
    orderId: string,
    deniedBy: string,
    req: Request,
    reason?: string
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.REFUND_DENIED,
      ResourceType.REFUND,
      refundId,
      deniedBy,
      req,
      {
        refund: {
          from: 'pending',
          to: 'denied',
        },
      },
      `Refund denied for order ${orderId}`,
      reason
    );
  }

  // ==================== Seller Management ====================

  static async logSellerVerificationRequested(
    userId: string,
    req: Request
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.APPROVAL_REQUESTED,
      ResourceType.SELLER_PROFILE,
      userId,
      userId,
      req,
      undefined,
      'Seller verification requested'
    );
  }

  static async logSellerVerified(
    userId: string,
    verifiedBy: string,
    req: Request
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.SELLER_VERIFIED,
      ResourceType.SELLER_PROFILE,
      userId,
      verifiedBy,
      req,
      {
        sellerStatus: {
          from: 'pending',
          to: 'verified',
        },
      },
      `Seller profile verified by ${verifiedBy}`
    );
  }

  static async logSellerVerificationRejected(
    userId: string,
    rejectedBy: string,
    req: Request,
    reason?: string
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.SELLER_VERIFICATION_REJECTED,
      ResourceType.SELLER_PROFILE,
      userId,
      rejectedBy,
      req,
      {
        sellerStatus: {
          from: 'pending',
          to: 'rejected',
        },
      },
      `Seller verification rejected by ${rejectedBy}`,
      reason
    );
  }

  // ==================== Security Events ====================

  static async logSuspiciousActivity(
    userId: string,
    req: Request,
    description: string,
    details?: any
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.SUSPICIOUS_ACTIVITY_DETECTED,
      ResourceType.USER,
      userId,
      null, // System detected it
      req,
      {
        suspicious: {
          from: null,
          to: details || description,
        },
      },
      description
    );
  }

  static async logBruteForceBlocked(
    email: string,
    req: Request,
    attemptCount: number
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.BRUTE_FORCE_BLOCKED,
      ResourceType.USER,
      `email:${email}`,
      null,
      req,
      {
        failedAttempts: {
          from: attemptCount - 1,
          to: attemptCount,
        },
      },
      `Brute force blocked: ${attemptCount} failed login attempts`
    );
  }

  static async logFraudAlert(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    req: Request,
    description: string,
    riskScore: number
  ): Promise<IAuditLog> {
    return this.log(
      AuditActionType.FRAUD_ALERT,
      resourceType,
      resourceId,
      userId,
      req,
      {
        fraud: {
          from: null,
          to: {
            riskScore,
            description,
          },
        },
      },
      description
    );
  }

  // ==================== Query Methods ====================

  /**
   * Get user activity for compliance/investigation
   */
  static async getUserActivity(userId: string, hours: number = 24, limit: number = 100) {
    return AuditLog.findByUser(userId, limit, 0);
  }

  /**
   * Get all suspicious activity in timeframe
   */
  static async getSuspiciousActivity(limit: number = 50) {
    return AuditLog.findSuspiciousActivity(limit);
  }

  /**
   * Get activity on a specific resource (forensics)
   */
  static async getResourceActivity(
    resourceType: ResourceType,
    resourceId: string,
    limit: number = 100
  ) {
    return AuditLog.findByResource(resourceType, resourceId, limit, 0);
  }

  /**
   * Get all actions of a specific type
   */
  static async getActionHistory(action: AuditActionType, limit: number = 100) {
    return AuditLog.findByAction(action, limit, 0);
  }

  /**
   * Get recent activity across system
   */
  static async getRecentActivity(hours: number = 24, limit: number = 100) {
    return AuditLog.findRecent(hours, limit, 0);
  }
}
