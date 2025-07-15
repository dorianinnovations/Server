import jwt from "jsonwebtoken";
import { env } from "../config/environment.js";
import { HTTP_STATUS, MESSAGES, SECURITY_CONFIG } from "../config/constants.js";

console.log("🔐 Initializing authentication middleware...");

// JWT signing function
export const signToken = (id) =>
  jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: SECURITY_CONFIG.JWT_EXPIRES_IN,
  });

console.log("✓JWT signing function ready.");

// Middleware to protect routes
export const protect = (req, res, next) => {
  let token;
  
  // Check for token in authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // If no token, return unauthorized
  if (!token) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
      status: MESSAGES.ERROR,
      message: MESSAGES.UNAUTHORIZED 
    });
  }

  try {
    // Verify token with JWT secret
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded; // Attach user data to request object
    next();
  } catch (error) {
    // Log the error for debugging but return generic message
    console.error("JWT verification failed:", error.message);
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
      status: MESSAGES.ERROR,
      message: MESSAGES.INVALID_TOKEN 
    });
  }
};

console.log("✓Authentication middleware ready."); 