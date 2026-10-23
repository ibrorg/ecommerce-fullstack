import request from 'supertest';
import app from '../src/server';
import User from '../src/models/User';
import { Notification, NotificationType, NotificationChannel } from '../src/models/Notification';
import mongoose from 'mongoose';

// in-app notification tests

describe('In-App Notifications', () => {
  let buyerToken: string;
  let buyerId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Notification.deleteMany({});

    const buyerReg = await request(app).post('/api/auth/register').send({
      name: 'Buyer User', email: 'buyer@example.com', password: 'password123'
    });
    buyerToken = buyerReg.body.token;
    buyerId = buyerReg.body.data.id;

    // seed a few notifications
    await Notification.create([
      {
        user: new mongoose.Types.ObjectId(buyerId),
        type: NotificationType.ORDER_STATUS,
        channel: NotificationChannel.IN_APP,
        status: 'delivered',
        title: 'Order Placed',
        body: 'Your order has been placed',
        recipient: buyerId,
        deliveredAt: new Date()
      },
      {
        user: new mongoose.Types.ObjectId(buyerId),
        type: NotificationType.REFUND_ISSUED,
        channel: NotificationChannel.IN_APP,
        status: 'delivered',
        title: 'Refund Processed',
        body: 'Your refund of $50 has been processed',
        recipient: buyerId,
        deliveredAt: new Date()
      },
      {
        user: new mongoose.Types.ObjectId(buyerId),
        type: NotificationType.ORDER_STATUS,
        channel: NotificationChannel.IN_APP,
        status: 'delivered',
        title: 'Order Shipped',
        body: 'Your order has been shipped',
        recipient: buyerId,
        readAt: new Date(),
        deliveredAt: new Date()
      }
    ]);
  });

  describe('GET /api/notifications', () => {
    it('should list user notifications', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications.length).toBe(3);
    });

    it('should filter unread only', async () => {
      const response = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      // 2 unread (1 is read)
      expect(response.body.data.notifications.length).toBe(2);
    });

    it('should reject without auth', async () => {
      await request(app).get('/api/notifications').expect(401);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread count', async () => {
      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.data.count).toBe(2);
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      const unread = await Notification.findOne({
        user: new mongoose.Types.ObjectId(buyerId),
        readAt: { $exists: false }
      });

      const response = await request(app)
        .put(`/api/notifications/${unread!._id}/read`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.data.readAt).toBeDefined();
    });

    it('should reject marking another user notification', async () => {
      // create a notification for a different user
      const otherNotif = await Notification.create({
        user: new mongoose.Types.ObjectId(),
        type: NotificationType.ORDER_STATUS,
        channel: NotificationChannel.IN_APP,
        status: 'delivered',
        title: 'Other',
        body: 'Other user notif',
        recipient: 'other'
      });

      await request(app)
        .put(`/api/notifications/${otherNotif._id}/read`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all as read', async () => {
      const response = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.data.marked).toBe(2);

      const count = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(count.body.data.count).toBe(0);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('should delete a notification', async () => {
      const notif = await Notification.findOne({
        user: new mongoose.Types.ObjectId(buyerId)
      });

      await request(app)
        .delete(`/api/notifications/${notif!._id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      const exists = await Notification.findById(notif!._id);
      expect(exists).toBeNull();
    });

    it('should reject deleting another user notification', async () => {
      const otherNotif = await Notification.create({
        user: new mongoose.Types.ObjectId(),
        type: NotificationType.ORDER_STATUS,
        channel: NotificationChannel.IN_APP,
        status: 'delivered',
        title: 'Other',
        body: 'test',
        recipient: 'other'
      });

      await request(app)
        .delete(`/api/notifications/${otherNotif._id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);
    });
  });
});
