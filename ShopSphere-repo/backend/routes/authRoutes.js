import { Router } from 'express';
import { register, login, forgotPassword, resetPassword } from '../controllers/authController.js';

const router = Router();

/**
 * ========================================
 * AUTHENTICATION ROUTES
 * ========================================
 * 
 * All routes under /api/auth handle:
 * - User registration
 * - User login/authentication
 * - Token generation
 * 
 * Public routes (no authentication required)
 */

/**
 * POST /api/auth/register
 * 
 * Register a new user account
 * 
 * Request body:
 * {
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "password": "securePassword123"
 * }
 * 
 * Response (201):
 * {
 *   "success": true,
 *   "message": "User registered successfully",
 *   "data": {
 *     "id": 1,
 *     "name": "John Doe",
 *     "email": "john@example.com",
 *     "role": "customer",
 *     "created_at": "2026-02-09T..."
 *   }
 * }
 */
router.post('/register', register);

/**
 * POST /api/auth/login
 * 
 * Authenticate user and get authentication token
 * 
 * Request body:
 * {
 *   "email": "john@example.com",
 *   "password": "securePassword123"
 * }
 * 
 * Response (200):
 * {
 *   "success": true,
 *   "message": "Login successful",
 *   "data": {
 *     "userId": 1,
 *     "name": "John Doe",
 *     "email": "john@example.com",
 *     "role": "customer",
 *     "token": "eyJhbGciOiJIUzI1NiIs..." (JWT token)
 *   }
 * }
 */
router.post('/login', login);

router.post('/forgot-password', forgotPassword);

router.post('/reset-password', resetPassword);


export default router;
