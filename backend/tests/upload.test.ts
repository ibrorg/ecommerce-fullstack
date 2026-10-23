import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/server';
import User from '../src/models/User';

// upload endpoint tests — uses shared in-memory MongoDB from setup.ts

const fixtureDir = path.join(__dirname, 'fixtures');
const singleImagePath = path.join(fixtureDir, 'test-image.jpg');
const secondImagePath = path.join(fixtureDir, 'test-image-2.jpg');
const textFilePath = path.join(fixtureDir, 'test-file.txt');

// uploads dir created by the route module — clean between tests so the
// delete endpoint doesn't see leftover files from previous runs
const uploadsDir = path.join(process.cwd(), 'uploads');

// 1x1 JPEG (107 bytes) — valid image content so multer's image filter accepts it
const JPEG_BYTES = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
  0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
  0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
  0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
  0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
  0x03, 0x02, 0x04, 0x02, 0x05, 0x07, 0x06, 0x08, 0x01, 0x09, 0x0A, 0x00,
  0x3E, 0x01, 0x00, 0x07, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00,
  0x3F, 0x00, 0xD2, 0xCF, 0x20, 0xFF, 0xD9
]);

// Helper: register a buyer and return token + id
const createBuyer = async (email = 'buyer@example.com') => {
  const reg = await request(app).post('/api/auth/register').send({
    name: 'Buyer User',
    email,
    password: 'password123'
  });
  return { token: reg.body.token, userId: reg.body.data.id };
};

// Helper: list current files in uploads dir (excludes hidden .gitkeep etc)
const listUploads = () => {
  if (!fs.existsSync(uploadsDir)) return [] as string[];
  return fs.readdirSync(uploadsDir).filter((f) => !f.startsWith('.'));
};

describe('Upload Endpoints', () => {
  let authToken: string;

  beforeAll(() => {
    // create fixtures directory and test files once for the whole suite
    if (!fs.existsSync(fixtureDir)) fs.mkdirSync(fixtureDir);
    fs.writeFileSync(singleImagePath, JPEG_BYTES);
    fs.writeFileSync(secondImagePath, JPEG_BYTES);
    fs.writeFileSync(textFilePath, 'this is a plain text file');
  });

  beforeEach(async () => {
    await User.deleteMany({});
    // clean uploads dir so each test starts fresh
    for (const f of listUploads()) {
      try {
        fs.unlinkSync(path.join(uploadsDir, f));
      } catch {
        // ignore
      }
    }
    const buyer = await createBuyer('uploader@example.com');
    authToken = buyer.token;
  });

  afterAll(() => {
    // tidy up the uploads dir after the suite finishes
    for (const f of listUploads()) {
      try {
        fs.unlinkSync(path.join(uploadsDir, f));
      } catch {
        // ignore
      }
    }
  });

  describe('POST /api/upload', () => {
    it('should upload a single image successfully', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', singleImagePath)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('url');
      expect(response.body.data.url).toMatch(/^\/uploads\//);
      expect(response.body.data).toHaveProperty('filename');
      expect(response.body.data).toHaveProperty('mimetype', 'image/jpeg');

      // file should actually exist on disk
      const filename = response.body.data.filename;
      expect(fs.existsSync(path.join(uploadsDir, filename))).toBe(true);
    });

    it('should return 400 when no file is attached', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject a non-image file (text)', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', textFilePath)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/image/i);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/upload')
        .attach('file', singleImagePath)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /api/upload/multiple', () => {
    it('should upload multiple images at once', async () => {
      const response = await request(app)
        .post('/api/upload/multiple')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', singleImagePath)
        .attach('files', secondImagePath)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('count', 2);
      expect(response.body.data.files).toBeInstanceOf(Array);
      expect(response.body.data.files.length).toBe(2);
      expect(response.body.data.files[0]).toHaveProperty('url');
    });

    it('should return 400 when no files are attached', async () => {
      const response = await request(app)
        .post('/api/upload/multiple')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/upload/multiple')
        .attach('files', singleImagePath)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('DELETE /api/upload/:filename', () => {
    it('should delete an existing uploaded file', async () => {
      // first upload a file
      const uploadRes = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', singleImagePath)
        .expect(200);

      const filename = uploadRes.body.data.filename;
      expect(fs.existsSync(path.join(uploadsDir, filename))).toBe(true);

      // then delete it
      const response = await request(app)
        .delete(`/api/upload/${filename}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('File deleted successfully');
      expect(fs.existsSync(path.join(uploadsDir, filename))).toBe(false);
    });

    it('should return 404 when the file does not exist', async () => {
      const response = await request(app)
        .delete('/api/upload/non-existent-file.jpg')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('File not found');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete('/api/upload/whatever.jpg')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});
