import { Request } from 'express';
import User, { ICapabilityGrant } from '../models/User';
import { AuditLogService } from './AuditLogService';
import { PermissionService } from './PermissionService';
import { ResourceType, AuditActionType } from '../models/AuditLog';

/**
 * CapabilityService
 * 
 * Manages fine-grained capability grants and revocations.
 * 
 * Capabilities are individual permissions that can be granted/revoked
 * independent of role. This allows:
 * - Special privileges for specific users
 * - Temporary permissions (e.g., 30-day moderator access)
 * - Audit trail of who granted/revoked what
 * - Permission escalation control (can't grant higher than own role)
 * 
 * Design:
 * - Pure business logic (side effects: DB write + audit log)
 * - Validation: Can't grant capabilities you don't have
 * - Hierarchy: Can't grant capabilities higher than your role
 * - Audit trail: Every grant/revoke logged
 * - Idempotent: Revoking twice = same result
 * 
 * Example Flow:
 * 1. Admin calls grantCapability(userId, 'admin:view-logs', 'Investigation access')
 * 2. Service validates: Admin has permission to grant this
 * 3. Service adds to user.capabilities array with metadata
 * 4. Service logs the grant to AuditLog
 * 5. Middleware picks up new capability on next request
 */

// Re-export for backward compatibility
export type CapabilityGrant = ICapabilityGrant;

export class CapabilityService {
  /**
   * Grant a capability to a user
   * 
   * @param userId - User receiving the capability
   * @param capability - Capability name (e.g., 'admin:view-logs')
   * @param grantedBy - Admin user granting the capability
   * @param req - Express request (for IP, user agent context)
   * @param reason - Why this capability is being granted
   * @param expiresAt - Optional: when the capability expires
   * @returns Updated user document
   */
  static async grantCapability(
    userId: string,
    capability: string,
    grantedBy: string,
    req: Request,
    reason?: string,
    expiresAt?: Date
  ): Promise<any> {
    // Fetch user being granted capability
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Fetch admin granting capability
    const admin = await User.findById(grantedBy);
    if (!admin) {
      throw new Error(`Admin ${grantedBy} not found`);
    }

    // Validate: Admin can grant this capability
    if (!PermissionService.canGrantCapability(admin, user, capability)) {
      throw new Error(
        `${admin.role} cannot grant capability '${capability}' to ${user.role}`
      );
    }

    // Check if user already has this capability (and it's not revoked)
    if (user.capabilities && Array.isArray(user.capabilities)) {
      const existing = user.capabilities.find(
        (cap) => cap.name === capability && !cap.revokedAt
      );
      if (existing) {
        // Already granted and active - idempotent
        return user;
      }
    }

    // Initialize capabilities array if needed
    if (!user.capabilities) {
      user.capabilities = [];
    }

    // Add the capability
    user.capabilities.push({
      name: capability,
      grantedAt: new Date(),
      grantedBy,
      reason,
      expiresAt,
    });

    await user.save();

    // Log the capability grant
    await AuditLogService.logCapabilityGranted(
      userId,
      capability,
      grantedBy,
      req,
      reason
    );

    return user;
  }

  /**
   * Revoke a capability from a user
   * 
   * @param userId - User losing the capability
   * @param capability - Capability name to revoke
   * @param revokedBy - Admin user revoking the capability
   * @param req - Express request
   * @param reason - Why the capability is being revoked
   * @returns Updated user document
   */
  static async revokeCapability(
    userId: string,
    capability: string,
    revokedBy: string,
    req: Request,
    reason?: string
  ): Promise<any> {
    // Fetch user losing capability
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Fetch admin revoking capability
    const admin = await User.findById(revokedBy);
    if (!admin) {
      throw new Error(`Admin ${revokedBy} not found`);
    }

    // Validate: Admin can revoke this capability (same as grant)
    if (!PermissionService.canGrantCapability(admin, user, capability)) {
      throw new Error(
        `${admin.role} cannot revoke capability '${capability}' from ${user.role}`
      );
    }

    // Find and revoke the capability
    if (!user.capabilities || !Array.isArray(user.capabilities)) {
      return user; // Nothing to revoke (idempotent)
    }

    let revoked = false;
    for (const cap of user.capabilities) {
      if (cap.name === capability && !cap.revokedAt) {
        cap.revokedAt = new Date();
        cap.revokedBy = revokedBy;
        cap.revokedReason = reason;
        revoked = true;
        break;
      }
    }

    if (revoked) {
      await user.save();

      // Log the capability revocation
      await AuditLogService.logCapabilityRevoked(
        userId,
        capability,
        revokedBy,
        req,
        reason
      );
    }

    return user;
  }

  /**
   * List all capabilities for a user
   * 
   * @param userId - User ID
   * @param includeRevoked - Include revoked/expired capabilities (default: false)
   * @returns Array of capabilities
   */
  static async listUserCapabilities(
    userId: string,
    includeRevoked: boolean = false
  ): Promise<CapabilityGrant[]> {
    const user = await User.findById(userId).select('capabilities').lean();
    if (!user || !user.capabilities) {
      return [];
    }

    if (includeRevoked) {
      return user.capabilities;
    }

    // Filter to active capabilities only
    return user.capabilities.filter((cap) => !cap.revokedAt);
  }

  /**
   * Check if a user has a specific capability
   * 
   * @param userId - User ID
   * @param capability - Capability name
   * @returns true if user has the capability (and it's not revoked/expired)
   */
  static async hasCapability(userId: string, capability: string): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user) {
      return false;
    }

    return PermissionService.hasCapability(user, capability);
  }

  /**
   * Check if a capability has expired
   * 
   * @param userId - User ID
   * @param capability - Capability name
   * @returns true if capability is expired
   */
  static async isCapabilityExpired(userId: string, capability: string): Promise<boolean> {
    const user = await User.findById(userId).select('capabilities').lean();
    if (!user || !user.capabilities) {
      return true;
    }

    const cap = user.capabilities.find((c) => c.name === capability);
    if (!cap) {
      return true;
    }

    if (cap.revokedAt) {
      return true;
    }

    if (cap.expiresAt && new Date() > cap.expiresAt) {
      return true;
    }

    return false;
  }

  /**
   * Auto-revoke expired capabilities
   * Called by scheduled job (Phase 2.5)
   * 
   * @returns Number of capabilities auto-revoked
   */
  static async revokeExpiredCapabilities(): Promise<number> {
    const users = await User.find({
      'capabilities.expiresAt': { $lt: new Date() },
      'capabilities.revokedAt': null,
    });

    let count = 0;
    for (const user of users) {
      for (const cap of user.capabilities || []) {
        if (cap.expiresAt && new Date() > cap.expiresAt && !cap.revokedAt) {
          cap.revokedAt = new Date();
          cap.revokedBy = 'system';
          cap.revokedReason = 'Capability expired';
          count++;
        }
      }
      await user.save();
    }

    return count;
  }

  /**
   * Get capability grant history for audit
   * 
   * @param userId - User ID
   * @returns Array of all capability changes (grants + revokes)
   */
  static async getCapabilityHistory(userId: string): Promise<any[]> {
    const user = await User.findById(userId).select('capabilities').lean();
    if (!user || !user.capabilities) {
      return [];
    }

    // Sort by grant date (newest first)
    return (user.capabilities || []).sort((a, b) => {
      const aTime = a.grantedAt?.getTime() || 0;
      const bTime = b.grantedAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  /**
   * Grant temporary capability (auto-expires)
   * Convenience method for time-limited permissions
   * 
   * @param userId - User ID
   * @param capability - Capability name
   * @param grantedBy - Admin user granting
   * @param req - Express request
   * @param durationDays - How many days until auto-revoke
   * @param reason - Reason for grant
   * @returns Updated user
   */
  static async grantTemporaryCapability(
    userId: string,
    capability: string,
    grantedBy: string,
    req: Request,
    durationDays: number = 30,
    reason?: string
  ): Promise<any> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    return this.grantCapability(
      userId,
      capability,
      grantedBy,
      req,
      reason || `Temporary access for ${durationDays} days`,
      expiresAt
    );
  }

  /**
   * Bulk grant capabilities to user
   * 
   * @param userId - User ID
   * @param capabilities - Array of capability names
   * @param grantedBy - Admin user
   * @param req - Express request
   * @param reason - Reason for grants
   * @returns Updated user
   */
  static async grantCapabilities(
    userId: string,
    capabilities: string[],
    grantedBy: string,
    req: Request,
    reason?: string
  ): Promise<any> {
    let user = await User.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    for (const capability of capabilities) {
      user = await this.grantCapability(userId, capability, grantedBy, req, reason);
    }

    return user;
  }

  /**
   * Bulk revoke capabilities from user
   * 
   * @param userId - User ID
   * @param capabilities - Array of capability names
   * @param revokedBy - Admin user
   * @param req - Express request
   * @param reason - Reason for revocations
   * @returns Updated user
   */
  static async revokeCapabilities(
    userId: string,
    capabilities: string[],
    revokedBy: string,
    req: Request,
    reason?: string
  ): Promise<any> {
    let user = await User.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    for (const capability of capabilities) {
      user = await this.revokeCapability(userId, capability, revokedBy, req, reason);
    }

    return user;
  }

  /**
   * Compare user capabilities
   * Useful for role migration or analysis
   * 
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @returns Object showing which user has which capabilities
   */
  static async compareCapabilities(userId1: string, userId2: string): Promise<any> {
    const user1 = await User.findById(userId1);
    const user2 = await User.findById(userId2);

    if (!user1 || !user2) {
      throw new Error('One or both users not found');
    }

    const caps1 = PermissionService.getUserCapabilities(user1);
    const caps2 = PermissionService.getUserCapabilities(user2);

    const onlyIn1 = Array.from(caps1).filter((c) => !caps2.has(c));
    const onlyIn2 = Array.from(caps2).filter((c) => !caps1.has(c));
    const shared = Array.from(caps1).filter((c) => caps2.has(c));

    return {
      user1Id: userId1,
      user1Role: user1.role,
      user2Id: userId2,
      user2Role: user2.role,
      onlyInUser1: onlyIn1,
      onlyInUser2: onlyIn2,
      shared,
    };
  }
}
