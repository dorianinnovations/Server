import express from "express";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import { signToken } from "../middleware/auth.js";
import { HTTP_STATUS, MESSAGES, SECURITY_CONFIG } from "../config/constants.js";

const router = express.Router();

// Signup Route
router.post(
  "/signup",
  [
    body("email").isEmail().withMessage("Valid email required."),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long."),
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
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(HTTP_STATUS.CONFLICT).json({ 
          status: MESSAGES.ERROR,
          message: MESSAGES.EMAIL_IN_USE 
        });
      }

      const user = await User.create({ email, password });
      console.log("New user created:", user.email);

      res.status(HTTP_STATUS.CREATED).json({
        status: MESSAGES.SUCCESS,
        token: signToken(user._id),
        data: { user: { id: user._id, email: user.email } },
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
        data: { user: { id: user._id, email: user.email } },
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

export default router; 