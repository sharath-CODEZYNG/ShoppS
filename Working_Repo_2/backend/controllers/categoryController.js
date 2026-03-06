import pool from '../config/db.js';

// Controller: Get all categories
export async function getAllCategories(req, res) {
  try {
    const [rows] = await pool.query('SELECT id, name, description, created_at FROM categories');
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching categories:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Get category by ID
export async function getCategoryById(req, res) {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT id, name, description, created_at FROM categories WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Error fetching category:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Create category (admin only)
export async function createCategory(req, res) {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { categoryId: result.insertId, name, description }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Category already exists' });
    }
    console.error('Error creating category:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Update category (admin only)
export async function updateCategory(req, res) {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    await pool.query(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [name, description, id]
    );

    return res.json({ success: true, message: 'Category updated successfully' });
  } catch (err) {
    console.error('Error updating category:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Controller: Delete category (admin only)
export async function deleteCategory(req, res) {
  const { id } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    return res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
