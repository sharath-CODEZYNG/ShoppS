import express from 'express';
import upload from '../middleware/upload.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { isAdmin } from '../middleware/isAdmin.js';
import {
  getAllProducts,
  getProductsByCategory,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  submitRating,
  submitReview,
  incrementView,
  getOrderReviewStatus,
  getProductReviews,
  getOrderRatingStatus,
  increaseAvailability
} from '../controllers/productController.js';
 
const router = express.Router();

// GET /api/products
router.get('/', getAllProducts);

// POST /api/products (create new product with optional image uploads up to 3)
router.post('/', upload.array('images', 3), (req, res, next) => {
	try {
		console.log('FILES RECEIVED IN ROUTE:', Array.isArray(req.files) ? req.files.map(f => f.originalname || f.filename) : req.files);
		console.log('ROUTE CONTENT-TYPE:', req.headers['content-type']);
	} catch (e) {
		console.warn('Error logging req.files in route middleware', e);
	}
	next();
}, createProduct);

// PUT /api/products/:id - update product (supports replacing images)
router.put('/:id', upload.array('images', 3), updateProduct);

// DELETE /api/products/:id - delete product
router.delete('/:id', deleteProduct);

// POST /api/products/:id/rate - submit rating
router.post('/:id/rate', verifyToken,submitRating);

// POST /api/products/:id/view - increment view count and return product
router.post('/:id/view', incrementView);

// POST /api/products/:id/review - submit text review

router.post('/:id/review', verifyToken, submitReview);


// PUT /api/products/:id/availability - increase availability (admin)
router.put('/:id/availability', increaseAvailability);

// GET /api/products/:id/order/:orderId/rating-status?userId= - check if user rated this order-item
router.get('/:id/order/:orderId/rating-status', getOrderRatingStatus);

// GET /api/products/category/:category
router.get('/category/:category', getProductsByCategory);

// GET /api/products/:id
router.get('/:id', getProductById);

// GET /api/products/:id/order/:orderId/review-status - check if user can review / already reviewed

router.get('/:id/order/:orderId/review-status', verifyToken, getOrderReviewStatus);


// GET /api/products/:id/reviews - list text reviews for a product

router.get('/:id/reviews', getProductReviews);


export default router;
