import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * Notification
 * 
 * Records all notifications sent to users
 * Tracks delivery status for reliability
 */

export enum NotificationType {
  FRAUD_ALERT = 'fraud_alert',
  ORDER_STATUS = 'order_status',
  PAYMENT_FAILED = 'payment_failed',
  REFUND_ISSUED = 'refund_issued',
  ACCOUNT_SECURITY = 'account_security',
  VERIFICATION_REQUIRED = 'verification_required',
  PROMOTIONAL = 'promotional',
  SYSTEM_ALERT = 'system_alert',
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
  WEBHOOK = 'webhook',
}

export enum NotificationStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  UNSUBSCRIBED = 'unsubscribed',
}

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  
  // Content
  subject?: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionText?: string;
  
  // Recipient
  recipient: string; // email, phone number, or push token
  
  // References
  relatedResource?: {
    type: string; // fraud_alert, order, payment, etc
    id: mongoose.Types.ObjectId;
  };
  
  // Retry tracking
  attemptCount: number;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  maxAttempts: number;
  
  // Delivery details
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failureReason?: string;
  
  // Metadata
  templateId?: string;
  variables?: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  markAsSent(): Promise<INotification>;
  markAsDelivered(): Promise<INotification>;
  markAsRead(): Promise<INotification>;
  recordFailure(reason: string): Promise<INotification>;
}

// Interface for static methods on Notification model
export interface INotificationModel extends Model<INotification> {
  findPending(limit?: number): Promise<INotification[]>;
  findUserNotifications(userId: mongoose.Types.ObjectId, limit?: number): Promise<INotification[]>;
  findFailed(hours?: number): Promise<INotification[]>;
}

const relatedResourceSchema = new Schema({
  type: String,
  id: mongoose.Schema.Types.ObjectId,
});

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: Object.values(NotificationChannel),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.PENDING,
      index: true,
    },
    subject: String,
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    actionUrl: String,
    actionText: String,
    recipient: {
      type: String,
      required: true,
    },
    relatedResource: relatedResourceSchema,
    attemptCount: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: Date,
    nextAttemptAt: Date,
    maxAttempts: {
      type: Number,
      default: 3,
    },
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    failureReason: String,
    templateId: String,
    variables: mongoose.Schema.Types.Mixed,
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: 'normal',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ status: 1, nextAttemptAt: 1 });
notificationSchema.index({ user: 1, type: 1 });
notificationSchema.index({ recipient: 1 });

/**
 * Mark as sent
 */
notificationSchema.methods.markAsSent = async function () {
  this.status = NotificationStatus.SENT;
  this.sentAt = new Date();
  this.lastAttemptAt = new Date();
  this.attemptCount++;
  return this.save();
};

/**
 * Mark as delivered
 */
notificationSchema.methods.markAsDelivered = async function () {
  this.status = NotificationStatus.DELIVERED;
  this.deliveredAt = new Date();
  return this.save();
};

/**
 * Mark as read
 */
notificationSchema.methods.markAsRead = async function () {
  this.readAt = new Date();
  return this.save();
};

/**
 * Record failure and schedule retry
 */
notificationSchema.methods.recordFailure = async function (reason: string) {
  this.failureReason = reason;
  this.lastAttemptAt = new Date();
  this.attemptCount++;

  if (this.attemptCount < this.maxAttempts) {
    this.status = NotificationStatus.PENDING;
    // Exponential backoff
    const delayMinutes = Math.pow(2, this.attemptCount);
    this.nextAttemptAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  } else {
    this.status = NotificationStatus.FAILED;
  }

  return this.save();
};

/**
 * Find pending notifications for sending
 */
notificationSchema.statics.findPending = function (limit: number = 100) {
  return this.find({
    status: NotificationStatus.PENDING,
    $or: [
      { nextAttemptAt: { $lte: new Date() } },
      { nextAttemptAt: { $exists: false } },
    ],
  })
    .sort({ priority: -1, createdAt: 1 })
    .limit(limit);
};

/**
 * Find user's notifications
 */
notificationSchema.statics.findUserNotifications = function (userId: mongoose.Types.ObjectId, limit: number = 50) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Find failed notifications
 */
notificationSchema.statics.findFailed = function (hours: number = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    status: NotificationStatus.FAILED,
    createdAt: { $gte: since },
  }).sort({ createdAt: -1 });
};

export const Notification = mongoose.model<INotification, INotificationModel>('Notification', notificationSchema);
