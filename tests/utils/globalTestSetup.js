import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Global test setup to prevent multiple database connections
 */

let mongoServer;
let isSetup = false;

const globalSetup = async () => {
  if (isSetup) {
    console.log('⚠️ Global test setup already completed');
    return;
  }

  console.log('🔧 Setting up global test environment...');
  
  // Close any existing connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create({
    binary: { version: '7.0.3' }
  });
  
  const mongoUri = mongoServer.getUri();
  
  // Set global test environment
  process.env.NODE_ENV = 'test';
  process.env.MONGO_URI_TEST = mongoUri;
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
  
  // Connect to test database
  await mongoose.connect(mongoUri, {
    bufferCommands: false,
    maxPoolSize: 1
  });
  
  isSetup = true;
  console.log('✅ Global test setup completed');
};

const globalTeardown = async () => {
  if (!isSetup) return;
  
  console.log('🧹 Tearing down global test environment...');
  
  try {
    // Clear all collections
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
    
    // Close connection
    await mongoose.connection.close();
    
    // Stop MongoDB server
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    isSetup = false;
    console.log('✅ Global test teardown completed');
  } catch (error) {
    console.error('❌ Global teardown error:', error);
  }
};

const clearDatabase = async () => {
  if (!isSetup) return;
  
  try {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  } catch (error) {
    console.error('❌ Database clear error:', error);
  }
};

// Export for Jest global setup/teardown
export default globalSetup;
export { globalTeardown, clearDatabase };