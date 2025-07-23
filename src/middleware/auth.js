import jwt from "jsonwebtoken";
import { env } from "../config/environment.js";
import { HTTP_STATUS, MESSAGES, SECURITY_CONFIG as _SECURITY_CONFIG } from "../config/constants.js";

console.log("🔐 Initializing authentication middleware...");

// JWT signing function
export const signToken = (id) =>
  jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

console.log("✓JWT signing function ready.");

// Middleware to protect routes
export const protect = (req, res, next) => {
  console.log("🚨 PROTECT MIDDLEWARE CALLED");
  console.log("🚨 Headers:", JSON.stringify(req.headers, null, 2));
  
  let token;
  
  // Check for token in authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    console.log("🚨 TOKEN EXTRACTED:", token?.substring(0, 30));
  } else {
    console.log("🚨 NO BEARER TOKEN FOUND");
    console.log("🚨 Authorization header:", req.headers.authorization);
  }

  // If no token, return unauthorized
  if (!token) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
      status: MESSAGES.ERROR,
      message: MESSAGES.UNAUTHORIZED 
    });
  }

  try {
    // Debug logging
    console.log("🔐 AUTH DEBUG: Starting token verification");
    console.log("🔐 AUTH DEBUG: Token length:", token?.length);
    console.log("🔐 AUTH DEBUG: Token starts:", token?.substring(0, 30));
    console.log("🔐 AUTH DEBUG: JWT_SECRET exists:", !!env.JWT_SECRET);
    console.log("🔐 AUTH DEBUG: JWT_SECRET length:", env.JWT_SECRET?.length);
    
    // Verify token with JWT secret
    const decoded = jwt.verify(token, env.JWT_SECRET);
    
    // Handle both userId and id fields for backward compatibility
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      throw new Error('No user ID found in token');
    }
    
    req.user = { 
      id: userId,
      userId: userId,
      ...decoded 
    };
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

// Middleware ready