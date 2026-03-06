# JWT Routes Implementation Examples

This document shows real examples of how to implement different types of routes with JWT authentication and authorization.

---

## 📋 Table of Contents

1. Public Routes (No Auth)
2. User-Protected Routes (verifyToken)
3. Admin-Only Routes (verifyToken + isAdmin)
4. Complete Working Examples

---

## 1️⃣ Public Routes (No Authentication)

### Example: Product Routes

```javascript
// routes/productRoutes.js
import express from 'express'
import {
  getProducts,
  getProductById,
  searchProducts
} from '../controllers/productController.js'

const router = express.Router()

/**
 * GET /api/products
 * Public - Anyone can view products
 * No authentication needed
 */
router.get('/', getProducts)

/**
 * GET /api/products/:id
 * Public - Anyone can view product details
 * No authentication needed
 */
router.get('/:id', getProductById)

/**
 * POST /api/products/search
 * Public - Anyone can search products
 * No authentication needed
 */
router.post('/search', searchProducts)

export default router
```

✅ **Key Point:** No middleware = public access

---

## 2️⃣ User-Protected Routes (Token Required)

### Example: User Profile Routes

```javascript
// routes/userRoutes.js
import express from 'express'
import { verifyToken } from '../middleware/verifyToken.js'
import {
  getUserProfile,
  updateUserProfile,
  getUserOrders,
  getUserPreferences
} from '../controllers/userController.js'

const router = express.Router()

/**
 * GET /api/users/:id
 * Protected - Only authenticated users
 * Returns: User profile + statistics
 */
router.get('/:id', verifyToken, getUserProfile)

/**
 * PUT /api/users/:id
 * Protected - Only authenticated users
 * Updates: User profile information
 */
router.put('/:id', verifyToken, updateUserProfile)

/**
 * GET /api/users/:id/orders
 * Protected - Only authenticated users
 * Returns: User's orders
 */
router.get('/:id/orders', verifyToken, getUserOrders)

/**
 * PUT /api/users/:id/preferences
 * Protected - Only authenticated users
 * Updates: User preferences
 */
router.put('/:id/preferences', verifyToken, getUserPreferences)

export default router
```

✅ **Key Point:** `verifyToken` middleware ensures user is authenticated

---

## 3️⃣ Admin-Only Routes (Token + Admin Role)

### Example 1: Product Management Routes

```javascript
// routes/productRoutes.js
import express from 'express'
import { verifyToken } from '../middleware/verifyToken.js'
import { isAdmin } from '../middleware/isAdmin.js'
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUploadProducts
} from '../controllers/productController.js'

const router = express.Router()

// ========================================
// PUBLIC ROUTES - No authentication
// ========================================

/**
 * GET /api/products
 * Public - Anyone can view products
 */
router.get('/', getProducts)

/**
 * GET /api/products/:id
 * Public - Anyone can view product details
 */
router.get('/:id', getProductById)

// ========================================
// ADMIN-ONLY ROUTES - Require token + admin role
// ========================================

/**
 * POST /api/products
 * Admin - Create new product
 * Middleware: verifyToken, isAdmin
 */
router.post('/', verifyToken, isAdmin, createProduct)

/**
 * PUT /api/products/:id
 * Admin - Update product
 * Middleware: verifyToken, isAdmin
 */
router.put('/:id', verifyToken, isAdmin, updateProduct)

/**
 * DELETE /api/products/:id
 * Admin - Delete product
 * Middleware: verifyToken, isAdmin
 */
router.delete('/:id', verifyToken, isAdmin, deleteProduct)

/**
 * POST /api/products/bulk-upload
 * Admin - Bulk upload products
 * Middleware: verifyToken, isAdmin
 */
router.post('/bulk-upload', verifyToken, isAdmin, bulkUploadProducts)

export default router
```

### Example 2: Order Management Routes

```javascript
// routes/orderRoutes.js
import express from 'express'
import { verifyToken } from '../middleware/verifyToken.js'
import { isAdmin } from '../middleware/isAdmin.js'
import {
  getMyOrders,
  createOrder,
  getOrderDetail,
  getAllOrders,      // Admin
  updateOrderStatus, // Admin
  cancelOrder        // Admin
} from '../controllers/orderController.js'

const router = express.Router()

// ========================================
// USER ROUTES - Require token only
// ========================================

/**
 * GET /api/orders/my
 * User - Get my orders
 */
router.get('/my', verifyToken, getMyOrders)

/**
 * POST /api/orders
 * User - Create new order
 */
router.post('/', verifyToken, createOrder)

/**
 * GET /api/orders/:id
 * User - Get order details (if owner or admin)
 */
router.get('/:id', verifyToken, getOrderDetail)

// ========================================
// ADMIN ROUTES - Require token + admin role
// ========================================

/**
 * GET /api/orders
 * Admin - Get all orders
 */
router.get('/', verifyToken, isAdmin, getAllOrders)

/**
 * PUT /api/orders/:id/status
 * Admin - Update order status
 */
router.put('/:id/status', verifyToken, isAdmin, updateOrderStatus)

/**
 * DELETE /api/orders/:id
 * Admin - Cancel order
 */
router.delete('/:id', verifyToken, isAdmin, cancelOrder)

export default router
```

### Example 3: Using Router Middleware (Apply to Entire Routes)

```javascript
// routes/adminRoutes.js
import express from 'express'
import { verifyToken } from '../middleware/verifyToken.js'
import { isAdmin } from '../middleware/isAdmin.js'
import {
  getDashboard,
  getAnalytics,
  getAllUsers,
  deleteUser,
  getSalesReport,
  getInventoryStatus
} from '../controllers/adminController.js'

const router = express.Router()

// Apply middleware to ALL routes in this file
// All routes will require: verifyToken AND isAdmin
router.use(verifyToken, isAdmin)

/**
 * GET /api/admin/dashboard
 * Admin - Dashboard statistics
 */
router.get('/dashboard', getDashboard)

/**
 * GET /api/admin/analytics
 * Admin - Detailed analytics
 */
router.get('/analytics', getAnalytics)

/**
 * GET /api/admin/users
 * Admin - List all users
 */
router.get('/users', getAllUsers)

/**
 * DELETE /api/admin/users/:id
 * Admin - Delete user
 */
router.delete('/users/:id', deleteUser)

/**
 * GET /api/admin/sales-report
 * Admin - Sales report
 */
router.get('/sales-report', getSalesReport)

/**
 * GET /api/admin/inventory
 * Admin - Inventory status
 */
router.get('/inventory', getInventoryStatus)

export default router
```

✅ **Key Point:** `router.use(verifyToken, isAdmin)` applies middleware to all routes

---

## 4️⃣ Complete Working Examples

### Example: Full E-commerce Routes Setup

#### server.js
```javascript
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

// Import all route modules
import authRoutes from './routes/authRoutes.js'
import productRoutes from './routes/productRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import userRoutes from './routes/userRoutes.js'
import adminRoutes from './routes/adminRoutes.js'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

// ========================================
// PUBLIC ROUTES
// ========================================

/**
 * Auth routes
 * POST /api/auth/register
 * POST /api/auth/login
 */
app.use('/api/auth', authRoutes)

// ========================================
// ALL OTHER ROUTES - Some public, some protected
// ========================================

/**
 * Product routes
 * GET /api/products (public)
 * GET /api/products/:id (public)
 * POST /api/products (admin)
 * PUT /api/products/:id (admin)
 * DELETE /api/products/:id (admin)
 */
app.use('/api/products', productRoutes)

/**
 * Order routes
 * GET /api/orders/my (user)
 * POST /api/orders (user)
 * GET /api/orders (admin)
 * PUT /api/orders/:id/status (admin)
 */
app.use('/api/orders', orderRoutes)

/**
 * User routes
 * GET /api/users/:id (user)
 * PUT /api/users/:id (user)
 * GET /api/users (admin)
 */
app.use('/api/users', userRoutes)

/**
 * Admin routes (all protected)
 * GET /api/admin/dashboard (admin)
 * GET /api/admin/analytics (admin)
 * GET /api/admin/users (admin)
 */
app.use('/api/admin', adminRoutes)

// Start server
const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
```

#### authRoutes.js
```javascript
import express from 'express'
import { register, login } from '../controllers/authController.js'

const router = express.Router()

// Public routes - No middleware
router.post('/register', register)
router.post('/login', login)

export default router
```

#### userRoutes.js
```javascript
import express from 'express'
import { verifyToken } from '../middleware/verifyToken.js'
import { isAdmin } from '../middleware/isAdmin.js'
import {
  getUserById,
  updateUserProfile,
  getAllUsers
} from '../controllers/userController.js'

const router = express.Router()

// User can get their own profile
router.get('/:id', verifyToken, getUserById)

// User can update their own profile
router.put('/:id', verifyToken, updateUserProfile)

// Only admin can get all users
router.get('/', verifyToken, isAdmin, getAllUsers)

export default router
```

---

## 🧪 Testing All Route Types

### Test 1: Public Route (No Auth)
```bash
# Get all products (public - no token needed)
curl http://localhost:4000/api/products

✓ Returns: All products
```

### Test 2: Protected Route (User Auth)
```bash
# Get user profile (requires token)
TOKEN="<token_from_login>"

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/users/1

✓ Returns: User profile
✗ Without token: 401 Unauthorized
```

### Test 3: Admin-Only Route
```bash
# Create product (admin only)
ADMIN_TOKEN="<admin_token>"

curl -X POST http://localhost:4000/api/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Product","price":99.99}'

✓ With admin token: Creates product
✗ With customer token: 403 Forbidden
✗ Without token: 401 Unauthorized
```

---

## 📊 Middleware Chain Reference

```
Public Route:
  Request → Handler → Response

Protected Route:
  Request → verifyToken → Handler (with req.user) → Response

Admin Route:
  Request → verifyToken → isAdmin → Handler → Response
```

---

## ✅ Best Practices

1. **Apply middleware in correct order**
   - Always: `verifyToken` before `isAdmin`
   - Why: `isAdmin` needs `req.user` from `verifyToken`

2. **Use router.use() for multiple admin routes**
   - Instead of: `router.post('/', verifyToken, isAdmin, handler)`
   - Use: `router.use(verifyToken, isAdmin)` at top

3. **Clear route organization**
   - Group by auth level (public, user, admin)
   - Add comments explaining protection level

4. **Consistent error responses**
   - 401: No/invalid token
   - 403: Valid token but insufficient permissions

5. **Access user data in controllers**
   - Via: `req.user.id`, `req.user.role`, `req.user.email`
   - Set by: `verifyToken` middleware

---

## 🎯 Summary

| Route Type | Middleware | Used For |
|-----------|-----------|----------|
| Public | None | Anyone can access |
| User | verifyToken | Authenticated users only |
| Admin | verifyToken + isAdmin | Admin users only |

---

**Implementation Date:** 2026-02-09  
**Status:** ✅ Production-Ready Examples
