import mongoose, { Document, Schema } from 'mongoose';

/**
 * Transaction
 * 
 * Immutable record of all payment transactions
 * Tracks:
 * - Charge requests (from orders)
 * - Refunds (after returns)
 * - Disputes (chargebacks)
 * - Payment processor responses
 */

export enum TransactionType {
  CHARGE = 'charge', // Initial payment
  REFUND = 'refund', // Refund to customer
  PARTIAL_REFUND = 'partial_refund', // Partial refund
  REVERSAL = 'reversal', // Automatic reversal
  CHARGEBACK = 'chargeback', // Chargeback filed
  ADJUSTMENT = 'adjustment', // Processor adjustment
}

export enum TransactionStatus {
  PENDING = 'pending', // Awaiting processor
  PROCESSING = 'processing', // In flight
  SUCCEEDED = 'succeeded', // Successful
  FAILED = 'failed', // Failed
  DECLINED = 'declined', // Declined by processor
  EXPIRED = 'expired', // Request expired
  CANCELLED = 'cancelled', // Manually cancelled
  DISPUTED = 'disputed', // Chargeback filed
  REFUNDED = 'refunded', // Refunded
}

export interface IDeclineDetails {
  code: string; // Stripe decline code: insufficient_funds, lost_card, etc.
  message: string; // Human-readable decline reason
  retryable: boolean; // Can this be retried?
}

export interface IProcessor {
  name: string; // stripe, paypal, etc
  transactionId: string; // Processor transaction ID
  authorizationCode?: string; // Auth code from processor
  avsResult?: string; // AVS check result
  cvvResult?: string; // CVV check result
  riskLevel?: string; // Processor fraud risk level
  riskDetails?: Record<string, any>;
}

export interface ITransaction extends Document {
  // Reference
  order?: mongoose.Types.ObjectId; // Related order
  user: mongoose.Types.ObjectId; // Customer
  paymentMethod: mongoose.Types.ObjectId; // PaymentMethod used
  
  // Basic info
  type: TransactionType;
  status: TransactionStatus;
  amount: number; // In cents (USD: $10.00 = 1000)
  currency: string; // USD, EUR, etc
  
  // Processor info
  processor: IProcessor;
  declineDetails?: IDeclineDetails;
  
  // Risk/Fraud
  fraudScore?: number; // 0-100 from fraud detection
  fraudAlert?: mongoose.Types.ObjectId; // Link to FraudAlert if any
  
  // Metadata
  description: string; // "Order #12345" or "Refund for Order #12345"
  idempotencyKey: string; // For retries, ensures no double-charge
  
  // Timestamps
  requestedAt: Date; // When request made
  processedAt?: Date; // When processor responded
  completedAt?: Date; // When status finalized
  
  // Retry logic
  retryCount: number; // Number of retry attempts
  nextRetryAt?: Date; // When to retry (if needed)
  maxRetries: number; // Maximum retries allowed
  
  // Related transactions
  relatedTransactions: mongoose.Types.ObjectId[]; // Refunds, reversals
  
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  updateStatus(newStatus: TransactionStatus, processor?: IProcessor): Promise<ITransaction>;
  recordDecline(declineCode: string, declineMessage: string, retryable: boolean): Promise<ITransaction>;
}

// Static methods interface
export interface ITransactionModel extends mongoose.Model<ITransaction> {
  createRefund(originalTransaction: ITransaction, refundAmount: number, processorInfo: IProcessor): Promise<ITransaction>;
  findPending(limit?: number): Promise<ITransaction[]>;
  findNeedingRetry(): Promise<ITransaction[]>;
  findUserTransactions(userId: mongoose.Types.ObjectId, limit?: number): Promise<ITransaction[]>;
  findFailed(hours?: number): Promise<ITransaction[]>;
  findHighRisk(minScore?: number): Promise<ITransaction[]>;
}

const processorSchema = new Schema<IProcessor>({
  name: {
    type: String,
    enum: ['stripe', 'paypal', 'manual'],
    required: true,
  },
  transactionId: {
    type: String,
    required: true,
    index: true,
  },
  authorizationCode: String,
  avsResult: String,
  cvvResult: String,
  riskLevel: String, // low, medium, high
  riskDetails: mongoose.Schema.Types.Mixed,
});

const declineDetailsSchema = new Schema<IDeclineDetails>({
  code: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  retryable: {
    type: Boolean,
    default: false,
  },
});

const transactionSchema = new Schema<ITransaction>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      sparse: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    paymentMethod: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentMethod',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    processor: {
      type: processorSchema,
      required: true,
    },
    declineDetails: declineDetailsSchema,
    fraudScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    fraudAlert: {
      type: Schema.Types.ObjectId,
      ref: 'FraudAlert',
      sparse: true,
    },
    description: {
      type: String,
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: Date,
    completedAt: Date,
    retryCount: {
      type: Number,
      default: 0,
    },
    nextRetryAt: Date,
    maxRetries: {
      type: Number,
      default: 3,
    },
    relatedTransactions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Transaction',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for queries
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ order: 1 });
transactionSchema.index({ status: 1, processedAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ 'processor.transactionId': 1 });
transactionSchema.index({ idempotencyKey: 1 });
transactionSchema.index({ fraudScore: 1 });

/**
 * Update transaction status
 */
transactionSchema.methods.updateStatus = async function (newStatus: TransactionStatus, processor?: IProcessor) {
  this.status = newStatus;
  this.processedAt = new Date();

  if (processor) {
    this.processor = processor;
  }

  if ([TransactionStatus.SUCCEEDED, TransactionStatus.FAILED, TransactionStatus.DECLINED].includes(newStatus)) {
    this.completedAt = new Date();
  }

  return this.save();
};

/**
 * Record decline event
 */
transactionSchema.methods.recordDecline = async function (declineCode: string, declineMessage: string, retryable: boolean) {
  this.status = TransactionStatus.DECLINED;
  this.declineDetails = {
    code: declineCode,
    message: declineMessage,
    retryable,
  };
  this.processedAt = new Date();

  // If retryable and not exceeded max retries, schedule retry
  if (retryable && this.retryCount < this.maxRetries) {
    this.retryCount++;
    // Exponential backoff: 1min, 2min, 4min, etc
    const delayMinutes = Math.pow(2, this.retryCount - 1);
    this.nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  }

  return this.save();
};

/**
 * Create refund transaction
 */
transactionSchema.statics.createRefund = function (
  originalTransaction: ITransaction,
  refundAmount: number,
  processorInfo: IProcessor
) {
  const refundTxn = new this({
    order: originalTransaction.order,
    user: originalTransaction.user,
    paymentMethod: originalTransaction.paymentMethod,
    type: refundAmount === originalTransaction.amount ? TransactionType.REFUND : TransactionType.PARTIAL_REFUND,
    status: TransactionStatus.PENDING,
    amount: refundAmount,
    currency: originalTransaction.currency,
    processor: processorInfo,
    description: `Refund for transaction ${originalTransaction.processor.transactionId}`,
    idempotencyKey: `refund-${originalTransaction._id}-${Date.now()}`,
    relatedTransactions: [originalTransaction._id],
  });

  return refundTxn.save();
};

/**
 * Find pending transactions
 */
transactionSchema.statics.findPending = function (limit: number = 100) {
  return this.find({
    status: TransactionStatus.PENDING,
  })
    .sort({ requestedAt: 1 })
    .limit(limit);
};

/**
 * Find transactions for retry
 */
transactionSchema.statics.findNeedingRetry = function () {
  return this.find({
    nextRetryAt: { $lte: new Date() },
    retryCount: { $lt: 10 }, // Absolute max
  }).sort({ nextRetryAt: 1 });
};

/**
 * Find user's transaction history
 */
transactionSchema.statics.findUserTransactions = function (userId: mongoose.Types.ObjectId, limit: number = 50) {
  return this.find({
    user: userId,
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Find failed transactions (for alerts)
 */
transactionSchema.statics.findFailed = function (hours: number = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    status: { $in: [TransactionStatus.FAILED, TransactionStatus.DECLINED] },
    processedAt: { $gte: since },
  }).sort({ processedAt: -1 });
};

/**
 * Find high-risk transactions
 */
transactionSchema.statics.findHighRisk = function (minScore: number = 70) {
  return this.find({
    fraudScore: { $gte: minScore },
  }).sort({ fraudScore: -1 });
};

export const Transaction = mongoose.model<ITransaction, ITransactionModel>('Transaction', transactionSchema);
