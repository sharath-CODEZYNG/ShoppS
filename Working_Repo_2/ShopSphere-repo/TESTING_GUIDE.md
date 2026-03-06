# QUICK TEST GUIDE - Cart Synchronization Fix

## Before You Start
1. Ensure you're logged in with a real database user
2. Open DevTools: `F12` → Network tab
3. Make sure backend is running: `npm start` (in `/backend`)
4. Make sure frontend is running: `npm run dev` (in `/frontend`)

---

## Test 1: Add Product Without Login ✅ CRITICAL

**Steps:**
1. Clear localStorage: `localStorage.clear()` in console
2. Refresh page
3. Go to Products page
4. Click "Add to Cart" on any product
5. **Expected:** Error message "Please login first"
6. **Database:** No new entry in carts table
7. **Network:** NO POST request

**Console Output:**
```
(No [ProductCard] logs - immediate error)
```

---

## Test 2: Add Product After Login ✅ PRIMARY TEST

**Steps:**
1. Login with: `john@example.com` / `password123`
2. Verify localStorage.currentUser is set: `JSON.parse(localStorage.getItem('currentUser'))`
3. Go to Products page
4. Select quantity: `2`
5. Click "Add to Cart"
6. **Network tab:** See both requests?
   - ✅ POST /api/cart/add → 200
   - ✅ GET /api/cart/:userId → 200
7. **Expected:** Button shows "Adding..." during request
8. **Expected:** Quantity selector resets to 1
9. **Expected:** Navbar count increases
10. **Database:** New entry in carts table
    ```sql
    SELECT * FROM carts WHERE user_id = 1;
    ```
    Should show: `{ id: X, user_id: 1, product_id: Y, quantity: 2, ... }`

**Console Output:**
```
[ProductCard] Adding to cart: userId=1, productId=Y, qty=2
[ProductCard] Add successful, fetching updated cart from backend...
[ProductCard] Cart synced from backend: 1 items
```

---

## Test 3: Navbar Count Accuracy ✅ VERIFY SYNC

**Steps:**
1. Note navbar count
2. Click "View Cart"
3. **Expected:** Cart page shows exact same items/count as navbar
4. **Expected:** Cart page lists items from database
5. Go back to Products
6. Add another product (qty 1)
7. **Expected:** Navbar count increases by 1
8. Click "View Cart" again
9. **Expected:** Cart page now shows 2 products

---

## Test 4: Add Same Product Twice ✅ DUPLICATE CHECK

**Steps:**
1. Clear cart (if needed): Delete all from carts table
2. Add Product A (qty 2)
3. Add Product A again (qty 1)
4. **Expected:** 
   - Only 1 cart item entry (not 2)
   - Product A quantity = 3 (2 + 1)
   - Navbar shows 1 product
5. **Database:**
    ```sql
    SELECT * FROM carts WHERE user_id = 1 AND product_id = A;
    ```
    Should show: `{ quantity: 3 }`

---

## Test 5: Insufficient Inventory ✅ VALIDATION

**Steps:**
1. Find a product with limited stock (e.g., 5 available)
2. Try to add qty 10
3. **Expected:** Error "Only 5 items available for this product"
4. **Database:** No new entry
5. **Network:** No POST request

---

## Test 6: Out of Stock ✅ BUTTON STATE

**Steps:**
1. Find a product with availability = 0
2. Try to click "Add to Cart"
3. **Expected:** Button is disabled
4. **Expected:** Error "Out of stock"
5. **Database:** No change

---

## Test 7: Network Failure Handling ✅ ERROR RESILIENCE

**Steps:**
1. Open DevTools → Network tab
2. Right-click → "Offline" (to simulate network failure)
3. Click "Add to Cart"
4. **Expected:** Error "Failed to add to cart"
5. **Network:** Request shows red (failed)
6. Switch back to "Online"
7. Try adding again
8. **Expected:** Works normally
9. **Database:** Only 1 entry (no duplicate from failed attempt)

---

## Test 8: Page Refresh Persistence ✅ STATE PRESERVATION

**Steps:**
1. Add 2 products to cart
2. Note: Navbar shows 2 items
3. Press F5 (refresh)
4. **Expected:**
   - Navbar still shows 2 items
   - Cart page shows same products
   - No duplicate entries in database
5. **Network:** GET /api/cart/:userId fired on page load

---

## Test 9: Multiple Users ✅ ISOLATION

**User 1:**
1. Login as john@example.com
2. Add Product A (qty 2) to cart
3. Note database: `carts` has entry with user_id=1
4. Note navbar count: 2

**User 2 (New browser tab or incognito):**
1. Login as different user (or create new user)
2. Add Product B (qty 1) to cart
3. Note database: New entry with different user_id
4. Note navbar count: 1
5. Switch back to User 1 tab
6. Navbar should still show 2 items
7. Verify database: Two separate cart entries

---

## Test 10: Cart Page Display ✅ DATA INTEGRITY

**Steps:**
1. Add 3 products to cart
2. Go to Cart page
3. **Expected:** Shows all 3 products
4. **Expected:** Quantities match what you added
5. **Expected:** Prices correct
6. **Expected:** Refresh page - same data persists
7. **Database verify:**
    ```sql
    SELECT carts.*, products.name FROM carts 
    JOIN products ON carts.product_id = products.id 
    WHERE carts.user_id = 1;
    ```
    Should show 3 rows matching cart page display

---

## Test 11: Console Logging ✅ DEBUGGING

**Steps:**
1. Open DevTools Console
2. Add product to cart
3. **Expected logs:**
    ```
    [ProductCard] Adding to cart: userId=1, productId=42, qty=2
    [ProductCard] Add successful, fetching updated cart from backend...
    [ProductCard] Cart synced from backend: 2 items
    ```
4. No error messages
5. No `undefined` errors

---

## Test 12: Place Order After Fix ✅ FINAL VALIDATION

**Steps:**
1. Login
2. Add 2 products to cart
3. Go to Cart page
4. Click "Place Order"
5. **Expected:** Order created successfully
6. **Database verify:**
    ```sql
    SELECT * FROM orders WHERE user_id = 1 ORDER BY created_at DESC LIMIT 1;
    ```
    Should have correct user_id
    ```sql
    SELECT * FROM order_items WHERE order_id = X;
    ```
    Should have 2 items with correct quantities
7. **Expected:** Cart clears after order placed
8. **Expected:** Can view order in "My Orders"

---

## Debugging Commands

### Check Current User
```javascript
JSON.parse(localStorage.getItem('currentUser'))
```

### Check Cart in Context
```javascript
// In React DevTools, check CartContext value
```

### Manual API Test (POST Add)
```bash
curl -X POST http://localhost:3001/api/cart/add \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"productId":42,"quantity":2}'
```

### Manual API Test (GET Fetch)
```bash
curl http://localhost:3001/api/cart/1
```

### Check Database Cart
```sql
SELECT * FROM carts WHERE user_id = 1;
```

### Clear Test Data
```sql
DELETE FROM carts WHERE user_id = 1;
```

---

## Common Issues & Fixes

### Issue: "Please login first" error every time
**Fix:** Check if localStorage.currentUser exists
```javascript
localStorage.getItem('currentUser')  // Should not be null
```

### Issue: No network requests showing
**Fix:** 
1. Check Network tab is recording (red circle at top left)
2. Try adding product again
3. Look for POST /api/cart/add

### Issue: Navbar shows items but Cart page is empty
**Fix:** This shouldn't happen after the fix. If it does:
1. Check browser console for errors
2. Verify GET /api/cart/:userId returned data
3. Check database has items: `SELECT * FROM carts;`

### Issue: Button stuck on "Adding..."
**Fix:**
1. Check network - request may be hanging
2. Verify backend is running
3. Check browser console for errors
4. Refresh page and try again

### Issue: Duplicate cart items
**Fix:**
1. This shouldn't happen - the fix prevents it
2. If it does: Check if same product added twice
3. Verify database: `SELECT COUNT(*) FROM carts WHERE user_id=1 AND product_id=42;`
4. Should be 1 row with combined quantity

---

## Success Criteria ✅

You know the fix is working when:

- [ ] Can't add to cart without login
- [ ] POST /api/cart/add request fires
- [ ] GET /api/cart/:userId request fires
- [ ] Navbar count matches database carts count
- [ ] Cart page shows database items
- [ ] Adding same product increases quantity (not duplicates)
- [ ] Quantity selector resets after add
- [ ] Can place order with correct user_id
- [ ] Page refresh preserves cart state
- [ ] Each user has isolated cart (different user_ids)

---

## Expected Network Traffic

### Add 1 Product
```
POST /api/cart/add
  Request:  { "userId": 1, "productId": 42, "quantity": 2 }
  Response: { "success": true, "message": "Added to cart", "data": {...} }

GET /api/cart/1
  Response: { "success": true, "data": [ { id: 1, userId: 1, productId: 42, quantity: 2 } ] }
```

### Add Same Product Again
```
POST /api/cart/add
  Request:  { "userId": 1, "productId": 42, "quantity": 1 }
  Response: { "success": true, ... }

GET /api/cart/1
  Response: { "success": true, "data": [ { id: 1, userId: 1, productId: 42, quantity: 3 } ] }
```

### Page Load
```
GET /api/cart/1
  Response: { "success": true, "data": [ ... existing items ... ] }
```

---

## Final Verification

**After completing all tests:**

✅ Database carts table has your items
✅ Each item has correct user_id
✅ Quantities are accurate
✅ Navbar count matches
✅ Cart page displays correctly
✅ Orders created with correct user_id
✅ No hardcoded userId = 1 anywhere
✅ Console logs show [ProductCard] prefix
✅ No duplicate items in cart
✅ Multi-user isolation works

**Status: READY FOR PRODUCTION** ✅
