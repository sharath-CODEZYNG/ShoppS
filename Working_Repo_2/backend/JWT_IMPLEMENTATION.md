# JWT Authentication Implementation Guide

## 🔐 Complete JWT System

This guide shows how to use JWT authentication and role-based authorization in your routes.

---

## 📦 Installation

First, install jsonwebtoken:

```bash
npm install jsonwebtoken
```

---

## 🔧 Configuration

### Environment Variables (.env)
```env
JWT_SECRET=shopsphere_secret_key_change_this_in_production
JWT_EXPIRY=1d
```

✅ JWT_SECRET is set with fallback in both middleware and authController
✅ Uses 1 day expiry for tokens

---

## 📋 Implementation Overview

### Middleware Stack

#### 1. verifyToken (middleware/verifyToken.js)
```javascript
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'shopsphere_secret_key'

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    })
  }

  const token = authHeader.substring(7)

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = { id: decoded.id, role: decoded.role, email: decoded.email }
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      })
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token.'
    })
  }
}
```

#### 2. isAdmin (middleware/isAdmin.js)
```javascript
export function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: No user context found'
    })
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Admin access required'
    })
  }

  next()
}
```

---

## 🚀 Login Controller (authController.js)

```javascript
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'shopsphere_secret_key'
const JWT_EXPIRY = '1d'

export async function login(req, res) {
  const { email, password } = req.body

  // ... validation & user lookup ...

  // Generate JWT
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  )

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: { id, name, email, role },
      token: token
    }
  })
}
```

---

## 📍 How to Protect Routes

### Pattern 1: Public Routes (No Middleware)
```javascript
// routes/productRoutes.js
router.get('/', getProducts)            // Public
router.get('/:id', getProductById)      // Public
router.post('/review', createReview)     // Public
```

### Pattern 2: User-Protected Routes (verifyToken only)
```javascript
// routes/orderRoutes.js
import { verifyToken } from '../middleware/verifyToken.js'

router.get('/my', verifyToken, getUserOrders)
router.post('/', verifyToken, createOrder)
router.get('/:id', verifyToken, getOrderDetail)
```

### Pattern 3: Admin-Only Routes (verifyToken + isAdmin)
```javascript
// routes/productRoutes.js
import { verifyToken } from '../middleware/verifyToken.js'
import { isAdmin } from '../middleware/isAdmin.js'

router.post('/', verifyToken, isAdmin, createProduct)
router.put('/:id', verifyToken, isAdmin, updateProduct)
router.delete('/:id', verifyToken, isAdmin, deleteProduct)

router.get('/all', verifyToken, isAdmin, getAllProducts)
```

### Pattern 4: Admin Routes (Alternative)
```javascript
// routes/adminRoutes.js
import { verifyToken } from '../middleware/verifyToken.js'
import { isAdmin } from '../middleware/isAdmin.js'

// Apply middleware to entire admin router
router.use(verifyToken, isAdmin)

router.get('/users', getAllUsers)
router.put('/orders/:id/status', updateOrderStatus)
router.delete('/users/:id', deleteUser)
```

---

## 🧪 Testing Examples

### 1. Register User (Public)
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'

Response 201:
{
  "success": true,
  "message": "User registered successfully. Please login to continue.",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "customer",
    "created_at": "2026-02-09T..."
  }
}
```

### 2. Login User (Public)
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

Response 200:
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer",
      "created_at": "2026-02-09T..."
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. Use Token in Protected Request
```bash
# Store token from login
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Use in protected route
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/users/1

Response 200:
{
  "success": true,
  "data": {
    "user": { ... },
    "total_orders": 5,
    "total_spend": 2500.00
  }
}
```

### 4. Admin-Only Route
```bash
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Admin list users
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/users

Response 200:
{
  "success": true,
  "data": [ { id: 1, name, email, role }, ... ]
}

# Non-admin try to list users → 403
curl -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  http://localhost:4000/api/users

Response 403:
{
  "success": false,
  "message": "Forbidden: Admin access required"
}
```

---

## 📊 Token Payload Structure

### What's Inside a JWT

```javascript
// Payload (decoded)
{
  id: 1,                    // User ID
  email: "john@example.com", // User email
  role: "customer",         // User role (customer, admin)
  iat: 1707542400,          // Issued at (timestamp)
  exp: 1707628800           // Expires at (1 day later)
}

// Token format (3 parts separated by dots)
header.payload.signature
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImN1c3RvbWVyIn0.abc123xyz...
```

---

## 🛡️ Security Checklist

- ✅ Token in Authorization header (not cookie/URL)
- ✅ Token expired after 1 day
- ✅ JWT_SECRET environment variable configured
- ✅ Role-based access control (admin checks)
- ✅ Proper error messages (401, 403 status codes)
- ✅ Token validation on protected routes
- ⚠️ TODO: Use HTTPS in production
- ⚠️ TODO: Implement refresh tokens
- ⚠️ TODO: Hash passwords with bcrypt

---

## 🔄 Complete Route Example

```javascript
// routes/exampleRoutes.js
import express from 'express'
import { verifyToken } from '../middleware/verifyToken.js'
import { isAdmin } from '../middleware/isAdmin.js'
import {
  getPublicData,
  getUserData,
  updateUserData,
  getAllUsers,
  deleteUser
} from '../controllers/exampleController.js'

const router = express.Router()

// PUBLIC ROUTES - No middleware needed
router.get('/public', getPublicData)

// USER ROUTES - Require token
router.get('/:id', verifyToken, getUserData)
router.put('/:id', verifyToken, updateUserData)

// ADMIN ROUTES - Require token + admin role
router.get('/', verifyToken, isAdmin, getAllUsers)
router.delete('/:id', verifyToken, isAdmin, deleteUser)

export default router
```

---

## 🔗 Using req.user in Controllers

Once middleware sets `req.user`, you can access it in any protected controller:

```javascript
export async function getUserData(req, res) {
  // req.user is automatically set by verifyToken middleware
  const userId = req.user.id        // User ID from token
  const userRole = req.user.role    // User role from token
  const userEmail = req.user.email  // User email from token

  // Fetch user-specific data
  const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [userId])

  return res.json({ success: true, data: user })
}
```

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "email and password are required"
}
```

### 401 Unauthorized (No Token)
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

### 401 Unauthorized (Invalid/Expired Token)
```json
{
  "success": false,
  "message": "Invalid token."
}
```

### 401 Unauthorized (Token Expired)
```json
{
  "success": false,
  "message": "Token expired. Please login again."
}
```

### 403 Forbidden (Not Admin)
```json
{
  "success": false,
  "message": "Forbidden: Admin access required"
}
```

---

## 📝 Key Points

1. **Register** - Creates user, does NOT generate token
2. **Login** - Returns user + JWT token
3. **verifyToken** - Extracts and validates JWT from Authorization header
4. **isAdmin** - Checks if user role is 'admin' (must use after verifyToken)
5. **Token Format** - `Authorization: Bearer <token>`
6. **Token Expiry** - 1 day (86400 seconds)
7. **Payload** - Contains id, email, role (no sensitive data)

---

## 🚀 Next Steps

1. ✅ Install jsonwebtoken
2. ✅ Configure .env with JWT_SECRET
3. ✅ Update authController with JWT logic
4. ✅ Apply middleware to protected routes
5. ⏭️ Test with curl examples above
6. ⏭️ Integrate with frontend (store token in localStorage)
7. ⏭️ Add refresh token mechanism (optional)
8. ⏭️ Implement bcrypt for passwords (recommended)

---

## 🎯 Production Checklist

- [ ] Change JWT_SECRET to strong random string (32+ chars)
- [ ] Use HTTPS instead of HTTP
- [ ] Set JWT_EXPIRY appropriately
- [ ] Implement refresh tokens
- [ ] Hash passwords with bcrypt
- [ ] Add rate limiting on /login
- [ ] Log failed authentication attempts
- [ ] Implement token blacklist (for logout)
- [ ] Add CORS security headers
- [ ] Test with all scenarios

---

**Implementation Date:** 2026-02-09  
**Status:** ✅ Complete  
**Environment:** Development (ready for production upgrade)
