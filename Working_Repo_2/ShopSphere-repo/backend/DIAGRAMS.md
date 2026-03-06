# Architecture Diagrams

## 1️⃣ Request Flow: Public Route (Registration)

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React)                                           │
│  POST /api/auth/register                                    │
│  { name, email, password }                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  Backend (Express) - server.js                              │
│  Route: /api/auth                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  authRoutes.js                                              │
│  POST /register                                             │
│  (Public - no middleware)                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  authController.register()                                  │
│  ✓ Validate input                                           │
│  ✓ Check email exists                                       │
│  ✓ Hash password (TODO: bcrypt)                             │
│  ✓ Insert user in database                                  │
│  ✓ Return created user                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  Response (201)                                             │
│  {                                                          │
│    success: true,                                           │
│    data: { id, name, email, role, created_at }             │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2️⃣ Request Flow: Protected Route (Get User Profile)

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (React)                                            │
│  GET /api/users/1                                            │
│  Headers: { Authorization: Bearer <token> }                 │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  Backend (Express) - server.js                               │
│  Route: /api/users                                           │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  userRoutes.js                                               │
│  GET /:id                                                    │
│  Middleware chain: verifyToken                               │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  🛡️ verifyToken Middleware                                   │
│  ├─ Check: Authorization header exists                       │
│  │  └─ If missing → 401 Unauthorized                         │
│  ├─ Extract: "Bearer <token>"                                │
│  ├─ Verify: Decode token                                     │
│  │  └─ If invalid → 403 Forbidden                            │
│  └─ Attach: req.user = { userId, role }                      │
│     └─ Call: next()                                          │
└────────────────────┬─────────────────────────────────────────┘
                     │ ✓ Token valid
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  userController.getUserById()                                │
│  ✓ Query database for user                                   │
│  ✓ Query orders (delivered status)                           │
│  ✓ Calculate totals & statistics                             │
│  ✓ Return user data + stats                                  │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  Response (200)                                              │
│  {                                                           │
│    success: true,                                            │
│    data: {                                                   │
│      user: { id, name, email, role, created_at },            │
│      total_orders: 5,                                        │
│      total_spend: 2500.00,                                   │
│      recent_orders: [...]                                    │
│    }                                                         │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 3️⃣ Request Flow: Admin-Only Route (Get All Users)

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (React)                                            │
│  GET /api/users                                              │
│  Headers: { Authorization: Bearer <admin_token> }            │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  Backend (Express) - server.js                               │
│  Route: /api/users                                           │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  userRoutes.js                                               │
│  GET /                                                       │
│  Middleware chain: verifyToken → isAdmin                      │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  1️⃣ 🛡️ verifyToken Middleware                                │
│  ├─ Check: Authorization header exists                       │
│  ├─ Verify: Decode token                                     │
│  ├─ Attach: req.user = { userId, role }                      │
│  └─ Call: next()                                             │
└────────────────────┬─────────────────────────────────────────┘
                     │ ✓ Token valid
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  2️⃣ 🛡️ isAdmin Middleware                                     │
│  ├─ Check: req.user exists                                   │
│  │  └─ If missing → 401 Unauthorized                         │
│  ├─ Check: req.user.role === 'admin'                         │
│  │  └─ If not admin → 403 Forbidden                          │
│  └─ Call: next()                                             │
└────────────────────┬─────────────────────────────────────────┘
                     │ ✓ User is admin
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  userController.getAllUsers()                                │
│  ✓ Query all users from database                             │
│  ✓ Return user list (no passwords)                           │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  Response (200)                                              │
│  {                                                           │
│    success: true,                                            │
│    data: [                                                   │
│      { id: 1, name, email, role, created_at },               │
│      { id: 2, name, email, role, created_at },               │
│      ...                                                     │
│    ]                                                         │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 4️⃣ Middleware Chain Architecture

```
ALL REQUESTS
    │
    ├─→ Public Routes (authRoutes)
    │   ├─ POST /register → No middleware → Controller
    │   └─ POST /login    → No middleware → Controller
    │
    └─→ Protected Routes (userRoutes)
        │
        ├─→ GET /:id → verifyToken → Controller
        │   │
        │   └─ Middleware validates JWT
        │      └─ Sets req.user
        │
        └─→ GET / → verifyToken → isAdmin → Controller
            │
            ├─ First middleware validates JWT
            │  └─ Sets req.user
            │
            └─ Second middleware checks role
               └─ Verifies req.user.role === 'admin'
```

---

## 5️⃣ Error Flow: Missing Token

```
Request: GET /api/users/1
         (No Authorization header)
    │
    ↓
verifyToken Middleware
    │
    ├─ Check: Authorization header
    │  └─ NOT FOUND ❌
    │
    ↓
Return 401 Unauthorized
{
  success: false,
  message: "Access denied. No token provided."
}
```

---

## 6️⃣ Error Flow: Invalid Token

```
Request: GET /api/users/1
         Headers: { Authorization: Bearer invalid_token }
    │
    ↓
verifyToken Middleware
    │
    ├─ Check: Header exists ✓
    │
    ├─ Extract: "invalid_token"
    │
    ├─ Verify: Decode token
    │  └─ FAILED ❌
    │
    ↓
Return 403 Forbidden
{
  success: false,
  message: "Invalid or expired token"
}
```

---

## 7️⃣ Error Flow: Not Admin

```
Request: GET /api/users
         Headers: { Authorization: Bearer customer_token }
         req.user = { userId: 5, role: "customer" }
    │
    ↓
verifyToken Middleware
    │
    ├─ Check: Header exists ✓
    ├─ Verify: Token valid ✓
    ├─ Attach: req.user ✓
    └─ Call: next() ✓
    │
    ↓
isAdmin Middleware
    │
    ├─ Check: req.user exists ✓
    │
    ├─ Check: req.user.role === 'admin'
    │  └─ FAILED ❌ (is "customer")
    │
    ↓
Return 403 Forbidden
{
  success: false,
  message: "Forbidden: Admin access required"
}
```

---

## 8️⃣ Complete Middleware Composition Pattern

```
router.METHOD(path, middleware1, middleware2, ..., handler)

Examples:

Public:
  router.post('/register', register)

Protected:
  router.get('/:id', verifyToken, getUserById)

Admin Only:
  router.get('/', verifyToken, isAdmin, getAllUsers)

Extendable:
  router.delete('/:id', verifyToken, isAdmin, deleteUser)
  router.put('/:id', verifyToken, updateUser)
  router.patch('/password', verifyToken, changePassword)
```

---

## 9️⃣ File Dependencies

```
server.js
├─ routes/authRoutes.js
│  └─ controllers/authController.js
│     └─ config/db.js
│
└─ routes/userRoutes.js
   ├─ middleware/verifyToken.js
   ├─ middleware/isAdmin.js
   ├─ controllers/userController.js
   │  └─ config/db.js
   │
   └─ (other route files...)
```

---

## 🔟 Status Code Reference

```
┌─────────┬─────────────────────────┬──────────────────────────┐
│ Status  │ Scenario                │ Message                  │
├─────────┼─────────────────────────┼──────────────────────────┤
│ 200 OK  │ Success                 │ "Login successful"       │
│ 201     │ Created                 │ "User registered"        │
│ 400     │ Bad request             │ "Email is required"      │
│ 401     │ No token                │ "No token provided"      │
│ 403     │ Invalid token/not admin │ "Forbidden"              │
│ 404     │ Not found               │ "User not found"         │
│ 409     │ Email exists            │ "Email already exists"   │
│ 500     │ Server error            │ "Server error"           │
└─────────┴─────────────────────────┴──────────────────────────┘
```

---

## Summary

✓ Public routes (auth) = No middleware
✓ Protected routes (user) = verifyToken middleware
✓ Admin routes = verifyToken + isAdmin middleware
✓ Clean separation = Easy to extend
✓ Reusable middleware = No code duplication
