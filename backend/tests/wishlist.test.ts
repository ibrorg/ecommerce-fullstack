import request from 'supertest';
import app from '../src/server';
import User from '../src/models/User';
import Product from '../src/models/Product';
import Wishlist from '../src/models/Wishlist';
import mongoose from 'mongoose';

// wishlist service + endpoint tests

describe('Wishlist', () => {
  let buyerToken: string;
  let productId: string;
  let productId2: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Wishlist.deleteMany({});

    const buyerReg = await request(app).post('/api/auth/register').send({
      name: 'Buyer',
      email: 'buyer@example.com',
      password: 'password123'
    });
    buyerToken = buyerReg.body.token;

    const product = await Product.create({
      name: 'Wishlist Product 1',
      description: 'desc',
      price: 50,
      category: 'Electronics',
      countInStock: 10,
      images: ['img.jpg'],
      sku: 'TEST-WISH-001',
      createdBy: new mongoose.Types.ObjectId()
    });
    productId = (product._id as mongoose.Types.ObjectId).toString();

    const product2 = await Product.create({
      name: 'Wishlist Product 2',
      description: 'desc',
      price: 100,
      category: 'Books',
      countInStock: 5,
      images: ['img2.jpg'],
      sku: 'TEST-WISH-002',
      createdBy: new mongoose.Types.ObjectId()
    });
    productId2 = (product2._id as mongoose.Types.ObjectId).toString();
  });

  it('should get empty wishlist for new user', async () => {
    const response = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toEqual([]);
  });

  it('should add product to wishlist', async () => {
    const response = await request(app)
      .post(`/api/wishlist/${productId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items.length).toBe(1);
    expect(response.body.data.items[0].product._id.toString()).toBe(productId);
  });

  it('should not duplicate when adding same product twice', async () => {
    await request(app)
      .post(`/api/wishlist/${productId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    const response = await request(app)
      .post(`/api/wishlist/${productId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(response.body.data.items.length).toBe(1);
  });

  it('should add multiple distinct products to wishlist', async () => {
    await request(app)
      .post(`/api/wishlist/${productId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    const response = await request(app)
      .post(`/api/wishlist/${productId2}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(response.body.data.items.length).toBe(2);
  });

  it('should remove product from wishlist', async () => {
    await request(app)
      .post(`/api/wishlist/${productId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    await request(app)
      .post(`/api/wishlist/${productId2}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    const response = await request(app)
      .delete(`/api/wishlist/${productId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(response.body.data.items.length).toBe(1);
    expect(response.body.data.items[0].product._id.toString()).toBe(productId2);
  });

  it('should return 404 when removing a product not in wishlist', async () => {
    await request(app)
      .post(`/api/wishlist/${productId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    const response = await request(app)
      .delete(`/api/wishlist/${productId2}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(404);

    expect(response.body.success).toBe(false);
  });

  it('should clear wishlist', async () => {
    await request(app)
      .post(`/api/wishlist/${productId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    await request(app)
      .post(`/api/wishlist/${productId2}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    await request(app)
      .delete('/api/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    const getResponse = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(getResponse.body.data.items).toEqual([]);
  });

  it('should reject add for non-existent product (404)', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const response = await request(app)
      .post(`/api/wishlist/${fakeId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(404);

    expect(response.body.success).toBe(false);
  });

  it('should reject access without auth (401)', async () => {
    await request(app).get('/api/wishlist').expect(401);
  });

  it('should reject POST without auth (401)', async () => {
    await request(app).post(`/api/wishlist/${productId}`).expect(401);
  });

  it('should get wishlist with populated product details', async () => {
    await request(app)
      .post(`/api/wishlist/${productId}`)
      .set('Authorization', `Bearer ${buyerToken}`);

    const response = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    const item = response.body.data.items[0];
    // populated product should expose name/price — not be a raw ObjectId
    expect(typeof item.product).toBe('object');
    expect(item.product).not.toBeNull();
    expect(item.product.name).toBe('Wishlist Product 1');
    expect(item.product.price).toBe(50);
    expect(item.addedAt).toBeDefined();
  });
});
