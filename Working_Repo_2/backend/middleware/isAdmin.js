/**
 * Admin Authorization Middleware
 * 
 * Ensures that the authenticated user has 'admin' role.
 * Must be used AFTER verifyToken middleware.
 * 
 * If admin: Continues to next handler
 * If not admin: Returns 403 Forbidden
 */

export function isAdmin(req, res, next) {
  // Verify that verifyToken middleware ran first
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: No user context found'
    });
  }

  // Check if user has admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Admin access required'
    });
  }

  next();
}

export default isAdmin;
