import request from 'supertest';
import express from 'express';
import secureCloudRoutes from '../../src/routes/secureCloud.js';
import { env } from '../../src/config/environment.js';

// Mock auth middleware for testing
const mockAuth = (req, res, next) => {
  req.user = { id: 'test-user-123' };
  next();
};

// Create test app
const app = express();
app.use(express.json());
app.use('/api/cloud', mockAuth, secureCloudRoutes);

describe('Secure Cloud Storage Routes', () => {
  
  beforeAll(() => {
    console.log('Testing secure cloud routes with environment:');
    console.log('AWS_REGION:', env.AWS_REGION);
    console.log('S3_BUCKET_NAME:', env.S3_BUCKET_NAME);
    console.log('AWS credentials configured:', !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY));
  });

  describe('POST /api/cloud/upload-image', () => {
    it('should reject request without image file', async () => {
      const response = await request(app)
        .post('/api/cloud/upload-image')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No image file provided');
    });

    it('should reject non-image files', async () => {
      // Create a fake text file buffer
      const textBuffer = Buffer.from('This is not an image');
      
      const response = await request(app)
        .post('/api/cloud/upload-image')
        .attach('image', textBuffer, 'test.txt')
        .expect(400);
    });

    // Note: Full image upload test would require actual AWS credentials
    // In a real environment, you would test with a test S3 bucket
  });

  describe('DELETE /api/cloud/delete-image', () => {
    it('should reject request without image key', async () => {
      const response = await request(app)
        .delete('/api/cloud/delete-image')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Image key is required');
    });

    it('should reject unauthorized deletion attempts', async () => {
      const response = await request(app)
        .delete('/api/cloud/delete-image')
        .send({ key: 'users/other-user/profile/image.jpg' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unauthorized: Cannot delete other users images');
    });
  });

  describe('GET /api/cloud/signed-url', () => {
    it('should reject request without image key', async () => {
      const response = await request(app)
        .get('/api/cloud/signed-url')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Image key is required');
    });

    it('should reject unauthorized access attempts', async () => {
      const response = await request(app)
        .get('/api/cloud/signed-url')
        .query({ key: 'users/other-user/profile/image.jpg' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unauthorized access to image');
    });

    it('should generate signed URL for authorized user', async () => {
      const response = await request(app)
        .get('/api/cloud/signed-url')
        .query({ key: 'users/test-user-123/profile/image.jpg' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.url).toContain('s3');
      expect(response.body.data.expiresAt).toBeDefined();
    });
  });

  describe('Environment Configuration', () => {
    it('should have all required AWS environment variables', () => {
      expect(env.AWS_REGION).toBeDefined();
      expect(env.S3_BUCKET_NAME).toBeDefined();
      
      // In production, these should be set via EAS environment variables
      if (process.env.NODE_ENV === 'production') {
        expect(env.AWS_ACCESS_KEY_ID).toBeDefined();
        expect(env.AWS_SECRET_ACCESS_KEY).toBeDefined();
      }
    });

    it('should use correct default values', () => {
      expect(env.AWS_REGION).toBe('us-east-2');
      expect(env.S3_BUCKET_NAME).toBe('numina-user-content');
    });
  });
});