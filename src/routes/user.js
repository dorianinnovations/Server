import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import { HTTP_STATUS, MESSAGES } from "../config/constants.js";

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

export default router; 