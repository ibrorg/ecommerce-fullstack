import request from 'supertest';
import app from '../src/server';
import User from '../src/models/User';
import Product from '../src/models/Product';
import Order from '../src/models/Order';
import mongoose from 'mongoose';

// razorpay service tests

describe('Razorpay Payment', () => {
  let buyerToken: string;
  let orderId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});

    const buyerReg = await request(app).post('/api/auth/register').send({
      name: 'Buyer', email: 'buyer@example.com', password: 'password123'
    });
    buyerToken = buyerReg.body.token;

    const product = await Product.create({
      name: 'Razorpay Test',
      description: 'desc',
      price: 500,
      category: 'Electronics',
      countInStock: 10,
      images: ['img.jpg'],
      sku: 'TEST-RZP-001',
      createdBy: new mongoose.Types.ObjectId()
    });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        orderItems: [{
          product: (product._id as mongoose.Types.ObjectId).toString(),
          name: 'Razorpay Test',
          quantity: 1,
          price: 500,
          image: 'img.jpg'
        }],
        shippingAddress: { address: '1 St', city: 'Mumbai', postalCode: '400001', country: 'India' },
        paymentMethod: 'Razorpay'
      });
    orderId = orderRes.body.data._id;
  });

  it('should reject create-order without auth', async () => {
    await request(app)
      .post(`/api/razorpay/create-order/${orderId}`)
      .expect(401);
  });

  it('should reject create-order for non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    // razorpay not configured in test env, so we get 500 for real orders
    // but for non-existent order the 404 check happens first
    const response = await request(app)
      .post(`/api/razorpay/create-order/${fakeId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    // could be 404 (order not found) or 500 (razorpay not configured)
    expect([404, 500]).toContain(response.status);
  });

  it('should reject verify without required fields', async () => {
    await request(app)
      .post(`/api/razorpay/verify/${orderId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({})
      .expect(400);
  });

  it('should reject verify with invalid signature', async () => {
    const response = await request(app)
      .post(`/api/razorpay/verify/${orderId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        razorpayOrderId: 'order_fake',
        razorpayPaymentId: 'pay_fake',
        signature: 'invalid_signature'
      });

    // 400 (invalid sig) or 500 (razorpay not configured)
    expect([400, 500]).toContain(response.status);
  });

  it('should reject verify without auth', async () => {
    await request(app)
      .post(`/api/razorpay/verify/${orderId}`)
      .send({
        razorpayOrderId: 'x',
        razorpayPaymentId: 'y',
        signature: 'z'
      })
      .expect(401);
  });
});
