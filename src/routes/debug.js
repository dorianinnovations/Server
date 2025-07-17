import express from 'express';
import { env } from '../config/environment.js';
import UserBehaviorProfile from '../models/UserBehaviorProfile.js';
import EmotionalAnalyticsSession from '../models/EmotionalAnalyticsSession.js';
import ShortTermMemory from '../models/ShortTermMemory.js';
import User from '../models/User.js';
import Tool from '../models/Tool.js';
import Task from '../models/Task.js';
import Event from '../models/Event.js';
import UserEvent from '../models/UserEvent.js';
import UserConstants from '../models/UserConstants.js';
import CreditPool from '../models/CreditPool.js';
import CollectiveSnapshot from '../models/CollectiveSnapshot.js';
import CollectiveDataConsent from '../models/CollectiveDataConsent.js';

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

// CEO Data Query endpoint
router.get('/debug/ceo-data', async (req, res) => {
  try {
    // Get counts and summary data
    const userCount = await User.countDocuments();
    const behaviorProfileCount = await UserBehaviorProfile.countDocuments();
    const emotionalSessionCount = await EmotionalAnalyticsSession.countDocuments();
    const memoryEntryCount = await ShortTermMemory.countDocuments();
    const toolCount = await Tool.countDocuments();
    
    // Get sample behavior profiles
    const sampleBehaviorProfiles = await UserBehaviorProfile.find({})
      .limit(3)
      .select('personalityTraits interests behaviorPatterns dataQuality createdAt')
      .lean();
      
    // Get recent emotional sessions
    const recentEmotionalSessions = await EmotionalAnalyticsSession.find({})
      .sort({ createdAt: -1 })
      .limit(3)
      .select('status reportProgress finalReport weekStartDate')
      .lean();
      
    // Get recent memory entries 
    const recentMemories = await ShortTermMemory.find({})
      .sort({ timestamp: -1 })
      .limit(5)
      .select('content timestamp role')
      .lean();
      
    // Get tool statistics
    const toolStats = await Tool.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          enabled: { $sum: { $cond: ['$enabled', 1, 0] } }
        }
      }
    ]);
    
    res.json({
      summary: {
        totalUsers: userCount,
        behaviorProfiles: behaviorProfileCount,
        emotionalSessions: emotionalSessionCount,
        memoryEntries: memoryEntryCount,
        tools: toolCount
      },
      sampleData: {
        behaviorProfiles: sampleBehaviorProfiles,
        emotionalSessions: recentEmotionalSessions,
        recentMemories: recentMemories
      },
      toolStatistics: toolStats,
      timestamp: new Date()
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to query data',
      details: error.message
    });
  }
});

// User Classification endpoint - separate test vs real accounts
router.get('/debug/user-analysis', async (req, res) => {
  try {
    // Get all users with basic stats
    const allUsers = await User.find({})
      .select('email createdAt emotionalLog profile subscription')
      .lean();
    
    // Classify users based on email patterns and activity
    const testUsers = allUsers.filter(user => 
      user.email.includes('test') || 
      user.email.includes('dev') || 
      user.email.includes('demo') ||
      user.email.includes('@example.') ||
      user.email.includes('numina@numina.com')
    );
    
    const realUsers = allUsers.filter(user => !testUsers.includes(user));
    
    // Get subscription stats
    const subscribedUsers = allUsers.filter(user => 
      user.subscription?.numinaTrace?.isActive
    );
    
    // Get activity levels
    const activeUsers = allUsers.filter(user => 
      user.emotionalLog && user.emotionalLog.length > 0
    );
    
    res.json({
      userClassification: {
        total: allUsers.length,
        realUsers: realUsers.length,
        testUsers: testUsers.length,
        subscribedUsers: subscribedUsers.length,
        activeUsers: activeUsers.length
      },
      testAccounts: testUsers.map(u => ({ email: u.email, created: u.createdAt })),
      realAccounts: realUsers.slice(0, 10).map(u => ({ 
        email: u.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Anonymize emails
        created: u.createdAt,
        hasActivity: u.emotionalLog?.length > 0,
        subscribed: u.subscription?.numinaTrace?.isActive || false
      })),
      timestamp: new Date()
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to analyze users',
      details: error.message
    });
  }
});

// Search Patterns endpoint - analyze what users are actually searching for
router.get('/debug/search-patterns', async (req, res) => {
  try {
    // Get all memory entries with tool executions
    const toolExecutions = await ShortTermMemory.find({
      content: { $regex: /🔧.*"query":|🔍|🎵|📰|🌤️|💱|📈/ }
    })
    .select('content timestamp role userId')
    .sort({ timestamp: -1 })
    .limit(50)
    .lean();
    
    // Extract search queries from tool executions
    const searchQueries = [];
    toolExecutions.forEach(entry => {
      const content = entry.content;
      // Extract queries from JSON tool responses
      const queryMatches = content.match(/"query":\s*"([^"]+)"/g);
      if (queryMatches) {
        queryMatches.forEach(match => {
          const query = match.match(/"query":\s*"([^"]+)"/)[1];
          searchQueries.push({
            query,
            timestamp: entry.timestamp,
            userId: entry.userId
          });
        });
      }
    });
    
    // Get user messages that look like search requests
    const userSearches = await ShortTermMemory.find({
      role: 'user',
      $or: [
        { content: { $regex: /search|find|look for|show me|get|weather|stock|crypto/i } },
        { content: { $regex: /what is|how to|where|when|why/i } }
      ]
    })
    .select('content timestamp userId')
    .sort({ timestamp: -1 })
    .limit(30)
    .lean();
    
    res.json({
      searchAnalysis: {
        totalToolExecutions: toolExecutions.length,
        extractedQueries: searchQueries.length,
        userSearchRequests: userSearches.length
      },
      recentToolQueries: searchQueries.slice(0, 15),
      recentUserSearches: userSearches.slice(0, 15).map(s => ({
        query: s.content,
        timestamp: s.timestamp,
        userId: s.userId
      })),
      timestamp: new Date()
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to analyze search patterns',
      details: error.message
    });
  }
});

// Complete Database Overview endpoint
router.get('/debug/db-overview', async (req, res) => {
  try {
    const [
      userCount,
      behaviorProfileCount,
      emotionalSessionCount,
      memoryEntryCount,
      toolCount,
      taskCount,
      eventCount,
      userEventCount,
      userConstantsCount,
      creditPoolCount,
      collectiveSnapshotCount,
      collectiveConsentCount
    ] = await Promise.all([
      User.countDocuments(),
      UserBehaviorProfile.countDocuments(),
      EmotionalAnalyticsSession.countDocuments(),
      ShortTermMemory.countDocuments(),
      Tool.countDocuments(),
      Task.countDocuments(),
      Event.countDocuments(),
      UserEvent.countDocuments(),
      UserConstants.countDocuments(),
      CreditPool.countDocuments(),
      CollectiveSnapshot.countDocuments(),
      CollectiveDataConsent.countDocuments()
    ]);
    
    // Get recent activity across all collections
    const recentActivity = {
      recentUsers: await User.find({}).sort({ createdAt: -1 }).limit(5).select('email createdAt').lean(),
      recentMemories: await ShortTermMemory.find({}).sort({ timestamp: -1 }).limit(3).select('role content timestamp').lean(),
      recentTasks: await Task.find({}).sort({ createdAt: -1 }).limit(3).select('title status createdAt').lean(),
    };
    
    res.json({
      databaseOverview: {
        collections: {
          users: userCount,
          behaviorProfiles: behaviorProfileCount,
          emotionalSessions: emotionalSessionCount,
          memoryEntries: memoryEntryCount,
          tools: toolCount,
          tasks: taskCount,
          events: eventCount,
          userEvents: userEventCount,
          userConstants: userConstantsCount,
          creditPools: creditPoolCount,
          collectiveSnapshots: collectiveSnapshotCount,
          collectiveConsents: collectiveConsentCount
        },
        totalDocuments: userCount + behaviorProfileCount + emotionalSessionCount + 
                       memoryEntryCount + toolCount + taskCount + eventCount + 
                       userEventCount + userConstantsCount + creditPoolCount + 
                       collectiveSnapshotCount + collectiveConsentCount
      },
      recentActivity,
      timestamp: new Date()
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get database overview',
      details: error.message
    });
  }
});

export default router;