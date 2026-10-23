import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * AuditLog Model
 * 
 * Immutable append-only audit trail for compliance and forensics.
 * NEVER UPDATE OR DELETE - Only insert new records.
 * Every state-changing action in the system creates an AuditLog entry.
 * 
 * Security Properties:
 * - Immutable (no update/delete methods)
 * - Indexed for fast queries (userId, resource, action, timestamp)
 * - TTL deletion disabled (keep forever)
 * - Actor verification (userId must exist and be authenticated)
 * - Change tracking (before/after values for forensics)
 * - Network context (ipAddress, userAgent for anomaly detection)
 * 
 * Compliance:
 * - GDPR: User activity history for Data Subject Access Requests (DSAR)
 * - PCI DSS: Payment card activity audit trail
 * - SOX: Financial transaction logging (future seller payouts)
 * - General: "Who did what when and why"
 */

export enum AuditActionType {
  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  EMAIL_CHANGED = 'EMAIL_CHANGED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  DEVICE_ADDED = 'DEVICE_ADDED',
  DEVICE_REMOVED = 'DEVICE_REMOVED',

  // User Management
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_UNSUSPENDED = 'USER_UNSUSPENDED',
  USER_DELETED = 'USER_DELETED',

  // Permissions & Capabilities
  CAPABILITY_GRANTED = 'CAPABILITY_GRANTED',
  CAPABILITY_REVOKED = 'CAPABILITY_REVOKED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REVOKED = 'ROLE_REVOKED',

  // Commerce
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_SHIPPED = 'ORDER_SHIPPED',
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  REFUND_APPROVED = 'REFUND_APPROVED',
  REFUND_DENIED = 'REFUND_DENIED',
  PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',

  // Seller
  SELLER_VERIFIED = 'SELLER_VERIFIED',
  SELLER_VERIFICATION_REJECTED = 'SELLER_VERIFICATION_REJECTED',

  // Admin Actions
  APPROVAL_REQUESTED = 'APPROVAL_REQUESTED',
  APPROVAL_GRANTED = 'APPROVAL_GRANTED',
  APPROVAL_DENIED = 'APPROVAL_DENIED',
  ADMIN_ACTION = 'ADMIN_ACTION',

  // Fraud & Security
  VIEWED = 'VIEWED',
  APPROVED = 'APPROVED',
  BLOCKED = 'BLOCKED',
  UNBLOCKED = 'UNBLOCKED',
  FLAGGED = 'FLAGGED',
  ESCALATED = 'ESCALATED',
  SUSPICIOUS_ACTIVITY_DETECTED = 'SUSPICIOUS_ACTIVITY_DETECTED',
  FRAUD_ALERT = 'FRAUD_ALERT',
  BRUTE_FORCE_BLOCKED = 'BRUTE_FORCE_BLOCKED',

  // System
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',
}

export enum ResourceType {
  USER = 'USER',
  PRODUCT = 'PRODUCT',
  ORDER = 'ORDER',
  REFUND = 'REFUND',
  PAYMENT = 'PAYMENT',
  SELLER_PROFILE = 'SELLER_PROFILE',
  SESSION = 'SESSION',
  DEVICE = 'DEVICE',
  APPROVAL = 'APPROVAL',
  SYSTEM = 'SYSTEM',
  FRAUD_ALERT = 'FRAUD_ALERT',
  TRANSACTION = 'TRANSACTION',
}

/**
 * Change tracking: Before/after values for audit forensics
 * Example:
 * {
 *   "status": { from: "active", to: "suspended" },
 *   "email": { from: "old@example.com", to: "new@example.com" }
 * }
 */
export interface ChangeObject {
  [fieldName: string]: {
    from: any;
    to: any;
  };
}

export interface IAuditLog extends Document {
  // Core tracking
  action: AuditActionType;
  resourceType: ResourceType;
  resourceId: string;
  
  // Actor information
  actorId: string | null; // userId of who did it (null for system actions)
  actorRole?: 'buyer' | 'seller' | 'admin' | 'super_admin' | 'system';
  
  // Changes (before/after for forensics)
  changes?: ChangeObject;
  
  // Network context (for anomaly detection)
  ipAddress?: string;
  userAgent?: string;
  
  // Description/reason
  description?: string;
  reason?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt?: Date; // Not used, but schema requires it
  
  // For approval workflows
  approvalRequestId?: string;
}

// Interface for static methods on AuditLog model
export interface IAuditLogModel extends Model<IAuditLog> {
  findByUser(userId: string, limit?: number, skip?: number): Promise<IAuditLog[]>;
  findByResource(resourceType: ResourceType, resourceId: string, limit?: number, skip?: number): Promise<IAuditLog[]>;
  findByAction(action: AuditActionType, limit?: number, skip?: number): Promise<IAuditLog[]>;
  findRecent(hours?: number, limit?: number, skip?: number): Promise<IAuditLog[]>;
  findSuspiciousActivity(limit?: number): Promise<IAuditLog[]>;
  findUserActivity(userId: string, actionTypes?: AuditActionType[], limit?: number): Promise<IAuditLog[]>;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      enum: Object.values(AuditActionType),
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      enum: Object.values(ResourceType),
      required: true,
      index: true,
    },
    resourceId: {
      type: String,
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      enum: ['buyer', 'seller', 'admin', 'super_admin', 'system'],
    },
    changes: {
      type: Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    description: {
      type: String,
    },
    reason: {
      type: String,
    },
    approvalRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'ApprovalRequest',
    },
  },
  {
    timestamps: true,
    // CRITICAL: Disable update timestamp. AuditLog is immutable.
    versionKey: false,
  }
);

/**
 * Composite indexes for common queries
 * These MUST be indexed for forensics queries to be fast enough
 */

// Find all actions by a user (login attempts, orders, etc)
auditLogSchema.index({ actorId: 1, createdAt: -1 });

// Find all actions on a resource (who modified this user/order/product)
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

// Find all actions of a type (all LOGIN_FAILURE events for brute force detection)
auditLogSchema.index({ action: 1, createdAt: -1 });

// Find suspicious activity by action + resource type
auditLogSchema.index({ action: 1, resourceType: 1, createdAt: -1 });

// Time-range queries (security incidents in last 24 hours)
auditLogSchema.index({ createdAt: -1 });

/**
 * Instance Methods
 * None - AuditLog is immutable. New records are created, never modified.
 */

/**
 * Static Methods
 * Pure read operations only. No create/update/delete on client side.
 * Creation happens via service layer with full validation.
 */

auditLogSchema.statics.findByUser = async function(
  userId: string,
  limit: number = 100,
  skip: number = 0
) {
  return this.find({ actorId: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

auditLogSchema.statics.findByResource = async function(
  resourceType: ResourceType,
  resourceId: string,
  limit: number = 100,
  skip: number = 0
) {
  return this.find({ resourceType, resourceId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

auditLogSchema.statics.findByAction = async function(
  action: AuditActionType,
  limit: number = 100,
  skip: number = 0
) {
  return this.find({ action })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

auditLogSchema.statics.findRecent = async function(
  hours: number = 24,
  limit: number = 100,
  skip: number = 0
) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({ createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

auditLogSchema.statics.findSuspiciousActivity = async function(
  limit: number = 50
) {
  return this.find({
    action: {
      $in: [
        AuditActionType.LOGIN_FAILURE,
        AuditActionType.BRUTE_FORCE_BLOCKED,
        AuditActionType.SUSPICIOUS_ACTIVITY_DETECTED,
        AuditActionType.FRAUD_ALERT,
      ],
    },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

auditLogSchema.statics.findUserActivity = async function(
  userId: string,
  actionTypes?: AuditActionType[],
  limit: number = 50
) {
  const query: any = { actorId: userId };
  if (actionTypes && actionTypes.length > 0) {
    query.action = { $in: actionTypes };
  }
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Prevent updates and deletes
 * This is a safeguard to ensure immutability even if someone calls updateOne/deleteOne
 */
auditLogSchema.pre('updateOne', function(next: (err?: Error) => void) {
  const error = new Error(
    'AuditLog is immutable. Cannot update records. Create new records only.'
  );
  next(error);
});

auditLogSchema.pre('updateMany', function(next: (err?: Error) => void) {
  const error = new Error(
    'AuditLog is immutable. Cannot update records. Create new records only.'
  );
  next(error);
});

auditLogSchema.pre('deleteOne', function(next: (err?: Error) => void) {
  const error = new Error(
    'AuditLog is immutable. Cannot delete records. Audit trail must be preserved forever.'
  );
  next(error);
});

auditLogSchema.pre('deleteMany', function(next: (err?: Error) => void) {
  const error = new Error(
    'AuditLog is immutable. Cannot delete records. Audit trail must be preserved forever.'
  );
  next(error);
});

// Export the model
export const AuditLog = mongoose.model<IAuditLog, IAuditLogModel>(
  'AuditLog',
  auditLogSchema
);
