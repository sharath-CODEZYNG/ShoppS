import pool from '../config/db.js'

export async function migrate() {
  try {
    // Check if images column exists
    const [rows] = await pool.query(
      `SELECT COUNT(*) as cnt FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'images'`
    )

    if (rows[0].cnt === 0) {
      try {
        await pool.query('ALTER TABLE products ADD COLUMN images JSON')
        console.log('✅ Added images JSON column to products table')
      } catch (err) {
        if (err.code === 'ER_TABLEACCESS_DENIED_ERROR') {
          console.log('⚠️  No ALTER permission to add images column; continuing without schema change')
        } else {
          throw err
        }
      }
    } else {
      console.log('✓ images column already exists')
    }
  } catch (err) {
    console.error('Migration error:', err.message)
  }
}

export default { migrate }
