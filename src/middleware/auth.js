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
  console.log("🔐 Auth middleware called for:", req.path);
  console.log("🔐 Headers:", req.headers.authorization);
  
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
    console.log("🔐 Token extracted:", token ? token.substring(0, 20) + "..." : "none");
  }

  if (!token) {
    console.log("🔐 No token found, returning UNAUTHORIZED");
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
      status: MESSAGES.ERROR,
      message: MESSAGES.UNAUTHORIZED 
    });
  }

  try {
    console.log("🔐 Verifying token with secret:", env.JWT_SECRET ? "present" : "missing");
    const decoded = jwt.verify(token, env.JWT_SECRET);
    console.log("🔐 Token verified successfully, user ID:", decoded.id);
    req.user = decoded; // Attach user ID to request object
    next();
  } catch (error) {
    console.error("🔐 JWT verification error:", error.message);
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
      status: MESSAGES.ERROR,
      message: MESSAGES.INVALID_TOKEN 
    });
  }
};

console.log("✓Authentication middleware ready."); 