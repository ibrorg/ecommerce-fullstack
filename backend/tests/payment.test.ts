import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server';
import User from '../src/models/User';
import Product from '../src/models/Product';
import Order from '../src/models/Order';

// payment endpoint tests — uses shared in-memory MongoDB from setup.ts
// STRIPE_SECRET_KEY is configured in .env.test with a fake key starting with
// `sk_` so the stripe object is initialized; any real API call will fail.

// Helper: register a buyer and return token + id
const createBuyer = async (email = 'buyer@example.com') => {
  const reg = await request(app).post('/api/auth/register').send({
    name: 'Buyer User',
    email,
    password: 'password123'
  });
  return { token: reg.body.token, userId: reg.body.data.id };
};

// Helper: create an order directly in the DB owned by `userId`
const createOrderFor = async (userId: string) => {
  const product = await Product.create({
    name: 'Purchased Product',
    description: 'd',
    price: 50,
    category: 'Misc',
    countInStock: 10,
    images: ['p.jpg'],
    sku: 'PAY-TEST-001'
  });

  const order = await Order.create({
    user: new mongoose.Types.ObjectId(userId),
    orderItems: [
      {
        product: product._id,
        name: 'Purchased Product',
        quantity: 1,
        price: 50,
        image: 'p.jpg'
      }
    ],
    shippingAddress: {
      address: '123 Test St',
      city: 'Test City',
      postalCode: '12345',
      country: 'Test Country'
    },
    paymentMethod: 'Stripe',
    taxPrice: 4,
    shippingPrice: 9.99,
    totalPrice: 63.99,
    isPaid: false,
    orderStatus: 'pending'
  });

  return order;
};

describe('Payment Endpoints', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
  });

  describe('POST /api/orders/:id/create-checkout-session', () => {
    it('should return 401 without authentication', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/orders/${fakeId}/create-checkout-session`)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should return 404 when the order does not exist', async () => {
      const buyer = await createBuyer('checkout-no-order@example.com');
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/orders/${fakeId}/create-checkout-session`)
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Order not found');
    });

    it('should return 401 when the order belongs to another user', async () => {
      const owner = await createBuyer('owner@example.com');
      const intruder = await createBuyer('intruder@example.com');
      const order = await createOrderFor(owner.userId);

      const response = await request(app)
        .post(`/api/orders/${order._id}/create-checkout-session`)
        .set('Authorization', `Bearer ${intruder.token}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not authorized');
    });

    it('should fail with 500 when Stripe API call fails (fake key)', async () => {
      const buyer = await createBuyer('stripe-fail@example.com');
      const order = await createOrderFor(buyer.userId);

      const response = await request(app)
        .post(`/api/orders/${order._id}/create-checkout-session`)
        .set('Authorization', `Bearer ${buyer.token}`);

      // Stripe will reject the fake key — handler catches and returns 500.
      // (Accept 500 or any 5xx — the precise Stripe error text is not stable.)
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
    it('should return 400 when the order is already paid', async () => {
      const buyer = await createBuyer('paid-order@example.com');
      const order = await createOrderFor(buyer.userId);
      // mark as paid directly in the DB
      order.isPaid = true;
      order.paidAt = new Date();
      await order.save();

      const response = await request(app)
        .post(`/api/orders/${order._id}/create-checkout-session`)
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Order is already paid');
    });
  });

  describe('POST /api/orders/:id/verify-payment', () => {
    it('should return 401 without authentication', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/orders/${fakeId}/verify-payment`)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should return 404 when the order does not exist', async () => {
      const buyer = await createBuyer('verify-no-order@example.com');
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/orders/${fakeId}/verify-payment`)
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ sessionId: 'cs_test_123' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Order not found');
    });

    it('should return 401 when the order belongs to another user', async () => {
      const owner = await createBuyer('verify-owner@example.com');
      const intruder = await createBuyer('verify-intruder@example.com');
      const order = await createOrderFor(owner.userId);

      const response = await request(app)
        .post(`/api/orders/${order._id}/verify-payment`)
        .set('Authorization', `Bearer ${intruder.token}`)
        .send({ sessionId: 'cs_test_123' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not authorized');
    });

    it('should fail with 500 when Stripe API call fails (fake key)', async () => {
      const buyer = await createBuyer('verify-fail@example.com');
      const order = await createOrderFor(buyer.userId);

      const response = await request(app)
        .post(`/api/orders/${order._id}/verify-payment`)
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ sessionId: 'cs_test_123' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/orders/webhook', () => {
    it('should return 400 when the stripe-signature header is missing', async () => {
      const response = await request(app)
        .post('/api/orders/webhook')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' }))
        .expect(400);

      // Stripe constructEvent throws when signature is missing → handler
      // catches and sends 400 "Webhook Error: ..."
      expect(response.text).toContain('Webhook Error');
    });

    it('should return 400 when the stripe-signature header is invalid', async () => {
      const response = await request(app)
        .post('/api/orders/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 't=12345,v1=invalid')
        .send(JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' }))
        .expect(400);

      expect(response.text).toContain('Webhook Error');
    });

    it('should return 500 when STRIPE_WEBHOOK_SECRET is unset', async () => {
      // The controller reads process.env.STRIPE_WEBHOOK_SECRET at request
      // time, so deleting it on the live process works.
      const savedSecret = process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.STRIPE_WEBHOOK_SECRET;

      try {
        const response = await request(app)
          .post('/api/orders/webhook')
          .set('Content-Type', 'application/json')
          .set('stripe-signature', 't=12345,v1=invalid')
          .send(JSON.stringify({ id: 'evt_test' }))
          .expect(500);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Webhook secret not configured');
      } finally {
        // restore so other tests can use it
        if (savedSecret !== undefined) {
          process.env.STRIPE_WEBHOOK_SECRET = savedSecret;
        }
      }
    });
  });
});
