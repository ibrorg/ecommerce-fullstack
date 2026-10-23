import request from 'supertest';
import app from '../src/server';
import pincodeService from '../src/services/pincodeService';

// pincode serviceability + COD eligibility tests

describe('Pincode Service & COD', () => {
  describe('GET /api/pincode/:code/serviceable', () => {
    it('should return serviceable for Mumbai pincode', async () => {
      const response = await request(app)
        .get('/api/pincode/400001/serviceable')
        .expect(200);

      expect(response.body.data.serviceable).toBe(true);
      expect(response.body.data.city).toBe('Mumbai');
      expect(response.body.data.codAvailable).toBe(true);
    });

    it('should return serviceable for Delhi pincode', async () => {
      const response = await request(app)
        .get('/api/pincode/110001/serviceable')
        .expect(200);

      expect(response.body.data.serviceable).toBe(true);
      expect(response.body.data.state).toBe('Delhi');
    });

    it('should return not serviceable for unknown pincode', async () => {
      const response = await request(app)
        .get('/api/pincode/999999/serviceable')
        .expect(200);

      expect(response.body.data.serviceable).toBe(false);
    });

    it('should return not serviceable for invalid pincode', async () => {
      const response = await request(app)
        .get('/api/pincode/123/serviceable')
        .expect(200);

      expect(response.body.data.serviceable).toBe(false);
    });
  });

  describe('GET /api/pincode/:code/cod-eligible', () => {
    it('should return COD eligible for serviceable pincode with low amount', async () => {
      const response = await request(app)
        .get('/api/pincode/400001/cod-eligible?amount=5000')
        .expect(200);

      expect(response.body.data.eligible).toBe(true);
    });

    it('should return COD not eligible for COD-blocked pincode (Lucknow)', async () => {
      const response = await request(app)
        .get('/api/pincode/226001/cod-eligible?amount=500')
        .expect(200);

      expect(response.body.data.eligible).toBe(false);
      expect(response.body.data.reason).toContain('COD not available');
    });

    it('should return COD not eligible for amount exceeding limit', async () => {
      const response = await request(app)
        .get('/api/pincode/400001/cod-eligible?amount=60000')
        .expect(200);

      expect(response.body.data.eligible).toBe(false);
      expect(response.body.data.reason).toContain('COD only available');
    });

    it('should return not eligible for un-serviceable pincode', async () => {
      const response = await request(app)
        .get('/api/pincode/999999/cod-eligible?amount=1000')
        .expect(200);

      expect(response.body.data.eligible).toBe(false);
    });
  });

  describe('PincodeService unit', () => {
    it('should check serviceability correctly', () => {
      const result = pincodeService.checkServiceability('560001');
      expect(result.serviceable).toBe(true);
      expect(result.city).toBe('Bengaluru');
    });

    it('should return false for invalid length', () => {
      const result = pincodeService.checkServiceability('12345');
      expect(result.serviceable).toBe(false);
    });

    it('should check COD eligibility with amount', () => {
      const eligible = pincodeService.isCodEligible('400001', 1000);
      expect(eligible.eligible).toBe(true);

      const ineligible = pincodeService.isCodEligible('400001', 60000);
      expect(ineligible.eligible).toBe(false);
    });
  });
});
