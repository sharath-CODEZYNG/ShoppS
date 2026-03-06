import express from 'express';
import { getUserById, getAllUsers } from '../controllers/userController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { isAdmin } from '../middleware/isAdmin.js';

const router = express.Router();

/**
 * ========================================
 * USER MANAGEMENT ROUTES
 * ========================================
 * 
 * All routes under /api/users handle:
 * - Retrieving user profile information
 * - Listing all users (admin only)
 * 
 * PROTECTED ROUTES - Require valid JWT token
 * Authentication is handled by verifyToken middleware
 */

/**
 * GET /api/users/:id
 * 
 * Retrieve a specific user's profile and order summary
 * 
 * Middleware:
 * - verifyToken: User must be authenticated
 * 
 * Request:
 * - Headers: Authorization: Bearer <jwt_token>
 * - Params: id (user ID)
 * 
 * Response (200):
 * {
 *   "success": true,
 *   "data": {
 *     "user": {
 *       "id": 1,
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "role": "customer",
 *       "created_at": "2026-02-09T..."
 *     },
 *     "total_orders": 5,
 *     "total_spend": 2500.00,
 *     "recent_orders": [...]
 *   }
 * }
 */
router.get('/:id', verifyToken, getUserById);

/**
 * GET /api/users
 * 
 * Retrieve all users (admin only)
 * 
 * Middleware:
 * - verifyToken: User must be authenticated
 * - isAdmin: User must have 'admin' role
 * 
 * Request:
 * - Headers: Authorization: Bearer <jwt_token>
 * 
 * Response (200):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "role": "customer",
 *       "created_at": "2026-02-09T..."
 *     },
 *     ...
 *   ]
 * }
 */
router.get('/', verifyToken, isAdmin, getAllUsers);

/**
 * Future endpoints (placeholder structure):
 * 
 * PUT /api/users/:id - Update user profile (protected)
 * DELETE /api/users/:id - Delete user account (admin or self)
 * PATCH /api/users/:id/password - Change password (protected)
 */

export default router;
