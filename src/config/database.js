import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Optimized Database Connection with enhanced pool settings
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Optimized connection pool settings
      maxPoolSize: 50,           // Increased pool size for better concurrency
      minPoolSize: 5,            // Maintain minimum connections
      maxIdleTimeMS: 30000,      // Close idle connections after 30 seconds
      serverSelectionTimeoutMS: 5000, // Fast server selection timeout
      socketTimeoutMS: 45000,    // Socket timeout
      family: 4,                 // Use IPv4, avoid slow IPv6 lookups
      bufferCommands: false,     // Disable mongoose buffering for better performance
      bufferMaxEntries: 0,       // Disable mongoose buffering queue
      heartbeatFrequencyMS: 10000, // Heartbeat every 10 seconds
      retryReads: true,          // Enable read retries
      retryWrites: true,         // Enable write retries
    });
    
    console.log("✓MongoDB connected with optimized pool settings");
    
    // Log connection pool events for monitoring
    mongoose.connection.on('connected', () => {
      console.log('✓MongoDB connection established');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('✗MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️MongoDB disconnected');
    });
    
    // Monitor connection pool
    mongoose.connection.on('fullsetup', () => {
      console.log('✓MongoDB replica set connected');
    });
    
  } catch (err) {
    console.error("✗ MongoDB connection error:", err);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1); // Only exit in non-test environments
    } else {
      throw err; // Let the test fail naturally
    }
  }
};

// Connection health check function
export const checkDBHealth = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  };
  
  return {
    state: states[state] || 'unknown',
    readyState: state,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  };
};

// Graceful shutdown
export const gracefulShutdown = async () => {
  try {
    await mongoose.connection.close();
    console.log('✓MongoDB connection closed gracefully');
  } catch (err) {
    console.error('✗Error closing MongoDB connection:', err);
  }
};

export default connectDB; 