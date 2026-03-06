import pool from '../config/db.js';

/**
 * ========================================
 * USER CONTROLLER
 * ========================================
 * 
 * Handles user-related operations:
 * - Getting user profile by ID
 * - Retrieving all users (admin)
 * - User history and statistics
 * 
 * NOTE: Authentication (register/login) is handled
 * by authController.js and authRoutes.js
 */

/**
 * Get user by ID
 * GET /api/users/:id
 * 
 * Retrieves a single user's profile and order summary
 * Protected route - requires valid JWT token
 */
export async function getUserById(req, res) {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];

    // Calculate delivered orders count and sum
    const [aggRows] = await pool.query(
      `SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as total_spend
       FROM orders
       WHERE user_id = ? AND status = 'delivered'`,
      [id]
    );

    const totals = aggRows && aggRows[0] ? aggRows[0] : { total_orders: 0, total_spend: 0 };

    // Fetch last 5 delivered orders
    const [recentRows] = await pool.query(
      `SELECT id, total_amount, created_at
       FROM orders
       WHERE user_id = ? AND status = 'delivered'
       ORDER BY created_at DESC
       LIMIT 5`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        user,
        total_orders: Number(totals.total_orders) || 0,
        total_spend: Number(totals.total_spend) || 0,
        recent_orders: recentRows || []
      }
    });
  } catch (err) {
    console.error('[User] Error fetching user:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

/**
 * Get all users
 * GET /api/users
 * 
 * Retrieves all users in the system
 * Protected route - requires valid JWT token AND admin role
 */
export async function getAllUsers(req, res) {
  try {
    console.log('[User] Fetching all users from database');
    const [rows] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    console.log('[User] Found', rows.length, 'users');
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[User] Error fetching users:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
