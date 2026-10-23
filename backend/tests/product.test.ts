import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server';
import User from '../src/models/User';
import Product from '../src/models/Product';
import Order from '../src/models/Order';

// product endpoint tests — uses shared in-memory MongoDB from setup.ts

describe('Product Endpoints', () => {
  let authToken: string;
  let adminToken: string;
  let productId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});

    // create a regular buyer via the public register endpoint
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'user@example.com',
        password: 'password123'
      });
    authToken = userResponse.body.token;

    // create an admin: register, then promote role directly in the DB
    const adminReg = await request(app)
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

    // login again to get a fresh token carrying the admin role
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'password123'
      });
    adminToken = adminLogin.body.token;

    // create a test product as admin
    const productResponse = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Product',
        description: 'A test product',
        price: 99.99,
        category: 'Electronics',
        countInStock: 10,
        images: ['test-image.jpg'],
        sku: 'TEST-SKU-001'
      });
    productId = productResponse.body.data._id;
  });

  describe('GET /api/products', () => {
    it('should get all products', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0]).toHaveProperty('name', 'Test Product');
    });

    it('should set X-Request-Id response header', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should set X-Response-Time header', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.headers['x-response-time']).toBeDefined();
      expect(response.headers['x-response-time']).toMatch(/\d+\.\d+ms/);
    });

    it('should work under /api/v1/ versioned prefix', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should set X-API-Version header on API responses', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('1.0.0');
    });

    it('should echo back a provided X-Request-Id header', async () => {
      const customId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const response = await request(app)
        .get('/api/products')
        .set('X-Request-Id', customId)
        .expect(200);

      expect(response.headers['x-request-id']).toBe(customId);
    });

    it('should set Cache-Control on product list responses', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.headers['cache-control']).toContain('max-age=60');
      expect(response.headers['cache-control']).toContain('stale-while-revalidate=300');
      expect(response.headers['vary']).toContain('Accept-Encoding');
    });

    it('should include computed badges array on each product', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body.data[0]).toHaveProperty('badges');
      expect(Array.isArray(response.body.data[0].badges)).toBe(true);
    });

    it('should compute New badge for recently created products', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      // the beforeEach product is created moments ago, so "New" should apply
      expect(response.body.data[0].badges).toContain('New');
    });

    it('should compute Sale badge when comparePrice exceeds price', async () => {
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'On Sale Item',
          description: 'desc',
          price: 30,
          comparePrice: 50,
          category: 'Electronics',
          countInStock: 8,
          images: ['img.jpg'],
          sku: 'TEST-SKU-SALE'
        })
        .expect(201);

      const response = await request(app)
        .get('/api/products?search=On Sale')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].badges).toContain('Sale');
    });

    it('should compute Low Stock badge when countInStock is between 1 and 5', async () => {
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Low Stock Item',
          description: 'desc',
          price: 20,
          category: 'Misc',
          countInStock: 3,
          images: ['img.jpg'],
          sku: 'TEST-SKU-LOW'
        })
        .expect(201);

      const response = await request(app)
        .get('/api/products?search=Low Stock')
        .expect(200);

      expect(response.body.data[0].badges).toContain('Low Stock');
    });

    it('should search products by name', async () => {
      const response = await request(app)
        .get('/api/products?search=Test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get('/api/products?category=Electronics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
    });

    it('should return empty array for non-existent category', async () => {
      const response = await request(app)
        .get('/api/products?category=NonExistent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(0);
    });

    it('should sort products by price ascending', async () => {
      // add a cheaper product so order is observable
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Cheaper Item',
          description: 'desc',
          price: 9.99,
          category: 'Electronics',
          countInStock: 5,
          images: ['img.jpg'],
          sku: 'TEST-SKU-CHEAP'
        })
        .expect(201);

      const response = await request(app)
        .get('/api/products?sort=price-asc')
        .expect(200);

      const prices = response.body.data.map((p: any) => p.price);
      expect(prices.length).toBeGreaterThanOrEqual(2);
      // first should be the cheapest
      expect(prices[0]).toBeLessThanOrEqual(prices[prices.length - 1]);
    });

    it('should sort products by price descending', async () => {
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Cheaper Item',
          description: 'desc',
          price: 9.99,
          category: 'Electronics',
          countInStock: 5,
          images: ['img.jpg'],
          sku: 'TEST-SKU-CHEAP2'
        })
        .expect(201);

      const response = await request(app)
        .get('/api/products?sort=price-desc')
        .expect(200);

      const prices = response.body.data.map((p: any) => p.price);
      expect(prices[0]).toBeGreaterThanOrEqual(prices[prices.length - 1]);
    });

    it('should filter by brand', async () => {
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Branded Item',
          description: 'desc',
          price: 19.99,
          category: 'Electronics',
          brand: 'Acme',
          countInStock: 5,
          images: ['img.jpg'],
          sku: 'TEST-SKU-BRAND'
        })
        .expect(201);

      const response = await request(app)
        .get('/api/products?brand=Acme')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.every((p: any) => p.brand === 'Acme')).toBe(true);
    });

    it('should filter by minimum rating', async () => {
      // attach a 5-star review to the test product
      await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rating: 5, comment: 'Excellent product loved it' })
        .expect(201);

      const response = await request(app)
        .get('/api/products?minRating=4')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.every((p: any) => p.rating >= 4)).toBe(true);
    });

    it('should filter in-stock products only', async () => {
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Out of Stock Item',
          description: 'desc',
          price: 15,
          category: 'Misc',
          countInStock: 0,
          images: ['img.jpg'],
          sku: 'TEST-SKU-OOS'
        })
        .expect(201);

      const response = await request(app)
        .get('/api/products?inStock=true')
        .expect(200);

      expect(response.body.data.every((p: any) => p.countInStock > 0)).toBe(true);
    });

    it('should filter by Sale badge (comparePrice > price)', async () => {
      // a non-sale product (the beforeEach Test Product has no comparePrice)
      // + a sale product
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Discounted Item',
          description: 'desc',
          price: 30,
          comparePrice: 60,
          category: 'Electronics',
          countInStock: 8,
          images: ['img.jpg'],
          sku: 'TEST-SKU-BADGE-SALE'
        })
        .expect(201);

      const response = await request(app)
        .get('/api/products?badges=Sale')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      // every returned product should actually carry the Sale badge
      expect(response.body.data.every((p: any) => p.badges.includes('Sale'))).toBe(true);
    });

    it('should filter by Low Stock badge', async () => {
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Almost Gone Item',
          description: 'desc',
          price: 20,
          category: 'Misc',
          countInStock: 2,
          images: ['img.jpg'],
          sku: 'TEST-SKU-BADGE-LOW'
        })
        .expect(201);

      const response = await request(app)
        .get('/api/products?badges=Low%20Stock')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.every((p: any) => p.badges.includes('Low Stock'))).toBe(true);
    });

    it('should filter by multiple badges (OR)', async () => {
      // Sale product + Low Stock product
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Multi Sale',
          description: 'desc',
          price: 25,
          comparePrice: 50,
          category: 'Misc',
          countInStock: 10,
          images: ['img.jpg'],
          sku: 'TEST-SKU-BADGE-MULTI1'
        })
        .expect(201);
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Multi Low',
          description: 'desc',
          price: 25,
          category: 'Misc',
          countInStock: 3,
          images: ['img.jpg'],
          sku: 'TEST-SKU-BADGE-MULTI2'
        })
        .expect(201);

      const response = await request(app)
        .get('/api/products?badges=Sale,Low%20Stock')
        .expect(200);

      // every returned product matches at least one of the requested badges
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      expect(
        response.body.data.every(
          (p: any) => p.badges.includes('Sale') || p.badges.includes('Low Stock')
        )
      ).toBe(true);
    });
  });

  describe('GET /api/products (cursor pagination)', () => {
    it('should return nextCursor when there are more results', async () => {
      // create 4 extra products so we have 5 total with the beforeEach product
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: `Cursor Product ${i}`,
            description: 'desc',
            price: 10 + i,
            category: 'Electronics',
            countInStock: 5,
            images: ['img.jpg'],
            sku: `TEST-SKU-CURSOR-${i}`
          })
          .expect(201);
      }

      const response = await request(app)
        .get('/api/products?cursor&limit=2&sort=price-asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.nextCursor).toBeDefined();
      // should not have page/pages (offset-only fields)
      expect(response.body.pagination.page).toBeUndefined();
    });

    it('should return the next page when using nextCursor', async () => {
      // create 4 extra products
      const createdIds: string[] = [];
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: `Cursor Page2 ${i}`,
            description: 'desc',
            price: 10 + i,
            category: 'Electronics',
            countInStock: 5,
            images: ['img.jpg'],
            sku: `TEST-SKU-CURSOR2-${i}`
          })
          .expect(201);
        createdIds.push(res.body.data._id);
      }

      // first page
      const first = await request(app)
        .get('/api/products?cursor&limit=2&sort=price-asc')
        .expect(200);

      const firstIds = first.body.data.map((p: any) => p._id);

      // second page using nextCursor
      const second = await request(app)
        .get(`/api/products?cursor=${first.body.pagination.nextCursor}&limit=2&sort=price-asc`)
        .expect(200);

      const secondIds = second.body.data.map((p: any) => p._id);

      // pages should not overlap
      const overlap = firstIds.filter((id: string) => secondIds.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('should return undefined nextCursor on the last page', async () => {
      // only the beforeEach product exists — 1 item, limit=10 → last page
      const response = await request(app)
        .get('/api/products?cursor&limit=10')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.pagination.nextCursor).toBeUndefined();
    });

    it('should return 400 for an invalid cursor', async () => {
      const response = await request(app)
        .get('/api/products?cursor=invalid-cursor-string&limit=2')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/products/bulk', () => {
    it('should return products matching the given ids in order', async () => {
      // create a second product
      const second = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Second Product',
          description: 'desc',
          price: 25,
          category: 'Books',
          countInStock: 3,
          images: ['img.jpg'],
          sku: 'TEST-SKU-002'
        })
        .expect(201);
      const secondId = second.body.data._id;

      const response = await request(app)
        .get(`/api/products/bulk?ids=${secondId},${productId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      // order should match the requested order
      expect(response.body.data[0]._id).toBe(secondId);
      expect(response.body.data[1]._id).toBe(productId);
    });

    it('should return empty array when no ids provided', async () => {
      const response = await request(app)
        .get('/api/products/bulk')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should silently drop invalid ids', async () => {
      const response = await request(app)
        .get(`/api/products/bulk?ids=not-an-id,${productId}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]._id).toBe(productId);
    });
  });

  describe('GET /api/products/compare', () => {
    it('should return fuller projection for comparison', async () => {
      // create a second product with weight + dimensions
      const second = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Compare Product',
          description: 'desc',
          price: 49,
          category: 'Electronics',
          subcategory: 'Audio',
          countInStock: 7,
          images: ['img.jpg'],
          sku: 'TEST-SKU-CMP',
          weight: 0.5,
          dimensions: { length: 10, width: 8, height: 4 }
        })
        .expect(201);
      const secondId = second.body.data._id;

      const response = await request(app)
        .get(`/api/products/compare?ids=${productId},${secondId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      // compare projection includes weight + dimensions on the product that set them
      const cmp = response.body.data.find((p: any) => p._id === secondId);
      expect(cmp).toBeDefined();
      expect(cmp.weight).toBe(0.5);
      expect(cmp.dimensions).toMatchObject({ length: 10, width: 8, height: 4 });
    });

    it('should cap at 4 unique ids', async () => {
      // create 5 products
      const ids = [productId];
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: `Extra ${i}`,
            description: 'desc',
            price: 10 + i,
            category: 'Misc',
            countInStock: 1,
            images: ['img.jpg'],
            sku: `TEST-SKU-X${i}`
          })
          .expect(201);
        ids.push(res.body.data._id);
      }

      const response = await request(app)
        .get(`/api/products/compare?ids=${ids.join(',')}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(4);
    });

    it('should return empty array when no ids provided', async () => {
      const response = await request(app)
        .get('/api/products/compare')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should get product by ID', async () => {
      const response = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('name', 'Test Product');
      expect(response.body.data).toHaveProperty('price', 99.99);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/products/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/products', () => {
    it('should create product as admin', async () => {
      const productData = {
        name: 'New Product',
        description: 'A new test product',
        price: 149.99,
        category: 'Books',
        countInStock: 5,
        images: ['new-product.jpg'],
        sku: 'NEW-PRODUCT-001'
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('name', productData.name);
      expect(response.body.data).toHaveProperty('price', productData.price);
    });

    it('should not create product as regular user', async () => {
      const productData = {
        name: 'New Product',
        description: 'A new test product',
        price: 149.99,
        category: 'Books',
        countInStock: 5,
        images: ['new-product.jpg'],
        sku: 'NEW-PRODUCT-002'
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData)
        .expect(403);

      expect(response.body.status).toBe('error');
    });

    it('should not create product without authentication', async () => {
      const productData = {
        name: 'New Product',
        description: 'A new test product',
        price: 149.99,
        category: 'Books',
        countInStock: 5,
        images: ['new-product.jpg'],
        sku: 'NEW-PRODUCT-003'
      };

      const response = await request(app)
        .post('/api/products')
        .send(productData)
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /api/products/:id/reviews', () => {
    it('should add review as authenticated user', async () => {
      const reviewData = {
        rating: 5,
        comment: 'Great product!'
      };

      const response = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(reviewData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Review added successfully');
    });

    it('should not add review without authentication', async () => {
      const reviewData = {
        rating: 5,
        comment: 'Great product!'
      };

      const response = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .send(reviewData)
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should not add duplicate review from same user', async () => {
      const reviewData = {
        rating: 5,
        comment: 'Great product!'
      };

      // Add first review
      await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(reviewData)
        .expect(201);

      // Try to add second review from same user
      const response = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(reviewData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Product already reviewed');
    });

    it('should persist photos when provided', async () => {
      const reviewData = {
        rating: 4,
        comment: 'Looks good',
        photos: ['photo1.jpg', 'photo2.jpg']
      };

      const response = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(reviewData)
        .expect(201);

      expect(response.body.data.review.photos).toEqual(['photo1.jpg', 'photo2.jpg']);
    });

    it('should default photos to empty array when not provided', async () => {
      const reviewData = {
        rating: 4,
        comment: 'No photos here'
      };

      const response = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(reviewData)
        .expect(201);

      expect(response.body.data.review.photos).toEqual([]);
    });

    it('should mark isVerifiedPurchase=false when user has no delivered order', async () => {
      const response = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rating: 5, comment: 'Nice' })
        .expect(201);

      expect(response.body.data.review.isVerifiedPurchase).toBe(false);
    });

    it('should mark isVerifiedPurchase=true when user has a delivered order', async () => {
      // look up the buyer's _id
      const buyer = await User.findOne({ email: 'user@example.com' });

      // create a paid + delivered order for this product
      await Order.create({
        user: buyer!._id,
        orderItems: [{
          product: productId,
          name: 'Test Product',
          quantity: 1,
          price: 99.99,
          image: 'test-image.jpg'
        }],
        shippingAddress: {
          address: '1 Main St',
          city: 'Mumbai',
          postalCode: '400001',
          country: 'India'
        },
        paymentMethod: 'Cash on Delivery',
        itemsPrice: 99.99,
        taxPrice: 0,
        shippingPrice: 0,
        totalPrice: 99.99,
        isPaid: true,
        isDelivered: true,
        orderStatus: 'delivered'
      } as any);

      const response = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rating: 5, comment: 'Bought and love it' })
        .expect(201);

      expect(response.body.data.review.isVerifiedPurchase).toBe(true);
    });

    it('should recompute product rating after a review', async () => {
      await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rating: 4, comment: 'Good' })
        .expect(201);

      const product = await Product.findById(productId);
      expect(product!.numReviews).toBe(1);
      expect(product!.rating).toBe(4);
    });
  });

  describe('POST /api/products/:id/reviews/:reviewId/vote', () => {
    let reviewId: string;
    let voterToken: string;

    beforeEach(async () => {
      // primary buyer leaves a review
      const reviewRes = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rating: 5, comment: 'Great' })
        .expect(201);
      reviewId = reviewRes.body.data.review._id;

      // a second buyer to cast the helpful vote
      const voterRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Voter User',
          email: 'voter@example.com',
          password: 'password123'
        });
      voterToken = voterRes.body.token;
    });

    it('should increment helpfulVotes when another user votes', async () => {
      const response = await request(app)
        .post(`/api/products/${productId}/reviews/${reviewId}/vote`)
        .set('Authorization', `Bearer ${voterToken}`)
        .send()
        .expect(200);

      expect(response.body.data.helpfulVotes).toBe(1);
    });

    it('should not allow a user to vote twice on the same review', async () => {
      await request(app)
        .post(`/api/products/${productId}/reviews/${reviewId}/vote`)
        .set('Authorization', `Bearer ${voterToken}`)
        .send()
        .expect(200);

      const response = await request(app)
        .post(`/api/products/${productId}/reviews/${reviewId}/vote`)
        .set('Authorization', `Bearer ${voterToken}`)
        .send()
        .expect(400);

      expect(response.body.message).toBe('You have already voted on this review');
    });

    it('should not allow voting on your own review', async () => {
      const response = await request(app)
        .post(`/api/products/${productId}/reviews/${reviewId}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send()
        .expect(400);

      expect(response.body.message).toBe('Cannot vote on your own review');
    });

    it('should require authentication to vote', async () => {
      const response = await request(app)
        .post(`/api/products/${productId}/reviews/${reviewId}/vote`)
        .send()
        .expect(401);

      expect(response.body.status).toBe('error');
    });

    it('should return 404 for a non-existent review', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .post(`/api/products/${productId}/reviews/${fakeId}/vote`)
        .set('Authorization', `Bearer ${voterToken}`)
        .send()
        .expect(404);

      expect(response.body.message).toBe('Review not found');
    });
  });

  describe('POST /api/products/:id/reviews/:reviewId/reply', () => {
    let reviewId: string;

    beforeEach(async () => {
      const reviewRes = await request(app)
        .post(`/api/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rating: 3, comment: 'Could be better' })
        .expect(201);
      reviewId = reviewRes.body.data.review._id;
    });

    it('should let an admin reply to a review', async () => {
      const response = await request(app)
        .post(`/api/products/${productId}/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: 'Sorry to hear that, reach out to support' })
        .expect(200);

      expect(response.body.data.sellerReply).toBeDefined();
      expect(response.body.data.sellerReply.comment).toBe('Sorry to hear that, reach out to support');
    });

    it('should not let a buyer reply to a review', async () => {
      const response = await request(app)
        .post(`/api/products/${productId}/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ comment: 'self reply' })
        .expect(403);

      expect(response.body.status).toBe('error');
    });

    it('should not allow a second reply on the same review', async () => {
      await request(app)
        .post(`/api/products/${productId}/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: 'first reply' })
        .expect(200);

      const response = await request(app)
        .post(`/api/products/${productId}/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: 'second reply' })
        .expect(400);

      expect(response.body.message).toBe('Review already has a seller reply');
    });

    it('should require a comment', async () => {
      const response = await request(app)
        .post(`/api/products/${productId}/reviews/${reviewId}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/products/${productId}/reviews/${reviewId}/reply`)
        .send({ comment: 'anon' })
        .expect(401);

      expect(response.body.status).toBe('error');
    });
  });
});
