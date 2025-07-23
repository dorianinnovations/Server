import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import ShortTermMemory from "../models/ShortTermMemory.js";
import Task from "../models/Task.js";
import UserBehaviorProfile from "../models/UserBehaviorProfile.js";
import SandboxSession from "../models/SandboxSession.js";
import LockedNode from "../models/LockedNode.js";
import AnalyticsInsight from "../models/AnalyticsInsight.js";
import Event from "../models/Event.js";
import { HTTP_STATUS, MESSAGES } from "../config/constants.js";
import logger from "../utils/logger.js";
import { getUserTier, getTierLimits } from "../config/tiers.js";

const router = express.Router();

// Get user profile
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v");
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ 
        status: MESSAGES.ERROR,
        message: MESSAGES.USER_NOT_FOUND 
      });
    }
    // Add tier information to user profile
    const userTier = getUserTier(user);
    const tierLimits = getTierLimits(user);
    
    res.json({ 
      status: MESSAGES.SUCCESS, 
      data: { 
        user,
        tierBadge: {
          tier: userTier,
          name: tierLimits.name,
          features: tierLimits.features
        }
      }
    });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      status: MESSAGES.ERROR, 
      message: MESSAGES.PROFILE_FETCH_FAILED 
    });
  }
});

// Update emotional profile
router.put("/emotional-profile", protect, async (req, res) => {
  try {
    const { 
      emotionalPreferences,
      personalityTraits,
      communicationStyle,
      socialPreferences,
      moodPatterns,
      triggers,
      copingStrategies,
      goals
    } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ 
        status: MESSAGES.ERROR,
        message: MESSAGES.USER_NOT_FOUND 
      });
    }

    const emotionalProfile = {
      emotionalPreferences: emotionalPreferences || {},
      personalityTraits: personalityTraits || {},
      communicationStyle: communicationStyle || 'balanced',
      socialPreferences: socialPreferences || {},
      moodPatterns: moodPatterns || {},
      triggers: triggers || [],
      copingStrategies: copingStrategies || [],
      goals: goals || [],
      lastUpdated: new Date()
    };

    if (!user.profile) {
      user.profile = new Map();
    }
    
    user.profile.set('emotionalProfile', JSON.stringify(emotionalProfile));
    user.markModified('profile');
    
    await user.save();

    res.json({ 
      status: MESSAGES.SUCCESS, 
      message: "Emotional profile updated successfully",
      data: { 
        emotionalProfile: JSON.parse(user.profile.get('emotionalProfile') || '{}')
      } 
    });

  } catch (err) {
    console.error("Error updating emotional profile:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
      status: MESSAGES.ERROR, 
      message: "Failed to update emotional profile" 
    });
  }
});

// ACCOUNT DELETION - Complete data removal
router.delete("/delete/:userId?", protect, async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.id;
    
    // Security check: only allow users to delete their own account
    // or admin users to delete any account
    if (targetUserId !== req.user.id && !req.user.isAdmin) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        status: MESSAGES.ERROR,
        message: "You can only delete your own account"
      });
    }

    logger.info(`Account deletion requested for user: ${targetUserId}`, {
      requesterId: req.user.id,
      targetUserId
    });

    // Find user before deletion
    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        status: MESSAGES.ERROR,
        message: MESSAGES.USER_NOT_FOUND
      });
    }

    // Comprehensive data deletion
    const deletionResults = await Promise.allSettled([
      // Delete user's memories
      ShortTermMemory.deleteMany({ userId: targetUserId }),
      
      // Delete user's tasks
      Task.deleteMany({ userId: targetUserId }),
      
      // Delete user's behavioral profile
      UserBehaviorProfile.deleteMany({ userId: targetUserId }),
      
      
      // Delete the user account itself
      User.findByIdAndDelete(targetUserId)
    ]);

    // Check for any failures
    const failures = deletionResults.filter(result => result.status === 'rejected');
    
    if (failures.length > 0) {
      logger.error(`Partial account deletion failure for user: ${targetUserId}`, {
        failures: failures.map(f => f.reason)
      });
      
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: MESSAGES.ERROR,
        message: "Account deletion partially failed. Please contact support.",
        details: failures.map(f => f.reason)
      });
    }

    // Count deleted items
    const deletedCounts = {
      memories: deletionResults[0].status === 'fulfilled' ? deletionResults[0].value.deletedCount : 0,
      tasks: deletionResults[1].status === 'fulfilled' ? deletionResults[1].value.deletedCount : 0,
      behaviorProfiles: deletionResults[2].status === 'fulfilled' ? deletionResults[2].value.deletedCount : 0,
      emotionalSessions: deletionResults[3].status === 'fulfilled' ? deletionResults[3].value.deletedCount : 0,
      userAccount: deletionResults[4].status === 'fulfilled' ? 1 : 0
    };

    logger.info(`Account successfully deleted for user: ${targetUserId}`, {
      deletedCounts,
      userEmail: user.email
    });

    res.json({
      success: true,
      status: MESSAGES.SUCCESS,
      message: "Account and all associated data have been permanently deleted",
      deletedItems: deletedCounts
    });

  } catch (error) {
    logger.error("Account deletion error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      status: MESSAGES.ERROR,
      message: "Failed to delete account. Please try again or contact support."
    });
  }
});

// Get comprehensive user data from MongoDB collections
router.get("/mongo-data", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch all relevant user data collections in parallel
    const [
      userData,
      behaviorProfile,
      shortTermMemory,
      tasks,
      sandboxSessions,
      lockedNodes,
      analyticsInsights,
      recentEvents
    ] = await Promise.all([
      User.findById(userId).select("-password -__v"),
      UserBehaviorProfile.findOne({ userId }),
      ShortTermMemory.find({ userId }).sort({ timestamp: -1 }).limit(15).lean(),
      Task.find({ userId }).sort({ createdAt: -1 }).limit(25).lean(),
      SandboxSession.find({ userId, isActive: true }).sort({ lastAccessed: -1 }).limit(10).lean(),
      LockedNode.find({ userId, isActive: true }).sort({ 'usageStats.lastUsed': -1 }).limit(15).lean(),
      AnalyticsInsight.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
      Event.find({ userId }).sort({ timestamp: -1 }).limit(20).lean()
    ]);

    // Compile comprehensive data response
    const comprehensiveData = {
      user: userData,
      ubpmCollection: behaviorProfile ? {
        preferences: behaviorProfile.preferences,
        behaviorMetrics: behaviorProfile.behaviorMetrics,
        emotionalProfile: behaviorProfile.emotionalProfile,
        temporalPatterns: behaviorProfile.temporalPatterns,
        lastUpdated: behaviorProfile.updatedAt
      } : null,
      emotionalCollection: userData?.emotionalLogs ? {
        logs: userData.emotionalLogs.slice(-15), // Last 15 emotional logs
        patterns: userData.emotionalState,
        currentMood: userData.currentMood,
        moodHistory: userData.moodHistory?.slice(-10) || [],
        lastUpdated: userData.updatedAt
      } : null,
      toolUsageCollection: userData?.toolUsage || null,
      insightsCollection: {
        recentMemory: shortTermMemory,
        tasks: tasks,
        analyticsInsights: analyticsInsights,
        sessionCount: userData?.sessionCount || 0,
        totalInteractions: userData?.totalInteractions || 0
      },
      sandboxCollection: {
        sessions: sandboxSessions.map(session => ({
          sessionId: session.sessionId,
          userQuery: session.userQuery,
          nodeCount: session.nodes?.length || 0,
          connectionCount: session.connections?.length || 0,
          metadata: session.metadata,
          lastAccessed: session.lastAccessed,
          createdAt: session.createdAt
        })),
        lockedNodes: lockedNodes.map(node => ({
          nodeId: node.nodeId,
          title: node.title,
          category: node.category,
          confidence: node.confidence,
          usageStats: node.usageStats,
          lockData: node.lockData,
          createdAt: node.createdAt
        })),
        totalSessions: sandboxSessions.length,
        totalLockedNodes: lockedNodes.length
      },
      activityCollection: {
        recentEvents: recentEvents,
        eventCount: recentEvents.length
      },
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: comprehensiveData,
      metadata: {
        completenessScore: calculateDataCompletenessScore(comprehensiveData),
        dataQuality: assessDataQuality(comprehensiveData),
        collections: ['user', 'ubpm', 'emotional', 'tools', 'insights']
      }
    });

  } catch (error) {
    logger.error('Error fetching comprehensive user data', { 
      userId: req.user?._id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch user data'
    });
  }
});

// Helper functions for data assessment
function calculateDataCompletenessScore(data) {
  let score = 0;
  const weights = {
    user: 0.25,
    ubpmCollection: 0.2,
    emotionalCollection: 0.15,
    toolUsageCollection: 0.1,
    insightsCollection: 0.15,
    sandboxCollection: 0.1,
    activityCollection: 0.05
  };

  if (data.user) score += weights.user;
  if (data.ubpmCollection) score += weights.ubpmCollection;
  if (data.emotionalCollection) score += weights.emotionalCollection;
  if (data.toolUsageCollection) score += weights.toolUsageCollection;
  if (data.insightsCollection) score += weights.insightsCollection;
  if (data.sandboxCollection?.totalSessions > 0) score += weights.sandboxCollection;
  if (data.activityCollection?.eventCount > 0) score += weights.activityCollection;

  return Math.round(score * 100) / 100;
}

function assessDataQuality(data) {
  if (!data.user) return 'poor';
  
  const hasUBPM = !!data.ubpmCollection;
  const hasEmotional = !!data.emotionalCollection;
  const hasInsights = data.insightsCollection?.recentMemory?.length > 0;
  const hasSandbox = data.sandboxCollection?.totalSessions > 0;
  const hasActivity = data.activityCollection?.eventCount > 0;

  const qualityScore = [hasUBPM, hasEmotional, hasInsights, hasSandbox, hasActivity].filter(Boolean).length;

  if (qualityScore >= 4) return 'excellent';
  if (qualityScore === 3) return 'good';
  if (qualityScore === 2) return 'fair';
  if (qualityScore === 1) return 'basic';
  return 'poor';
}

export default router; 