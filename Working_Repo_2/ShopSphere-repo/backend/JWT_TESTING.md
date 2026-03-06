# JWT Testing Guide

Quick reference for testing JWT authentication and authorization.

---

## 🚀 Quick Start

### 1. Register User
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Response (201):**
```json
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

---

### 2. Login User
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Response (200):**
```json
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

**Save the token:**
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 3. Test Protected Route (With Token)
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/users/1
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "customer"
    },
    "total_orders": 0,
    "total_spend": 0,
    "recent_orders": []
  }
}
```

---

## 🧪 Error Test Cases

### Test: Missing Token
```bash
curl http://localhost:4000/api/users/1
```

**Response (401):**
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

---

### Test: Invalid Token
```bash
curl -H "Authorization: Bearer invalid_token_123" \
  http://localhost:4000/api/users/1
```

**Response (401):**
```json
{
  "success": false,
  "message": "Invalid token."
}
```

---

### Test: Wrong Token Format
```bash
curl -H "Authorization: invalid_header_format" \
  http://localhost:4000/api/users/1
```

**Response (401):**
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

---

### Test: Admin Route with Customer Token
```bash
CUSTOMER_TOKEN="<token_from_customer_login>"

curl -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  http://localhost:4000/api/users
```

**Response (403):**
```json
{
  "success": false,
  "message": "Forbidden: Admin access required"
}
```

---

## 👨‍💼 Admin Testing

### Create Admin User (Direct DB)

For testing, create an admin user manually:

```bash
# Using mysql command line
mysql ecommerce_db -u shop_user -pshop123

INSERT INTO users (name, email, password, role, created_at) 
VALUES ('Admin User', 'admin@example.com', 'admin123', 'admin', NOW());
```

### Login as Admin
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

### Use Admin Token
```bash
ADMIN_TOKEN="<admin_token_from_login>"

# Admin can list all users
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/api/users

# Response (200)
{
  "success": true,
  "data": [
    { "id": 1, "name": "John Doe", "email": "john@example.com", "role": "customer" },
    { "id": 2, "name": "Admin User", "email": "admin@example.com", "role": "admin" }
  ]
}
```

---

## 🔍 Token Analysis

### Decode JWT Token

Use online tool or command line:

```bash
# Install jwt-cli or use online tool at https://jwt.io

# Token structure: header.payload.signature
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImN1c3RvbWVyIiwiaWF0IjoxNzA3NTQyNDAwLCJleHAiOjE3MDc2Mjg4MDB9.abc123xyz"

# Parts:
# 1. Header: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
#    Decodes to: {"alg":"HS256","typ":"JWT"}
#
# 2. Payload: eyJpZCI6MSwicm9sZSI6ImN1c3RvbWVyIiwiaWF0IjoxNzA3NTQyNDAwLCJleHAiOjE3MDc2Mjg4MDB9
#    Decodes to: {"id":1,"role":"customer","iat":1707542400,"exp":1707628800}
#
# 3. Signature: abc123xyz
#    Verified using: HMACSHA256(base64(header) + "." + base64(payload), JWT_SECRET)
```

---

## 📊 Test Scenarios Checklist

### Authentication
- [ ] Register new user → 201 Created
- [ ] Login with correct credentials → 200 OK + token
- [ ] Login with wrong password → 401 Unauthorized
- [ ] Login with non-existent email → 401 Unauthorized

### Protected Routes
- [ ] Access with valid token → 200 OK
- [ ] Access without token → 401 Unauthorized
- [ ] Access with invalid token → 401 Unauthorized
- [ ] Access with malformed header → 401 Unauthorized

### Admin Routes
- [ ] Admin access with admin token → 200 OK
- [ ] Customer access with customer token → 403 Forbidden
- [ ] Access without token → 401 Unauthorized

---

## 🛠️ Debugging

### Check Token Payload
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."

# Extract payload (middle part)
PAYLOAD=$(echo $TOKEN | cut -d'.' -f2)

# Base64 decode
echo $PAYLOAD | base64 -d | jq .
```

### Check Headers
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."

# See all response headers
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/users/1
```

### Check Backend Logs
```bash
# Look for JWT verification messages
tail -f server.log | grep -i "token\|auth"
```

---

## ⏰ Token Expiry Testing

### Wait for Token to Expire
```bash
# Token expires in 1 day
# To test expiry, you can:

# Option 1: Manually edit .env to set JWT_EXPIRY=1s (1 second)
# Wait 2 seconds, then try using token

# Option 2: Check token expiry time
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
PAYLOAD=$(echo $TOKEN | cut -d'.' -f2)
echo $PAYLOAD | base64 -d | jq .exp

# exp is timestamp in seconds since epoch
# If current time > exp, token is expired
```

---

## 📋 Complete Test Script

```bash
#!/bin/bash

API="http://localhost:4000"

echo "=== 1. Register ==="
curl -X POST $API/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"test123"}' | jq .

echo -e "\n=== 2. Login ==="
RESPONSE=$(curl -s -X POST $API/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}')

echo $RESPONSE | jq .

TOKEN=$(echo $RESPONSE | jq -r '.data.token')
echo "Token: $TOKEN"

echo -e "\n=== 3. Protected Route (with token) ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  $API/api/users/1 | jq .

echo -e "\n=== 4. Protected Route (without token) ==="
curl -s $API/api/users/1 | jq .

echo -e "\n=== 5. Invalid Token ==="
curl -s -H "Authorization: Bearer invalid" \
  $API/api/users/1 | jq .
```

---

## 🎯 Key Testing Points

1. **Token Format:** `Authorization: Bearer <token>`
2. **Status Codes:** 401 (no/invalid token), 403 (insufficient permissions)
3. **Token Payload:** Contains id, email, role
4. **Expiry:** Token expires after 1 day
5. **Middleware Chain:** verifyToken must run before isAdmin

---

**Last Updated:** 2026-02-09  
**Status:** ✅ Ready to Test
