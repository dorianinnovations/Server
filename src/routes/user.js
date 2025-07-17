import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import ShortTermMemory from "../models/ShortTermMemory.js";
import Task from "../models/Task.js";
import UserBehaviorProfile from "../models/UserBehaviorProfile.js";
import EmotionalAnalyticsSession from "../models/EmotionalAnalyticsSession.js";
import { HTTP_STATUS, MESSAGES } from "../config/constants.js";
import logger from "../utils/logger.js";

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
    res.json({ 
      status: MESSAGES.SUCCESS, 
      data: { user } 
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
      
      // Delete user's emotional analytics sessions
      EmotionalAnalyticsSession.deleteMany({ userId: targetUserId }),
      
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
      status: MESSAGES.SUCCESS,
      message: "Account and all associated data have been permanently deleted",
      deletedItems: deletedCounts
    });

  } catch (error) {
    logger.error("Account deletion error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: MESSAGES.ERROR,
      message: "Failed to delete account. Please try again or contact support."
    });
  }
});

export default router; 