import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import ShortTermMemory from "../models/ShortTermMemory.js";
import UserBehaviorProfile from "../models/UserBehaviorProfile.js";
import Event from "../models/Event.js";
import { HTTP_STATUS, MESSAGES } from "../config/constants.js";
import logger from "../utils/logger.js";
import { getUserTier, getTierLimits } from "../config/tiers.js";
import multer from 'multer';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// Configure multer for profile picture uploads
const profilePictureUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedMimes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'image/gif'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for profile pictures'), false);
    }
  }
});

// Configure multer for banner image uploads
const bannerImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for banners
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedMimes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'image/gif'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for banner images'), false);
    }
  }
});

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
        profilePicture: user.profile?.get('profilePicture') || null,
        bannerImage: user.profile?.get('bannerImage') || null,
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

// Upload profile picture
router.post("/profile/picture", protect, profilePictureUpload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: MESSAGES.ERROR,
        message: "No image file provided"
      });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        status: MESSAGES.ERROR,
        message: MESSAGES.USER_NOT_FOUND
      });
    }

    // Validate file type
    const fileType = await fileTypeFromBuffer(req.file.buffer);
    if (!fileType || !fileType.mime.startsWith('image/')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: MESSAGES.ERROR,
        message: "Invalid image file"
      });
    }

    // Process and compress the image
    const processedImage = await sharp(req.file.buffer)
      .resize(300, 300, { 
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ 
        quality: 85,
        progressive: true
      })
      .toBuffer();

    // Convert to base64 for storage (in production, upload to cloud storage like AWS S3)
    const base64Image = processedImage.toString('base64');
    const profilePictureUrl = `data:image/jpeg;base64,${base64Image}`;

    // Update user profile with picture URL
    if (!user.profile) {
      user.profile = new Map();
    }
    
    user.profile.set('profilePicture', profilePictureUrl);
    user.profile.set('profilePictureUpdated', new Date().toISOString());
    user.markModified('profile');
    
    await user.save();

    logger.info('Profile picture updated successfully', { userId });

    res.json({
      status: MESSAGES.SUCCESS,
      message: "Profile picture updated successfully",
      data: {
        profilePicture: profilePictureUrl,
        updatedAt: user.profile.get('profilePictureUpdated')
      }
    });

  } catch (error) {
    logger.error('Profile picture upload error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: MESSAGES.ERROR,
        message: "File size too large. Maximum size is 5MB."
      });
    }
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: MESSAGES.ERROR,
      message: "Failed to upload profile picture"
    });
  }
});

// Delete profile picture
router.delete("/profile/picture", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        status: MESSAGES.ERROR,
        message: MESSAGES.USER_NOT_FOUND
      });
    }

    // Remove profile picture from user profile
    if (user.profile && user.profile.has('profilePicture')) {
      user.profile.delete('profilePicture');
      user.profile.delete('profilePictureUpdated');
      user.markModified('profile');
      await user.save();

      logger.info('Profile picture deleted successfully', { userId });

      res.json({
        status: MESSAGES.SUCCESS,
        message: "Profile picture deleted successfully"
      });
    } else {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        status: MESSAGES.ERROR,
        message: "No profile picture found"
      });
    }

  } catch (error) {
    logger.error('Profile picture deletion error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: MESSAGES.ERROR,
      message: "Failed to delete profile picture"
    });
  }
});

// Upload banner image
router.post("/profile/banner", protect, bannerImageUpload.single('bannerImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: MESSAGES.ERROR,
        message: "No banner image file provided"
      });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        status: MESSAGES.ERROR,
        message: MESSAGES.USER_NOT_FOUND
      });
    }

    // Validate file type
    const fileType = await fileTypeFromBuffer(req.file.buffer);
    if (!fileType || !fileType.mime.startsWith('image/')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: MESSAGES.ERROR,
        message: "Invalid image file"
      });
    }

    // Process and compress the banner image (16:9 aspect ratio)
    const processedImage = await sharp(req.file.buffer)
      .resize(1200, 675, { 
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ 
        quality: 85,
        progressive: true
      })
      .toBuffer();

    // Convert to base64 for storage (in production, upload to cloud storage like AWS S3)
    const base64Image = processedImage.toString('base64');
    const bannerImageUrl = `data:image/jpeg;base64,${base64Image}`;

    // Update user profile with banner image URL
    if (!user.profile) {
      user.profile = new Map();
    }
    
    user.profile.set('bannerImage', bannerImageUrl);
    user.profile.set('bannerImageUpdated', new Date().toISOString());
    user.markModified('profile');
    
    await user.save();

    logger.info('Banner image updated successfully', { userId });

    res.json({
      status: MESSAGES.SUCCESS,
      message: "Banner image updated successfully",
      data: {
        bannerImage: bannerImageUrl,
        updatedAt: user.profile.get('bannerImageUpdated')
      }
    });

  } catch (error) {
    logger.error('Banner image upload error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        status: MESSAGES.ERROR,
        message: "File size too large. Maximum size is 10MB."
      });
    }
    
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: MESSAGES.ERROR,
      message: "Failed to upload banner image"
    });
  }
});

// Delete banner image
router.delete("/profile/banner", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        status: MESSAGES.ERROR,
        message: MESSAGES.USER_NOT_FOUND
      });
    }

    // Remove banner image from user profile
    if (user.profile && user.profile.has('bannerImage')) {
      user.profile.delete('bannerImage');
      user.profile.delete('bannerImageUpdated');
      user.markModified('profile');
      await user.save();

      logger.info('Banner image deleted successfully', { userId });

      res.json({
        status: MESSAGES.SUCCESS,
        message: "Banner image deleted successfully"
      });
    } else {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        status: MESSAGES.ERROR,
        message: "No banner image found"
      });
    }

  } catch (error) {
    logger.error('Banner image deletion error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: MESSAGES.ERROR,
      message: "Failed to delete banner image"
    });
  }
});

// Update emotional profile
// User settings routes
router.get("/settings", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("settings preferences -_id");
    
    res.json({
      success: true,
      data: {
        settings: user?.settings || {},
        preferences: user?.preferences || {}
      }
    });
  } catch (error) {
    logger.error("Error fetching user settings:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Failed to fetch user settings"
    });
  }
});

router.post("/settings", protect, async (req, res) => {
  try {
    const { settings, preferences } = req.body;
    
    const updateData = {};
    if (settings) updateData.settings = settings;
    if (preferences) updateData.preferences = preferences;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, select: "settings preferences -_id" }
    );
    
    res.json({
      success: true,
      data: {
        settings: user?.settings || {},
        preferences: user?.preferences || {}
      },
      message: "Settings updated successfully"
    });
  } catch (error) {
    logger.error("Error updating user settings:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Failed to update user settings"
    });
  }
});

// User preferences routes (separate from settings)
router.get("/preferences", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("preferences -_id");
    
    res.json({
      success: true,
      data: {
        preferences: user?.preferences || {}
      }
    });
  } catch (error) {
    logger.error("Error fetching user preferences:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Failed to fetch user preferences"
    });
  }
});

router.post("/preferences", protect, async (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!preferences) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: "Preferences data is required"
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { preferences } },
      { new: true, select: "preferences -_id" }
    );
    
    res.json({
      success: true,
      data: {
        preferences: user?.preferences || {}
      },
      message: "Preferences updated successfully"
    });
  } catch (error) {
    logger.error("Error updating user preferences:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Failed to update user preferences"
    });
  }
});

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
    const userId = req.user.id;

    // Fetch all relevant user data collections in parallel
    const [
      userData,
      behaviorProfile,
      shortTermMemory,
      tasks
    ] = await Promise.all([
      User.findById(userId).select("-password -__v"),
      UserBehaviorProfile.findOne({ userId }),
      ShortTermMemory.find({ userId }).sort({ timestamp: -1 }).limit(15).lean(),
      Event.find({ userId }).sort({ timestamp: -1 }).limit(20).lean()
    ]);

    // Initialize undefined collections as empty arrays
    const lockedNodes = [];
    const analyticsInsights = [];
    const recentEvents = tasks; // Events were loaded as tasks

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
      // sandboxCollection removed - collection no longer exists
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

// TEMPORARY: UBMP context endpoint (should be in ubmp.js but file system issues)
router.get("/ubmp-context", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const behaviorProfile = await UserBehaviorProfile.findOne({ userId });
    
    if (!behaviorProfile) {
      return res.json({
        success: true,
        data: { dataPoints: 0, confidence: 0, patterns: [] },
        visualizations: {
          progressiveState: { stage: 'discovery', progress: 0, message: 'Building your cognitive profile...' },
          personalityRadar: [],
          behaviorFlow: [],
          communicationStats: { avgResponseLength: 150 }, // Fallback when no data
          workPatterns: { preferredHours: [9, 14, 20], sessionLength: 45 }
        }
      });
    }
    
    // Extract communication patterns with REAL avgResponseLength fix
    const communicationPatterns = behaviorProfile.behaviorPatterns.filter(p => 
      ['brief_communicator', 'detailed_explainer', 'cognitive_questioner'].includes(p.pattern)
    );
    
    // 🎯 THE AVGRESPONSELENGTH FIX - use real calculated value
    const avgResponseLength = communicationPatterns.length > 0 ? 
      (communicationPatterns[0].evidence?.avgLength || 
       communicationPatterns[0].metadata?.get?.('avgResponseLength') || 
       150) : 150;
    
    const communicationStats = {
      style: communicationPatterns.length > 0 ? communicationPatterns[0].pattern.replace('_', ' ') : undefined,
      avgResponseLength: avgResponseLength, // REAL calculated value!
      confidence: communicationPatterns.length > 0 ? Math.round(communicationPatterns[0].confidence * 100) : undefined,
      questionStyle: 'analytical',
      technicalTerms: ['API', 'database', 'endpoint', 'collection']
    };
    
    console.log(`🎯 UBMP Context: avgResponseLength = ${avgResponseLength} (patterns: ${communicationPatterns.length})`);
    
    res.json({
      success: true,
      data: {
        dataPoints: behaviorProfile.behaviorPatterns.length,
        confidence: behaviorProfile.behaviorPatterns.length > 0 ? 
          behaviorProfile.behaviorPatterns.reduce((sum, p) => sum + p.confidence, 0) / behaviorProfile.behaviorPatterns.length : 0
      },
      visualizations: {
        progressiveState: {
          stage: behaviorProfile.behaviorPatterns.length >= 3 ? 'analysis' : 'discovery',
          progress: Math.min(behaviorProfile.behaviorPatterns.length * 20, 100)
        },
        communicationStats,
        workPatterns: { preferredHours: [9, 14, 20], sessionLength: 45 }
      }
    });
    
  } catch (error) {
    console.error('UBMP context error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch UBMP context' });
  }
});

export default router; 