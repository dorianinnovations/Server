import express from 'express';
import { protect } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /auth-test
 * Simple endpoint to test JWT authentication middleware
 */
router.get('/auth-test', protect, (req, res) => {
  try {
    logger.info('Auth test endpoint accessed successfully', { 
      userId: req.user?.id || req.user?._id,
      userEmail: req.user?.email,
      tokenData: {
        id: req.user?.id,
        _id: req.user?._id,
        userId: req.user?.userId
      }
    });

    res.json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: req.user?.id || req.user?._id,
        email: req.user?.email,
        userId: req.user?.userId
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in auth-test endpoint', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error in auth test'
    });
  }
});

/**
 * POST /auth-test
 * Test endpoint with POST method
 */
router.post('/auth-test', protect, (req, res) => {
  try {
    logger.info('Auth test POST endpoint accessed successfully', { 
      userId: req.user?.id || req.user?._id,
      body: req.body
    });

    res.json({
      success: true,
      message: 'POST Authentication successful',
      user: {
        id: req.user?.id || req.user?._id,
        email: req.user?.email
      },
      receivedData: req.body,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error in auth-test POST endpoint', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error in auth test POST'
    });
  }
});

export default router;