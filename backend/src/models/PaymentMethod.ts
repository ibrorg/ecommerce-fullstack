import mongoose, { Document, Schema } from 'mongoose';

/**
 * PaymentMethod
 * 
 * Stores user payment methods (credit cards, PayPal, etc.)
 * Uses tokenization - never stores actual card numbers
 * PCI-DSS compliant
 */

export enum PaymentMethodType {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay',
  BANK_TRANSFER = 'bank_transfer',
  CRYPTO = 'crypto',
}

export enum PaymentMethodStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DECLINED = 'declined',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

export interface ICard {
  brand: string; // visa, mastercard, amex, discover
  last4: string; // Last 4 digits
  expMonth: number; // 1-12
  expYear: number; // 2025+
  fingerprint: string; // Stripe/PayPal fingerprint for duplicate detection
  country: string; // Card issuing country
  postalCode?: string; // For AVS checks
}

export interface IPayPalAccount {
  email: string;
  paypalId: string;
  verified: boolean;
  verifiedAt?: Date;
}

export interface IBankAccount {
  accountName: string;
  accountNumber: string; // Last 4 only
  routingNumber?: string;
  bankName: string;
  country: string;
}

export interface IPaymentMethod extends Document {
  user: mongoose.Types.ObjectId;
  type: PaymentMethodType;
  status: PaymentMethodStatus;
  
  // Tokenization (never store actual card/account data)
  stripeTokenId?: string; // Stripe payment method ID
  paypalTokenId?: string; // PayPal token
  
  // Payment details (tokenized)
  card?: ICard;
  paypal?: IPayPalAccount;
  bankAccount?: IBankAccount;
  
  // Usage tracking
  isDefault: boolean;
  displayName: string; // User-friendly name: "My Visa", "PayPal"
  lastUsedAt?: Date;
  usageCount: number;
  
  // Risk data
  riskScore: number; // 0-100, based on decline rate, country, etc.
  declineCount: number; // Number of times this method declined
  declineRate: number; // 0-1 (declines / total attempts)
  lastDeclineAt?: Date;
  lastDeclineReason?: string;
  
  // Fraud data
  isFlagged: boolean;
  flaggedAt?: Date;
  flaggedReason?: string;
  
  // Metadata
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  // Instance methods
  getDisplayInfo(): any;
  markAsUsed(): Promise<IPaymentMethod>;
  recordDecline(reason: string): Promise<IPaymentMethod>;
  flag(reason: string): Promise<IPaymentMethod>;
  unflag(): Promise<IPaymentMethod>;
  delete(): Promise<IPaymentMethod>;
}

// Static methods interface
export interface IPaymentMethodModel extends mongoose.Model<IPaymentMethod> {
  findDefault(userId: mongoose.Types.ObjectId): Promise<IPaymentMethod | null>;
  findActive(userId: mongoose.Types.ObjectId): Promise<IPaymentMethod[]>;
  findByCardFingerprint(fingerprint: string): Promise<IPaymentMethod[]>;
  findRisky(minRiskScore?: number, limit?: number): Promise<IPaymentMethod[]>;
  createPaymentMethod(
    userId: mongoose.Types.ObjectId,
    type: PaymentMethodType,
    tokenId: string,
    displayName: string,
    details: any
  ): Promise<IPaymentMethod>;
}

const cardSchema = new Schema<ICard>({
  brand: {
    type: String,
    enum: ['visa', 'mastercard', 'amex', 'discover'],
    required: true,
  },
  last4: {
    type: String,
    required: true,
    minlength: 4,
    maxlength: 4,
  },
  expMonth: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  expYear: {
    type: Number,
    required: true,
    min: new Date().getFullYear(),
  },
  fingerprint: {
    type: String,
    required: true,
    index: true,
  },
  country: {
    type: String,
    required: true,
  },
  postalCode: String,
});

const paypalSchema = new Schema<IPayPalAccount>({
  email: {
    type: String,
    required: true,
  },
  paypalId: {
    type: String,
    required: true,
    index: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verifiedAt: Date,
});

const bankSchema = new Schema<IBankAccount>({
  accountName: {
    type: String,
    required: true,
  },
  accountNumber: {
    type: String,
    required: true,
  },
  routingNumber: String,
  bankName: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
});

const paymentMethodSchema = new Schema<IPaymentMethod>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(PaymentMethodType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentMethodStatus),
      default: PaymentMethodStatus.ACTIVE,
      index: true,
    },
    stripeTokenId: {
      type: String,
      sparse: true,
      index: true,
    },
    paypalTokenId: {
      type: String,
      sparse: true,
      index: true,
    },
    card: cardSchema,
    paypal: paypalSchema,
    bankAccount: bankSchema,
    isDefault: {
      type: Boolean,
      default: false,
    },
    displayName: {
      type: String,
      required: true,
    },
    lastUsedAt: Date,
    usageCount: {
      type: Number,
      default: 0,
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    declineCount: {
      type: Number,
      default: 0,
    },
    declineRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    lastDeclineAt: Date,
    lastDeclineReason: String,
    isFlagged: {
      type: Boolean,
      default: false,
    },
    flaggedAt: Date,
    flaggedReason: String,
    billingAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
paymentMethodSchema.index({ user: 1, status: 1 });
paymentMethodSchema.index({ user: 1, isDefault: 1 });
paymentMethodSchema.index({ user: 1, createdAt: -1 });
paymentMethodSchema.index({ stripeTokenId: 1 }, { sparse: true });
paymentMethodSchema.index({ paypalTokenId: 1 }, { sparse: true });
paymentMethodSchema.index({ 'card.fingerprint': 1 }, { sparse: true });

/**
 * Get safe display of payment method (for UI)
 */
paymentMethodSchema.methods.getDisplayInfo = function () {
  const method: any = {
    id: this._id,
    displayName: this.displayName,
    type: this.type,
    isDefault: this.isDefault,
    status: this.status,
    riskScore: this.riskScore,
  };

  if (this.card) {
    method.cardLast4 = this.card.last4;
    method.cardBrand = this.card.brand;
    method.cardExpiry = `${this.card.expMonth}/${this.card.expYear}`;
    method.cardCountry = this.card.country;
  }

  if (this.paypal) {
    method.paypalEmail = this.paypal.email;
  }

  return method;
};

/**
 * Mark as used (for tracking)
 */
paymentMethodSchema.methods.markAsUsed = async function () {
  this.lastUsedAt = new Date();
  this.usageCount = (this.usageCount || 0) + 1;
  return this.save();
};

/**
 * Record decline event
 */
paymentMethodSchema.methods.recordDecline = async function (reason: string) {
  this.declineCount = (this.declineCount || 0) + 1;
  this.lastDeclineAt = new Date();
  this.lastDeclineReason = reason;
  
  // Recalculate decline rate
  if (this.usageCount > 0) {
    this.declineRate = this.declineCount / this.usageCount;
  }

  return this.save();
};

/**
 * Flag as risky
 */
paymentMethodSchema.methods.flag = async function (reason: string) {
  this.isFlagged = true;
  this.flaggedAt = new Date();
  this.flaggedReason = reason;
  this.status = PaymentMethodStatus.SUSPENDED;
  return this.save();
};

/**
 * Unflag payment method
 */
paymentMethodSchema.methods.unflag = async function () {
  this.isFlagged = false;
  this.flaggedAt = undefined;
  this.flaggedReason = undefined;
  this.status = PaymentMethodStatus.ACTIVE;
  return this.save();
};

/**
 * Soft delete payment method
 */
paymentMethodSchema.methods.delete = async function () {
  this.deletedAt = new Date();
  this.status = PaymentMethodStatus.DELETED;
  return this.save();
};

/**
 * Find user's default payment method
 */
paymentMethodSchema.statics.findDefault = function (userId: mongoose.Types.ObjectId) {
  return this.findOne({
    user: userId,
    isDefault: true,
    status: PaymentMethodStatus.ACTIVE,
    deletedAt: null,
  });
};

/**
 * Find active payment methods for user
 */
paymentMethodSchema.statics.findActive = function (userId: mongoose.Types.ObjectId) {
  return this.find({
    user: userId,
    status: PaymentMethodStatus.ACTIVE,
    deletedAt: null,
  }).sort({ isDefault: -1, lastUsedAt: -1 });
};

/**
 * Find by fingerprint (duplicate detection)
 */
paymentMethodSchema.statics.findByCardFingerprint = function (fingerprint: string) {
  return this.find({ 'card.fingerprint': fingerprint, deletedAt: null });
};

/**
 * Find risky payment methods
 */
paymentMethodSchema.statics.findRisky = function (minRiskScore: number = 60, limit: number = 100) {
  return this.find({
    riskScore: { $gte: minRiskScore },
    status: PaymentMethodStatus.ACTIVE,
    deletedAt: null,
  })
    .sort({ riskScore: -1 })
    .limit(limit);
};

/**
 * Create new payment method
 */
paymentMethodSchema.statics.createPaymentMethod = function (
  userId: mongoose.Types.ObjectId,
  type: PaymentMethodType,
  tokenId: string,
  displayName: string,
  details: any
) {
  const method: any = {
    user: userId,
    type,
    displayName,
  };

  if (type === PaymentMethodType.CREDIT_CARD || type === PaymentMethodType.DEBIT_CARD) {
    method.stripeTokenId = tokenId;
    method.card = details.card;
  } else if (type === PaymentMethodType.PAYPAL) {
    method.paypalTokenId = tokenId;
    method.paypal = details.paypal;
  } else if (type === PaymentMethodType.BANK_TRANSFER) {
    method.bankAccount = details.bankAccount;
  }

  return this.create(method);
};

export const PaymentMethod = mongoose.model<IPaymentMethod, IPaymentMethodModel>('PaymentMethod', paymentMethodSchema);
