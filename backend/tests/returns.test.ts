import request from 'supertest';
import app from '../src/server';
import User from '../src/models/User';
import Product from '../src/models/Product';
import Order from '../src/models/Order';
import ReturnRequest from '../src/models/ReturnRequest';
import mongoose from 'mongoose';

// returns / refunds flow tests

describe('Returns / Refunds', () => {
  let adminToken: string;
  let buyerToken: string;
  let orderId: string;
  let productId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await ReturnRequest.deleteMany({});

    // admin
    await request(app).post('/api/auth/register').send({
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
      price: 50,
      category: 'Electronics',
      countInStock: 10,
      images: ['img.jpg'],
      sku: 'TEST-RET-001',
      createdBy: new mongoose.Types.ObjectId()
    });
    productId = (product._id as mongoose.Types.ObjectId).toString();

    // create + pay for an order
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        orderItems: [{
          product: productId,
          name: 'Test Product',
          quantity: 2,
          price: 50,
          image: 'img.jpg'
        }],
        shippingAddress: { address: '1 St', city: 'City', postalCode: '12345', country: 'India' },
        paymentMethod: 'Stripe'
      });
    orderId = orderRes.body.data._id;

    // mark as paid
    await Order.findByIdAndUpdate(orderId, {
      isPaid: true,
      paidAt: new Date(),
      paymentResult: { id: 'pi_test_123', status: 'paid' }
    });
  });

  describe('POST /api/returns', () => {
    it('should create a return request for a paid order', async () => {
      const response = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId,
          items: [{
            product: productId,
            name: 'Test Product',
            quantity: 1,
            price: 50,
            reason: 'damaged'
          }],
          reason: 'Item arrived damaged'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('requested');
    });

    it('should reject return for unpaid order', async () => {
      await Order.findByIdAndUpdate(orderId, { isPaid: false });

      const response = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId,
          items: [{ product: productId, name: 'X', quantity: 1, price: 50, reason: 'damaged' }],
          reason: 'test'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject return for another user order', async () => {
      // register second buyer
      const other = await request(app).post('/api/auth/register').send({
        name: 'Other', email: 'other@example.com', password: 'password123'
      });

      const response = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${other.body.token}`)
        .send({
          orderId,
          items: [{ product: productId, name: 'X', quantity: 1, price: 50, reason: 'damaged' }],
          reason: 'test'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should reject duplicate return request', async () => {
      await ReturnRequest.create({
        order: orderId,
        user: new mongoose.Types.ObjectId(),
        items: [{ product: productId, name: 'X', quantity: 1, price: 50, reason: 'damaged' }],
        reason: 'first',
        status: 'requested'
      });

      const response = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId,
          items: [{ product: productId, name: 'X', quantity: 1, price: 50, reason: 'damaged' }],
          reason: 'second'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/returns/my-returns', () => {
    it('should list buyer returns', async () => {
      await ReturnRequest.create({
        order: orderId,
        user: (await User.findOne({ email: 'buyer@example.com' }))!._id,
        items: [{ product: productId, name: 'X', quantity: 1, price: 50, reason: 'damaged' }],
        reason: 'test'
      });

      const response = await request(app)
        .get('/api/returns/my-returns')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.returns.length).toBe(1);
    });
  });

  describe('Admin return management', () => {
    let returnId: string;

    beforeEach(async () => {
      const ret = await ReturnRequest.create({
        order: orderId,
        user: (await User.findOne({ email: 'buyer@example.com' }))!._id,
        items: [{ product: productId, name: 'Test Product', quantity: 1, price: 50, reason: 'damaged' }],
        reason: 'damaged on arrival'
      });
      returnId = (ret._id as mongoose.Types.ObjectId).toString();
    });

    it('should list all returns as admin', async () => {
      const response = await request(app)
        .get('/api/returns')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.returns.length).toBe(1);
    });

    it('should reject non-admin access', async () => {
      await request(app)
        .get('/api/returns')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);
    });

    it('should reject a return with reason', async () => {
      const response = await request(app)
        .put(`/api/returns/${returnId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ adminNotes: 'No damage evidence provided' })
        .expect(200);

      expect(response.body.data.status).toBe('rejected');
      expect(response.body.data.adminNotes).toContain('evidence');
    });

    it('should approve a return and reverse stock', async () => {
      const stockBefore = await Product.findById(productId);

      const response = await request(app)
        .put(`/api/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);

      expect(response.body.data.status).toBe('refunded');
      expect(response.body.data.refundAmount).toBeGreaterThan(0);

      // stock should have been incremented
      const stockAfter = await Product.findById(productId);
      expect(stockAfter!.countInStock).toBeGreaterThan(stockBefore!.countInStock);

      // order should be marked as refunded
      const order = await Order.findById(orderId);
      expect(order!.orderStatus).toBe('refunded');
    });

    it('should not approve an already-rejected return', async () => {
      await request(app)
        .put(`/api/returns/${returnId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ adminNotes: 'no' });

      const response = await request(app)
        .put(`/api/returns/${returnId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Buyer cancel return', () => {
    it('should cancel own return', async () => {
      const ret = await ReturnRequest.create({
        order: orderId,
        user: (await User.findOne({ email: 'buyer@example.com' }))!._id,
        items: [{ product: productId, name: 'X', quantity: 1, price: 50, reason: 'damaged' }],
        reason: 'test'
      });

      const response = await request(app)
        .put(`/api/returns/${(ret._id as mongoose.Types.ObjectId).toString()}/cancel`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.data.status).toBe('cancelled');
    });
  });
});
