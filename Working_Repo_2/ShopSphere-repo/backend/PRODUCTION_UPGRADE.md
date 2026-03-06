# Production-Ready Middleware & Controllers

> This document shows how to upgrade to real JWT tokens and bcrypt password hashing

---

## 📦 Required Packages

```bash
npm install bcrypt jsonwebtoken dotenv
```

---

## 📝 .env Configuration

Create `.env` file in backend root:

```env
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRY=7d
BCRYPT_ROUNDS=10
```

---

## 🛡️ Production-Ready: verifyToken.js

```javascript
/**
 * JWT Token Verification Middleware (Production)
 * 
 * Verifies JWT tokens with cryptographic validation
 * Uses jsonwebtoken library for secure token handling
 */

import jwt from 'jsonwebtoken';

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  // Check if Authorization header exists
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // Verify token using JWT secret (cryptographically secure)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach decoded user info to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email
    };
    
    next();
  } catch (err) {
    // Handle different JWT errors
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    console.error('[Auth] Token verification failed:', err.message);
    return res.status(403).json({
      success: false,
      message: 'Token verification failed.'
    });
  }
}

export default verifyToken;
```

---

## 👤 Production-Ready: authController.js

```javascript
/**
 * Authentication Controller (Production)
 * 
 * Handles user registration and login with:
 * - Bcrypt password hashing
 * - JWT token generation
 * - Token expiration
 * - Comprehensive validation
 */

import pool from '../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

/**
 * POST /api/auth/register
 * Register a new user with secure password hashing
 */
export async function register(req, res) {
  const { name, email, password, passwordConfirm } = req.body;

  // Validation: required fields
  if (!name || !email || !password || !passwordConfirm) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  // Validation: email format
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    });
  }

  // Validation: password strength
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters'
    });
  }

  // Validation: password match
  if (password !== passwordConfirm) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match'
    });
  }

  try {
    const connection = await pool.getConnection();

    // Check if email already exists
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existingUsers.length > 0) {
      await connection.release();
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Hash password using bcrypt
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || 10));

    // Insert user with hashed password
    const [result] = await connection.query(
      'INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())',
      [name, email.toLowerCase(), hashedPassword, 'customer']
    );

    const userId = result.insertId;

    // Fetch created user
    const [newUsers] = await connection.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [userId]
    );

    await connection.release();

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: newUsers[0]
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
}

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
export async function login(req, res) {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  try {
    const connection = await pool.getConnection();

    // Find user by email
    const [users] = await connection.query(
      'SELECT id, name, email, password, role FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    await connection.release();

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Compare password with hash using bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRY || '7d'
      }
    );

    // Return user data with token (NOT password)
    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: token,
        expiresIn: process.env.JWT_EXPIRY || '7d'
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
}
```

---

## 📋 Comparison: Development vs Production

### Development (Current)
```javascript
// Token: Base64 encoded, not cryptographically verified
const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

// Password: Plain text stored in database
'INSERT INTO users (password) VALUES (?, [plainPassword])'
```

### Production (Recommended)
```javascript
// Token: Cryptographically signed and verified with secret
const decoded = jwt.verify(token, process.env.JWT_SECRET);

// Password: Bcrypt hashed (one-way function)
const hashedPassword = await bcrypt.hash(password, 10);
const match = await bcrypt.compare(inputPassword, hashedPassword);
```

---

## 🔐 Security Benefits

| Aspect | Dev | Production |
|--------|-----|-----------|
| Token Forgery | ⚠️ Can be faked | ✅ Cryptographically prevented |
| Token Expiry | ⚠️ No expiration | ✅ Auto-expires (7 days) |
| Password Storage | ⚠️ Plain text | ✅ One-way hash (bcrypt) |
| Rainbow Tables | ⚠️ Vulnerable | ✅ Salted hashes prevent |
| Timing Attacks | ⚠️ No protection | ✅ Constant-time comparison |

---

## 🚀 Implementation Steps

### Step 1: Install Dependencies
```bash
npm install bcrypt jsonwebtoken
```

### Step 2: Create .env
```
JWT_SECRET=your-super-secret-key-min-32-chars-recommended
JWT_EXPIRY=7d
BCRYPT_ROUNDS=10
```

### Step 3: Replace verifyToken.js
- Copy production version above
- Use `jwt.verify()` instead of manual decode

### Step 4: Replace authController.js
- Copy production version above
- Use `bcrypt.hash()` for registration
- Use `bcrypt.compare()` for login
- Generate JWT tokens with expiry

### Step 5: Test
```bash
# Register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@test.com","password":"Pass123!","passwordConfirm":"Pass123!"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@test.com","password":"Pass123!"}'
```

---

## 📊 Token Structure

### Development Token
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJjdXN0b21lciJ9.abc123...
                                        │                                            │
                                        └─ Payload (Base64, not verified)            └─ Signature
```

### Production Token
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTcwNjM3NjAwMCwiZXhwIjoxNzA3NzU2MDAwfQ.verified_signature_using_secret
                                        │                                                                                                      │
                                        └─ Payload (Base64 + claims: iat, exp)                                                               └─ HMACSHA256(secret)
```

---

## 🔑 JWT Payload (Production)

```javascript
{
  userId: 1,                    // User ID
  email: "john@example.com",    // User email
  role: "customer",             // User role
  iat: 1706376000,              // Issued at (timestamp)
  exp: 1707756000               // Expires at (7 days later)
}
```

When expired, `jwt.verify()` automatically rejects:
```javascript
throw new TokenExpiredError('jwt expired');
```

---

## 🛡️ Password Hashing Flow

### Registration
```
Input Password: "MyPassword123"
                    ↓
         bcrypt.hash(password, 10)
                    ↓
Hashed Output: "$2b$10$JKL3jk4...ajsd9Lk.." (62 chars)
                    ↓
         Store in database
```

### Login
```
Input Password: "MyPassword123"
Stored Hash: "$2b$10$JKL3jk4...ajsd9Lk.."
                    ↓
bcrypt.compare(inputPassword, storedHash)
                    ↓
Result: true/false
```

**Key Point:** bcrypt uses salt internally - same password produces different hashes!

---

## 🔄 Complete Login Flow (Production)

```
1. User submits: { email, password }

2. Database query: Find user by email

3. Check password: bcrypt.compare(inputPassword, storedHash)
   └─ If false → 401 Unauthorized

4. Generate JWT token:
   jwt.sign({ userId, role }, secret, { expiresIn: '7d' })

5. Return token to frontend

6. Frontend stores: localStorage.setItem('token', token)

7. For protected requests:
   Headers: { Authorization: Bearer <token> }

8. Server verifies: jwt.verify(token, secret)
   └─ If expired or invalid → 403 Forbidden

9. Extract user data from decoded token

10. Process request with authenticated context
```

---

## ✅ Checklist: Development to Production

- [ ] Install bcrypt and jsonwebtoken
- [ ] Create .env with JWT_SECRET, JWT_EXPIRY, BCRYPT_ROUNDS
- [ ] Update verifyToken.js to use jwt.verify()
- [ ] Update authController register() with bcrypt.hash()
- [ ] Update authController login() with bcrypt.compare()
- [ ] Update authController login() to generate JWT
- [ ] Test registration with hashing
- [ ] Test login with token generation
- [ ] Test protected routes with token validation
- [ ] Test token expiration
- [ ] Set strong JWT_SECRET (minimum 32 characters)
- [ ] Use HTTPS in production
- [ ] Set secure cookies (HttpOnly, SameSite, Secure)

---

## 🚨 Security Notes

### Never commit .env
```bash
# .gitignore
.env
.env.local
```

### Minimum JWT_SECRET length
```
Good:   "your-32-character-minimum-secret!"
Bad:    "short"
```

### Use HTTPS in production
```javascript
// Production middleware (optional)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});
```

### Secure cookie options
```javascript
// If using cookies instead of headers
res.cookie('token', token, {
  httpOnly: true,      // Not accessible via JavaScript
  secure: true,        // HTTPS only
  sameSite: 'strict',  // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
});
```

---

## 📞 Production Upgrade Timeline

**Phase 1 (Now):** Current development setup working
**Phase 2 (Week 1):** Add bcrypt and JWT
**Phase 3 (Week 2):** Deploy with HTTPS
**Phase 4 (Week 3):** Add refresh tokens
**Phase 5 (Week 4):** Add OAuth (optional)

Your refactored route structure makes this upgrade **seamless**! ✨
