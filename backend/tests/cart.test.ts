import request from 'supertest';
import app from '../src/server';
import User from '../src/models/User';
import Product from '../src/models/Product';
import Cart from '../src/models/Cart';
import mongoose from 'mongoose';

// server-side cart tests

describe('Server Cart', () => {
  let buyerToken: string;
  let productId: string;
  let productId2: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Cart.deleteMany({});

    const buyerReg = await request(app).post('/api/auth/register').send({
      name: 'Buyer', email: 'buyer@example.com', password: 'password123'
    });
    buyerToken = buyerReg.body.token;

    const product = await Product.create({
      name: 'Cart Product 1',
      description: 'desc',
      price: 50,
      category: 'Electronics',
      countInStock: 10,
      images: ['img.jpg'],
      sku: 'TEST-CART-001',
      createdBy: new mongoose.Types.ObjectId()
    });
    productId = (product._id as mongoose.Types.ObjectId).toString();

    const product2 = await Product.create({
      name: 'Cart Product 2',
      description: 'desc',
      price: 100,
      category: 'Books',
      countInStock: 5,
      images: ['img2.jpg'],
      sku: 'TEST-CART-002',
      createdBy: new mongoose.Types.ObjectId()
    });
    productId2 = (product2._id as mongoose.Types.ObjectId).toString();
  });

  it('should get empty cart for new user', async () => {
    const response = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toEqual([]);
  });

  it('should add item to cart', async () => {
    const response = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId, quantity: 2 })
      .expect(200);

    expect(response.body.data.items.length).toBe(1);
    expect(response.body.data.items[0].quantity).toBe(2);
  });

  it('should increment quantity when adding existing item', async () => {
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId, quantity: 1 });

    const response = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId, quantity: 2 })
      .expect(200);

    expect(response.body.data.items[0].quantity).toBe(3);
  });

  it('should update item quantity', async () => {
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId, quantity: 1 });

    const response = await request(app)
      .put(`/api/cart/items/${productId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ quantity: 5 })
      .expect(200);

    expect(response.body.data.items[0].quantity).toBe(5);
  });

  it('should remove item from cart', async () => {
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId, quantity: 1 });

    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId: productId2, quantity: 1 });

    const response = await request(app)
      .delete(`/api/cart/items/${productId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(response.body.data.items.length).toBe(1);
    expect(response.body.data.items[0].product._id.toString()).toBe(productId2);
  });

  it('should clear cart', async () => {
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId, quantity: 1 });

    await request(app)
      .delete('/api/cart')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    const cart = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${buyerToken}`);

    expect(cart.body.data.items).toEqual([]);
  });

  it('should merge guest cart into server cart', async () => {
    // add server item first
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId, quantity: 1 });

    // merge guest cart with same product + new product
    const response = await request(app)
      .post('/api/cart/merge')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        items: [
          { product: productId, quantity: 2 }, // should sum with existing
          { product: productId2, quantity: 1 }
        ]
      })
      .expect(200);

    // product1 should have quantity 3 (1+2), product2 quantity 1
    const item1 = response.body.data.items.find((i: any) => i.product._id.toString() === productId);
    const item2 = response.body.data.items.find((i: any) => i.product._id.toString() === productId2);
    expect(item1.quantity).toBe(3);
    expect(item2.quantity).toBe(1);
  });

  it('should reject cart access without auth', async () => {
    await request(app).get('/api/cart').expect(401);
  });

  it('should reject add without productId', async () => {
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({})
      .expect(400);
  });
});
