import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:5000';

async function createTestUser() {
  try {
    const response = await axios.post(`${API_BASE}/signup`, {
      email: 'test@example.com',
      password: 'testpassword'
    });
    
    console.log('✓ Test user created successfully');
    console.log('User ID:', response.data.user?._id);
    return response.data;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('User already exists')) {
      console.log('✓ Test user already exists');
      return { message: 'User already exists' };
    }
    console.log('✗ Error creating test user:', error.response?.data || error.message);
    console.log('Status:', error.response?.status);
    console.log('Full error:', error.message);
    return null;
  }
}

createTestUser().catch(console.error);