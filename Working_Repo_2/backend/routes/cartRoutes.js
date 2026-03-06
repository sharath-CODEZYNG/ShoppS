import express from 'express';
import { addToCart, getCartByUser, updateCartItem, removeCartItem, clearCart } from '../controllers/cartController.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { isAdmin } from '../middleware/isAdmin.js';

const router = express.Router();

// POST /api/cart/add
router.post('/add', addToCart);

// GET /api/cart/:userId
router.get('/:userId', getCartByUser);

// PUT /api/cart/item/:cartId - Update item quantity
router.put('/item/:cartId',  updateCartItem);

// DELETE /api/cart/item/:cartId - Remove item from cart
router.delete('/item/:cartId', removeCartItem);

// DELETE /api/cart/:userId - Clear entire cart
router.delete('/:userId',  clearCart);

export default router;
