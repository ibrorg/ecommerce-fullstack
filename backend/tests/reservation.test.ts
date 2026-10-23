import request from 'supertest';
import app from '../src/server';
import User from '../src/models/User';
import Product from '../src/models/Product';
import Reservation from '../src/models/Reservation';
import reservationService from '../src/services/reservationService';
import mongoose from 'mongoose';

// reservation service + endpoint tests

describe('Inventory Reservations', () => {
  let buyerToken: string;
  let buyerId: string;
  let productId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Reservation.deleteMany({});

    const buyerReg = await request(app).post('/api/auth/register').send({
      name: 'Buyer User', email: 'buyer@example.com', password: 'password123'
    });
    buyerToken = buyerReg.body.token;
    buyerId = buyerReg.body.data.id;

    const product = await Product.create({
      name: 'Limited Item',
      description: 'desc',
      price: 100,
      category: 'Electronics',
      countInStock: 5,
      images: ['img.jpg'],
      sku: 'TEST-RES-001',
      createdBy: new mongoose.Types.ObjectId()
    });
    productId = (product._id as mongoose.Types.ObjectId).toString();
  });

  describe('POST /api/reservations/hold', () => {
    it('should hold stock for a session', async () => {
      const sessionRes = await request(app)
        .post('/api/reservations/session')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      const sessionId = sessionRes.body.data.sessionId;

      const response = await request(app)
        .post('/api/reservations/hold')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          sessionId,
          items: [{ productId, quantity: 2 }]
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0].quantity).toBe(2);
      expect(response.body.data[0].status).toBe('active');
    });

    it('should reject hold exceeding available stock', async () => {
      const sessionRes = await request(app)
        .post('/api/reservations/session')
        .set('Authorization', `Bearer ${buyerToken}`);

      const response = await request(app)
        .post('/api/reservations/hold')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          sessionId: sessionRes.body.data.sessionId,
          items: [{ productId, quantity: 10 }]
        })
        .expect(409);

      expect(response.body.success).toBe(false);
    });

    it('should reject hold without auth', async () => {
      await request(app)
        .post('/api/reservations/hold')
        .send({ sessionId: 'x', items: [{ productId, quantity: 1 }] })
        .expect(401);
    });
  });

  describe('GET /api/reservations/available/:productId', () => {
    it('should return available stock = total - reserved', async () => {
      // hold 3 of 5
      await reservationService.hold(buyerId, productId, 3, 'sess-1');

      const response = await request(app)
        .get(`/api/reservations/available/${productId}`)
        .expect(200);

      expect(response.body.data.available).toBe(2);
    });

    it('should return full stock when no reservations', async () => {
      const response = await request(app)
        .get(`/api/reservations/available/${productId}`)
        .expect(200);

      expect(response.body.data.available).toBe(5);
    });
  });

  describe('DELETE /api/reservations/session/:sessionId', () => {
    it('should release all reservations for a session', async () => {
      await reservationService.hold(buyerId, productId, 2, 'sess-release');

      await request(app)
        .delete('/api/reservations/session/sess-release')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      const available = await reservationService.getAvailableStock(productId);
      expect(available).toBe(5);
    });
  });

  describe('Concurrency — two users checkout last item', () => {
    it('should allow only one user to hold the last item', async () => {
      // set stock to 1
      await Product.findByIdAndUpdate(productId, { countInStock: 1 });

      const session1 = await request(app)
        .post('/api/reservations/session')
        .set('Authorization', `Bearer ${buyerToken}`);
      const session2 = await request(app)
        .post('/api/reservations/session')
        .set('Authorization', `Bearer ${buyerToken}`);

      // fire both holds in parallel
      const [r1, r2] = await Promise.all([
        request(app)
          .post('/api/reservations/hold')
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({ sessionId: session1.body.data.sessionId, items: [{ productId, quantity: 1 }] })
          .catch((e: any) => e.response || e),
        request(app)
          .post('/api/reservations/hold')
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({ sessionId: session2.body.data.sessionId, items: [{ productId, quantity: 1 }] })
          .catch((e: any) => e.response || e)
      ]);

      // exactly one should succeed (201), the other should fail (409)
      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);
    });
  });

  describe('Reservation expiry', () => {
    it('should release expired reservations via releaseExpired', async () => {
      // create a reservation with past expiry
      await Reservation.create({
        userId: new mongoose.Types.ObjectId(buyerId),
        productId: new mongoose.Types.ObjectId(productId),
        quantity: 2,
        sessionId: 'expired-session',
        status: 'active',
        expiresAt: new Date(Date.now() - 1000) // expired 1s ago
      });

      const released = await reservationService.releaseExpired();
      expect(released).toBe(1);

      const available = await reservationService.getAvailableStock(productId);
      expect(available).toBe(5);
    });
  });

  describe('Convert reservations on order', () => {
    it('should convert active reservations to converted status', async () => {
      await reservationService.hold(buyerId, productId, 2, 'convert-session');

      await reservationService.convertBySession('convert-session');

      const reservations = await Reservation.find({ sessionId: 'convert-session' });
      expect(reservations[0].status).toBe('converted');
    });
  });
});
