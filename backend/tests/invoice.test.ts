import request from 'supertest';
import app from '../src/server';
import User from '../src/models/User';
import Product from '../src/models/Product';
import Order from '../src/models/Order';
import mongoose from 'mongoose';

// invoice PDF generation tests

describe('Order Invoice PDF', () => {
  let buyerToken: string;
  let otherToken: string;
  let adminToken: string;
  let orderId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});

    // buyer
    const buyerReg = await request(app).post('/api/auth/register').send({
      name: 'Buyer', email: 'buyer@example.com', password: 'password123'
    });
    buyerToken = buyerReg.body.token;

    // other user
    const otherReg = await request(app).post('/api/auth/register').send({
      name: 'Other', email: 'other@example.com', password: 'password123'
    });
    otherToken = otherReg.body.token;

    // admin
    await request(app).post('/api/auth/register').send({
      name: 'Admin', email: 'admin@example.com', password: 'password123'
    });
    await User.updateOne({ email: 'admin@example.com' }, { $set: { role: 'admin' } });
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.com', password: 'password123'
    });
    adminToken = adminLogin.body.token;

    // product + order
    const product = await Product.create({
      name: 'Invoice Test Product',
      description: 'desc',
      price: 100,
      category: 'Electronics',
      countInStock: 10,
      images: ['img.jpg'],
      sku: 'TEST-INV-001',
      createdBy: new mongoose.Types.ObjectId()
    });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        orderItems: [{
          product: (product._id as mongoose.Types.ObjectId).toString(),
          name: 'Invoice Test Product',
          quantity: 2,
          price: 100,
          image: 'img.jpg'
        }],
        shippingAddress: { address: '1 St', city: 'City', postalCode: '12345', country: 'India' },
        paymentMethod: 'Stripe'
      });
    orderId = orderRes.body.data._id;
  });

  it('should download PDF invoice as order owner', async () => {
    const response = await request(app)
      .get(`/api/orders/${orderId}/invoice`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.body.length).toBeGreaterThan(1000); // PDF has content
  });

  it('should download PDF invoice as admin', async () => {
    const response = await request(app)
      .get(`/api/orders/${orderId}/invoice`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.headers['content-type']).toBe('application/pdf');
  });

  it('should reject invoice download for non-owner non-admin', async () => {
    await request(app)
      .get(`/api/orders/${orderId}/invoice`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('should reject invoice download without auth', async () => {
    await request(app)
      .get(`/api/orders/${orderId}/invoice`)
      .expect(401);
  });

  it('should return 404 for non-existent order invoice', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await request(app)
      .get(`/api/orders/${fakeId}/invoice`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(404);
  });
});
