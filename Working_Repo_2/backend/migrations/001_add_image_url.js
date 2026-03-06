import pool from '../config/db.js'

export async function migrate() {
  try {
    // Check if image_url column exists
    const [rows] = await pool.query(
      `SELECT COUNT(*) as cnt FROM information_schema.columns 
       WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'image_url'`
    )

    if (rows[0].cnt === 0) {
      // Add column if it doesn't exist
      try {
        await pool.query('ALTER TABLE products ADD COLUMN image_url TEXT')
        console.log('✅ Added image_url column to products table')
      } catch (alterErr) {
        if (alterErr.code === 'ER_TABLEACCESS_DENIED_ERROR') {
          console.log('⚠️  No ALTER permission - image_url functionality will work without schema change')
        } else {
          throw alterErr
        }
      }
    } else {
      console.log('✓ image_url column already exists')
    }
  } catch (err) {
    console.error('Migration error:', err.message)
    // Don't throw - allow app to continue
  }
}
