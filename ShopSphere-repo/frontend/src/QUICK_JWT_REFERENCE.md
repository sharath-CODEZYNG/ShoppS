# 🎯 JWT Frontend Integration - Quick Reference

## ✅ What's Working Now

```
User → Login → Token stored → Request with token → Protected data
```

---

## 📦 Files Created/Updated

### New File
```
✨ src/utils/axiosInstance.js
   └── Axios with JWT interceptors
```

### Updated Files
```
✏️  src/services/authAPI.js
    └── Stores token on login

✏️  src/pages/Login.jsx
    └── Saves token to localStorage

✏️  src/services/adminAPI.js
    └── Uses axiosInstance (auto token injection)

✏️  src/admin/AdminUsers.jsx
    └── Error handling + auth checks
```

---

## 🔧 How Token Flow Works

### 1. Login
```javascript
// User credentials → Backend
POST /api/auth/login
Body: { email, password }

Response:
{
  "success": true,
  "data": {
    "user": { id, name, email, role },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Store Token
```javascript
// authAPI.js automatically stores:
localStorage.setItem('token', response.data.token)
localStorage.setItem('user', JSON.stringify(response.data.user))
```

### 3. Use Token
```javascript
// axiosInstance.js automatically injects:
headers.Authorization = `Bearer ${localStorage.getItem('token')}`
```

### 4. Protected Request
```javascript
// Any API call with axiosInstance:
api.get('/api/users')  // Token included automatically
```

---

## 🧪 Test Right Now

### 1. Login in Browser
```
http://localhost:5173/login
Email: admin@test.com
Password: password123
```

### 2. Check localStorage
```javascript
// In browser console:
localStorage.getItem('token')     // Should exist
localStorage.getItem('user')      // Should be { "id": 1, ... }
```

### 3. Go to Admin Page
```
http://localhost:5173/admin/users
Should show users list
```

### 4. Check Network Request
```
DevTools → Network → Click any /api/ request
Headers → Authorization: Bearer eyJ...
Should see token in header
```

---

## 🔐 Error Codes

| Code | Cause | Fix |
|------|-------|-----|
| **401** | Token missing/invalid/expired | Clear localStorage, redirect to login |
| **403** | User not admin | Login with admin account |
| **404** | Route not found | Check backend routes exist |
| **500** | Server error | Check backend logs |

---

## 📊 localStorage Keys

```javascript
localStorage.getItem('token')
// Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

localStorage.getItem('user')
// Returns: "{ "id": 1, "name": "Admin", "email": "admin@test.com", "role": "admin" }"
```

---

## 🚀 Common Patterns

### Check if Logged In
```javascript
const user = JSON.parse(localStorage.getItem('user') || 'null')
if (!user) {
  navigate('/login')
}
```

### Check if Admin
```javascript
const user = JSON.parse(localStorage.getItem('user') || 'null')
if (!user || user.role !== 'admin') {
  navigate('/login')
}
```

### Make Protected API Call
```javascript
import api from '../utils/axiosInstance'

const response = await api.get('/api/users')
// Token automatically included!
```

### Handle Logout
```javascript
import { authAPI } from '../services/authAPI'

authAPI.logout()  // Clears all localStorage
navigate('/login')
```

---

## ⚙️ How Interceptors Work

### Request Interceptor
```javascript
// Runs BEFORE every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

### Response Interceptor
```javascript
// Runs AFTER every response
api.interceptors.response.use(
  (response) => response,  // Success
  (error) => {
    if (error.response?.status === 401) {
      // Token expired
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

---

## 🎯 Admin Users Flow

```
1. Visit http://localhost:5173/admin/users
   ↓
2. AdminUsers.jsx checks:
   - Token in localStorage? 
   - User.role === 'admin'?
   ↓
3. If yes: Fetch and display users
   If no: Show "Access Denied" or redirect
   ↓
4. api.get('/api/users')
   ↓
5. axiosInstance adds: Authorization: Bearer <token>
   ↓
6. Backend verifyToken + isAdmin middleware
   ↓
7. Returns users list or 401/403 error
```

---

## 🧠 Remember

| What | Where | How |
|------|-------|-----|
| **Store Token** | localStorage after login | `localStorage.setItem('token', ...)` |
| **Send Token** | Every API request | axiosInstance interceptor |
| **Check Role** | Before showing admin content | `user.role === 'admin'` |
| **Handle 401** | Response interceptor | Redirect to /login |
| **Handle 403** | Component error handling | Show "Access Denied" |

---

## ✨ You're Done!

- ✅ Token stored properly
- ✅ Token sent automatically
- ✅ Role-based protection
- ✅ Error handling
- ✅ Admin access control

**Now test it in your browser!** 🚀

---

**Date:** February 9, 2026  
**Status:** ✅ Complete
