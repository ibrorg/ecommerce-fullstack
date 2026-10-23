import mongoose, { Document, Schema, Model, Types } from 'mongoose';

/**
 * BehaviorPattern Model
 * 
 * User baseline behavior profile for anomaly detection
 * Captures normal patterns so we can detect deviations
 * 
 * Design:
 * - One profile per user
 * - Updated after each significant action (order, refund, login)
 * - Calculates running averages and baselines
 * - Compared against for anomaly detection
 * 
 * Patterns tracked:
 * - Order frequency (orders per week)
 * - Average order value
 * - Preferred payment methods
 * - Shipping destinations
 * - Time of day (when user is active)
 * - Device consistency
 * - Refund rate and reasons
 * - Product categories purchased
 * 
 * Anomaly detection:
 * - Order value 10x higher than baseline = anomaly
 * - Order frequency 5x higher = velocity spike
 * - New country = new destination
 * - Time zone change = account takeover risk
 * - New payment method = flagged for verification
 */

// Static methods interface
export interface IBehaviorPatternModel extends Model<IBehaviorPattern> {
  findOrCreateByUserId(userId: Types.ObjectId): Promise<IBehaviorPattern>;
  findAnomalousUsers(minScore?: number, limit?: number): Promise<IBehaviorPattern[]>;
  findHighRefundRate(minRate?: number, limit?: number): Promise<IBehaviorPattern[]>;
}

export interface OrderPattern {
  count: number; // Total orders
  avgValue: number; // Average order value
  minValue: number;
  maxValue: number;
  stdDev: number; // Standard deviation (volatility)
  lastOrderAt?: Date;
  // Temporal
  daysActiveDuringWeek: number[]; // [0,1,2,3,4,5,6] = which days active
  avgTimeOfDayHour?: number; // 0-23, when user typically orders
}

export interface RefundPattern {
  count: number; // Total refunds
  rate: number; // refunds / orders (0-1)
  avgRefundValue: number;
  topReasons: Array<{ reason: string; count: number }>; // Most common reasons
  lastRefundAt?: Date;
}

export interface PaymentPattern {
  preferredPaymentMethods: Array<{
    method: 'credit_card' | 'debit_card' | 'wallet' | 'bank_transfer';
    cardBrand?: string; // visa, mastercard, amex
    count: number;
    successRate: number;
  }>;
  declinedPayments: number;
  declineRate: number;
}

export interface ShippingPattern {
  preferredAddresses: Array<{
    address: string;
    city: string;
    country: string;
    count: number;
  }>;
  preferredCarrier?: string;
  expressShippingRate: number; // % of orders with express
}

export interface ProductPattern {
  preferredCategories: Array<{
    category: string;
    count: number;
    avgValue: number;
  }>;
  priceRange: { min: number; max: number }; // Normal price points
}

export interface LoginPattern {
  avgLoginFrequency: number; // logins per week
  preferredDevices: Array<{
    deviceId: string;
    count: number;
  }>;
  preferredCountries: string[];
  preferredTimezone?: string;
  failureRate: number; // failed logins / total attempts
}

export interface IBehaviorPattern extends Document {
  // Identity
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;

  // Patterns
  orders: OrderPattern;
  refunds: RefundPattern;
  payments: PaymentPattern;
  shipping: ShippingPattern;
  products: ProductPattern;
  logins: LoginPattern;

  // Risk indicators
  isAnomaly: boolean; // Current behavior deviates from baseline?
  anomalyScore: number; // 0-100 how much deviation
  anomalyReasons: string[]; // Which patterns are abnormal

  // Confidence in baseline
  orderCount: number; // Total observations (higher = more confident)
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  recordOrder(amount: number, category: string, shippingCountry: string, timeOfDay: number): Promise<void>;
  recordRefund(amount: number, reason: string): Promise<void>;
  recordPayment(method: string, success: boolean): Promise<void>;
  recordLogin(deviceId: string, country: string, timezone: string): Promise<void>;
  calculateAnomalyScore(): number;
  detectAnomalies(): string[]; // Returns list of detected anomalies
  hasConfidentBaseline(): boolean; // Do we have enough data?
}

const behaviorPatternSchema = new Schema<IBehaviorPattern>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    orders: {
      count: { type: Number, default: 0 },
      avgValue: { type: Number, default: 0 },
      minValue: { type: Number, default: 0 },
      maxValue: { type: Number, default: 0 },
      stdDev: { type: Number, default: 0 },
      lastOrderAt: Date,
      daysActiveDuringWeek: [Number],
      avgTimeOfDayHour: Number,
    },

    refunds: {
      count: { type: Number, default: 0 },
      rate: { type: Number, default: 0, min: 0, max: 1 },
      avgRefundValue: { type: Number, default: 0 },
      topReasons: [
        {
          reason: String,
          count: Number,
        },
      ],
      lastRefundAt: Date,
    },

    payments: {
      preferredPaymentMethods: [
        {
          method: {
            type: String,
            enum: ['credit_card', 'debit_card', 'wallet', 'bank_transfer'],
          },
          cardBrand: String,
          count: Number,
          successRate: Number,
        },
      ],
      declinedPayments: { type: Number, default: 0 },
      declineRate: { type: Number, default: 0, min: 0, max: 1 },
    },

    shipping: {
      preferredAddresses: [
        {
          address: String,
          city: String,
          country: String,
          count: Number,
        },
      ],
      preferredCarrier: String,
      expressShippingRate: { type: Number, default: 0, min: 0, max: 1 },
    },

    products: {
      preferredCategories: [
        {
          category: String,
          count: Number,
          avgValue: Number,
        },
      ],
      priceRange: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 0 },
      },
    },

    logins: {
      avgLoginFrequency: { type: Number, default: 0 },
      preferredDevices: [
        {
          deviceId: String,
          count: Number,
        },
      ],
      preferredCountries: [String],
      preferredTimezone: String,
      failureRate: { type: Number, default: 0, min: 0, max: 1 },
    },

    isAnomaly: { type: Boolean, default: false },
    anomalyScore: { type: Number, default: 0, min: 0, max: 100 },
    anomalyReasons: [String],

    orderCount: { type: Number, default: 0 },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

/**
 * Instance Methods
 */

behaviorPatternSchema.methods.recordOrder = async function (
  amount: number,
  category: string,
  shippingCountry: string,
  timeOfDay: number // 0-23
): Promise<void> {
  // Update order stats using running average
  const count = this.orders.count + 1;
  const newAvg = (this.orders.avgValue * this.orders.count + amount) / count;

  this.orders.count = count;
  this.orders.avgValue = newAvg;
  this.orders.minValue = Math.min(this.orders.minValue || amount, amount);
  this.orders.maxValue = Math.max(this.orders.maxValue || amount, amount);
  this.orders.lastOrderAt = new Date();

  // Track time of day
  if (this.orders.avgTimeOfDayHour === undefined) {
    this.orders.avgTimeOfDayHour = timeOfDay;
  } else {
    this.orders.avgTimeOfDayHour =
      (this.orders.avgTimeOfDayHour * (count - 1) + timeOfDay) / count;
  }

  // Track product categories
  const existingCategory = this.products.preferredCategories.find((c: { category: string; count: number; avgValue: number }) => c.category === category);
  if (existingCategory) {
    existingCategory.count++;
    existingCategory.avgValue = (existingCategory.avgValue + amount) / 2;
  } else {
    this.products.preferredCategories.push({ category, count: 1, avgValue: amount });
  }

  // Track shipping destinations
  const existingAddress = this.shipping.preferredAddresses.find((a: { address: string; city: string; country: string; count: number }) => a.country === shippingCountry);
  if (existingAddress) {
    existingAddress.count++;
  } else {
    this.shipping.preferredAddresses.push({
      address: shippingCountry,
      city: 'N/A',
      country: shippingCountry,
      count: 1,
    });
  }

  this.orderCount = count;
  this.lastUpdatedAt = new Date();
  this.anomalyScore = this.calculateAnomalyScore();
  await this.save();
};

behaviorPatternSchema.methods.recordRefund = async function (amount: number, reason: string): Promise<void> {
  this.refunds.count++;
  this.refunds.rate = this.orders.count > 0 ? this.refunds.count / this.orders.count : 0;
  this.refunds.avgRefundValue = (this.refunds.avgRefundValue + amount) / 2;
  this.refunds.lastRefundAt = new Date();

  // Track refund reasons
  const existingReason = this.refunds.topReasons.find((r: { reason: string; count: number }) => r.reason === reason);
  if (existingReason) {
    existingReason.count++;
  } else {
    this.refunds.topReasons.push({ reason, count: 1 });
  }

  // Sort by count
  this.refunds.topReasons.sort((a: { reason: string; count: number }, b: { reason: string; count: number }) => b.count - a.count);

  this.lastUpdatedAt = new Date();
  this.anomalyScore = this.calculateAnomalyScore();
  await this.save();
};

behaviorPatternSchema.methods.recordPayment = async function (method: string, success: boolean): Promise<void> {
  const existing = this.payments.preferredPaymentMethods.find((p: { method: string; cardBrand?: string; count: number; successRate: number }) => p.method === method);
  if (existing) {
    existing.count++;
    existing.successRate = success ? (existing.successRate + 1) / 2 : existing.successRate * 0.9;
  } else {
    this.payments.preferredPaymentMethods.push({
      method: method as any,
      count: 1,
      successRate: success ? 1 : 0,
    });
  }

  if (!success) {
    this.payments.declinedPayments++;
  }

  const totalPayments = this.orders.count;
  this.payments.declineRate = totalPayments > 0 ? this.payments.declinedPayments / totalPayments : 0;

  this.lastUpdatedAt = new Date();
  this.anomalyScore = this.calculateAnomalyScore();
  await this.save();
};

behaviorPatternSchema.methods.recordLogin = async function (
  deviceId: string,
  country: string,
  timezone: string
): Promise<void> {
  const existing = this.logins.preferredDevices.find((d: { deviceId: string; count: number }) => d.deviceId === deviceId);
  if (existing) {
    existing.count++;
  } else {
    this.logins.preferredDevices.push({ deviceId, count: 1 });
  }

  if (!this.logins.preferredCountries.includes(country)) {
    this.logins.preferredCountries.push(country);
  }

  this.logins.preferredTimezone = timezone;
  this.lastUpdatedAt = new Date();
  this.anomalyScore = this.calculateAnomalyScore();
  await this.save();
};

behaviorPatternSchema.methods.calculateAnomalyScore = function (): number {
  let score = 0;

  // Do we have enough data? (need at least 5 orders to have confidence)
  if (this.orders.count < 5) return 0;

  // Check what methods to detect
  const anomalies = this.detectAnomalies();
  this.anomalyReasons = anomalies;

  // Score based on number of anomalies
  score = Math.min(anomalies.length * 15, 100);
  this.isAnomaly = anomalies.length > 0;

  return score;
};

behaviorPatternSchema.methods.detectAnomalies = function (): string[] {
  const anomalies: string[] = [];

  if (this.orders.count < 5) return anomalies; // Not enough data

  // High refund rate
  if (this.refunds.rate > 0.5) {
    anomalies.push(`High refund rate: ${(this.refunds.rate * 100).toFixed(1)}%`);
  }

  // Very low payment success rate
  if (this.payments.declineRate > 0.3) {
    anomalies.push(`High decline rate: ${(this.payments.declineRate * 100).toFixed(1)}%`);
  }

  // New country (shipping)
  if (this.shipping.preferredAddresses.length > 3) {
    anomalies.push('Unusual shipping destination');
  }

  // New payment method
  if (
    this.payments.preferredPaymentMethods.length > 1 &&
    this.payments.preferredPaymentMethods[this.payments.preferredPaymentMethods.length - 1].count === 1
  ) {
    anomalies.push('New payment method');
  }

  // Unusual time of day
  if (this.orders.avgTimeOfDayHour !== undefined) {
    const hour = Math.round(this.orders.avgTimeOfDayHour);
    if (hour >= 2 && hour <= 5) {
      anomalies.push('Unusual purchase time (night)');
    }
  }

  return anomalies;
};

behaviorPatternSchema.methods.hasConfidentBaseline = function (): boolean {
  // Need at least 5-10 orders to be confident
  return this.orders.count >= 5;
};

/**
 * Static Methods
 */

behaviorPatternSchema.statics.findOrCreateByUserId = async function (
  userId: mongoose.Types.ObjectId
): Promise<IBehaviorPattern> {
  let pattern = await this.findOne({ userId });
  if (!pattern) {
    pattern = await this.create({ userId });
  }
  return pattern;
};

/**
 * Find users with anomalous behavior
 */
behaviorPatternSchema.statics.findAnomalousUsers = async function (
  minScore: number = 30,
  limit: number = 100
): Promise<IBehaviorPattern[]> {
  return this.find({
    isAnomaly: true,
    anomalyScore: { $gte: minScore },
    orderCount: { $gte: 5 }, // Only if confident baseline
  })
    .sort({ anomalyScore: -1 })
    .limit(limit)
    .populate('userId', 'email firstName lastName');
};

/**
 * Find high-risk users (high refund rate)
 */
behaviorPatternSchema.statics.findHighRefundRate = async function (
  minRate: number = 0.5,
  limit: number = 100
): Promise<IBehaviorPattern[]> {
  return this.find({
    'refunds.rate': { $gte: minRate },
    orderCount: { $gte: 5 },
  })
    .sort({ 'refunds.rate': -1 })
    .limit(limit)
    .populate('userId', 'email firstName lastName');
};

export const BehaviorPattern = mongoose.model<IBehaviorPattern, IBehaviorPatternModel>(
  'BehaviorPattern',
  behaviorPatternSchema
);
