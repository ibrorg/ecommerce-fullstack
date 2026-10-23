import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * ApprovalRequest Model
 * 
 * Workflow for high-risk actions requiring admin approval:
 * - Seller verification
 * - High-value refunds (>$X)
 * - User suspension/unsuspension
 * - Capability grants (especially high-privileged ones)
 * - Product delisting (dispute handling)
 * 
 * State Machine:
 * pending → approved → [completed OR rolled back]
 * pending → rejected → completed
 * pending → [expired after 7 days] → completed
 * 
 * Design:
 * - Immutable request object (never modify original request)
 * - Audit trail of who approved/rejected and why
 * - Automatic expiration after 7 days
 * - Data-agnostic (stores any action data as JSON)
 * - Approval chain support (multiple approvers for very high-risk)
 * 
 * Examples:
 * - Seller wants to verify: ApprovalRequest created, admin reviews, approves/rejects
 * - User requests high refund: ApprovalRequest created, auto-notifies admins
 */

export enum ApprovalActionType {
  // Seller Operations
  SELLER_VERIFICATION = 'SELLER_VERIFICATION',
  SELLER_KYC_VERIFICATION = 'SELLER_KYC_VERIFICATION',
  SELLER_RESTRICTION_LIFT = 'SELLER_RESTRICTION_LIFT',

  // Refunds & Disputes
  HIGH_REFUND = 'HIGH_REFUND',
  CUSTOMER_DISPUTE = 'CUSTOMER_DISPUTE',
  FRAUD_APPEAL = 'FRAUD_APPEAL',

  // User Management
  USER_SUSPENSION = 'USER_SUSPENSION',
  USER_UNSUSPENSION = 'USER_UNSUSPENSION',
  USER_DELETION = 'USER_DELETION',

  // Permissions
  CAPABILITY_GRANT = 'CAPABILITY_GRANT',
  ROLE_ASSIGNMENT = 'ROLE_ASSIGNMENT',

  // Content & Moderation
  PRODUCT_DELISTING = 'PRODUCT_DELISTING',
  PRODUCT_RESTORATION = 'PRODUCT_RESTORATION',
  CONTENT_REVIEW = 'CONTENT_REVIEW',

  // System
  SYSTEM_CONFIG_CHANGE = 'SYSTEM_CONFIG_CHANGE',
  BULK_ACTION = 'BULK_ACTION',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * Single approval decision in the chain
 * Supports multiple approvers for very high-risk actions
 */
export interface ApprovalDecision {
  approverId: mongoose.Types.ObjectId;
  decision: 'approved' | 'rejected';
  reason: string;
  decidedAt: Date;
  ipAddress: string;
  userAgent: string;
}

/**
 * Request metadata - context about who initiated the request
 */
export interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

/**
 * Callback data - used to execute action after approval
 * Stored separately so we can retry if execution fails
 */
export interface ActionCallback {
  executed: boolean;
  executedAt?: Date;
  error?: string;
  result?: any;
}

export interface IApprovalRequest extends Document {
  // Identity
  _id: mongoose.Types.ObjectId;
  requestId: string; // Unique, human-readable ID

  // Request Details
  action: ApprovalActionType;
  status: ApprovalStatus;
  requestedBy: mongoose.Types.ObjectId; // User who initiated request
  requestData: Record<string, any>; // Action-specific data (seller info, refund amount, etc.)
  requestMetadata: RequestMetadata;

  // Resource Context
  resourceType: string; // User, Order, Product, Seller, etc.
  resourceId: mongoose.Types.ObjectId;

  // Priority & Requirements
  priority: 'low' | 'normal' | 'high' | 'critical';
  requiredApprovalCount: number; // 1 for normal, 2+ for high-risk
  approvalsReceived: ApprovalDecision[];

  // Timing
  createdAt: Date;
  expiresAt: Date; // Auto-expire after 7 days
  approvedAt?: Date;
  rejectedAt?: Date;
  expiredAt?: Date;

  // Execution
  actionCallback: ActionCallback;

  // Audit Trail
  notes?: string;
  cancelledAt?: Date;
  cancelReason?: string;

  // Methods
  isActive(): boolean;
  isPending(): boolean;
  canApprove(approverId: string): boolean;
  addApproval(approverId: mongoose.Types.ObjectId, reason: string, ip: string, ua: string): Promise<void>;
  addRejection(approverId: mongoose.Types.ObjectId, reason: string, ip: string, ua: string): Promise<void>;
  isFullyApproved(): boolean;
  isFullyRejected(): boolean;
  hasExpired(): boolean;
}

// Interface for static methods on ApprovalRequest model
export interface IApprovalRequestModel extends Model<IApprovalRequest> {
  createRequest(
    action: ApprovalActionType,
    requestedBy: mongoose.Types.ObjectId,
    requestData: Record<string, any>,
    resourceType: string,
    resourceId: mongoose.Types.ObjectId,
    priority: 'low' | 'normal' | 'high' | 'critical',
    requiredApprovals: number,
    requestMetadata: RequestMetadata
  ): Promise<IApprovalRequest>;
  findPending(filters?: {
    action?: ApprovalActionType;
    priority?: string;
    limit?: number;
  }): Promise<IApprovalRequest[]>;
  findByResource(resourceType: string, resourceId: mongoose.Types.ObjectId): Promise<IApprovalRequest[]>;
  findByRequester(userId: mongoose.Types.ObjectId, limit?: number): Promise<IApprovalRequest[]>;
  expireOldRequests(): Promise<number>;
}

const approvalRequestSchema = new Schema<IApprovalRequest>(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      // Format: AR-{action}-{timestamp}-{random}
      // Example: AR-SELLER_VERIFICATION-1234567890-ABC123
    },

    action: {
      type: String,
      enum: Object.values(ApprovalActionType),
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(ApprovalStatus),
      default: ApprovalStatus.PENDING,
      index: true,
    },

    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    requestData: {
      type: Schema.Types.Mixed,
      required: true,
      // Stores action-specific data:
      // - SELLER_VERIFICATION: { businessName, taxId, bankAccount }
      // - HIGH_REFUND: { orderId, amount, reason }
      // - USER_SUSPENSION: { userId, reason }
      // - CAPABILITY_GRANT: { userId, capabilities: string[] }
      // - PRODUCT_DELISTING: { productId, reason, evidence }
    },

    requestMetadata: {
      ipAddress: {
        type: String,
        required: true,
      },
      userAgent: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },

    resourceType: {
      type: String,
      required: true,
      // User, Order, Product, Seller, etc.
      // Used to identify what resource this approval affects
    },

    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      // ID of the resource being approved
      // e.g., seller userId, product ID, order ID
    },

    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: 'normal',
      index: true,
    },

    requiredApprovalCount: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
      // Single approvers for routine actions
      // Multiple approvers for high-risk actions
    },

    approvalsReceived: [
      {
        approverId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        decision: {
          type: String,
          enum: ['approved', 'rejected'],
          required: true,
        },
        reason: {
          type: String,
          required: true,
          maxlength: 1000,
        },
        decidedAt: {
          type: Date,
          default: Date.now,
        },
        ipAddress: {
          type: String,
          required: true,
        },
        userAgent: {
          type: String,
          required: true,
        },
      },
    ],

    expiresAt: {
      type: Date,
      required: true,
      index: true,
      // 7 days from creation
      // TTL index will auto-delete after this date
      // But we also track status changes to know why it expired
    },

    approvedAt: {
      type: Date,
      // When all required approvals were received
    },

    rejectedAt: {
      type: Date,
      // When first rejection was received (auto-fails the request)
    },

    expiredAt: {
      type: Date,
      // When request expired (after 7 days without decision)
    },

    actionCallback: {
      executed: {
        type: Boolean,
        default: false,
      },
      executedAt: Date,
      error: String,
      result: Schema.Types.Mixed,
    },

    notes: {
      type: String,
      maxlength: 2000,
    },

    cancelledAt: Date,
    cancelReason: String,
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for query performance
 */
approvalRequestSchema.index({ requestedBy: 1, createdAt: -1 }); // User's approval requests
approvalRequestSchema.index({ status: 1, priority: 1 }); // Filter pending by priority
approvalRequestSchema.index({ action: 1, status: 1 }); // By action type
approvalRequestSchema.index({ resourceType: 1, resourceId: 1 }); // By affected resource
approvalRequestSchema.index({ expiresAt: 1 }); // For TTL index
approvalRequestSchema.index({ 'approvalsReceived.approverId': 1 }); // Approver's decisions

/**
 * TTL Index: Auto-delete expired requests after expiresAt
 * This prevents the database from growing unbounded with old requests
 * 
 * Note: TTL deletion is approximate (runs every 60 seconds)
 * So we still need to check hasExpired() at query time
 */
approvalRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Instance Methods
 */

/**
 * Check if request is still active (not expired, not cancelled)
 */
approvalRequestSchema.methods.isActive = function (): boolean {
  return (
    this.status !== ApprovalStatus.EXPIRED &&
    this.status !== ApprovalStatus.CANCELLED &&
    !this.hasExpired()
  );
};

/**
 * Check if request is pending decision
 */
approvalRequestSchema.methods.isPending = function (): boolean {
  return this.status === ApprovalStatus.PENDING && this.isActive();
};

/**
 * Check if approver can add their decision
 * - Can only approve if pending
 * - Can only approve once per approver
 */
approvalRequestSchema.methods.canApprove = function (approverId: string): boolean {
  if (!this.isPending()) {
    return false;
  }

  // Check if this approver already decided
  const alreadyDecided = this.approvalsReceived.some(
    (decision: ApprovalDecision) => decision.approverId.toString() === approverId
  );

  return !alreadyDecided;
};

/**
 * Add approval decision to the chain
 */
approvalRequestSchema.methods.addApproval = async function (
  approverId: mongoose.Types.ObjectId,
  reason: string,
  ip: string,
  ua: string
): Promise<void> {
  if (!this.canApprove(approverId.toString())) {
    throw new Error('Cannot approve: request not pending or already decided');
  }

  this.approvalsReceived.push({
    approverId,
    decision: 'approved',
    reason,
    decidedAt: new Date(),
    ipAddress: ip,
    userAgent: ua,
  });

  // Check if fully approved
  if (this.isFullyApproved()) {
    this.status = ApprovalStatus.APPROVED;
    this.approvedAt = new Date();
  }

  await this.save();
};

/**
 * Add rejection decision
 * One rejection rejects the entire request
 */
approvalRequestSchema.methods.addRejection = async function (
  approverId: mongoose.Types.ObjectId,
  reason: string,
  ip: string,
  ua: string
): Promise<void> {
  if (!this.canApprove(approverId.toString())) {
    throw new Error('Cannot reject: request not pending or already decided');
  }

  this.approvalsReceived.push({
    approverId,
    decision: 'rejected',
    reason,
    decidedAt: new Date(),
    ipAddress: ip,
    userAgent: ua,
  });

  // Any rejection fails the entire request
  this.status = ApprovalStatus.REJECTED;
  this.rejectedAt = new Date();

  await this.save();
};

/**
 * Check if fully approved (enough approvals received)
 */
approvalRequestSchema.methods.isFullyApproved = function (): boolean {
  const approvals = this.approvalsReceived.filter(
    (d: ApprovalDecision) => d.decision === 'approved'
  ).length;
  return approvals >= this.requiredApprovalCount;
};

/**
 * Check if rejected (any rejection fails the request)
 */
approvalRequestSchema.methods.isFullyRejected = function (): boolean {
  return this.approvalsReceived.some((d: ApprovalDecision) => d.decision === 'rejected');
};

/**
 * Check if request has expired
 */
approvalRequestSchema.methods.hasExpired = function (): boolean {
  return new Date() > this.expiresAt && this.status === ApprovalStatus.PENDING;
};

/**
 * Static Methods
 */

/**
 * Create a new approval request
 */
approvalRequestSchema.statics.createRequest = async function (
  action: ApprovalActionType,
  requestedBy: mongoose.Types.ObjectId,
  requestData: Record<string, any>,
  resourceType: string,
  resourceId: mongoose.Types.ObjectId,
  priority: 'low' | 'normal' | 'high' | 'critical',
  requiredApprovals: number,
  requestMetadata: RequestMetadata
): Promise<IApprovalRequest> {
  // Generate unique request ID
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const requestId = `AR-${action}-${timestamp}-${random}`;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  return this.create({
    requestId,
    action,
    requestedBy,
    requestData,
    resourceType,
    resourceId,
    priority,
    requiredApprovalCount: requiredApprovals,
    requestMetadata,
    expiresAt,
    approvalsReceived: [],
    actionCallback: {
      executed: false,
    },
  });
};

/**
 * Find pending requests for admin dashboard
 */
approvalRequestSchema.statics.findPending = async function (
  filters?: {
    action?: ApprovalActionType;
    priority?: string;
    limit?: number;
  }
): Promise<IApprovalRequest[]> {
  const query: any = { status: ApprovalStatus.PENDING };

  if (filters?.action) {
    query.action = filters.action;
  }
  if (filters?.priority) {
    query.priority = filters.priority;
  }

  return this.find(query)
    .populate('requestedBy', 'email firstName lastName role')
    .populate('approvalsReceived.approverId', 'email firstName lastName')
    .sort({ priority: -1, createdAt: 1 }) // High priority first, then oldest first
    .limit(filters?.limit || 50);
};

/**
 * Find approval history for a resource
 */
approvalRequestSchema.statics.findByResource = async function (
  resourceType: string,
  resourceId: mongoose.Types.ObjectId
): Promise<IApprovalRequest[]> {
  return this.find({ resourceType, resourceId })
    .populate('requestedBy', 'email firstName lastName')
    .populate('approvalsReceived.approverId', 'email firstName lastName')
    .sort({ createdAt: -1 });
};

/**
 * Find approval requests by user (who requested them)
 */
approvalRequestSchema.statics.findByRequester = async function (
  userId: mongoose.Types.ObjectId,
  limit = 50
): Promise<IApprovalRequest[]> {
  return this.find({ requestedBy: userId })
    .populate('approvalsReceived.approverId', 'email firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Find all expired pending requests and update their status
 * Should be called by a scheduled job
 */
approvalRequestSchema.statics.expireOldRequests = async function (): Promise<number> {
  const result = await this.updateMany(
    {
      status: ApprovalStatus.PENDING,
      expiresAt: { $lt: new Date() },
    },
    {
      status: ApprovalStatus.EXPIRED,
      expiredAt: new Date(),
    }
  );

  return result.modifiedCount;
};

export const ApprovalRequest = mongoose.model<IApprovalRequest, IApprovalRequestModel>(
  'ApprovalRequest',
  approvalRequestSchema
);