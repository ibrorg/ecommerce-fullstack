import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/server';
import User from '../src/models/User';
import Store from '../src/models/Store';
import Product from '../src/models/Product';

// seller endpoint tests — uses shared in-memory MongoDB from setup.ts

const validSellerPayload = {
  storeName: 'Test Store',
  businessType: 'individual',
  description: 'A test store',
  gstNumber: '27ABCDE1234F1Z5',
  pan: 'ABCDE1234F',
  businessAddress: '123 Test St',
  city: 'Mumbai',
  state: 'Maharashtra',
  zipCode: '400001',
  phone: '9876543210',
  bankAccountNumber: '1234567890123',
  ifscCode: 'ABCD0123456',
  bankName: 'Test Bank'
};

// Helper: register a regular buyer and return its token + id
const createBuyer = async (email = 'buyer@example.com') => {
  const reg = await request(app).post('/api/auth/register').send({
    name: 'Buyer User',
    email,
    password: 'password123'
  });
  return { token: reg.body.token, userId: reg.body.data.id };
};

// Helper: register a user, promote to seller, create a store directly in the
// DB so subsequent seller-only endpoints have a store to operate on.
const createSeller = async (email = 'seller@example.com') => {
  const reg = await request(app).post('/api/auth/register').send({
    name: 'Seller User',
    email,
    password: 'password123'
  });
  const userId = reg.body.data.id;

  // promote to seller role (route guards check req.user.role)
  await User.updateOne({ _id: userId }, { $set: { role: 'seller' } });

  // create store directly to bypass the seller registration route (tested separately)
  // slug must be unique — derive from email so each seller has a different slug
  const slug = email.split('@')[0].toLowerCase();
  await Store.create({
    name: 'Test Store',
    slug,
    description: 'A test store',
    businessType: 'individual',
    owner: userId,
    email,
    phone: '9876543210',
    address: {
      street: '123 Test St',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      zipCode: '400001'
    },
    bankDetails: {
      accountName: 'Seller User',
      accountNumber: '1234567890123',
      ifscCode: 'ABCD0123456',
      bankName: 'Test Bank'
    }
  });

  // re-login to get a fresh token (the role is also fetched fresh on each request)
  const login = await request(app).post('/api/auth/login').send({
    email,
    password: 'password123'
  });

  return { token: login.body.token, userId };
};

describe('Seller Endpoints', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Store.deleteMany({});
    await Product.deleteMany({});
  });

  describe('POST /api/seller/register', () => {
    it('should register a seller successfully with valid data', async () => {
      const buyer = await createBuyer('reg-seller@example.com');

      const response = await request(app)
        .post('/api/seller/register')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send(validSellerPayload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('store');
      expect(response.body.data.store).toHaveProperty('name', 'Test Store');

      // role should be promoted to seller in the DB
      const updatedUser = await User.findById(buyer.userId);
      expect(updatedUser?.role).toBe('seller');
    });

    it('should return 400 when required fields are missing', async () => {
      const buyer = await createBuyer('missing-fields@example.com');

      const response = await request(app)
        .post('/api/seller/register')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ storeName: 'Only Name' }) // missing many fields
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('All fields are required');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/seller/register')
        .send(validSellerPayload)
        .expect(401);

      expect(response.body.status).toBe('error');
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should not allow a seller to register a second store', async () => {
      // createSeller already creates a store for this user
      const seller = await createSeller('dup-seller@example.com');

      const response = await request(app)
        .post('/api/seller/register')
        .set('Authorization', `Bearer ${seller.token}`)
        .send({ ...validSellerPayload, storeName: 'Second Store' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/seller/store', () => {
    it('should get the seller store when one exists', async () => {
      const seller = await createSeller('store-get@example.com');

      const response = await request(app)
        .get('/api/seller/store')
        .set('Authorization', `Bearer ${seller.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('name', 'Test Store');
    });

    it('should return 404 when seller has no store', async () => {
      // register a buyer, promote to seller, but DON'T create a store
      const reg = await request(app).post('/api/auth/register').send({
        name: 'No Store Seller',
        email: 'no-store@example.com',
        password: 'password123'
      });
      await User.updateOne(
        { _id: reg.body.data.id },
        { $set: { role: 'seller' } }
      );
      const login = await request(app).post('/api/auth/login').send({
        email: 'no-store@example.com',
        password: 'password123'
      });

      const response = await request(app)
        .get('/api/seller/store')
        .set('Authorization', `Bearer ${login.body.token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/seller/store')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /api/seller/dashboard', () => {
    it('should return dashboard data for a seller', async () => {
      const seller = await createSeller('dashboard@example.com');

      const response = await request(app)
        .get('/api/seller/dashboard')
        .set('Authorization', `Bearer ${seller.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('store');
      expect(response.body.data).toHaveProperty('earnings');
      expect(response.body.data).toHaveProperty('totalProducts');
    });

    it('should not allow a buyer to access seller dashboard (403)', async () => {
      const buyer = await createBuyer('buyer-dashboard@example.com');

      const response = await request(app)
        .get('/api/seller/dashboard')
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(403);

      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/seller/products', () => {
    it('should return paginated seller products', async () => {
      const seller = await createSeller('products-list@example.com');

      // seed a product owned by the seller
      await Product.create({
        name: 'Seller Product',
        description: 'A product',
        price: 19.99,
        category: 'Books',
        countInStock: 5,
        images: ['img.jpg'],
        sku: 'SELLER-SKU-001',
        createdBy: seller.userId
      });

      const response = await request(app)
        .get('/api/seller/products')
        .set('Authorization', `Bearer ${seller.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data.products.length).toBe(1);
      expect(response.body.data.products[0]).toHaveProperty('name', 'Seller Product');
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should return 403 for a non-seller', async () => {
      const buyer = await createBuyer('products-buyer@example.com');

      const response = await request(app)
        .get('/api/seller/products')
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(403);

      expect(response.body.status).toBe('error');
    });
  });

  describe('POST /api/seller/products', () => {
    it('should create a product as a seller', async () => {
      const seller = await createSeller('create-prod@example.com');

      const productData = {
        name: 'New Seller Product',
        description: 'Brand new',
        price: 29.99,
        category: 'Electronics',
        countInStock: 8,
        images: ['new.jpg'],
        sku: 'SELLER-NEW-001'
      };

      const response = await request(app)
        .post('/api/seller/products')
        .set('Authorization', `Bearer ${seller.token}`)
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('name', 'New Seller Product');
      expect(response.body.data).toHaveProperty('price', 29.99);
      // createdBy should be set to the seller's user id
      expect(response.body.data.createdBy).toBe(seller.userId);
    });

    it('should reject duplicate SKU', async () => {
      const seller = await createSeller('dup-sku@example.com');

      await Product.create({
        name: 'Existing',
        description: 'Existing product',
        price: 9.99,
        category: 'Toys',
        countInStock: 1,
        images: ['x.jpg'],
        sku: 'DUP-SKU-001',
        createdBy: seller.userId
      });

      const response = await request(app)
        .post('/api/seller/products')
        .set('Authorization', `Bearer ${seller.token}`)
        .send({
          name: 'Another',
          description: 'Another product',
          price: 19.99,
          category: 'Toys',
          countInStock: 1,
          images: ['y.jpg'],
          sku: 'DUP-SKU-001'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 for a non-seller', async () => {
      const buyer = await createBuyer('create-buyer@example.com');

      const response = await request(app)
        .post('/api/seller/products')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({
          name: 'X',
          description: 'Y',
          price: 1,
          category: 'Z',
          countInStock: 1,
          images: ['z.jpg'],
          sku: 'Z-1'
        })
        .expect(403);

      expect(response.body.status).toBe('error');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/seller/products')
        .send({
          name: 'X',
          description: 'Y',
          price: 1,
          category: 'Z',
          countInStock: 1,
          images: ['z.jpg'],
          sku: 'Z-2'
        })
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('DELETE /api/seller/products/:id', () => {
    it('should delete (soft) a product owned by the seller', async () => {
      const seller = await createSeller('delete-prod@example.com');

      const product = await Product.create({
        name: 'To Delete',
        description: 'Will be deleted',
        price: 5.99,
        category: 'Home',
        countInStock: 3,
        images: ['d.jpg'],
        sku: 'DEL-SKU-001',
        createdBy: seller.userId
      });

      const productId = (product._id as mongoose.Types.ObjectId).toString();

      const response = await request(app)
        .delete(`/api/seller/products/${productId}`)
        .set('Authorization', `Bearer ${seller.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isActive', false);
      expect(response.body.data.deletedAt).toBeTruthy();
    });

    it('should return 403 when deleting a product owned by another seller', async () => {
      const sellerA = await createSeller('owner-a@example.com');
      const sellerB = await createSeller('owner-b@example.com');

      const product = await Product.create({
        name: 'Owned by A',
        description: 'Not B\'s product',
        price: 7.99,
        category: 'Home',
        countInStock: 2,
        images: ['a.jpg'],
        sku: 'OWN-A-001',
        createdBy: sellerA.userId
      });

      const productId = (product._id as mongoose.Types.ObjectId).toString();

      const response = await request(app)
        .delete(`/api/seller/products/${productId}`)
        .set('Authorization', `Bearer ${sellerB.token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 when product does not exist', async () => {
      const seller = await createSeller('missing-prod@example.com');
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/seller/products/${fakeId}`)
        .set('Authorization', `Bearer ${seller.token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/seller/products/${fakeId}`)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});
