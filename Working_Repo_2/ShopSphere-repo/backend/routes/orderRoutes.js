import express from 'express';
import { createOrder,createOrderFromItems,getOrderById, getUserOrders, getAllOrders, updateOrderStatus } from '../controllers/orderController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import {isAdmin } from '../middleware/isAdmin.js';

const router = express.Router();

// POST /api/orders (create order from cart)
router.post('/', createOrder);

// GET /api/orders/user/:userId (get user's orders) - MUST be before /:id
router.get('/user/:userId',  getUserOrders);

// POST /api/orders/voice (create order directly from selected items)
router.post('/voice', createOrderFromItems);

// GET /api/orders/:id (get order details)
router.get('/:id',  getOrderById);

// GET /api/orders (admin only - get all orders)
router.get('/', getAllOrders);

// PUT /api/orders/:id/status (admin only - update order status)
router.put('/:id/status', updateOrderStatus);

export default router;
