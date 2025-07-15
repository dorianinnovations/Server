import jwt from "jsonwebtoken";
import { env } from "../config/environment.js";
import { HTTP_STATUS, MESSAGES, SECURITY_CONFIG } from "../config/constants.js";

console.log("🔐 Initializing authentication middleware...");

// JWT signing function
export const signToken = (id) =>
  jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

console.log("✓JWT signing function ready.");

// Middleware to protect routes
export const protect = (req, res, next) => {
  let token;
  
  console.log("🔐 Auth middleware called for:", req.path);
  console.log("🔐 Authorization header:", req.headers.authorization ? "Present" : "Missing");
  
  // Check for token in authorization header
  console.log("🔐 Full authorization header:", req.headers.authorization);
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    const parts = req.headers.authorization.split(" ");
    console.log("🔐 Authorization parts:", parts);
    token = parts[1];
    console.log("🔐 Token extracted:", token ? "Present (length: " + token.length + ")" : "Missing");
  }

  // If no token, return unauthorized
  if (!token) {
    console.log("🔐 No token found, returning unauthorized");
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
      status: MESSAGES.ERROR,
      message: MESSAGES.UNAUTHORIZED 
    });
  }

  try {
    console.log("🔐 Verifying token with secret length:", env.JWT_SECRET.length);
    // Verify token with JWT secret
    const decoded = jwt.verify(token, env.JWT_SECRET);
    console.log("🔐 Token verified successfully, user ID:", decoded.id);
    req.user = decoded; // Attach user data to request object
    next();
  } catch (error) {
    // Log the error for debugging but return generic message
    console.error("🔐 JWT verification failed:", error.message);
    console.error("🔐 JWT secret being used:", env.JWT_SECRET.substring(0, 8) + "...");
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
      status: MESSAGES.ERROR,
      message: MESSAGES.INVALID_TOKEN 
    });
  }
};

console.log("✓Authentication middleware ready."); 