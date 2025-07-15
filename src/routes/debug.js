import express from 'express';
import { env } from '../config/environment.js';

const router = express.Router();

// Debug endpoint to check environment variables
router.get('/debug/env', (req, res) => {
  res.json({
    NODE_ENV: env.NODE_ENV,
    JWT_SECRET_LENGTH: env.JWT_SECRET ? env.JWT_SECRET.length : 0,
    JWT_SECRET_PREFIX: env.JWT_SECRET ? env.JWT_SECRET.substring(0, 8) + '...' : 'undefined',
    PORT: env.PORT,
    MONGO_URI_PREFIX: env.MONGO_URI ? env.MONGO_URI.substring(0, 20) + '...' : 'undefined'
  });
});

export default router;