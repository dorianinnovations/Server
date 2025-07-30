import express from "express";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import { signToken, protect, protectRefresh } from "../middleware/auth.js";
import { HTTP_STATUS, MESSAGES, SECURITY_CONFIG as _SECURITY_CONFIG } from "../config/constants.js";
import emailService from "../services/emailService.js";

const router = express.Router();

// Signup Route
router.post(
  "/signup",
  [
    body("email").isEmail().withMessage("Valid email required."),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long."),
    body("name")
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage("Name must be between 1 and 100 characters."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        status: MESSAGES.ERROR,
        message: MESSAGES.VALIDATION_ERROR,
        errors: errors.array() 
      });
    }

    const { email, password, name } = req.body;
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(HTTP_STATUS.CONFLICT).json({ 
          status: MESSAGES.ERROR,
          message: MESSAGES.EMAIL_IN_USE 
        });
      }

      const userData = { email, password };
      if (name && name.trim()) {
        userData.name = name.trim();
      }

      const user = await User.create(userData);
      console.log("New user created:", user.email);

      // Send welcome email (non-blocking) - NOW ENABLED WITH RESEND
      const emailPromise = emailService.sendWelcomeEmail(user.email, user.name || user.email.split('@')[0])
        .then(result => {
          if (result.success) {
            console.log('✅ Welcome email sent via', result.service, 'to:', user.email);
            if (result.messageId) {
              console.log('📧 Email ID:', result.messageId);
            }
            if (result.previewUrl) {
              console.log('📧 Email preview:', result.previewUrl);
            }
          } else {
            console.warn('⚠️ Welcome email failed:', result.error);
          }
        })
        .catch(err => console.error('❌ Welcome email error:', err));

      // Include email status in response for better testing/debugging
      let emailSent = false;
      let emailService_used = null;
      let emailMessageId = null;

      try {
        const emailResult = await emailService.sendWelcomeEmail(user.email, user.name || user.email.split('@')[0]);
        emailSent = emailResult.success;
        emailService_used = emailResult.service;
        emailMessageId = emailResult.messageId;
        
        if (emailResult.success) {
          console.log('✅ Welcome email sent via', emailResult.service, 'to:', user.email);
        } else {
          console.warn('⚠️ Welcome email failed:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Welcome email error:', emailError);
      }

      res.status(HTTP_STATUS.CREATED).json({
        status: MESSAGES.SUCCESS,
        token: signToken(user._id),
        data: { 
          user: { 
            id: user._id, 
            email: user.email,
            ...(user.name && { name: user.name })
          } 
        },
        welcomeEmail: {
          sent: emailSent,
          service: emailService_used,
          messageId: emailMessageId
        }
      });
    } catch (err) {
      console.error("Signup error:", err);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
        status: MESSAGES.ERROR, 
        message: MESSAGES.SIGNUP_FAILED 
      });
    }
  }
);

// Login Route
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required."),
    body("password").notEmpty().withMessage("Password is required.")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
        status: MESSAGES.ERROR,
        message: MESSAGES.VALIDATION_ERROR,
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;
    console.log("Login attempt for:", email);

    try {
      const user = await User.findOne({ email }).select("+password");
      if (!user || !(await user.correctPassword(password, user.password))) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
          status: MESSAGES.ERROR,
          message: MESSAGES.INVALID_CREDENTIALS 
        });
      }

      res.json({
        status: MESSAGES.SUCCESS,
        token: signToken(user._id),
        data: { 
          user: { 
            id: user._id, 
            email: user.email,
            ...(user.name && { name: user.name })
          } 
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
        status: MESSAGES.ERROR, 
        message: MESSAGES.LOGIN_FAILED 
      });
    }
  }
);

// Spotify Connection Routes - Now Active
router.post('/spotify/connect', protect, async (req, res) => {
  try {
    const { 
      accessToken, 
      refreshToken, 
      spotifyUserId, 
      spotifyEmail, 
      spotifyDisplayName, 
      expiresIn 
    } = req.body;
    
    const userId = req.user.id;
    
    // Update user with Spotify connection data
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'profile.spotifyAccessToken': accessToken,
          'profile.spotifyRefreshToken': refreshToken,
          'profile.spotifyUserId': spotifyUserId,
          'profile.spotifyEmail': spotifyEmail,
          'profile.spotifyDisplayName': spotifyDisplayName,
          'profile.spotifyConnectedAt': new Date(),
          'profile.spotifyTokenExpiresAt': new Date(Date.now() + (expiresIn * 1000))
        }
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    console.log(`🎵 Spotify connected for user ${userId} (${spotifyDisplayName})`);
    
    res.json({
      success: true,
      message: 'Spotify account connected successfully',
      data: {
        spotifyUserId,
        spotifyDisplayName,
        spotifyEmail,
        connectedAt: user.profile.spotifyConnectedAt
      }
    });
    
  } catch (error) {
    console.error('Spotify connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect Spotify account'
    });
  }
});

router.post('/spotify/disconnect', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Remove Spotify data from user profile
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $unset: {
          'profile.spotifyAccessToken': '',
          'profile.spotifyRefreshToken': '',
          'profile.spotifyUserId': '',
          'profile.spotifyEmail': '',
          'profile.spotifyDisplayName': '',
          'profile.spotifyConnectedAt': '',
          'profile.spotifyTokenExpiresAt': ''
        }
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    console.log(`🎵 Spotify disconnected for user ${userId}`);
    
    res.json({
      success: true,
      message: 'Spotify account disconnected successfully'
    });
    
  } catch (error) {
    console.error('Spotify disconnection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Spotify account'
    });
  }
});

// JWT Token Refresh Route
router.post("/refresh", protectRefresh, async (req, res) => {
  try {
    // User is already authenticated by protect middleware
    const userId = req.user.id;
    
    // Generate new token
    const newToken = signToken(userId);
    
    res.json({
      status: MESSAGES.SUCCESS,
      token: newToken,
      message: 'Token refreshed successfully'
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: MESSAGES.ERROR,
      message: 'Failed to refresh token'
    });
  }
});

export default router; 