// Test UBPM endpoint directly with numinaworks user ID
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Create a JWT token for numinaworks@gmail.com
const numinaworksUserId = '68854f56daac2491888de03c';
const token = jwt.sign(
  { id: numinaworksUserId, email: 'numinaworks@gmail.com' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('🎯 Generated token for numinaworks@gmail.com:');
console.log(token);
console.log('\n📱 Test command:');
console.log(`curl -X GET "http://localhost:5000/test-ubpm/context" -H "Authorization: Bearer ${token}" | jq .`);