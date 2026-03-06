import express from 'express';
import { getDashboard } from '../controllers/dashboardController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { isAdmin } from '../middleware/isAdmin.js';

const router = express.Router();

// GET /api/admin/dashboard
router.get('/dashboard', getDashboard);

export default router;
