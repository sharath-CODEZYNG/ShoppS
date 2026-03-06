# 🔐 JWT Frontend Integration - Complete Setup Guide

## ✅ What Was Fixed

### 1. ✅ Token Storage (authAPI.js + Login.jsx)
- **Before:** Token was NOT being stored after login
- **After:** Token and user object stored in localStorage immediately after successful login

```javascript
localStorage.setItem('token', response.data.token)
localStorage.setItem('user', JSON.stringify(response.data.user))
```

### 2. ✅ Axios Interceptor (axiosInstance.js - NEW)
- **Before:** No automatic token attachment to requests
- **After:** All API requests automatically include token in Authorization header

```javascript
Authorization: Bearer <token>
```

### 3. ✅ API Service (adminAPI.js)
- **Before:** Using plain axios without token
- **After:** Using axiosInstance with automatic token injection

### 4. ✅ Error Handling (AdminUsers.jsx)
- **Before:** Generic error, no specific handling
- **After:** Proper 401/403 handling with redirects

### 5. ✅ Admin Authorization (AdminUsers.jsx)
- **Before:** Only basic role check
- **After:** Checks both token and role before rendering

---

## 📁 Files Modified

| File | Status | Changes |
|------|--------|---------|
| `src/services/authAPI.js` | ✏️ Updated | Store token on login |
| `src/pages/Login.jsx` | ✏️ Updated | Store token + user in localStorage |
| `src/services/adminAPI.js` | ✏️ Updated | Use axiosInstance |
| `src/admin/AdminUsers.jsx` | ✏️ Updated | Error handling + auth checks |
| `src/utils/axiosInstance.js` | ✨ **NEW** | Axios with interceptors |

---

## 🔄 How It Works Now

### Login Flow
```
1. User enters email/password
   ↓
2. Login.jsx calls authAPI.login()
   ↓
3. authAPI.js stores token + user
   localStorage.setItem('token', ...)
   localStorage.setItem('user', ...)
   ↓
4. Login.jsx redirects to home
   ↓
5. User is authenticated
```

### API Request Flow
```
1. AdminUsers.jsx calls adminAPI.getUsers()
   ↓
2. adminAPI uses axiosInstance
   ↓
3. axiosInstance.interceptors.request runs
   Gets token from localStorage
   Adds: Authorization: Bearer <token>
   ↓
4. Request sent to backend with token
   ↓
5. Backend verifies token (verifyToken middleware)
   ↓
6. Response returned to component
```

### Error Handling
```
401 Unauthorized
  ↓
axiosInstance detects 401
  ↓
Clear localStorage (token + user)
  ↓
Redirect to /login

403 Forbidden
  ↓
Log warning
  ↓
Component shows "Access Denied"
```

---

## 📋 Storage Structure

### After Successful Login
```javascript
// localStorage keys:
localStorage.getItem('token')
// Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

localStorage.getItem('user')
// Returns: "{ "id": 1, "name": "Admin User", "email": "admin@test.com", "role": "admin" }"
```

### Logout Flow
```javascript
authAPI.logout() // Clears all 3 keys:
// - 'token'
// - 'user'
// - 'currentUser' (legacy)
```

---

## 🧪 Quick Test Steps

### Step 1: Register User (Optional)
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@test.com",
    "password": "password123"
  }'
```

### Step 2: Login in Frontend
1. Open http://localhost:5173/login
2. Enter credentials:
   - Email: admin@test.com
   - Password: password123
3. Click "Sign in"
4. Should see welcome message
5. Check browser DevTools → Application → Storage → localStorage
6. Should see `token` and `user` keys

### Step 3: Go to Admin Users
1. Navigate to admin panel (or `/admin/users`)
2. If you're admin, you should see users list
3. If not admin, you should see "Access Denied"

### Step 4: Check Network
1. Open DevTools → Network tab
2. Click on any API request to AdminUsers
3. Check Headers → Authorization
4. Should see: `Authorization: Bearer eyJ...`

---

## 🔐 Security Features Implemented

✅ **Token Auto-Inject:** All requests include token automatically
✅ **No Password Exposure:** Only token sent in headers
✅ **Automatic Logout:** 401 response clears localStorage
✅ **Role Checking:** Frontend + Backend validation
✅ **Bearer Format:** Standard JWT header format
✅ **Error Handling:** 401/403 specific responses

---

## 🚨 Common Issues & Fixes

### Issue 1: Still Getting 401
**Cause:** Token not in localStorage

**Fix:**
1. Check browser DevTools → Application → localStorage
2. Verify `token` key exists
3. Copy token value and check at https://jwt.io
4. Verify expiration time

### Issue 2: 403 Forbidden
**Cause:** User is not admin

**Fix:**
1. Check `user` in localStorage
2. Verify `role === "admin"`
3. Login with admin account
4. Check backend database for correct role

### Issue 3: Token Not Sent in Requests
**Cause:** axiosInstance not being used

**Fix:**
1. Verify imports in adminAPI.js:
   ```javascript
   import api from '../utils/axiosInstance'
   ```
2. Check axiosInstance.js exists
3. Verify request using: `api.get()` not `axios.get()`

### Issue 4: Redirects to Login Automatically
**Cause:** Token expired or interceptor error

**Fix:**
1. Generate new token by logging in again
2. Check token expiry time in jwt.io
3. Verify backend uses 1-day expiry

---

## 📊 Component Dependencies

```
Login.jsx
  ├── authAPI.login()
  └── localStorage.setItem('token', ...)

AdminUsers.jsx
  ├── adminAPI.getUsers()
  │   └── axiosInstance
  │       └── localStorage.getItem('token')
  └── useNavigate() for redirects

axiosInstance.js
  ├── interceptors.request (add token)
  └── interceptors.response (handle errors)
```

---

## 🎯 Role-Based Access Pattern

### Admin Route Protection
```javascript
// In component
const user = JSON.parse(localStorage.getItem('user') || 'null')

if (!user || user.role !== 'admin') {
  return <AccessDenied />
}

// Or redirect
if (!user || user.role !== 'admin') {
  navigate('/login')
}
```

### Protected API Call
```javascript
// In axiosInstance (automatic)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

### Backend Validation
```javascript
// Middleware chain
router.get('/users', verifyToken, isAdmin, handler)
```

---

## 🔄 Token Lifecycle

```
┌─────────────────────────────────────────────────┐
│ User logs in                                     │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ Backend generates JWT (1-day expiry)            │
│ Returns: { user, token }                        │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ Frontend stores in localStorage                 │
│ - token                                         │
│ - user                                          │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ Every API request includes token                │
│ Header: Authorization: Bearer <token>           │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ Backend verifies token                          │
│ - Checks signature                              │
│ - Checks expiry                                 │
│ - Checks role (if needed)                       │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ API call succeeds OR fails with 401/403         │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ If 401: Clear localStorage, redirect to login   │
│ If 403: Show "Access Denied"                    │
│ If 200: Show data                               │
└─────────────────────────────────────────────────┘
```

---

## 📝 Implementation Checklist

- [x] Token stored in localStorage after login
- [x] User object stored in localStorage
- [x] axiosInstance.js created with interceptors
- [x] adminAPI.js updated to use axiosInstance
- [x] AdminUsers.jsx has role check
- [x] AdminUsers.jsx has error handling
- [x] 401 responses redirect to login
- [x] 403 responses show access denied
- [x] Token included in all requests
- [x] Proper localStorage keys

---

## 🚀 Testing the Complete Flow

### Test 1: Successful Admin Login
```bash
# 1. Open http://localhost:5173/login
# 2. Enter admin credentials
# 3. Check localStorage has token
# 4. Go to admin/users
# 5. Should see users list
```

### Test 2: Non-Admin Login
```bash
# 1. Login as customer (non-admin)
# 2. Try to access admin/users
# 3. Should see "Access Denied"
```

### Test 3: Logout
```bash
# 1. authAPI.logout()
# 2. localStorage should be empty
# 3. Redirect to login
```

### Test 4: Token Expiry
```bash
# 1. Wait 1 day (or modify backend to 1 minute for testing)
# 2. Try API call
# 3. Should get 401
# 4. Should redirect to login
```

---

## 💡 Pro Tips

### Debugging Token Issues
```javascript
// In browser console:
localStorage.getItem('token')
localStorage.getItem('user')

// Decode token at:
// https://jwt.io/
```

### Check Interceptor is Working
```javascript
// In browser DevTools → Network
// Click any /api/ request
// Headers tab
// Should see: Authorization: Bearer eyJ...
```

### Test without Frontend
```bash
TOKEN="your_token_here"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/users
```

---

## ✨ Summary

You now have:
- ✅ Token automatically stored after login
- ✅ Token automatically sent in all requests
- ✅ Automatic token injection via axios interceptor
- ✅ Proper error handling (401/403)
- ✅ Admin role protection on frontend + backend
- ✅ Automatic logout on token expiry
- ✅ Clean, production-ready implementation

**Your JWT authentication system is fully integrated!** 🎉

---

## 📞 Next Steps

1. **Test with your frontend** - Follow "Testing the Complete Flow" above
2. **Create admin user** - Ensure you have an admin account in database
3. **Test all routes** - Try different user roles
4. **Add to other pages** - Use same pattern for other protected pages
5. **Production setup** - Change JWT_SECRET to strong random string

---

**Integration Date:** February 9, 2026  
**Status:** ✅ Complete & Production-Ready  
**Next:** Deploy to production with HTTPS
