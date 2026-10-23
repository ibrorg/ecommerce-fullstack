import User, { IUser } from '../models/User';

/**
 * PermissionService
 * 
 * Role-Based Access Control (RBAC) + Capability-Based Access Control (CBAC)
 * 
 * Two-tier permission system:
 * 1. Roles: Coarse-grained (buyer, seller, admin, super_admin, system)
 * 2. Capabilities: Fine-grained (e.g., orders:refund, products:create, users:suspend)
 * 
 * Design:
 * - Pure business logic (no database writes, side effects, or state changes)
 * - Used by middleware and service layer for access control
 * - Composable: Check capabilities with OR/AND logic
 * - Inheritance: Higher roles inherit lower role capabilities
 * - Testable: Pure functions with deterministic output
 * 
 * Role Hierarchy:
 * system > super_admin > admin > seller > buyer
 * 
 * Each role inherits all capabilities from roles below it.
 * 
 * Examples:
 * - super_admin can do everything (all capabilities)
 * - admin can suspend users, approve refunds, verify sellers
 * - seller can create products, view own orders, request refunds
 * - buyer can browse products, create orders, request refunds
 * - system performs background tasks (scheduled jobs, fraud detection)
 */

/**
 * Capability definitions
 * Format: "resource:action" or "resource:action:scope"
 * 
 * Scope variations:
 * - own: Only own resources (user can see own profile)
 * - any: All resources of type (admin can see all profiles)
 * - approved: Only approved resources (seller can only sell verified products)
 */
export const CAPABILITIES = {
  // User Management
  'users:view:own': 'View own profile and information',
  'users:view:any': 'View any user profile (admin)',
  'users:edit:own': 'Edit own profile',
  'users:edit:any': 'Edit any user profile (admin)',
  'users:suspend': 'Suspend user account',
  'users:unsuspend': 'Unsuspend user account',
  'users:delete': 'Permanently delete user account',

  // Product Management
  'products:create': 'Create new product listing',
  'products:edit:own': 'Edit own products',
  'products:edit:any': 'Edit any product (admin)',
  'products:delete:own': 'Delete own products',
  'products:delete:any': 'Delete any product (admin)',
  'products:view': 'View product listings',
  'products:approve': 'Approve/reject product listings (admin)',

  // Order Management
  'orders:create': 'Create/place orders',
  'orders:view:own': 'View own orders',
  'orders:view:any': 'View any orders (admin/seller)',
  'orders:cancel:own': 'Cancel own orders',
  'orders:cancel:any': 'Cancel any order (admin)',
  'orders:ship': 'Ship orders (seller)',

  // Refund Management
  'refunds:request': 'Request refund for own order',
  'refunds:approve': 'Approve/deny refunds (admin)',
  'refunds:view:own': 'View own refunds',
  'refunds:view:any': 'View all refunds (admin)',

  // Seller Management
  'seller:create': 'Register as seller',
  'seller:view:own': 'View own seller profile',
  'seller:view:any': 'View any seller profile',
  'seller:verify': 'Verify seller profiles (admin)',
  'seller:analytics': 'View seller analytics (own)',
  'seller:payouts': 'Request/view seller payouts',

  // Payment Management
  'payments:view:own': 'View own payment history',
  'payments:view:any': 'View all payments (admin)',
  'payments:refund': 'Process refunds',

  // Admin Management
  'admin:view-logs': 'View audit logs',
  'admin:view-users': 'View all users (admin)',
  'admin:approve-actions': 'Approve pending admin actions',
  'admin:manage-permissions': 'Grant/revoke capabilities',
  'admin:manage-roles': 'Assign roles to users',
  'admin:system-config': 'Change system configuration',
  'admin:fraud-detection': 'View fraud alerts and risk scores',

  // Super Admin
  'superadmin:all': 'All permissions (super admin)',
};

export type Capability = keyof typeof CAPABILITIES;

/**
 * Role-to-Capability mapping
 * This defines what each role can do by default
 * Individual users can have additional/fewer capabilities via grants/revocations
 */
const ROLE_CAPABILITIES: Record<string, Capability[]> = {
  system: [
    'users:view:any',
    'products:view',
    'orders:view:any',
    'refunds:view:any',
    'admin:view-logs',
    'admin:fraud-detection',
    'superadmin:all',
  ],

  super_admin: [
    // Inherits everything below, plus:
    'users:view:any',
    'users:edit:any',
    'users:suspend',
    'users:unsuspend',
    'users:delete',
    'products:edit:any',
    'products:delete:any',
    'products:approve',
    'orders:view:any',
    'orders:cancel:any',
    'refunds:approve',
    'refunds:view:any',
    'seller:verify',
    'payments:view:any',
    'payments:refund',
    'admin:view-logs',
    'admin:view-users',
    'admin:approve-actions',
    'admin:manage-permissions',
    'admin:manage-roles',
    'admin:system-config',
    'admin:fraud-detection',
    'superadmin:all',
  ],

  admin: [
    // Inherits from seller + buyer, plus:
    'users:view:any',
    'users:suspend',
    'users:unsuspend',
    'products:edit:any',
    'products:delete:any',
    'products:approve',
    'orders:view:any',
    'orders:cancel:any',
    'refunds:approve',
    'refunds:view:any',
    'seller:verify',
    'seller:view:any',
    'payments:view:any',
    'payments:refund',
    'admin:view-logs',
    'admin:view-users',
    'admin:approve-actions',
    'admin:manage-permissions',
    'admin:fraud-detection',
  ],

  seller: [
    // Inherits from buyer, plus:
    'products:create',
    'products:edit:own',
    'products:delete:own',
    'products:view',
    'orders:view:any', // Sellers see all orders (to track sales)
    'orders:ship',
    'refunds:view:any', // Sellers see refund requests for their products
    'seller:create',
    'seller:view:own',
    'seller:analytics',
    'seller:payouts',
    'users:view:own',
    'users:edit:own',
    'orders:create',
    'orders:view:own',
    'orders:cancel:own',
    'refunds:request',
    'refunds:view:own',
    'payments:view:own',
    'products:view',
  ],

  buyer: [
    // Basic customer permissions
    'products:view',
    'orders:create',
    'orders:view:own',
    'orders:cancel:own',
    'refunds:request',
    'refunds:view:own',
    'users:view:own',
    'users:edit:own',
    'payments:view:own',
  ],
};

/**
 * PermissionService
 * Pure RBAC/CBAC logic, no database writes
 */
export class PermissionService {
  /**
   * Get all capabilities for a user
   * Combines role-based capabilities with user-specific capability grants/revokes
   * 
   * @param user - User document (must include role and capabilities array)
   * @returns Set of capabilities the user has
   */
  static getUserCapabilities(user: IUser): Set<Capability> {
    const capabilities = new Set<Capability>();

    // Add role-based capabilities
    const roleCapabilities = ROLE_CAPABILITIES[user.role as string] || [];
    roleCapabilities.forEach((cap) => capabilities.add(cap));

    // Add user-specific capability grants (from admin assignments)
    if (user.capabilities && Array.isArray(user.capabilities)) {
      user.capabilities.forEach((cap) => {
        // capabilities is string[], add directly
        if (typeof cap === 'string') {
          capabilities.add(cap as Capability);
        } else if (typeof cap === 'object' && cap !== null) {
          // Handle legacy object format with revokedAt check
          const capObj = cap as { name?: string; revokedAt?: Date };
          if (!capObj.revokedAt && capObj.name) {
            capabilities.add(capObj.name as Capability);
          }
        }
      });
    }

    return capabilities;
  }

  /**
   * Check if user has a specific capability
   * 
   * @param user - User document
   * @param capability - Capability to check
   * @returns true if user has capability, false otherwise
   */
  static hasCapability(user: IUser, capability: Capability | string): boolean {
    const capabilities = this.getUserCapabilities(user);
    return capabilities.has(capability as Capability);
  }

  /**
   * Check if user has ANY of the provided capabilities
   * 
   * @param user - User document
   * @param capabilities - Array of capabilities to check
   * @returns true if user has at least one capability
   */
  static hasAnyCapability(
    user: IUser,
    capabilities: (Capability | string)[]
  ): boolean {
    const userCaps = this.getUserCapabilities(user);
    return capabilities.some((cap) => userCaps.has(cap as Capability));
  }

  /**
   * Check if user has ALL of the provided capabilities
   * 
   * @param user - User document
   * @param capabilities - Array of capabilities to check
   * @returns true if user has all capabilities
   */
  static hasAllCapabilities(
    user: IUser,
    capabilities: (Capability | string)[]
  ): boolean {
    const userCaps = this.getUserCapabilities(user);
    return capabilities.every((cap) => userCaps.has(cap as Capability));
  }

  /**
   * Check if user has a specific role
   * 
   * @param user - User document
   * @param role - Role to check
   * @returns true if user has the role
   */
  static hasRole(user: IUser, role: string | string[]): boolean {
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  }

  /**
   * Check if user can perform action on resource
   * Supports scope-based permissions (own, any, approved)
   * 
   * @param user - User document
   * @param resource - Resource type (e.g., 'products', 'orders', 'users')
   * @param action - Action (e.g., 'edit', 'delete', 'view')
   * @param scope - Scope specification (own userId, any = true, approved = bool)
   * @returns true if user can perform the action
   * 
   * Examples:
   * - canPerform(user, 'products', 'edit', 'own') - user can edit own products
   * - canPerform(user, 'orders', 'view', 'any') - admin can view any orders
   * - canPerform(user, 'users', 'suspend') - admin can suspend users
   */
  static canPerform(
    user: IUser,
    resource: string,
    action: string,
    scope?: string | boolean
  ): boolean {
    // Format the capability name
    let capability = `${resource}:${action}`;
    if (scope) {
      capability = `${resource}:${action}:${scope}`;
    }

    return this.hasCapability(user, capability);
  }

  /**
   * Check if user can access another user's resource
   * Supports ownership verification + role-based override
   * 
   * @param user - Current user
   * @param ownerId - Owner of the resource
   * @param resource - Resource type
   * @param action - Action to perform
   * @returns true if user is owner OR has admin capability
   * 
   * Example:
   * - If user owns the order: true
   * - If user is admin: true
   * - Otherwise: false
   */
  static canAccessResource(
    user: IUser,
    ownerId: string | object,
    resource: string,
    action: string
  ): boolean {
    // Convert ObjectId to string if needed
    const ownerIdStr = typeof ownerId === 'string' ? ownerId : String(ownerId);
    const userIdStr = String(user._id);

    // User is the owner - allow if they have own:action capability
    if (userIdStr === ownerIdStr) {
      return this.canPerform(user, resource, action, 'own');
    }

    // User is not the owner - check for any:action capability
    return this.canPerform(user, resource, action, 'any');
  }

  /**
   * Get role hierarchy level
   * Used to prevent lower-privileged users from elevating others
   * 
   * @param role - Role name
   * @returns Numeric level (0-5), higher = more privileged
   */
  static getRoleLevel(role: string): number {
    const hierarchy: Record<string, number> = {
      buyer: 0,
      seller: 1,
      admin: 3,
      super_admin: 4,
      system: 5,
    };
    return hierarchy[role] || -1;
  }

  /**
   * Check if user can manage another user
   * Higher-privileged users can manage lower-privileged users
   * 
   * @param manager - User who is trying to manage
   * @param target - User being managed
   * @returns true if manager has higher or equal privilege level
   */
  static canManageUser(manager: IUser, target: IUser): boolean {
    const managerLevel = this.getRoleLevel(manager.role);
    const targetLevel = this.getRoleLevel(target.role);
    return managerLevel > targetLevel;
  }

  /**
   * Check if user can assign capability
   * Super admin can grant/revoke any capability
   * Admin can only grant capabilities lower than their own role
   * 
   * @param granter - User granting the capability
   * @param grantee - User receiving the capability
   * @param capability - Capability being granted
   * @returns true if granter can grant this capability
   */
  static canGrantCapability(
    granter: IUser,
    grantee: IUser,
    capability: Capability | string
  ): boolean {
    // Super admin can grant any capability
    if (granter.role === 'super_admin' || granter.role === 'system') {
      return true;
    }

    // Admin can only grant to lower-privileged users
    if (granter.role === 'admin') {
      return this.canManageUser(granter, grantee);
    }

    // Regular users cannot grant capabilities
    return false;
  }

  /**
   * Check if user can modify permissions
   * 
   * @param user - User attempting to modify permissions
   * @returns true if user has admin:manage-permissions capability
   */
  static canManagePermissions(user: IUser): boolean {
    return this.hasCapability(user, 'admin:manage-permissions');
  }

  /**
   * Check if user can approve actions
   * Used for refunds, seller verification, etc.
   * 
   * @param user - User attempting to approve
   * @returns true if user has admin:approve-actions capability
   */
  static canApproveActions(user: IUser): boolean {
    return this.hasCapability(user, 'admin:approve-actions');
  }

  /**
   * Check if user can view audit logs
   * 
   * @param user - User attempting to view logs
   * @returns true if user has admin:view-logs capability
   */
  static canViewAuditLogs(user: IUser): boolean {
    return this.hasCapability(user, 'admin:view-logs');
  }

  /**
   * Get human-readable capability description
   * 
   * @param capability - Capability name
   * @returns Description string
   */
  static getCapabilityDescription(capability: Capability | string): string {
    return CAPABILITIES[capability as Capability] || 'Unknown capability';
  }

  /**
   * Get all capabilities for a role
   * 
   * @param role - Role name
   * @returns Array of capabilities
   */
  static getRoleCapabilities(role: string): Capability[] {
    return ROLE_CAPABILITIES[role] || [];
  }

  /**
   * List all available capabilities
   * 
   * @returns Array of all capability definitions
   */
  static listAllCapabilities(): Array<{ name: Capability; description: string }> {
    return Object.entries(CAPABILITIES).map(([name, description]) => ({
      name: name as Capability,
      description,
    }));
  }
}
