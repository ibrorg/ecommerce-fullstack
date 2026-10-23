import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { Notification, NotificationType, NotificationChannel, NotificationStatus, INotification } from '../models/Notification';
import User from '../models/User';

/**
 * NotificationService
 * 
 * Manages all user notifications across channels:
 * - Email
 * - SMS (Twilio)
 * - Push notifications
 * - In-app notifications
 * - Webhooks
 * 
 * Features:
 * - Delivery tracking
 * - Retry logic with exponential backoff
 * - Channel preferences
 * - Template system
 * - Batch processing
 */

// Email setup (using nodemailer)
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface CreateNotificationRequest {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  channels: NotificationChannel[];
  title: string;
  body: string;
  subject?: string;
  actionUrl?: string;
  actionText?: string;
  templateId?: string;
  variables?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  relatedResource?: {
    type: string;
    id: mongoose.Types.ObjectId;
  };
}

export class NotificationService {
  /**
   * Create and send notification(s) to user
   * Creates separate notifications per channel
   */
  static async createAndSend(request: CreateNotificationRequest): Promise<INotification[]> {
    const { userId, type, channels, title, body, subject, actionUrl, actionText, templateId, variables, priority, relatedResource } = request;

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const notifications: INotification[] = [];

    // Create notification per channel
    for (const channel of channels) {
      let recipient = '';

      // Determine recipient based on channel
      if (channel === NotificationChannel.EMAIL) {
        recipient = user.email;
      } else if (channel === NotificationChannel.SMS) {
        if (!user.phone) {
          continue; // Skip SMS if no phone number
        }
        recipient = user.phone;
      } else if (channel === NotificationChannel.PUSH) {
        // TODO: Get push token from user profile
        recipient = 'push_token_placeholder';
      } else if (channel === NotificationChannel.IN_APP) {
        recipient = userId.toString();
      }

      if (!recipient) {
        continue;
      }

      // Create notification record
      const notification = await Notification.create({
        user: userId,
        type,
        channel,
        status: NotificationStatus.PENDING,
        title,
        body,
        subject: subject || title,
        recipient,
        actionUrl,
        actionText,
        templateId,
        variables,
        priority: priority || 'normal',
        relatedResource,
      });

      notifications.push(notification);

      // Attempt to send immediately (for high priority)
      if (priority === 'critical' || priority === 'high') {
        await this.sendNotification(notification);
      }
    }

    return notifications;
  }

  /**
   * Send a single notification
   * Routes to appropriate channel handler
   */
  static async sendNotification(notification: INotification): Promise<void> {
    try {
      switch (notification.channel) {
        case NotificationChannel.EMAIL:
          await this.sendEmail(notification);
          break;
        case NotificationChannel.SMS:
          await this.sendSMS(notification);
          break;
        case NotificationChannel.PUSH:
          await this.sendPushNotification(notification);
          break;
        case NotificationChannel.IN_APP:
          // In-app is just a database record, already created
          await notification.markAsDelivered();
          break;
        case NotificationChannel.WEBHOOK:
          await this.sendWebhook(notification);
          break;
      }
    } catch (error: any) {
      await notification.recordFailure(error.message);
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmail(notification: INotification): Promise<void> {
    const htmlContent = this.renderEmailTemplate(notification);

    await emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@ecommerce.com',
      to: notification.recipient,
      subject: notification.subject || notification.title,
      html: htmlContent,
      text: notification.body,
    });

    await notification.markAsSent();
  }

  /**
   * Send SMS notification (using Twilio)
   */
  private static async sendSMS(notification: INotification): Promise<void> {
    // TODO: Implement Twilio integration
    // For now, just mark as sent
    console.log(`SMS to ${notification.recipient}: ${notification.body}`);
    await notification.markAsSent();
  }

  /**
   * Send push notification
   */
  private static async sendPushNotification(notification: INotification): Promise<void> {
    // TODO: Implement Firebase Cloud Messaging (FCM) or similar
    console.log(`Push notification: ${notification.title}`);
    await notification.markAsSent();
  }

  /**
   * Send webhook notification (for 3rd party integrations)
   */
  private static async sendWebhook(notification: INotification): Promise<void> {
    // TODO: Implement webhook delivery
    console.log(`Webhook: ${notification.title}`);
    await notification.markAsSent();
  }

  /**
   * Render email template
   */
  private static renderEmailTemplate(notification: INotification): string {
    const { title, body, actionUrl, actionText, variables } = notification;

    // Replace variables in body
    let renderedBody = body;
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        renderedBody = renderedBody.replace(`{{${key}}}`, String(value));
      });
    }

    const actionButton = actionUrl
      ? `<a href="${actionUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">${actionText || 'View Details'}</a>`
      : '';

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { border-bottom: 2px solid #007bff; padding-bottom: 10px; }
            .content { padding: 20px 0; }
            .footer { border-top: 1px solid #ddd; padding-top: 10px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${title}</h2>
            </div>
            <div class="content">
              <p>${renderedBody}</p>
              ${actionButton}
            </div>
            <div class="footer">
              <p>You received this email because you're an eCommerce customer. 
              <a href="{unsubscribe_link}">Unsubscribe</a></p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Send notifications in batch (for queued processing)
   */
  static async processPendingNotifications(limit: number = 100): Promise<number> {
    const pending = await Notification.findPending(limit);
    let sentCount = 0;

    for (const notification of pending) {
      try {
        await this.sendNotification(notification);
        sentCount++;
      } catch (error) {
        console.error(`Failed to send notification ${notification._id}:`, error);
      }
    }

    return sentCount;
  }

  /**
   * Get user's notification preferences
   */
  static async getPreferences(userId: mongoose.Types.ObjectId): Promise<any> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // TODO: Implement NotificationPreference model
    return {
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      fraudAlerts: true,
      orderUpdates: true,
      promotions: false,
      unsubscribeAll: false,
    };
  }

  /**
   * Update user's notification preferences
   */
  static async updatePreferences(userId: mongoose.Types.ObjectId, preferences: any): Promise<void> {
    // TODO: Implement preference persistence
    console.log(`Updated preferences for user ${userId}:`, preferences);
  }

  /**
   * Mark user notification as read
   */
  static async markAsRead(notificationId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId): Promise<void> {
    const notification = await Notification.findById(notificationId);
    if (!notification || notification.user.toString() !== userId.toString()) {
      throw new Error('Notification not found');
    }

    await notification.markAsRead();
  }

  /**
   * Get user's notification history
   */
  static async getUserNotifications(userId: mongoose.Types.ObjectId, limit: number = 50): Promise<INotification[]> {
    return Notification.findUserNotifications(userId, limit);
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: mongoose.Types.ObjectId): Promise<number> {
    return Notification.countDocuments({
      user: userId,
      readAt: null,
      channel: NotificationChannel.IN_APP,
    });
  }

  /**
   * Send fraud alert notification
   */
  static async sendFraudAlert(
    userId: mongoose.Types.ObjectId,
    fraudLevel: string,
    reason: string,
    fraudAlertId: mongoose.Types.ObjectId
  ): Promise<INotification[]> {
    return this.createAndSend({
      userId,
      type: NotificationType.FRAUD_ALERT,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      title: `🚨 Security Alert: Suspicious Activity Detected`,
      body: `We detected ${fraudLevel} fraud risk on your account: ${reason}. Please review and verify this activity.`,
      subject: 'Security Alert - Verify Your Account',
      actionUrl: `/account/security/${fraudAlertId}`,
      actionText: 'Review Activity',
      priority: fraudLevel === 'critical' ? 'critical' : 'high',
      relatedResource: {
        type: 'fraud_alert',
        id: fraudAlertId,
      },
    });
  }

  /**
   * Send payment failed notification
   */
  static async sendPaymentFailed(userId: mongoose.Types.ObjectId, reason: string, orderId: mongoose.Types.ObjectId): Promise<INotification[]> {
    return this.createAndSend({
      userId,
      type: NotificationType.PAYMENT_FAILED,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      title: '❌ Payment Failed',
      body: `Your payment failed: ${reason}. Please update your payment method and try again.`,
      subject: 'Payment Failed - Action Required',
      actionUrl: `/orders/${orderId}/payment`,
      actionText: 'Retry Payment',
      priority: 'high',
      relatedResource: {
        type: 'order',
        id: orderId,
      },
    });
  }

  /**
   * Send order status notification
   */
  static async sendOrderUpdate(userId: mongoose.Types.ObjectId, orderId: mongoose.Types.ObjectId, status: string, details: string): Promise<INotification[]> {
    const statusEmojis: Record<string, string> = {
      pending: '⏳',
      processing: '⚙️',
      shipped: '📦',
      delivered: '✅',
      cancelled: '❌',
    };

    return this.createAndSend({
      userId,
      type: NotificationType.ORDER_STATUS,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      title: `${statusEmojis[status] || '📦'} Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      body: details,
      subject: `Order Update: ${status}`,
      actionUrl: `/orders/${orderId}`,
      actionText: 'View Order',
      priority: 'normal',
      relatedResource: {
        type: 'order',
        id: orderId,
      },
    });
  }
}
