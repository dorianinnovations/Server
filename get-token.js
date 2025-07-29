import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const token = jwt.sign(
  { id: '68854f56daac2491888de03c', email: 'numinaworks@gmail.com' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

console.log(token);