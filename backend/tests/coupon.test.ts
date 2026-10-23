import request from 'supertest';
import app from '../src/server';
import Coupon from '../src/models/Coupon';
import Order from '../src/models/Order';
import User from '../src/models/User';
import Product from '../src/models/Product';
import mongoose from 'mongoose';

// coupon service + endpoint tests

describe('Coupon System', () => {
  let adminToken: string;
  let buyerToken: string;
  let productId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Coupon.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});

    // admin
    const adminReg = await request(app).post('/api/auth/register').send({
      name: 'Admin User', email: 'admin@example.com', password: 'password123'
    });
    await User.updateOne({ email: 'admin@example.com' }, { $set: { role: 'admin' } });
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.com', password: 'password123'
    });
    adminToken = adminLogin.body.token;

    // buyer
    const buyerReg = await request(app).post('/api/auth/register').send({
      name: 'Buyer User', email: 'buyer@example.com', password: 'password123'
    });
    buyerToken = buyerReg.body.token;

    // product
    const product = await Product.create({
      name: 'Test Product',
      description: 'desc',
      price: 100,
      category: 'Electronics',
      countInStock: 50,
      images: ['img.jpg'],
      sku: 'TEST-COUPON-001',
      createdBy: new mongoose.Types.ObjectId()
    });
    productId = (product._id as mongoose.Types.ObjectId).toString();
  });

  describe('Admin Coupon CRUD', () => {
    it('should create a percentage coupon', async () => {
      const response = await request(app)
        .post('/api/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'SAVE20',
          type: 'percentage',
          value: 20,
          minOrder: 50,
          maxDiscount: 100,
          validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isActive: true
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.code).toBe('SAVE20');
      expect(response.body.data.value).toBe(20);
    });

    it('should create a flat coupon', async () => {
      const response = await request(app)
        .post('/api/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'FLAT15',
          type: 'flat',
          value: 15,
          minOrder: 0,
          validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('flat');
    });

    it('should reject duplicate coupon code', async () => {
      await Coupon.create({
        code: 'DUP',
        type: 'flat',
        value: 10,
        validTo: new Date(Date.now() + 86400000)
      });

      const response = await request(app)
        .post('/api/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'DUP',
          type: 'flat',
          value: 5,
          validTo: new Date(Date.now() + 86400000)
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should list coupons with pagination', async () => {
      await Coupon.create([
        { code: 'AAA', type: 'flat', value: 5, validTo: new Date(Date.now() + 86400000) },
        { code: 'BBB', type: 'flat', value: 5, validTo: new Date(Date.now() + 86400000) }
      ]);

      const response = await request(app)
        .get('/api/coupons?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.coupons.length).toBe(2);
    });

    it('should delete a coupon', async () => {
      const coupon = await Coupon.create({
        code: 'DELETE',
        type: 'flat', value: 5,
        validTo: new Date(Date.now() + 86400000)
      });

      await request(app)
        .delete(`/api/coupons/${coupon._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const exists = await Coupon.findById(coupon._id);
      expect(exists).toBeNull();
    });

    it('should reject non-admin access', async () => {
      await request(app)
        .post('/api/coupons')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ code: 'X', type: 'flat', value: 5, validTo: new Date() })
        .expect(403);
    });
  });

  describe('Coupon Validation', () => {
    beforeEach(async () => {
      await Coupon.create({
        code: 'SAVE10',
        type: 'percentage',
        value: 10,
        minOrder: 50,
        maxDiscount: 50,
        perUserLimit: 2,
        validFrom: new Date(Date.now() - 86400000),
        validTo: new Date(Date.now() + 86400000),
        isActive: true
      });
    });

    it('should validate a valid coupon', async () => {
      const response = await request(app)
        .post('/api/coupons/validate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ code: 'SAVE10', itemsPrice: 100 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.discountAmount).toBe(10);
    });

    it('should reject coupon below min order', async () => {
      const response = await request(app)
        .post('/api/coupons/validate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ code: 'SAVE10', itemsPrice: 30 })
        .expect(200);

      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.error).toContain('Minimum order');
    });

    it('should reject expired coupon', async () => {
      await Coupon.findOneAndUpdate(
        { code: 'SAVE10' },
        { validTo: new Date(Date.now() - 86400000) }
      );

      const response = await request(app)
        .post('/api/coupons/validate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ code: 'SAVE10', itemsPrice: 100 })
        .expect(200);

      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.error).toContain('expired');
    });

    it('should reject unknown coupon', async () => {
      const response = await request(app)
        .post('/api/coupons/validate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ code: 'NOPE', itemsPrice: 100 })
        .expect(200);

      expect(response.body.data.valid).toBe(false);
    });

    it('should cap discount at maxDiscount', async () => {
      // 10% of 1000 = 100, capped at 50
      const response = await request(app)
        .post('/api/coupons/validate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ code: 'SAVE10', itemsPrice: 1000 })
        .expect(200);

      expect(response.body.data.discountAmount).toBe(50);
    });
  });

  describe('Coupon applied at order creation', () => {
    beforeEach(async () => {
      await Coupon.create({
        code: 'ORDER10',
        type: 'percentage',
        value: 10,
        minOrder: 0,
        validFrom: new Date(Date.now() - 86400000),
        validTo: new Date(Date.now() + 86400000),
        isActive: true,
        perUserLimit: 5
      });
    });

    it('should apply coupon discount to new order', async () => {
      const orderData = {
        orderItems: [{
          product: productId,
          name: 'Test Product',
          quantity: 1,
          price: 100,
          image: 'img.jpg'
        }],
        shippingAddress: {
          address: '123 St', city: 'City', postalCode: '12345', country: 'India'
        },
        paymentMethod: 'Stripe',
        couponCode: 'ORDER10'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send(orderData);

      // debug
      if (response.status !== 201) {
        console.error('ORDER CREATE FAILED:', response.status, response.body);
      }

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.discountPrice).toBe(10);
      expect(response.body.data.appliedCoupon.code).toBe('ORDER10');
      // items 100 + tax 8 + shipping 9.99 - discount 10 = 107.99
      expect(response.body.data.totalPrice).toBe(107.99);

      // coupon usage count incremented
      const coupon = await Coupon.findOne({ code: 'ORDER10' });
      expect(coupon!.usedCount).toBe(1);
    });

    it('should reject invalid coupon at order creation', async () => {
      const orderData = {
        orderItems: [{
          product: productId,
          name: 'Test Product',
          quantity: 1,
          price: 100,
          image: 'img.jpg'
        }],
        shippingAddress: {
          address: '123 St', city: 'City', postalCode: '12345', country: 'India'
        },
        paymentMethod: 'Stripe',
        couponCode: 'INVALID'
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
