import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server';
import User from '../src/models/User';
import Product from '../src/models/Product';
import Order from '../src/models/Order';

// order endpoint tests — uses shared in-memory MongoDB from setup.ts

describe('Order Endpoints', () => {
  let authToken: string;
  let adminToken: string;
  let productId: string;
  let orderId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});

    // create a regular buyer
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'user@example.com',
        password: 'password123'
      });
    authToken = userResponse.body.token;

    // create an admin: register, promote, re-login
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password123'
      });

    await User.updateOne(
      { email: 'admin@example.com' },
      { $set: { role: 'admin' } }
    );

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'password123'
      });
    adminToken = adminLogin.body.token;

    // create a test product directly (bypasses route validation)
    const product = await Product.create({
      name: 'Test Product',
      description: 'A test product',
      price: 99.99,
      category: 'Electronics',
      countInStock: 10,
      images: ['test-image.jpg'],
      sku: 'TEST-SKU-001'
    });
    productId = (product._id as mongoose.Types.ObjectId).toString();
  });

  describe('POST /api/orders', () => {
    it('should create order as authenticated user', async () => {
      const orderData = {
        orderItems: [
          {
            product: productId,
            name: 'Test Product',
            price: 99.99,
            quantity: 2,
            image: 'test-image.jpg'
          }
        ],
        shippingAddress: {
          address: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'PayPal',
        taxPrice: 0,
        shippingPrice: 0,
        totalPrice: 199.98
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      // server recalculates totals: 2x99.99=199.98 + 8% tax=16.00 + free shipping(over 100) = 215.98
      expect(response.body.data.totalPrice).toBe(215.98);
      orderId = response.body.data._id;
    });

    it('should not create order without authentication', async () => {
      const orderData = {
        orderItems: [
          {
            product: productId,
            name: 'Test Product',
            price: 99.99,
            quantity: 2,
            image: 'test-image.jpg'
          }
        ],
        shippingAddress: {
          address: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'PayPal',
        taxPrice: 0,
        shippingPrice: 0,
        totalPrice: 199.98
      };

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should not create order with empty order items', async () => {
      const orderData = {
        orderItems: [],
        shippingAddress: {
          address: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'PayPal',
        taxPrice: 0,
        shippingPrice: 0,
        totalPrice: 0
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/orders/myorders', () => {
    beforeEach(async () => {
      const orderData = {
        orderItems: [
          {
            product: productId,
            name: 'Test Product',
            price: 99.99,
            quantity: 1,
            image: 'test-image.jpg'
          }
        ],
        shippingAddress: {
          address: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'PayPal',
        taxPrice: 0,
        shippingPrice: 0,
        totalPrice: 99.99
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);
      orderId = response.body.data._id;
    });

    it('should get user orders', async () => {
      const response = await request(app)
        .get('/api/orders/myorders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      // server calculates: 99.99 + 8% tax(8.00) + shipping(9.99) = 117.98
      expect(response.body.data[0]).toHaveProperty('totalPrice', 117.98);
    });

    it('should not get orders without authentication', async () => {
      const response = await request(app)
        .get('/api/orders/myorders')
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /api/orders/:id', () => {
    beforeEach(async () => {
      const orderData = {
        orderItems: [
          {
            product: productId,
            name: 'Test Product',
            price: 99.99,
            quantity: 1,
            image: 'test-image.jpg'
          }
        ],
        shippingAddress: {
          address: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'PayPal',
        taxPrice: 0,
        shippingPrice: 0,
        totalPrice: 99.99
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);
      orderId = response.body.data._id;
    });

    it('should get order by ID for owner', async () => {
      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id', orderId);
      // server calculates: 99.99 + 8% tax(8.00) + shipping(9.99) = 117.98
      expect(response.body.data).toHaveProperty('totalPrice', 117.98);
    });

    it('should get order by ID for admin', async () => {
      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id', orderId);
    });

    it('should return 404 for non-existent order', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/orders/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/orders/:id/status', () => {
    beforeEach(async () => {
      const orderData = {
        orderItems: [
          {
            product: productId,
            name: 'Test Product',
            price: 99.99,
            quantity: 1,
            image: 'test-image.jpg'
          }
        ],
        shippingAddress: {
          address: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'Test Country'
        },
        paymentMethod: 'PayPal',
        taxPrice: 0,
        shippingPrice: 0,
        totalPrice: 99.99
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);
      orderId = response.body.data._id;
    });

    it('should update order status as admin', async () => {
      const response = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.orderStatus).toBe('shipped');
    });

    it('should not update order status as regular user', async () => {
      const response = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'shipped' })
        .expect(403);

      expect(response.body.status).toBe('error');
    });

    it('should not update order status without authentication', async () => {
      const response = await request(app)
        .put(`/api/orders/${orderId}/status`)
        .send({ status: 'shipped' })
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /api/orders (idempotency)', () => {
    const orderData = {
      orderItems: [
        {
          product: '',
          name: 'Test Product',
          price: 99.99,
          quantity: 2,
          image: 'test-image.jpg'
        }
      ],
      shippingAddress: {
        address: '123 Test St',
        city: 'Test City',
        postalCode: '12345',
        country: 'Test Country'
      },
      paymentMethod: 'PayPal',
      taxPrice: 0,
      shippingPrice: 0,
      totalPrice: 199.98
    };

    it('should return the same order when the same Idempotency-Key is used', async () => {
      orderData.orderItems[0].product = productId;
      const key = 'order-key-1';

      const first = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', key)
        .send(orderData)
        .expect(201);

      expect(first.body.success).toBe(true);
      const firstOrderId = first.body.data._id;

      // second request with same key should return the cached order
      const second = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', key)
        .send(orderData)
        .expect(201);

      expect(second.body.data._id).toBe(firstOrderId);
    });

    it('should create different orders with different Idempotency-Keys', async () => {
      orderData.orderItems[0].product = productId;

      const first = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'key-A')
        .send(orderData)
        .expect(201);

      const second = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'key-B')
        .send(orderData)
        .expect(201);

      expect(first.body.data._id).not.toBe(second.body.data._id);
    });

    it('should work normally without an Idempotency-Key header', async () => {
      orderData.orderItems[0].product = productId;

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
    });
  });
});
