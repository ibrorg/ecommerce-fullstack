import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server';
import User from '../src/models/User';
import Product from '../src/models/Product';
import Order from '../src/models/Order';

// search autocomplete + product recommendations endpoint tests
// uses the shared in-memory MongoDB replica set from setup.ts

interface Suggestion {
  _id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  image: string;
}

interface Recommendation {
  _id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  rating: number;
  count: number;
}

interface RelatedProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  rating: number;
}

describe('Search & Recommendations', () => {
  let buyerToken: string;
  let userId: mongoose.Types.ObjectId;
  let productA: string;
  let productB: string;
  let productC: string;
  let productD: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});

    const buyerReg = await request(app).post('/api/auth/register').send({
      name: 'Buyer',
      email: 'buyer@example.com',
      password: 'password123'
    });
    buyerToken = buyerReg.body.token;

    const user = await User.findOne({ email: 'buyer@example.com' });
    userId = user!._id as mongoose.Types.ObjectId;

    const a = await Product.create({
      name: 'iPhone 13',
      description: 'Apple smartphone',
      price: 799,
      category: 'Electronics',
      countInStock: 10,
      images: ['iphone13.jpg'],
      sku: 'IPH-13',
      rating: 4.5,
      numReviews: 10,
      createdBy: userId
    });
    productA = (a._id as mongoose.Types.ObjectId).toString();

    const b = await Product.create({
      name: 'iPhone 14 Case',
      description: 'Case for iPhone 14',
      price: 29,
      category: 'Electronics',
      countInStock: 50,
      images: ['case.jpg'],
      sku: 'CASE-14',
      rating: 4.2,
      numReviews: 5,
      createdBy: userId
    });
    productB = (b._id as mongoose.Types.ObjectId).toString();

    const c = await Product.create({
      name: 'Samsung Galaxy S22',
      description: 'Samsung flagship',
      price: 699,
      category: 'Electronics',
      countInStock: 8,
      images: ['galaxy.jpg'],
      sku: 'SAM-S22',
      rating: 4.7,
      numReviews: 20,
      createdBy: userId
    });
    productC = (c._id as mongoose.Types.ObjectId).toString();

    const d = await Product.create({
      name: 'Coffee Maker',
      description: 'Drip coffee maker',
      price: 49,
      category: 'Kitchen',
      countInStock: 15,
      images: ['coffee.jpg'],
      sku: 'COFFEE-1',
      rating: 4.0,
      numReviews: 3,
      createdBy: userId
    });
    productD = (d._id as mongoose.Types.ObjectId).toString();
  });

  describe('GET /api/search/autocomplete', () => {
    it('should return product name suggestions matching the query', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete?q=iphone')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(2);

      const names = response.body.data.map((p: Suggestion) => p.name);
      expect(names).toEqual(expect.arrayContaining(['iPhone 13', 'iPhone 14 Case']));

      // verify the documented response shape
      const first = response.body.data[0] as Suggestion;
      expect(first).toHaveProperty('_id');
      expect(first).toHaveProperty('slug');
      expect(first).toHaveProperty('category');
      expect(first).toHaveProperty('price');
      expect(first).toHaveProperty('image');
    });

    it('should return an empty array when the query is less than 2 characters', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete?q=i')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should match case-insensitively', async () => {
      const response = await request(app)
        .get('/api/search/autocomplete?q=IPHONE')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should cap results at 8 even when more matches exist', async () => {
      // 10 products whose names start with "Phone"
      for (let i = 0; i < 10; i++) {
        await Product.create({
          name: `Phone Model ${i}`,
          description: 'desc',
          price: 100 + i,
          category: 'Electronics',
          countInStock: 5,
          images: [`p${i}.jpg`],
          sku: `PHONE-${i}`,
          rating: 4,
          createdBy: userId
        });
      }

      const response = await request(app)
        .get('/api/search/autocomplete?q=phone&limit=20')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(8);
    });
  });

  describe('GET /api/products/:id/recommendations (with order history)', () => {
    beforeEach(async () => {
      // Order 1: A + B + C
      await Order.create({
        user: userId,
        orderItems: [
          { product: productA, name: 'iPhone 13', quantity: 1, price: 799, image: 'iphone13.jpg' },
          { product: productB, name: 'iPhone 14 Case', quantity: 1, price: 29, image: 'case.jpg' },
          { product: productC, name: 'Samsung Galaxy S22', quantity: 1, price: 699, image: 'galaxy.jpg' }
        ],
        shippingAddress: { address: '1 St', city: 'C', postalCode: '12345', country: 'US' },
        paymentMethod: 'PayPal',
        itemsPrice: 1527,
        taxPrice: 0,
        shippingPrice: 0,
        totalPrice: 1527,
        isPaid: true,
        paidAt: new Date()
      });
      // Order 2: A + B (B now co-occurs twice)
      await Order.create({
        user: userId,
        orderItems: [
          { product: productA, name: 'iPhone 13', quantity: 1, price: 799, image: 'iphone13.jpg' },
          { product: productB, name: 'iPhone 14 Case', quantity: 1, price: 29, image: 'case.jpg' }
        ],
        shippingAddress: { address: '1 St', city: 'C', postalCode: '12345', country: 'US' },
        paymentMethod: 'PayPal',
        itemsPrice: 828,
        taxPrice: 0,
        shippingPrice: 0,
        totalPrice: 828,
        isPaid: true,
        paidAt: new Date()
      });
    });

    it('should return co-occurring products ranked by frequency', async () => {
      const response = await request(app)
        .get(`/api/products/${productA}/recommendations`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(2);

      // B appears in 2 orders, C in 1 — B must rank first
      const recs = response.body.data as Recommendation[];
      expect(recs[0]).toHaveProperty('name', 'iPhone 14 Case');
      expect(recs[0]).toHaveProperty('count', 2);
      expect(recs[1]).toHaveProperty('name', 'Samsung Galaxy S22');
      expect(recs[1]).toHaveProperty('count', 1);
    });

    it('should exclude the source product from recommendations', async () => {
      const response = await request(app)
        .get(`/api/products/${productA}/recommendations`)
        .expect(200);

      const ids = (response.body.data as Recommendation[]).map(p => p._id);
      expect(ids).not.toContain(productA);
    });
  });

  describe('GET /api/products/:id/recommendations (fallback)', () => {
    it('should fall back to same-category products when no co-occurrence data exists', async () => {
      // No orders created in this describe block — productA has no co-occurrence data,
      // so the service should fall back to top-rated products in the same category
      // (Electronics). productD is in Kitchen and must NOT appear.
      const response = await request(app)
        .get(`/api/products/${productA}/recommendations`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const names = (response.body.data as Recommendation[]).map(p => p.name);
      expect(names).toEqual(expect.arrayContaining(['iPhone 14 Case', 'Samsung Galaxy S22']));
      expect(names).not.toContain('Coffee Maker');
      // fallback entries carry count: 0
      expect((response.body.data as Recommendation[])[0]).toHaveProperty('count', 0);
    });
  });

  describe('GET /api/products/:id/related', () => {
    it('should return products in the same category, excluding the source', async () => {
      const response = await request(app)
        .get(`/api/products/${productA}/related`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      // Electronics has A, B, C — excluding A leaves B and C
      expect(response.body.data).toHaveLength(2);

      const names = (response.body.data as RelatedProduct[]).map(p => p.name);
      expect(names).toEqual(expect.arrayContaining(['iPhone 14 Case', 'Samsung Galaxy S22']));
      expect(names).not.toContain('iPhone 13');
      expect(names).not.toContain('Coffee Maker');

      // top rating first — Samsung (4.7) > iPhone Case (4.2)
      expect(response.body.data[0]).toHaveProperty('name', 'Samsung Galaxy S22');
    });
  });
});
