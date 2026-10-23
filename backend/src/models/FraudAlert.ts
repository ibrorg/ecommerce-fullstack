import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * FraudAlert Model
 * 
 * Immutable record of fraud detections and investigations
 * Used for security monitoring, pattern analysis, and compliance
 * 
 * Design:
 * - Immutable (no updates after creation, only resolution field changes)
 * - Append-only audit trail
 * - Multi-signal detection (velocity, duplicate, refund patterns, payment failures)
 * - Risk-based routing (high risk → auto-block, medium → review, low → monitor)
 * - Investigation tracking (analyst notes, decisions, actions taken)
 * 
 * Compliance:
 * - PCI DSS: Fraud detection and prevention logging
 * - SOX: Financial fraud detection trail
 * - GDPR: User fraud/risk tracking for account management
 * - General: Complete fraud investigation history
 */

export enum FraudAlertType {
  // Velocity-based (too many actions in short time)
  VELOCITY_ORDERS = 'VELOCITY_ORDERS',
  VELOCITY_REFUNDS = 'VELOCITY_REFUNDS',
  VELOCITY_PAYMENTS = 'VELOCITY_PAYMENTS',
  VELOCITY_SIGNUPS = 'VELOCITY_SIGNUPS',

  // Duplicate detection
  DUPLICATE_ACCOUNT = 'DUPLICATE_ACCOUNT', // Same IP/device as other accounts
  DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT', // Same card/email across accounts

  // Refund patterns (abuse)
  REFUND_RATE_HIGH = 'REFUND_RATE_HIGH', // >50% of orders refunded
  REFUND_VALUE_HIGH = 'REFUND_VALUE_HIGH', // Requesting very high refund
  REFUND_PATTERN = 'REFUND_PATTERN', // Pattern: buy → refund → repeat
  REFUND_FRAUD = 'REFUND_FRAUD', // High risk refund fraud detected

  // Payment issues
  PAYMENT_DECLINED = 'PAYMENT_DECLINED', // Multiple failed payments
  PAYMENT_MISMATCH = 'PAYMENT_MISMATCH', // Card holder ≠ delivery address
  CARD_RISK = 'CARD_RISK', // Card flagged as high-risk by processor

  // Device & account issues
  NEW_DEVICE_HIGH_VALUE = 'NEW_DEVICE_HIGH_VALUE', // New device + large order
  ACCOUNT_TAKEOVER = 'ACCOUNT_TAKEOVER', // Unusual login + activity
  MULTIPLE_ACCOUNTS = 'MULTIPLE_ACCOUNTS', // User operating multiple accounts
  PASSWORD_RESET_ABUSE = 'PASSWORD_RESET_ABUSE', // Password reset + immediate activity

  // Shipping issues
  SHIPPING_MISMATCH = 'SHIPPING_MISMATCH', // Address changes or VPN
  SHIPPING_HIGH_RISK = 'SHIPPING_HIGH_RISK', // Destination is high-fraud zone
  EXPRESS_SHIPPING_PATTERN = 'EXPRESS_SHIPPING_PATTERN', // High-value + express to new address

  // User behavior
  BEHAVIOR_ANOMALY = 'BEHAVIOR_ANOMALY', // Deviation from baseline
  SELLER_COLLUSION = 'SELLER_COLLUSION', // Suspicious seller/buyer relationship
  REVIEW_MANIPULATION = 'REVIEW_MANIPULATION', // Fake reviews from linked accounts

  // System alerts
  BLACKLIST_HIT = 'BLACKLIST_HIT', // User/email/IP on fraud blacklist
  MANUAL_INVESTIGATION = 'MANUAL_INVESTIGATION', // Admin flagged manually
  EXTERNAL_PROVIDER_ALERT = 'EXTERNAL_PROVIDER_ALERT', // 3rd party (payment processor, etc)
}

export enum FraudRiskLevel {
  LOW = 'low', // Monitor but allow (adjust limits)
  MEDIUM = 'medium', // Review by analyst before allowing
  HIGH = 'high', // Block until reviewed and approved
  CRITICAL = 'critical', // Immediate blocking, escalation required
}

export enum FraudAlertStatus {
  DETECTED = 'detected', // Initial detection
  INVESTIGATING = 'investigating', // Under analyst review
  APPROVED = 'approved', // Analyst approved the action (legitimate)
  BLOCKED = 'blocked', // Action blocked pending further review
  RESOLVED = 'resolved', // Investigation complete, action taken
  FALSE_POSITIVE = 'false_positive', // Fraud detected but user confirmed legitimate
  ESCALATED = 'escalated', // Escalated to law enforcement/payment processor
}

/**
 * Detection signal - individual rule that triggered
 * Multiple signals combine for risk score
 */
export interface DetectionSignal {
  signalType: string; // e.g., "velocity_orders", "duplicate_account"
  severity: 'low' | 'medium' | 'high' | 'critical'; // Individual signal severity
  score: number; // 0-100 contribution to overall risk
  details: Record<string, any>; // Signal-specific data (count, threshold, etc.)
  detectedAt: Date;
}

/**
 * Investigation details
 * Tracks analyst review and decision
 */
export interface InvestigationDetails {
  analyst?: {
    userId: mongoose.Types.ObjectId;
    email?: string;
    name?: string;
  };
  notes?: string; // Analyst investigation notes
  decision?: 'approve' | 'block' | 'allow_with_limits'; // Investigation outcome
  decisionReason?: string;
  decidedAt?: Date;
  escalatedTo?: 'law_enforcement' | 'payment_processor' | 'customer'; // Who informed
  escalatedAt?: Date;
}

/**
 * Action taken in response to fraud alert
 */
export interface FraudAction {
  type:
    | 'block_order'
    | 'block_payment'
    | 'suspend_account'
    | 'require_verification'
    | 'limit_order_value'
    | 'require_approval';
  timestamp: Date;
  result: 'success' | 'failed' | 'pending'; // Was action applied?
  details?: Record<string, any>;
}

export interface IFraudAlert extends Document {
  // Identity
  _id: mongoose.Types.ObjectId;
  alertId: string; // Human-readable: FA-{type}-{timestamp}-{random}

  // What triggered alert
  alertType: FraudAlertType;
  riskLevel: FraudRiskLevel;
  status: FraudAlertStatus;
  riskScore: number; // 0-100 composite score

  // Who/what
  userId: mongoose.Types.ObjectId;
  email: string;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;

  // Context
  contextType: 'order' | 'payment' | 'account' | 'refund' | 'login'; // What user was doing
  contextId?: mongoose.Types.ObjectId; // Order ID, payment ID, etc.
  contextData: Record<string, any>; // Order amount, refund reason, etc.

  // Detection
  detectionSignals: DetectionSignal[]; // Which rules fired
  detectedAt: Date;
  detectionMethod: 'automated' | 'manual' | 'external'; // How detected

  // Investigation
  investigation: InvestigationDetails;
  actions: FraudAction[];

  // Timing
  createdAt: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;

  // Relationships (for correlation analysis)
  linkedAlerts?: mongoose.Types.ObjectId[]; // Other alerts for same user
  linkedAccounts?: mongoose.Types.ObjectId[]; // Suspected duplicate accounts

  // Methods
  isResolved(): boolean;
  escalate(to: 'law_enforcement' | 'payment_processor', reason: string): Promise<void>;
  approve(analyst: mongoose.Types.ObjectId, reason: string): Promise<void>;
  block(analyst: mongoose.Types.ObjectId, reason: string): Promise<void>;
}

// Static methods interface
export interface IFraudAlertModel extends Model<IFraudAlert> {
  createAlert(
    alertType: FraudAlertType,
    userId: mongoose.Types.ObjectId,
    email: string,
    riskScore: number,
    signals: DetectionSignal[],
    contextType: 'order' | 'payment' | 'account' | 'refund' | 'login',
    contextData: Record<string, any>,
    detectionMethod?: 'automated' | 'manual' | 'external',
    metadata?: {
      userAgent?: string;
      ipAddress?: string;
      deviceId?: string;
      contextId?: mongoose.Types.ObjectId;
    }
  ): Promise<IFraudAlert>;
  findPending(riskLevel?: FraudRiskLevel, limit?: number): Promise<IFraudAlert[]>;
  findByUser(userId: mongoose.Types.ObjectId, limit?: number): Promise<IFraudAlert[]>;
  findRelated(alert: IFraudAlert): Promise<IFraudAlert[]>;
}

const fraudAlertSchema = new Schema<IFraudAlert>(
  {
    alertId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    alertType: {
      type: String,
      enum: Object.values(FraudAlertType),
      required: true,
      index: true,
    },

    riskLevel: {
      type: String,
      enum: Object.values(FraudRiskLevel),
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(FraudAlertStatus),
      default: FraudAlertStatus.DETECTED,
      index: true,
    },

    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },

    userAgent: String,
    ipAddress: {
      type: String,
      index: true,
    },
    deviceId: String,

    contextType: {
      type: String,
      enum: ['order', 'payment', 'account', 'refund', 'login'],
      required: true,
      index: true,
    },

    contextId: Schema.Types.ObjectId,

    contextData: {
      type: Schema.Types.Mixed,
      // e.g., for order context:
      // { orderId, amount, items, destination, shippingMethod }
      // e.g., for payment context:
      // { cardLast4, processor, amount, currency }
      // e.g., for account context:
      // { loginCount, newLoginLocation, passwordReset }
    },

    detectionSignals: [
      {
        signalType: {
          type: String,
          required: true,
        },
        severity: {
          type: String,
          enum: ['low', 'medium', 'high', 'critical'],
          required: true,
        },
        score: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        details: Schema.Types.Mixed,
        detectedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    detectedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    detectionMethod: {
      type: String,
      enum: ['automated', 'manual', 'external'],
      required: true,
    },

    investigation: {
      analyst: {
        userId: Schema.Types.ObjectId,
        email: String,
        name: String,
      },
      notes: String,
      decision: {
        type: String,
        enum: ['approve', 'block', 'allow_with_limits'],
      },
      decisionReason: String,
      decidedAt: Date,
      escalatedTo: {
        type: String,
        enum: ['law_enforcement', 'payment_processor', 'customer'],
      },
      escalatedAt: Date,
    },

    actions: [
      {
        type: {
          type: String,
          enum: [
            'block_order',
            'block_payment',
            'suspend_account',
            'require_verification',
            'limit_order_value',
            'require_approval',
          ],
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        result: {
          type: String,
          enum: ['success', 'failed', 'pending'],
          default: 'pending',
        },
        details: Schema.Types.Mixed,
      },
    ],

    resolvedAt: Date,
    resolutionNotes: String,

    linkedAlerts: [Schema.Types.ObjectId],
    linkedAccounts: [Schema.Types.ObjectId],
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for query performance
 */
fraudAlertSchema.index({ userId: 1, detectedAt: -1 }); // User's alerts
fraudAlertSchema.index({ riskLevel: 1, status: 1 }); // For dashboard filtering
fraudAlertSchema.index({ alertType: 1, detectedAt: -1 }); // By alert type
fraudAlertSchema.index({ contextType: 1, contextId: 1 }); // By what triggered
fraudAlertSchema.index({ ipAddress: 1, detectedAt: -1 }); // IP-based attacks
fraudAlertSchema.index({ email: 1, detectedAt: -1 }); // Email fraud patterns
fraudAlertSchema.index({ status: 1, detectedAt: -1 }); // Unresolved alerts

/**
 * Instance Methods
 */

fraudAlertSchema.methods.isResolved = function (): boolean {
  return [FraudAlertStatus.RESOLVED, FraudAlertStatus.FALSE_POSITIVE].includes(this.status);
};

fraudAlertSchema.methods.escalate = async function (
  to: 'law_enforcement' | 'payment_processor',
  reason: string
): Promise<void> {
  this.investigation.escalatedTo = to;
  this.investigation.escalatedAt = new Date();
  this.status = FraudAlertStatus.ESCALATED;
  this.resolutionNotes = reason;
  await this.save();
};

fraudAlertSchema.methods.approve = async function (
  analyst: mongoose.Types.ObjectId,
  reason: string
): Promise<void> {
  this.investigation.analyst = {
    userId: analyst,
  };
  this.investigation.decision = 'approve';
  this.investigation.decisionReason = reason;
  this.investigation.decidedAt = new Date();
  this.status = FraudAlertStatus.APPROVED;
  this.resolvedAt = new Date();
  await this.save();
};

fraudAlertSchema.methods.block = async function (
  analyst: mongoose.Types.ObjectId,
  reason: string
): Promise<void> {
  this.investigation.analyst = {
    userId: analyst,
  };
  this.investigation.decision = 'block';
  this.investigation.decisionReason = reason;
  this.investigation.decidedAt = new Date();
  this.status = FraudAlertStatus.BLOCKED;
  await this.save();
};

/**
 * Static Methods
 */

fraudAlertSchema.statics.createAlert = async function (
  alertType: FraudAlertType,
  userId: mongoose.Types.ObjectId,
  email: string,
  riskScore: number,
  signals: DetectionSignal[],
  contextType: 'order' | 'payment' | 'account' | 'refund' | 'login',
  contextData: Record<string, any>,
  detectionMethod: 'automated' | 'manual' | 'external' = 'automated',
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    deviceId?: string;
    contextId?: mongoose.Types.ObjectId;
  }
): Promise<IFraudAlert> {
  // Determine risk level from score
  let riskLevel: FraudRiskLevel;
  if (riskScore >= 80) {
    riskLevel = FraudRiskLevel.CRITICAL;
  } else if (riskScore >= 60) {
    riskLevel = FraudRiskLevel.HIGH;
  } else if (riskScore >= 40) {
    riskLevel = FraudRiskLevel.MEDIUM;
  } else {
    riskLevel = FraudRiskLevel.LOW;
  }

  // Generate alert ID
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const alertId = `FA-${alertType}-${timestamp}-${random}`;

  return this.create({
    alertId,
    alertType,
    riskLevel,
    riskScore,
    userId,
    email,
    detectionSignals: signals,
    detectedAt: new Date(),
    detectionMethod,
    contextType,
    contextData,
    contextId: metadata?.contextId,
    userAgent: metadata?.userAgent,
    ipAddress: metadata?.ipAddress,
    deviceId: metadata?.deviceId,
  });
};

/**
 * Find pending alerts for analyst review
 */
fraudAlertSchema.statics.findPending = async function (
  riskLevel?: FraudRiskLevel,
  limit: number = 50
): Promise<IFraudAlert[]> {
  const query: any = {
    status: { $in: [FraudAlertStatus.DETECTED, FraudAlertStatus.INVESTIGATING] },
  };

  if (riskLevel) {
    query.riskLevel = riskLevel;
  }

  return this.find(query)
    .sort({ riskScore: -1, detectedAt: -1 }) // Critical first
    .limit(limit)
    .populate('userId', 'email firstName lastName role');
};

/**
 * Find alerts by user
 */
fraudAlertSchema.statics.findByUser = async function (
  userId: mongoose.Types.ObjectId,
  limit: number = 50
): Promise<IFraudAlert[]> {
  return this.find({ userId })
    .sort({ detectedAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Find related alerts (same IP, email, device)
 */
fraudAlertSchema.statics.findRelated = async function (
  alert: IFraudAlert
): Promise<IFraudAlert[]> {
  const query: any = {
    _id: { $ne: alert._id },
    detectedAt: {
      $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    },
  };

  // Find alerts with same IP, email, or device
  const conditions = [];
  if (alert.ipAddress) conditions.push({ ipAddress: alert.ipAddress });
  if (alert.email) conditions.push({ email: alert.email });
  if (alert.deviceId) conditions.push({ deviceId: alert.deviceId });

  if (conditions.length > 0) {
    query.$or = conditions;
  }

  return this.find(query).limit(100);
};

export const FraudAlert = mongoose.model<IFraudAlert, IFraudAlertModel>(
  'FraudAlert',
  fraudAlertSchema
);
