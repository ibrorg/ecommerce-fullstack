import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server';
import User from '../src/models/User';
import Store from '../src/models/Store';
import Order from '../src/models/Order';
import Product from '../src/models/Product';

// admin endpoint tests — uses shared in-memory MongoDB from setup.ts

// Helper: register a user, promote to admin, return fresh token + id
const createAdmin = async (email = 'admin@example.com') => {
  const reg = await request(app).post('/api/auth/register').send({
    name: 'Admin User',
    email,
    password: 'password123'
  });
  const userId = reg.body.data.id;

  await User.updateOne({ _id: userId }, { $set: { role: 'admin' } });

  // re-login so the access token carries the admin role claim
  const login = await request(app).post('/api/auth/login').send({
    email,
    password: 'password123'
  });

  return { token: login.body.token, userId };
};

// Helper: register a regular buyer
const createBuyer = async (email = 'buyer@example.com') => {
  const reg = await request(app).post('/api/auth/register').send({
    name: 'Buyer User',
    email,
    password: 'password123'
  });
  return { token: reg.body.token, userId: reg.body.data.id };
};

// Helper: create a seller (with store) so admin verifications have something to verify
const createStoreForAdmin = async (email = 'seller@example.com') => {
  const reg = await request(app).post('/api/auth/register').send({
    name: 'Seller User',
    email,
    password: 'password123'
  });
  const userId = reg.body.data.id;
  await User.updateOne({ _id: userId }, { $set: { role: 'seller' } });

  const slug = email.split('@')[0].toLowerCase();
  const store = await Store.create({
    name: 'Seller Store',
    slug,
    description: 'A seller store',
    businessType: 'individual',
    owner: userId,
    email,
    phone: '9876543210',
    address: {
      street: '1 Seller St',
      city: 'Pune',
      state: 'MH',
      country: 'India',
      zipCode: '411001'
    },
    bankDetails: {
      accountName: 'Seller User',
      accountNumber: '9999999999999',
      ifscCode: 'ABCD0123456',
      bankName: 'Bank'
    },
    isVerified: false
  });

  return { store, userId };
};

describe('Admin Endpoints', () => {
  let adminToken: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Store.deleteMany({});
    await Order.deleteMany({});
    await Product.deleteMany({});

    const admin = await createAdmin('admin@example.com');
    adminToken = admin.token;
  });

  describe('GET /api/admin/dashboard', () => {
    it('should return platform stats for an admin', async () => {
      // seed a bit of data so stats are non-zero
      await Product.create({
        name: 'P1',
        description: 'd',
        price: 10,
        category: 'C',
        countInStock: 1,
        images: ['x.jpg'],
        sku: 'A-1'
      });

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalUsers');
      expect(response.body.data).toHaveProperty('totalOrders');
      expect(response.body.data).toHaveProperty('totalProducts');
      expect(response.body.data).toHaveProperty('totalStores');
      expect(response.body.data).toHaveProperty('totalRevenue');
      expect(response.body.data.totalProducts).toBeGreaterThanOrEqual(1);
    });

    it('should deny access to a non-admin buyer (403)', async () => {
      const buyer = await createBuyer('buyer-dash@example.com');

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(403);

      expect(response.body.status).toBe('error');
    });

    it('should deny access without authentication (401)', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /api/admin/revenue-trends', () => {
    it('should return revenue trends for the given window', async () => {
      const response = await request(app)
        .get('/api/admin/revenue-trends?days=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should deny access to a non-admin (403)', async () => {
      const buyer = await createBuyer('buyer-rev@example.com');
      const response = await request(app)
        .get('/api/admin/revenue-trends')
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(403);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/admin/top-products', () => {
    it('should return top products list', async () => {
      const response = await request(app)
        .get('/api/admin/top-products')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/admin/order-status', () => {
    it('should return order status distribution', async () => {
      // create an order so the aggregation has data
      await Order.create({
        user: new mongoose.Types.ObjectId(),
        orderItems: [],
        shippingAddress: {
          address: 'x',
          city: 'y',
          postalCode: 'z',
          country: 'w'
        },
        paymentMethod: 'PayPal',
        taxPrice: 0,
        shippingPrice: 0,
        totalPrice: 0,
        orderStatus: 'pending'
      });

      const response = await request(app)
        .get('/api/admin/order-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      // distribution aggregates by status — at least one bucket should exist
      const pendingBucket = response.body.data.find(
        (b: any) => b._id === 'pending'
      );
      expect(pendingBucket).toBeDefined();
      expect(pendingBucket.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/admin/verifications', () => {
    it('should return pending store verifications', async () => {
      // seed an unverified store
      await createStoreForAdmin('pending-seller@example.com');

      const response = await request(app)
        .get('/api/admin/verifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0]).toHaveProperty('isVerified', false);
    });

    it('should return empty array when no pending stores exist', async () => {
      const response = await request(app)
        .get('/api/admin/verifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(0);
    });
  });

  describe('PUT /api/admin/verify-store/:storeId', () => {
    it('should verify a pending store', async () => {
      const { store } = await createStoreForAdmin('verify-seller@example.com');
      const storeId = (store._id as mongoose.Types.ObjectId).toString();

      const response = await request(app)
        .put(`/api/admin/verify-store/${storeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isVerified', true);

      // double-check directly in DB
      const updated = await Store.findById(storeId);
      expect(updated?.isVerified).toBe(true);
    });

    it('should return 404 when store does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/admin/verify-store/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should deny access to a non-admin (403)', async () => {
      const { store } = await createStoreForAdmin('verify-seller-2@example.com');
      const storeId = (store._id as mongoose.Types.ObjectId).toString();
      const buyer = await createBuyer('buyer-verify@example.com');

      const response = await request(app)
        .put(`/api/admin/verify-store/${storeId}`)
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(403);

      expect(response.body.status).toBe('error');
    });

    it('should deny access without authentication (401)', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/admin/verify-store/${fakeId}`)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});
