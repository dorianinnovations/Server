import jwt from "jsonwebtoken";
import { env } from "../config/environment.js";
import { HTTP_STATUS, MESSAGES, SECURITY_CONFIG } from "../config/constants.js";
import logger from "../utils/logger.js";

// JWT signing function
export const signToken = (id) =>
  jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: SECURITY_CONFIG.JWT_EXPIRES_IN,
  });

console.log("✓JWT signing function ready.");

// Middleware to protect routes
export const protect = (req, res, next) => {
  logger.info("=== AUTH DEBUG ===", {
    authHeader: req.headers.authorization,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent']
  });
  
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
    logger.info("Token extraction", { tokenFound: !!token });
  } else {
    logger.warn("No Bearer token in authorization header");
  }

  if (!token) {
    logger.warn("No token - returning 401");
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
      status: MESSAGES.ERROR,
      message: MESSAGES.UNAUTHORIZED 
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    logger.info("Token decoded successfully", { userId: decoded.id });
    req.user = decoded; // Attach user ID to request object
    next();
  } catch (error) {
    logger.error("JWT verification error", { error: error.message });
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
      status: MESSAGES.ERROR,
      message: MESSAGES.INVALID_TOKEN 
    });
  }
}; 