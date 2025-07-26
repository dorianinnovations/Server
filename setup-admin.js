#!/usr/bin/env node

/**
 * Admin Account Setup Script
 * Creates an admin account with Aether tier privileges
 */

import mongoose from 'mongoose';
import { env } from './src/config/environment.js';
import User from './src/models/User.js';
import logger from './src/utils/logger.js';

// Admin account configuration
const ADMIN_EMAIL = 'darrel@numina.app'; // Change this to your email
const ADMIN_PASSWORD = 'admin123!Secure'; // Change this to your preferred password

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGO_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('Connected to MongoDB for admin setup');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Create admin account
const createAdminAccount = async () => {
  try {
    logger.info('🔧 Setting up admin account...');
    
    // Check if admin already exists
    let adminUser = await User.findOne({ email: ADMIN_EMAIL });
    
    if (adminUser) {
      logger.info('✅ Admin user already exists, updating to Aether tier...');
    } else {
      logger.info('🆕 Creating new admin user...');
      adminUser = new User({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        profile: new Map([
          ['username', 'admin'],
          ['displayName', 'Admin'],
          ['role', 'admin']
        ])
      });
    }
    
    // Set Aether tier subscription (unlimited premium)
    const aetherEndDate = new Date();
    aetherEndDate.setFullYear(aetherEndDate.getFullYear() + 10); // 10 years
    
    adminUser.subscription = {
      pro: {
        isActive: false,
        startDate: null,
        endDate: null,
        plan: null,
        paymentMethodId: null,
        autoRenew: false,
        cancelledAt: null,
        lastPaymentDate: null,
        nextBillingDate: null
      },
      aether: {
        isActive: true,
        startDate: new Date(),
        endDate: aetherEndDate,
        plan: 'yearly',
        paymentMethodId: 'admin-granted',
        autoRenew: false,
        cancelledAt: null,
        lastPaymentDate: new Date(),
        nextBillingDate: null
      }
    };
    
    // Set admin role and enhanced profile
    if (!adminUser.profile) {
      adminUser.profile = new Map();
    }
    adminUser.profile.set('role', 'admin');
    adminUser.profile.set('isAdmin', true);
    adminUser.profile.set('tier', 'AETHER');
    adminUser.profile.set('setupDate', new Date());
    
    // Save the admin user
    await adminUser.save();
    
    logger.info('🎉 Admin account setup complete!');
    logger.info(`📧 Email: ${ADMIN_EMAIL}`);
    logger.info(`🔑 Password: ${ADMIN_PASSWORD}`);
    logger.info(`👑 Tier: AETHER (Unlimited)`);
    logger.info(`🛡️ Role: Admin`);
    logger.info(`⏰ Aether Access Until: ${aetherEndDate.toDateString()}`);
    
    // Verify tier system
    const { getUserTier, getTierLimits } = await import('./src/config/tiers.js');
    const userTier = getUserTier(adminUser);
    const tierLimits = getTierLimits(adminUser);
    
    logger.info('\n🔍 Tier Verification:');
    logger.info(`Current Tier: ${userTier}`);
    logger.info(`Daily Requests: ${tierLimits.dailyRequests === -1 ? 'Unlimited' : tierLimits.dailyRequests}`);
    logger.info(`Requests Per Minute: ${tierLimits.requestsPerMinute}`);
    logger.info(`Max Tokens Per Request: ${tierLimits.maxTokensPerRequest}`);
    logger.info(`Priority Processing: ${tierLimits.features.priorityProcessing ? 'Yes' : 'No'}`);
    logger.info(`Advanced Analytics: ${tierLimits.features.advancedAnalytics ? 'Yes' : 'No'}`);
    logger.info(`Memory Retention: ${tierLimits.features.memoryRetention === -1 ? 'Unlimited' : tierLimits.features.memoryRetention + ' days'}`);
    
    return adminUser;
    
  } catch (error) {
    logger.error('❌ Admin setup failed:', error);
    throw error;
  }
};

// Test admin login
const testAdminLogin = async (adminUser) => {
  try {
    logger.info('\n🧪 Testing admin login...');
    
    // Test password verification
    const isPasswordCorrect = await adminUser.correctPassword(ADMIN_PASSWORD, adminUser.password);
    
    if (isPasswordCorrect) {
      logger.info('✅ Password verification successful');
    } else {
      logger.error('❌ Password verification failed');
      return false;
    }
    
    // Test tier methods
    const hasActivePro = adminUser.hasActivePro();
    const hasActiveAether = adminUser.hasActiveAether();
    const currentTier = adminUser.getTier();
    
    logger.info(`✅ Has Pro: ${hasActivePro}`);
    logger.info(`✅ Has Aether: ${hasActiveAether}`);
    logger.info(`✅ Current Tier: ${currentTier}`);
    
    if (currentTier === 'AETHER' && hasActiveAether) {
      logger.info('🎉 Admin account fully functional!');
      return true;
    } else {
      logger.error('❌ Tier system not working correctly');
      return false;
    }
    
  } catch (error) {
    logger.error('❌ Admin login test failed:', error);
    return false;
  }
};

// Main setup function
const setupAdmin = async () => {
  try {
    await connectDB();
    
    logger.info('🚀 Starting Admin Account Setup...\n');
    
    const adminUser = await createAdminAccount();
    const loginTest = await testAdminLogin(adminUser);
    
    if (loginTest) {
      logger.info('\n✅ ADMIN SETUP COMPLETE!');
      logger.info('\n📱 To login on your mobile app:');
      logger.info(`   Email: ${ADMIN_EMAIL}`);
      logger.info(`   Password: ${ADMIN_PASSWORD}`);
      logger.info(`   API URL: http://192.168.1.237:5000`);
      
      logger.info('\n🎯 Your Aether Features:');
      logger.info('   • Unlimited daily requests');
      logger.info('   • 1000 requests per minute');
      logger.info('   • 32,000 tokens per request');
      logger.info('   • Priority processing');
      logger.info('   • Advanced analytics');
      logger.info('   • Unlimited memory retention');
      logger.info('   • Unlimited conversation history');
      
      logger.info('\n🔧 Admin Privileges:');
      logger.info('   • Access to all system features');
      logger.info('   • Backend administration capabilities');
      logger.info('   • Tier system management');
      
    } else {
      logger.error('\n❌ ADMIN SETUP FAILED!');
      logger.error('Please check the logs and try again.');
      process.exit(1);
    }
    
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Admin setup script failed:', error);
    process.exit(1);
  }
};

// Handle script arguments
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
🔧 Admin Account Setup Script

Usage: node setup-admin.js [options]

Options:
  --help          Show this help message
  --email <email> Set admin email (default: ${ADMIN_EMAIL})
  --password <pw> Set admin password (default: generated)

This script will:
1. Create or update admin account with Aether tier
2. Grant unlimited access to all features
3. Test the tier system functionality
4. Provide login credentials for mobile app

The admin account will have:
• Aether tier (highest premium)
• Admin role and privileges
• Unlimited requests and features
• 10-year subscription validity
  `);
  process.exit(0);
}

// Override email if provided
const emailArg = args.findIndex(arg => arg === '--email');
if (emailArg !== -1 && args[emailArg + 1]) {
  ADMIN_EMAIL = args[emailArg + 1];
}

// Override password if provided
const passwordArg = args.findIndex(arg => arg === '--password');
if (passwordArg !== -1 && args[passwordArg + 1]) {
  ADMIN_PASSWORD = args[passwordArg + 1];
}

// Run setup
setupAdmin();

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('\n🛑 Admin setup interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('\n🛑 Admin setup terminated');
  process.exit(1);
});