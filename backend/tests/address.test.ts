import request from 'supertest';
import app from '../src/server';
import User from '../src/models/User';
import Address from '../src/models/Address';

// address book service + endpoint tests

const validAddress = {
  label: 'Home',
  fullName: 'John Doe',
  phone: '+919876543210',
  line1: '12 MG Road',
  line2: 'Apt 4B',
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400001',
  country: 'India',
  landmark: 'Near station'
};

describe('Address Book', () => {
  let token: string;
  let token2: string;

  beforeEach(async () => {
    await User.deleteMany({});
    await Address.deleteMany({});

    const reg = await request(app).post('/api/auth/register').send({
      name: 'Address User',
      email: 'addr@example.com',
      password: 'password123'
    });
    token = reg.body.token;

    const reg2 = await request(app).post('/api/auth/register').send({
      name: 'Other User',
      email: 'other@example.com',
      password: 'password123'
    });
    token2 = reg2.body.token;
  });

  describe('GET /api/addresses', () => {
    it('should return empty list for a new user', async () => {
      const res = await request(app)
        .get('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/addresses')
        .expect(401);

      expect(res.body.status).toBe('error');
    });
  });

  describe('POST /api/addresses', () => {
    it('should create an address and auto-default the first one', async () => {
      const res = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(validAddress)
        .expect(201);

      expect(res.body.data.fullName).toBe('John Doe');
      expect(res.body.data.isDefaultShipping).toBe(true);
      expect(res.body.data.isDefaultBilling).toBe(true);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({ label: 'Home' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/addresses')
        .send(validAddress)
        .expect(401);
    });

    it('should unset the previous default shipping when a new one is marked default', async () => {
      const first = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(validAddress)
        .expect(201);

      const second = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validAddress, line1: '45 Park St', isDefaultShipping: true })
        .expect(201);

      expect(second.body.data.isDefaultShipping).toBe(true);

      const reloaded = await Address.findById(first.body.data._id);
      expect(reloaded!.isDefaultShipping).toBe(false);
    });
  });

  describe('PUT /api/addresses/:id', () => {
    it('should update an address field', async () => {
      const created = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(validAddress)
        .expect(201);

      const res = await request(app)
        .put(`/api/addresses/${created.body.data._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ city: 'Pune' })
        .expect(200);

      expect(res.body.data.city).toBe('Pune');
    });

    it('should return 404 for another user address', async () => {
      const created = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(validAddress)
        .expect(201);

      await request(app)
        .put(`/api/addresses/${created.body.data._id}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ city: 'Pune' })
        .expect(404);
    });
  });

  describe('PUT /api/addresses/:id/default-shipping', () => {
    it('should set a new default shipping and unset the old one', async () => {
      const first = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(validAddress)
        .expect(201);

      const second = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validAddress, line1: '99 Hill Rd' })
        .expect(201);

      const res = await request(app)
        .put(`/api/addresses/${second.body.data._id}/default-shipping`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);

      expect(res.body.data.isDefaultShipping).toBe(true);

      const reloadedFirst = await Address.findById(first.body.data._id);
      expect(reloadedFirst!.isDefaultShipping).toBe(false);
    });
  });

  describe('PUT /api/addresses/:id/default-billing', () => {
    it('should set the default billing address', async () => {
      const created = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(validAddress)
        .expect(201);

      // add a second so we can switch billing to it
      const second = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validAddress, line1: '7 Lake View' })
        .expect(201);

      const res = await request(app)
        .put(`/api/addresses/${second.body.data._id}/default-billing`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);

      expect(res.body.data.isDefaultBilling).toBe(true);

      const reloadedFirst = await Address.findById(created.body.data._id);
      expect(reloadedFirst!.isDefaultBilling).toBe(false);
    });
  });

  describe('DELETE /api/addresses/:id', () => {
    it('should remove an address', async () => {
      const created = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(validAddress)
        .expect(201);

      await request(app)
        .delete(`/api/addresses/${created.body.data._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const list = await request(app)
        .get('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(list.body.data).toEqual([]);
    });

    it('should promote another address to default shipping when the default is removed', async () => {
      const first = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send(validAddress)
        .expect(201);

      const second = await request(app)
        .post('/api/addresses')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validAddress, line1: '88 New Rd' })
        .expect(201);

      // first is currently default shipping; delete it
      await request(app)
        .delete(`/api/addresses/${first.body.data._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const reloadedSecond = await Address.findById(second.body.data._id);
      expect(reloadedSecond!.isDefaultShipping).toBe(true);
    });
  });
});
