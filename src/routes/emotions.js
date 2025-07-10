import express from "express";
import { protect } from "../middleware/auth.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";
// Analytics helper no longer needed for simple emotion logging

const router = express.Router();

// Submit emotional entry
router.post("/", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Map frontend fields to backend expected names
    const { mood: emotion, intensity, notes: context, date } = req.body;

    // Validate required fields
    if (!emotion || typeof emotion !== 'string' || emotion.trim().length === 0) {
      return res.status(400).json({
        message: "Emotion is required and must be a non-empty string"
      });
    }

    // Validate intensity if provided
    if (intensity !== undefined && (typeof intensity !== 'number' || intensity < 1 || intensity > 10)) {
      return res.status(400).json({
        message: "Intensity must be a number between 1 and 10"
      });
    }

    // Find the user and add the emotional entry
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Create the emotional entry
    const emotionalEntry = {
      emotion: emotion.trim(),
      intensity: intensity || undefined,
      context: context?.trim() || undefined,
      timestamp: new Date()
    };

    // Add to user's emotional log
    user.emotionalLog.push(emotionalEntry);
    user.updatedAt = new Date();
    await user.save();

    // Note: Complex analytics removed - now using simple history tracking

    logger.info("Emotional entry submitted", { 
      userId, 
      emotion: emotionalEntry.emotion,
      intensity: emotionalEntry.intensity 
    });

    res.status(201).json({
      message: "Emotional entry submitted successfully",
      entry: {
        id: user.emotionalLog[user.emotionalLog.length - 1]._id,
        emotion: emotionalEntry.emotion,
        intensity: emotionalEntry.intensity,
        context: emotionalEntry.context,
        timestamp: emotionalEntry.timestamp
      }
    });

  } catch (error) {
    logger.error("Error submitting emotional entry", { 
      error: error.message, 
      userId: req.user?.id,
      body: req.body 
    });
    res.status(500).json({
      message: "Failed to submit emotional entry",
      error: error.message
    });
  }
});

export default router; 