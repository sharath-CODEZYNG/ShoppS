import pool from '../config/db.js';

export async function getDashboard(req, res) {
  try {
    // 1️⃣ Total Users
    const [userRows] = await pool.query('SELECT COUNT(*) as total_users FROM users');
    const totalUsers = userRows && userRows[0] ? Number(userRows[0].total_users) : 0;

    // 2️⃣ Total Orders
    const [orderRows] = await pool.query('SELECT COUNT(*) as total_orders FROM orders');
    const totalOrders = orderRows && orderRows[0] ? Number(orderRows[0].total_orders) : 0;

    // 3️⃣ Total Revenue (ONLY delivered)
    const [revenueRows] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total_revenue
       FROM orders
       WHERE status = 'delivered'`
    );
    const totalRevenue = revenueRows && revenueRows[0] ? Number(revenueRows[0].total_revenue) : 0;

    // 4️⃣ Monthly Revenue (last 12 months)
    const [monthlyRows] = await pool.query(
      `SELECT 
        DATE_FORMAT(created_at, '%m') as month,
        COALESCE(SUM(total_amount), 0) as revenue
       FROM orders
       WHERE status = 'delivered'
       GROUP BY DATE_FORMAT(created_at, '%m')
       ORDER BY month`
    );
    
    // Build full 12-month array (Jan-Dec) with 0 for missing months
    const monthlyData = Array(12).fill(0);
    if (monthlyRows && Array.isArray(monthlyRows)) {
      monthlyRows.forEach(row => {
        const monthNum = parseInt(row.month, 10) - 1; // 0-indexed
        if (monthNum >= 0 && monthNum < 12) {
          monthlyData[monthNum] = Number(row.revenue);
        }
      });
    }

    // 5️⃣ Recent Orders (Last 5)
    const [recentOrdersRows] = await pool.query(
      `SELECT o.id,
        o.total_amount,
        o.status,
        o.created_at,
        u.email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC
       LIMIT 5`
    );
    const recentOrders = recentOrdersRows || [];

    // 6️⃣ Recent Users (Last 5)
    const [recentUsersRows] = await pool.query(
      `SELECT id, name, email, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 5`
    );
    const recentUsers = recentUsersRows || [];

    return res.json({
      success: true,
      data: {
        total_users: totalUsers,
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        monthly_revenue: monthlyData,
        recent_orders: recentOrders,
        recent_users: recentUsers
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
