import jwt from 'jsonwebtoken';
import { env } from './src/config/environment.js';

console.log('JWT_SECRET:', env.JWT_SECRET);

// Test JWT creation and verification
const testUserId = '123456789';
const token = jwt.sign({ id: testUserId }, env.JWT_SECRET, { expiresIn: '1h' });

console.log('Generated token:', token);

try {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  console.log('Decoded token:', decoded);
  console.log('JWT test: SUCCESS');
} catch (error) {
  console.error('JWT test: FAILED -', error.message);
}