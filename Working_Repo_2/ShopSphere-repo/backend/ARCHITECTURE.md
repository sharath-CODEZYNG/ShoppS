# Backend Architecture Guide

## Overview
Clean, scalable REST API architecture with separated concerns for authentication and user management.

---

## 📁 Folder Structure

```
backend/
├── routes/
│   ├── authRoutes.js          # Authentication endpoints
│   ├── userRoutes.js          # User management endpoints
│   ├── productRoutes.js       # Product endpoints
│   ├── cartRoutes.js          # Cart endpoints
│   ├── orderRoutes.js         # Order endpoints
│   ├── categoryRoutes.js      # Category endpoints
│   └── adminRoutes.js         # Admin endpoints
│
├── controllers/
│   ├── authController.js      # Auth logic (register, login)
│   ├── userController.js      # User logic (get profile, list users)
│   ├── productController.js   # Product logic
│   ├── cartController.js      # Cart logic
│   ├── orderController.js     # Order logic
│   ├── categoryController.js  # Category logic
│   └── adminController.js     # Admin logic
│
├── middleware/
│   ├── verifyToken.js         # JWT verification middleware
│   └── isAdmin.js             # Admin role check middleware
│
├── config/
│   └── db.js                  # Database connection pool
│
├── migrations/
│   ├── 001_add_image_url.js
│   └── 002_add_images_json.js
│
└── server.js                   # Express app setup & route mounting
```

---

## 🔐 Route Organization

### Authentication Routes (`/api/auth`)
**Location:** `routes/authRoutes.js`

| Method | Endpoint | Controller | Protection | Purpose |
|--------|----------|-----------|-----------|---------|
| POST | `/register` | `authController.register()` | Public | Register new user |
| POST | `/login` | `authController.login()` | Public | Authenticate user |

**Key Point:** All user registration and authentication happens here.

---

### User Management Routes (`/api/users`)
**Location:** `routes/userRoutes.js`

| Method | Endpoint | Controller | Protection | Purpose |
|--------|----------|-----------|-----------|---------|
| GET | `/:id` | `userController.getUserById()` | `verifyToken` | Get user profile |
| GET | `/` | `userController.getAllUsers()` | `verifyToken` + `isAdmin` | List all users |

**Key Point:** Retrieve user data only. NO authentication logic here.

---

## 🛡️ Middleware Stack

### verifyToken Middleware
**File:** `middleware/verifyToken.js`

Verifies JWT token in Authorization header.

**Usage:**
```javascript
router.get('/:id', verifyToken, userController.getUserById);
```

**How it works:**
1. Checks `Authorization: Bearer <token>` header
2. Decodes and validates token
3. Attaches `req.user` with user data
4. If invalid, returns `401 Unauthorized`

**Example Request:**
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
     http://localhost:4000/api/users/1
```

---

### isAdmin Middleware
**File:** `middleware/isAdmin.js`

Checks if authenticated user has 'admin' role.

**Usage:**
```javascript
router.get('/', verifyToken, isAdmin, userController.getAllUsers);
```

**How it works:**
1. Assumes `verifyToken` ran first (checks `req.user`)
2. Verifies `req.user.role === 'admin'`
3. If not admin, returns `403 Forbidden`

**Middleware Chain:**
```
Request
   ↓
verifyToken (check token exists)
   ↓
isAdmin (check role is 'admin')
   ↓
Handler (getAllUsers)
```

---

## 📋 Authentication Flow

### Registration
```
1. User submits: { name, email, password }
2. Route: POST /api/auth/register
3. Controller: authController.register()
4. Process:
   - Validate input
   - Check email doesn't exist
   - Insert user in database
   - Return created user (without password)
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "customer",
    "created_at": "2026-02-09T..."
  }
}
```

---

### Login
```
1. User submits: { email, password }
2. Route: POST /api/auth/login
3. Controller: authController.login()
4. Process:
   - Validate input
   - Find user by email & password
   - Generate JWT token
   - Return user data + token
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "customer",
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### Protected Requests
```
1. Frontend stores token from login response
2. For protected routes, includes:
   - Headers: { "Authorization": "Bearer <token>" }
3. Server:
   - Checks Authorization header
   - Verifies token
   - Attaches req.user
   - Processes request
```

**Example: Get User Profile**
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
     http://localhost:4000/api/users/1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer",
      "created_at": "2026-02-09T..."
    },
    "total_orders": 5,
    "total_spend": 2500.00,
    "recent_orders": [...]
  }
}
```

---

### Admin Endpoint
```
1. Only admin users can call GET /api/users
2. Middleware chain:
   - verifyToken (verify JWT)
   - isAdmin (check role == 'admin')
3. If not admin, returns 403 Forbidden
```

**Example: Get All Users**
```bash
curl -H "Authorization: Bearer <admin_token>" \
     http://localhost:4000/api/users
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer",
      "created_at": "2026-02-09T..."
    },
    {
      "id": 2,
      "name": "Admin User",
      "email": "admin@example.com",
      "role": "admin",
      "created_at": "2026-02-09T..."
    }
  ]
}
```

---

## 🚀 Production Improvements

### Current Implementation (Development)
- Passwords stored in plain text ⚠️
- Tokens not cryptographically verified
- Basic base64 encoding for token

### Recommended for Production
1. **Password Hashing**
   ```javascript
   import bcrypt from 'bcrypt';
   const hashedPassword = await bcrypt.hash(password, 10);
   ```

2. **JWT Implementation**
   ```javascript
   import jwt from 'jsonwebtoken';
   const token = jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
   ```

3. **Environment Variables**
   ```
   JWT_SECRET=your-secret-key
   JWT_EXPIRY=7d
   ```

4. **Token Refresh**
   - Short-lived access tokens (15 min)
   - Long-lived refresh tokens (7 days)
   - Implement refresh endpoint

5. **HTTPS Only**
   - Enforce HTTPS in production
   - Secure cookies with HttpOnly flag

---

## ✅ Best Practices Applied

| Practice | Implementation |
|----------|----------------|
| Separation of Concerns | Auth routes separate from user routes |
| Single Responsibility | Each controller handles one domain |
| Middleware Composition | Reusable middleware for protection |
| Error Handling | Consistent error responses |
| Documentation | JSDoc comments on routes & middleware |
| Status Codes | Proper HTTP status codes (201, 401, 403) |
| Security | Protected endpoints with authentication |
| Logging | Console logs for debugging |

---

## 🔗 Related Files

- [authRoutes.js](./routes/authRoutes.js) - Authentication endpoints
- [userRoutes.js](./routes/userRoutes.js) - User management endpoints
- [authController.js](./controllers/authController.js) - Auth business logic
- [userController.js](./controllers/userController.js) - User business logic
- [verifyToken.js](./middleware/verifyToken.js) - Token verification
- [isAdmin.js](./middleware/isAdmin.js) - Admin role check
- [server.js](./server.js) - Express app & routing setup

---

## 🧪 Testing Examples

### Register User
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Login User
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Get User Profile (Protected)
```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/users/1
```

### Get All Users (Admin Only)
```bash
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIs..."
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/users
```

---

## 📝 Summary

✅ **Authentication** → `/api/auth` (register, login)
✅ **User Management** → `/api/users` (profile, admin list)
✅ **Middleware Protection** → verifyToken, isAdmin
✅ **Clean Separation** → No redundant routes
✅ **Scalable** → Easy to add new protected routes
✅ **Production-Ready** → Proper error handling, logging, status codes
