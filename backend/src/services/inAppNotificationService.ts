import { Notification, NotificationType, NotificationChannel, NotificationStatus } from '../models/Notification';
import { AppError } from '../middleware/errorHandler';
import mongoose from 'mongoose';

// in-app notification service — uses the existing Notification model
// but focuses on the in_app channel for the bell-icon UI

export class InAppNotificationService {
  // create an in-app notification for a user
  async create(
    userId: string,
    type: NotificationType | string,
    title: string,
    body: string,
    options?: {
      actionUrl?: string;
      actionText?: string;
      relatedResourceType?: string;
      relatedResourceId?: string;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    }
  ) {
    try {
      const notification = await Notification.create({
        user: new mongoose.Types.ObjectId(userId),
        type,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.DELIVERED, // in-app is instantly "delivered"
        title,
        body,
        actionUrl: options?.actionUrl,
        actionText: options?.actionText,
        recipient: userId, // for in-app, recipient is the user ID
        relatedResource: options?.relatedResourceType && options?.relatedResourceId
          ? { type: options.relatedResourceType, id: new mongoose.Types.ObjectId(options.relatedResourceId) }
          : undefined,
        priority: options?.priority || 'normal',
        deliveredAt: new Date()
      });
      return notification;
    } catch (err) {
      // notification failure should never break the parent operation
      console.error('Failed to create in-app notification:', err);
      return null;
    }
  }

  // get user's in-app notifications (paginated)
  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false
  ) {
    const skip = (page - 1) * limit;
    const filter: any = {
      user: new mongoose.Types.ObjectId(userId),
      channel: NotificationChannel.IN_APP
    };

    if (unreadOnly) {
      filter.readAt = { $exists: false };
    }

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter)
    ]);

    return {
      notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  // count unread notifications
  async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({
      user: new mongoose.Types.ObjectId(userId),
      channel: NotificationChannel.IN_APP,
      readAt: { $exists: false }
    });
  }

  // mark a single notification as read (ownership checked)
  async markAsRead(notificationId: string, userId: string) {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    if (notification.user.toString() !== userId) {
      throw new AppError('Not authorized', 403);
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    return notification;
  }

  // mark all unread notifications as read for a user
  async markAllAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      {
        user: new mongoose.Types.ObjectId(userId),
        channel: NotificationChannel.IN_APP,
        readAt: { $exists: false }
      },
      { $set: { readAt: new Date() } }
    );

    return result.modifiedCount;
  }

  // delete a notification (ownership checked)
  async deleteNotification(notificationId: string, userId: string) {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    if (notification.user.toString() !== userId) {
      throw new AppError('Not authorized', 403);
    }

    await Notification.deleteOne({ _id: notificationId });
  }
}

export default new InAppNotificationService();
