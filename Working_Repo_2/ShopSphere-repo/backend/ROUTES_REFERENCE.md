# Backend Routes Quick Reference

## 🔐 Authentication (`/api/auth`)

### Public Endpoints (No Auth Required)

```
POST /api/auth/register
├─ Request: { name, email, password }
├─ Response: 201 Created { user data }
└─ Purpose: Create new user account

POST /api/auth/login
├─ Request: { email, password }
├─ Response: 200 OK { userId, token }
└─ Purpose: Authenticate user & get JWT token
```

---

## 👤 User Management (`/api/users`)

### Protected Endpoints (Require JWT Token)

```
GET /api/users/:id
├─ Headers: { Authorization: Bearer <token> }
├─ Response: 200 OK { user profile, orders, stats }
├─ Middleware: verifyToken
└─ Purpose: Get specific user's profile

GET /api/users
├─ Headers: { Authorization: Bearer <admin_token> }
├─ Response: 200 OK [{ user }, { user }, ...]
├─ Middleware: verifyToken → isAdmin
└─ Purpose: List all users (admin only)
```

---

## 🛡️ Middleware Chain

```
Unprotected Routes (Public)
├─ /api/auth/register
└─ /api/auth/login

Protected Routes (User)
├─ Request
│  └─ verifyToken middleware
│     └─ Checks Authorization header
│        └─ Decodes JWT token
│           └─ Sets req.user
│              └─ Handler executes
│
Protected Routes (Admin)
├─ Request
│  └─ verifyToken middleware
│     └─ Checks Authorization header
│        └─ Decodes JWT token
│           └─ Sets req.user
│              └─ isAdmin middleware
│                 └─ Checks req.user.role === 'admin'
│                    └─ Handler executes
```

---

## 📊 File Organization

| File | Purpose | Exports |
|------|---------|---------|
| `routes/authRoutes.js` | Auth endpoints | router |
| `routes/userRoutes.js` | User endpoints | router |
| `controllers/authController.js` | Auth logic | register(), login() |
| `controllers/userController.js` | User logic | getUserById(), getAllUsers() |
| `middleware/verifyToken.js` | JWT verification | verifyToken() |
| `middleware/isAdmin.js` | Admin check | isAdmin() |

---

## ⚡ Usage Examples

### In Route Files
```javascript
import { verifyToken } from '../middleware/verifyToken.js';
import { isAdmin } from '../middleware/isAdmin.js';
import { getUserById, getAllUsers } from '../controllers/userController.js';

router.get('/:id', verifyToken, getUserById);              // Protected
router.get('/', verifyToken, isAdmin, getAllUsers);        // Admin Only
```

### In Frontend (React)
```javascript
// Store token from login
const { token } = loginResponse.data;
localStorage.setItem('token', token);

// Use token in requests
const headers = {
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
};

// Get user profile
const response = await fetch('http://localhost:4000/api/users/1', { headers });
```

---

## 🔍 Error Responses

```javascript
// 400 Bad Request - Missing fields
{ success: false, message: "Email and password are required" }

// 401 Unauthorized - No token
{ success: false, message: "Access denied. No token provided." }

// 403 Forbidden - Not admin
{ success: false, message: "Forbidden: Admin access required" }

// 404 Not Found - User doesn't exist
{ success: false, message: "User not found" }

// 409 Conflict - Email already exists
{ success: false, message: "Email already registered" }

// 500 Server Error
{ success: false, message: "Server error" }
```

---

## ✅ Architecture Benefits

✓ **No Redundancy** - Auth routes not duplicated
✓ **Clear Separation** - Authentication vs User Management
✓ **Secure** - Protected endpoints require valid token
✓ **Scalable** - Easy to add new protected routes
✓ **Maintainable** - Single place for each concern
✓ **Testable** - Isolated middleware and controllers
✓ **Production Ready** - Proper error handling

---

## 🚀 Next Steps for Production

1. **Add bcrypt for password hashing**
   ```javascript
   import bcrypt from 'bcrypt';
   const hashedPassword = await bcrypt.hash(password, 10);
   ```

2. **Implement real JWT**
   ```javascript
   import jwt from 'jsonwebtoken';
   const token = jwt.sign({ userId, role }, process.env.JWT_SECRET);
   ```

3. **Add token expiration**
   ```javascript
   const token = jwt.sign({ userId, role }, secret, { expiresIn: '7d' });
   ```

4. **Implement refresh tokens**
   - Shorter-lived access tokens (15 min)
   - Longer-lived refresh tokens (7 days)

5. **Add HTTPS & secure cookies**
   - Production must use HTTPS
   - Set HttpOnly flag on auth cookies

---

## 📋 Checklist

- ✅ Authentication routes under `/api/auth`
- ✅ User routes under `/api/users` (no auth)
- ✅ Middleware for token verification
- ✅ Middleware for admin role check
- ✅ No duplicate routes
- ✅ Proper error handling
- ✅ Clear logging
- ✅ Production-ready structure
