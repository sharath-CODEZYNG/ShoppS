/**
 * JWT Token Verification Middleware
 * 
 * Verifies JWT token from Authorization header
 * Token format: "Bearer <token>"
 * 
 * If valid: Attaches decoded user info to req.user
 * If invalid/expired: Returns 401 Unauthorized
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'shopsphere_secret_key';

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  // Check if Authorization header exists
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // Verify token using JWT secret
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach user info to request for downstream use
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email
    };
    
    next();
  } catch (err) {
    // Handle different JWT errors
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    console.error('[Auth] Token verification failed:', err.message);
    return res.status(401).json({
      success: false,
      message: 'Token verification failed.'
    });
  }
}

export default verifyToken;
