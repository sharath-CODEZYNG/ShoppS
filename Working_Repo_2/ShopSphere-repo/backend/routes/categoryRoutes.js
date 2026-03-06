import express from 'express';
import { getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { isAdmin } from '../middleware/isAdmin.js';

const router = express.Router();

// GET /api/categories (get all categories)
router.get('/', getAllCategories);

// GET /api/categories/:id
router.get('/:id', getCategoryById);

// POST /api/categories (admin only)
router.post('/', createCategory);

// PUT /api/categories/:id (admin only)
router.put('/:id', updateCategory);

// DELETE /api/categories/:id (admin only)
router.delete('/:id', deleteCategory);

export default router;
