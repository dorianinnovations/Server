import mongoose from "mongoose";
import { env } from "./environment.js";
import { DB_CONFIG } from "./constants.js";

console.log("🗄️ Initializing database connection...");

// Optimized Database Connection with enhanced pool settings
const connectDB = async () => {
  try {
    console.log("🔗 Attempting MongoDB connection...");
    console.log("📊 Using optimized connection pool settings");
    
    await mongoose.connect(env.MONGO_URI, {
      // Use centralized connection pool settings
      maxPoolSize: DB_CONFIG.CONNECTION_POOL.MAX_POOL_SIZE,
      minPoolSize: DB_CONFIG.CONNECTION_POOL.MIN_POOL_SIZE,
      maxIdleTimeMS: DB_CONFIG.CONNECTION_POOL.MAX_IDLE_TIME_MS,
      serverSelectionTimeoutMS: DB_CONFIG.CONNECTION_POOL.SERVER_SELECTION_TIMEOUT_MS,
      socketTimeoutMS: DB_CONFIG.CONNECTION_POOL.SOCKET_TIMEOUT_MS,
      family: 4, // Use IPv4, avoid slow IPv6 lookups
      bufferCommands: false, // Disable mongoose buffering for better performance
      heartbeatFrequencyMS: DB_CONFIG.CONNECTION_POOL.HEARTBEAT_FREQUENCY_MS,
      retryReads: true, // Enable read retries
      retryWrites: true, // Enable write retries
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
    
    console.log("✓Database connection monitoring configured");
    
  } catch (err) {
    console.error("✗ MongoDB connection error:", err);
    if (env.NODE_ENV !== 'test') {
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
    0: DB_CONFIG.STATES.DISCONNECTED,
    1: DB_CONFIG.STATES.CONNECTED,
    2: DB_CONFIG.STATES.CONNECTING,
    3: DB_CONFIG.STATES.DISCONNECTING
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