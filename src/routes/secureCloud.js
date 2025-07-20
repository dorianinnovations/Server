import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import sharp from 'sharp';
import { protect as auth } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { env } from '../config/environment.js';

const router = express.Router();

// Configure S3 client with environment variables
const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const bucketName = env.S3_BUCKET_NAME;

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

/**
 * POST /api/cloud/upload-image
 * Secure server-side image upload to S3
 */
router.post('/upload-image', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    const { imageType = 'general' } = req.body;
    const userId = req.user.id;

    logger.info('Secure cloud upload initiated', {
      userId,
      imageType,
      originalSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    // Optimize image with Sharp
    let processedBuffer;
    try {
      processedBuffer = await sharp(req.file.buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
    } catch (sharpError) {
      logger.error('Image processing failed', { error: sharpError.message });
      return res.status(400).json({
        success: false,
        error: 'Invalid image file',
      });
    }

    // Generate unique key
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const key = `users/${userId}/${imageType}/${timestamp}-${randomId}.jpg`;

    // Upload to S3
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: key,
        Body: processedBuffer,
        ContentType: 'image/jpeg',
        CacheControl: 'max-age=31536000', // 1 year cache
        Metadata: {
          userId,
          imageType,
          uploadedAt: new Date().toISOString(),
          originalSize: req.file.size.toString(),
          processedSize: processedBuffer.length.toString(),
        },
      },
    });

    const result = await upload.done();
    
    // Generate public URL
    const url = `https://${bucketName}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

    logger.info('Secure cloud upload successful', {
      userId,
      key,
      url,
      originalSize: req.file.size,
      processedSize: processedBuffer.length,
    });

    res.json({
      success: true,
      data: {
        url,
        key,
        size: processedBuffer.length,
        originalSize: req.file.size,
      },
    });

  } catch (error) {
    logger.error('Secure cloud upload failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: 'Upload failed',
    });
  }
});

/**
 * DELETE /api/cloud/delete-image
 * Secure server-side image deletion from S3
 */
router.delete('/delete-image', auth, async (req, res) => {
  try {
    const { key } = req.body;
    const userId = req.user.id;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Image key is required',
      });
    }

    // Security check: ensure user can only delete their own images
    if (!key.startsWith(`users/${userId}/`)) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Cannot delete other users images',
      });
    }

    logger.info('Secure cloud delete initiated', { userId, key });

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);

    logger.info('Secure cloud delete successful', { userId, key });

    res.json({
      success: true,
      message: 'Image deleted successfully',
    });

  } catch (error) {
    logger.error('Secure cloud delete failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: 'Delete failed',
    });
  }
});

/**
 * POST /api/cloud/upload-profile-image
 * Specific endpoint for profile image uploads with additional processing
 */
router.post('/upload-profile-image', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    const userId = req.user.id;

    logger.info('Profile image upload initiated', {
      userId,
      originalSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    // Create multiple sizes for profile images
    const sizes = [
      { name: 'thumbnail', size: 150 },
      { name: 'medium', size: 400 },
      { name: 'large', size: 800 },
    ];

    const uploadPromises = sizes.map(async ({ name, size }) => {
      // Process image
      const processedBuffer = await sharp(req.file.buffer)
        .resize(size, size, { fit: 'cover' })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();

      // Generate key
      const timestamp = Date.now();
      const key = `users/${userId}/profile/${name}-${timestamp}.jpg`;

      // Upload to S3
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: bucketName,
          Key: key,
          Body: processedBuffer,
          ContentType: 'image/jpeg',
          CacheControl: 'max-age=31536000',
          Metadata: {
            userId,
            imageType: 'profile',
            size: name,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      await upload.done();

      return {
        size: name,
        url: `https://${bucketName}.s3.${env.AWS_REGION}.amazonaws.com/${key}`,
        key,
      };
    });

    const results = await Promise.all(uploadPromises);

    logger.info('Profile image upload successful', {
      userId,
      sizes: results.map(r => r.size),
    });

    res.json({
      success: true,
      data: {
        images: results,
        userId,
      },
    });

  } catch (error) {
    logger.error('Profile image upload failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: 'Profile image upload failed',
    });
  }
});

/**
 * GET /api/cloud/signed-url
 * Generate presigned URLs for temporary access (alternative approach)
 */
router.get('/signed-url', auth, async (req, res) => {
  try {
    const { key, expiresIn = 3600 } = req.query; // Default 1 hour
    const userId = req.user.id;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Image key is required',
      });
    }

    // Security check
    if (!key.startsWith(`users/${userId}/`)) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to image',
      });
    }

    // For simple use case, return the public URL
    // In production, you might want to use getSignedUrl for private buckets
    const url = `https://${bucketName}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

    res.json({
      success: true,
      data: {
        url,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      },
    });

  } catch (error) {
    logger.error('Signed URL generation failed', {
      error: error.message,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate signed URL',
    });
  }
});

export default router;