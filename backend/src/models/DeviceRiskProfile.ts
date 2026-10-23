import mongoose, { Document, Schema, Model, Types } from 'mongoose';

// Static methods interface for DeviceRiskProfile
export interface IDeviceRiskProfileModel extends Model<IDeviceRiskProfile> {
  findOrCreateByDeviceId(deviceId: string): Promise<IDeviceRiskProfile>;
  findRiskyDevices(riskLevel?: DeviceRiskLevel, limit?: number): Promise<IDeviceRiskProfile[]>;
  findAccountFarms(minUsers?: number, limit?: number): Promise<IDeviceRiskProfile[]>;
  findImpossibleTravel(maxSecondsBetweenCountries?: number, limit?: number): Promise<IDeviceRiskProfile[]>;
}

/**
 * DeviceRiskProfile Model
 * 
 * Tracks per-device risk signals and patterns
 * Used to detect account takeover, stolen devices, and coordinated attacks
 * 
 * Design:
 * - One profile per unique device fingerprint
 * - Tracks login patterns, payment methods, velocity
 * - Updates after each use (not immutable - reflects current risk)
 * - Aggregates data for pattern analysis
 * 
 * Use Cases:
 * - "This device has been used by 47 different user accounts" → account farming
 * - "This device failed 150 logins in the last hour" → brute force attack
 * - "This device switched from Beijing to New York in 2 minutes" → impossible
 * - "Payment succeeds from this device 95% of the time vs 40% baseline" → fraudster
 */

export enum DeviceRiskLevel {
  LOW = 'low', // Trusted device
  MEDIUM = 'medium', // Some suspicious activity
  HIGH = 'high', // Multiple risk signals
  CRITICAL = 'critical', // Active attack or compromise
}

/**
 * Device login history - track login patterns
 */
export interface LoginRecord {
  userId: mongoose.Types.ObjectId;
  timestamp: Date;
  ipAddress: string;
  country?: string;
  city?: string;
  success: boolean;
  failureReason?: string;
}

/**
 * Payment success rate tracking
 */
export interface PaymentRecord {
  timestamp: Date;
  cardLast4: string;
  amount: number;
  currency: string;
  success: boolean;
  processor: string;
  declineCode?: string;
}

export interface IDeviceRiskProfile extends Document {
  // Identity
  _id: mongoose.Types.ObjectId;
  deviceId: string; // Hash of userAgent + IP combo (at time of creation)

  // Current state
  riskLevel: DeviceRiskLevel;
  riskScore: number; // 0-100
  lastSeenAt: Date;
  lastSeenUserId?: mongoose.Types.ObjectId;

  // Anomalies
  uniqueUserCount: number; // How many different users from this device? (high = farm)
  uniqueCountries: string[]; // Countries accessed from this device
  locationChangeVelocity?: number; // Fastest country change in seconds
  loginAttemptCount24h: number; // Failed logins in 24h
  passwordResetAttempts24h: number;

  // Payment patterns
  paymentSuccessRate: number; // 0-1 (how often payments succeed)
  preferredCardLast4?: string;
  preferredCardSuccessRate?: number;

  // Activity patterns
  ordersPlaced: number;
  ordersRefunded: number;
  averageOrderValue: number;
  suspiciousOrderPattern?: boolean;

  // Login history (last 100)
  loginHistory: LoginRecord[];

  // Payment history (last 50)
  paymentHistory: PaymentRecord[];

  // Blacklist status
  flaggedAt?: Date;
  flaggedReason?: string;
  blockedAt?: Date;
  blockReason?: string;

  // Timing
  firstSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  recordLogin(userId: mongoose.Types.ObjectId, ip: string, success: boolean): Promise<void>;
  recordPayment(
    amount: number,
    cardLast4: string,
    success: boolean,
    declineCode?: string
  ): Promise<void>;
  calculateRiskScore(): number;
  isBlocked(): boolean;
  flag(reason: string): Promise<void>;
  block(reason: string): Promise<void>;
  unblock(): Promise<void>;
}

const deviceRiskProfileSchema = new Schema<IDeviceRiskProfile>(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    riskLevel: {
      type: String,
      enum: Object.values(DeviceRiskLevel),
      default: DeviceRiskLevel.LOW,
      index: true,
    },

    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },

    lastSeenAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    lastSeenUserId: Schema.Types.ObjectId,

    uniqueUserCount: {
      type: Number,
      default: 1,
      index: true, // High value = suspicious
    },

    uniqueCountries: [String],

    locationChangeVelocity: Number, // seconds between location changes

    loginAttemptCount24h: {
      type: Number,
      default: 0,
    },

    passwordResetAttempts24h: {
      type: Number,
      default: 0,
    },

    paymentSuccessRate: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1,
    },

    preferredCardLast4: String,
    preferredCardSuccessRate: Number,

    ordersPlaced: {
      type: Number,
      default: 0,
    },

    ordersRefunded: {
      type: Number,
      default: 0,
    },

    averageOrderValue: {
      type: Number,
      default: 0,
    },

    suspiciousOrderPattern: Boolean,

    loginHistory: [
      {
        userId: Schema.Types.ObjectId,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        ipAddress: String,
        country: String,
        city: String,
        success: Boolean,
        failureReason: String,
      },
    ],

    paymentHistory: [
      {
        timestamp: {
          type: Date,
          default: Date.now,
        },
        cardLast4: String,
        amount: Number,
        currency: String,
        success: Boolean,
        processor: String,
        declineCode: String,
      },
    ],

    flaggedAt: Date,
    flaggedReason: String,
    blockedAt: Date,
    blockReason: String,

    firstSeenAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for performance
 */
deviceRiskProfileSchema.index({ riskScore: -1 }); // Find riskiest devices
deviceRiskProfileSchema.index({ blockedAt: 1 }); // Blocked devices
deviceRiskProfileSchema.index({ lastSeenAt: -1 }); // Recent activity
deviceRiskProfileSchema.index({ uniqueUserCount: 1 }); // Account farms

/**
 * Instance Methods
 */

deviceRiskProfileSchema.methods.recordLogin = async function (
  userId: mongoose.Types.ObjectId,
  ip: string,
  success: boolean
): Promise<void> {
  // Track unique users from this device
  const userExists = this.loginHistory.some((login: LoginRecord) => login.userId.equals(userId));
  if (!userExists) {
    this.uniqueUserCount++;
  }

  // Add login record (keep last 100)
  this.loginHistory.push({
    userId,
    timestamp: new Date(),
    ipAddress: ip,
    success,
  });

  if (this.loginHistory.length > 100) {
    this.loginHistory = this.loginHistory.slice(-100);
  }

  // Update failure counter for rate limiting
  if (!success) {
    this.loginAttemptCount24h++;

    // Reset counter every 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFailures = this.loginHistory.filter(
      (login: LoginRecord) => login.timestamp > oneDayAgo && !login.success
    );
    this.loginAttemptCount24h = recentFailures.length;
  }

  this.lastSeenAt = new Date();
  this.lastSeenUserId = userId;

  // Recalculate risk
  this.riskScore = this.calculateRiskScore();
  await this.save();
};

deviceRiskProfileSchema.methods.recordPayment = async function (
  amount: number,
  cardLast4: string,
  success: boolean,
  declineCode?: string
): Promise<void> {
  // Add payment record (keep last 50)
  this.paymentHistory.push({
    timestamp: new Date(),
    cardLast4,
    amount,
    currency: 'USD',
    success,
    processor: 'stripe', // TODO: Parameterize
    declineCode,
  });

  if (this.paymentHistory.length > 50) {
    this.paymentHistory = this.paymentHistory.slice(-50);
  }

  // Calculate payment success rate
  const totalPayments = this.paymentHistory.length;
  const successfulPayments = this.paymentHistory.filter((p: PaymentRecord) => p.success).length;
  this.paymentSuccessRate = totalPayments > 0 ? successfulPayments / totalPayments : 0.5;

  // Track preferred card
  const cardPayments = this.paymentHistory.filter((p: PaymentRecord) => p.cardLast4 === cardLast4);
  if (cardPayments.length > 0) {
    const cardSuccesses = cardPayments.filter((p: PaymentRecord) => p.success).length;
    this.preferredCardSuccessRate = cardSuccesses / cardPayments.length;
    this.preferredCardLast4 = cardLast4;
  }

  this.lastSeenAt = new Date();

  // Recalculate risk
  this.riskScore = this.calculateRiskScore();
  await this.save();
};

deviceRiskProfileSchema.methods.calculateRiskScore = function (): number {
  let score = 0;

  // Multiple accounts from same device = major red flag
  if (this.uniqueUserCount > 5) score += 40; // 5+ users = high risk
  else if (this.uniqueUserCount > 2) score += 20;

  // Rapid location changes
  if (this.locationChangeVelocity && this.locationChangeVelocity < 3600) {
    score += 30; // Country change < 1 hour
  }

  // Failed login attempts
  if (this.loginAttemptCount24h > 10) score += 20;
  if (this.loginAttemptCount24h > 50) score += 30;

  // Password reset abuse
  if (this.passwordResetAttempts24h > 3) score += 15;

  // Payment decline patterns
  if (this.paymentSuccessRate < 0.1) score += 25; // <10% success rate

  // Order refund rate
  if (this.ordersPlaced > 5) {
    const refundRate = this.ordersRefunded / this.ordersPlaced;
    if (refundRate > 0.8) score += 30; // 80%+ refund rate
    else if (refundRate > 0.5) score += 15;
  }

  // Already flagged
  if (this.flaggedAt) score += 10;
  if (this.blockedAt) score = 100; // Always blocked

  return Math.min(score, 100);
};

deviceRiskProfileSchema.methods.isBlocked = function (): boolean {
  return !!this.blockedAt;
};

deviceRiskProfileSchema.methods.flag = async function (reason: string): Promise<void> {
  this.flaggedAt = new Date();
  this.flaggedReason = reason;
  this.riskLevel = DeviceRiskLevel.HIGH;
  await this.save();
};

deviceRiskProfileSchema.methods.block = async function (reason: string): Promise<void> {
  this.blockedAt = new Date();
  this.blockReason = reason;
  this.riskLevel = DeviceRiskLevel.CRITICAL;
  this.riskScore = 100;
  await this.save();
};

deviceRiskProfileSchema.methods.unblock = async function (): Promise<void> {
  this.blockedAt = undefined;
  this.blockReason = undefined;
  this.riskScore = this.calculateRiskScore();
  await this.save();
};

/**
 * Static Methods
 */

deviceRiskProfileSchema.statics.create = async function (
  deviceId: string
): Promise<IDeviceRiskProfile> {
  return this.create({
    deviceId,
    riskLevel: DeviceRiskLevel.LOW,
    riskScore: 0,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
  });
};

/**
 * Find or create a device profile
 */
deviceRiskProfileSchema.statics.findOrCreateByDeviceId = async function (
  deviceId: string
): Promise<IDeviceRiskProfile> {
  let profile = await this.findOne({ deviceId });
  if (!profile) {
    profile = await this.create({ deviceId });
  }
  return profile;
};

/**
 * Find risky devices
 */
deviceRiskProfileSchema.statics.findRiskyDevices = async function (
  riskLevel?: DeviceRiskLevel,
  limit: number = 100
): Promise<IDeviceRiskProfile[]> {
  const query: any = {};
  if (riskLevel) {
    query.riskLevel = riskLevel;
  }

  return this.find(query)
    .sort({ riskScore: -1, lastSeenAt: -1 })
    .limit(limit);
};

/**
 * Find devices used by account farmers
 */
deviceRiskProfileSchema.statics.findAccountFarms = async function (
  minUsers: number = 5,
  limit: number = 50
): Promise<IDeviceRiskProfile[]> {
  return this.find({ uniqueUserCount: { $gte: minUsers } })
    .sort({ uniqueUserCount: -1 })
    .limit(limit);
};

/**
 * Find devices with rapid location changes (impossible travel)
 */
deviceRiskProfileSchema.statics.findImpossibleTravel = async function (
  maxSecondsBetweenCountries: number = 3600, // 1 hour
  limit: number = 50
): Promise<IDeviceRiskProfile[]> {
  return this.find({
    locationChangeVelocity: { $lt: maxSecondsBetweenCountries },
  })
    .sort({ locationChangeVelocity: 1 })
    .limit(limit);
};

export const DeviceRiskProfile = mongoose.model<IDeviceRiskProfile, IDeviceRiskProfileModel>(
  'DeviceRiskProfile',
  deviceRiskProfileSchema
);
