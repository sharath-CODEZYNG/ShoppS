# Production-Level Cart System Refactor

## Problem Analysis: Why Current Approach Failed

### The Core Issue: Dual State + Infinite Loops

**Current (Broken) Flow:**
```
ProductCard.handleAdd()
    ↓
    calls addToCart API → backend updates carts table
    ↓
    calls addItem() → CartContext updates
    ↓
    Cart.jsx renders with new CartContext
    ↓
    Cart.jsx useEffect with [addItem] dependency fires
    ↓
    fetchBackendCart() called again
    ↓
    Navbar re-renders, fetches backend every 2 seconds
    ↓
    Each fetch creates new cartCount state
    ↓
    Navbar re-renders
    ↓
    Triggers useEffect dependencies
    ↓
    Back to step 1...
```

**Why Badge Increases Infinitely:**
1. Navbar polls backend every 2000ms
2. Each poll creates a new Promise
3. Each Promise triggers setCartCount
4. setCartCount triggers component re-render
5. Re-render changes dependency array values
6. useEffect fires again with new dependencies
7. Multiple unanswered Promises accumulate
8. Each accumulating Promise tries to update state

**Why Order Fails Even Though Cart Shows Items:**
1. Cart.jsx displays `items` state (from local state)
2. User clicks "Place Order"
3. Backend `createOrder` queries `SELECT * FROM carts WHERE userId = ?`
4. Backend finds 0 rows (because items weren't saved there, or were deleted by previous action)
5. Backend returns "Cart is empty"
6. Frontend still shows items (from stale local state)

**Why Quantity Buttons are Unstable:**
1. Click +1 button
2. `handleIncreaseQty` calls `updateCartItem` (API)
3. API updates backend
4. `fetchBackendCart()` called
5. `setItems()` triggered
6. Cart.jsx re-renders
7. But if Cart.jsx is re-rendering from parent, useEffect fires again
8. Multiple simultaneous updates race condition

## Solution: Backend as Single Source of Truth

### Architecture
```
BACKEND (MySQL) - Single Source of Truth
  ↓ (fetch, read-only from frontend)
CartContext - Order history ONLY (not current cart)
  ↓
Frontend Local State (Cart.jsx) - Display only, fetched from backend
  ↓ (read from local state)
Navbar - Display count from CartContext.cart (which syncs on mount)
```

### Key Principles
1. **Backend is authoritative** - Always the source of truth
2. **Transactions are atomic** - Order + Delete is one operation
3. **No polling** - Fetch on demand, not periodically
4. **No useEffect dependencies on functions** - Use empty deps []
5. **CartContext stores orders, not current cart** - Clean separation
6. **Navbar derives count from CartContext.cart** - Set once on mount

---

## Implementation

### 1. Backend: Order Controller with Transaction

```javascript
// controllers/orderController.js
import pool from '../config/db.js';

export async function createOrder(req, res) {
  const { userId, shippingAddress } = req.body;

  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      message: 'userId is required' 
    });
  }

  let connection;
  try {
    // Get a connection for transaction
    connection = await pool.getConnection();
    
    console.log('\n=== TRANSACTION START: ORDER CREATION ===');
    console.log('User:', userId);
    
    // BEGIN TRANSACTION
    await connection.beginTransaction();
    console.log('✅ Transaction started');

    // STEP 1: Get and lock cart items (SELECT FOR UPDATE)
    console.log('Step 1: Fetching cart items...');
    const [cartItems] = await connection.query(
      `SELECT c.id as cartId, c.productId, c.quantity, p.price, p.availability 
       FROM carts c 
       JOIN products p ON c.productId = p.id 
       WHERE c.userId = ? 
       FOR UPDATE`,
      [userId]
    );
    console.log(`✅ Found ${cartItems.length} items in cart`);

    if (cartItems.length === 0) {
      await connection.rollback();
      console.log('❌ Cart is empty, rolling back transaction');
      return res.status(400).json({ 
        success: false, 
        message: 'Cart is empty' 
      });
    }

    // STEP 2: Validate availability
    console.log('Step 2: Validating product availability...');
    for (const item of cartItems) {
      if (item.quantity > item.availability) {
        await connection.rollback();
        console.log(`❌ Insufficient stock for product ${item.productId}, rolling back`);
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for product ID ${item.productId}` 
        });
      }
    }
    console.log('✅ All items have sufficient stock');

    // STEP 3: Calculate order total
    const totalAmount = cartItems.reduce(
      (sum, item) => sum + (item.price * item.quantity), 
      0
    );
    console.log(`Step 3: Total amount calculated: $${totalAmount}`);

    // STEP 4: INSERT order
    console.log('Step 4: Creating order record...');
    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, total_amount, shipping_address, status, created_at) 
       VALUES (?, ?, ?, 'pending', NOW())`,
      [userId, totalAmount, shippingAddress || null]
    );
    const orderId = orderResult.insertId;
    console.log(`✅ Order created with ID: ${orderId}`);

    // STEP 5: INSERT order_items and UPDATE product availability
    console.log('Step 5: Inserting order items and updating availability...');
    for (const item of cartItems) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price) 
         VALUES (?, ?, ?, ?)`,
        [orderId, item.productId, item.quantity, item.price]
      );

      await connection.query(
        `UPDATE products 
         SET availability = availability - ?, purchases = purchases + ? 
         WHERE id = ?`,
        [item.quantity, item.quantity, item.productId]
      );
    }
    console.log(`✅ Order items inserted for ${cartItems.length} products`);

    // STEP 6: DELETE cart items
    console.log('Step 6: Clearing cart...');
    const [deleteResult] = await connection.query(
      'DELETE FROM carts WHERE userId = ?',
      [userId]
    );
    console.log(`✅ Cart cleared: ${deleteResult.affectedRows} rows deleted`);

    // COMMIT TRANSACTION
    await connection.commit();
    console.log('✅ Transaction committed successfully');
    console.log('=== TRANSACTION END: SUCCESS ===\n');

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { 
        orderId, 
        totalAmount: Number(totalAmount.toFixed(2)), 
        itemCount: cartItems.length 
      }
    });

  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
        console.log('❌ Transaction rolled back due to error');
      } catch (rollbackErr) {
        console.error('Rollback error:', rollbackErr);
      }
    }
    console.error('❌ Error creating order:', err);
    console.log('=== TRANSACTION END: FAILED ===\n');
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  } finally {
    if (connection) {
      await connection.release();
      console.log('Connection released');
    }
  }
}
```

### 2. Frontend: Refactored CartContext

```javascript
// context/CartContext.jsx
import { createContext, useState } from 'react'

export const CartContext = createContext({
  cart: [],
  orders: [],
  setCart: () => {},
  addOrder: () => {},
})

export function CartProvider({ children }) {
  // cart: used ONLY for navbar count display
  // This is populated from backend on mount in App.jsx or Home.jsx
  const [cart, setCart] = useState([])
  
  // orders: order history
  const [orders, setOrders] = useState([])

  // addOrder: add to order history after successful order placement
  function addOrder(orderData) {
    setOrders(prev => [orderData, ...prev])
  }

  // clearCart: empty the cart state (called after successful order)
  function clearCart() {
    setCart([])
  }

  return (
    <CartContext.Provider value={{ 
      cart, 
      setCart,
      orders, 
      addOrder,
      clearCart
    }}>
      {children}
    </CartContext.Provider>
  )
}
```

**Key Changes:**
- ❌ Removed: `addItem`, `removeItem`, `updateQty`, `placeOrder` methods
- ✅ Added: `setCart` method to sync from backend
- ✅ `cart` is NOW READ-ONLY display state, not operational state
- ✅ `orders` remains for order history

### 3. Frontend: Refactored Cart.jsx

```javascript
// pages/Cart.jsx
import { useContext, useState, useEffect } from 'react'
import { CartContext } from '../context/CartContext'
import { PRODUCTS } from '../services/products'
import { 
  fetchCart, 
  updateCartItem, 
  removeCartItem, 
  orderAPI 
} from '../services/api'
import Navbar from '../components/Navbar'

export default function Cart() {
  const { setCart, addOrder, clearCart: clearContextCart } = useContext(CartContext)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [orderMessage, setOrderMessage] = useState(null)
  const [processing, setProcessing] = useState(false)

  // CRITICAL: Fetch from backend ONLY on mount, never again
  useEffect(() => {
    const loadCart = async () => {
      try {
        console.log('[Cart] Fetching cart on mount...')
        const res = await fetchCart(1)
        
        if (res?.success && Array.isArray(res.data)) {
          console.log(`[Cart] Loaded ${res.data.length} items`)
          setItems(res.data)
          // Sync CartContext for navbar
          setCart(res.data)
        } else {
          console.log('[Cart] No items returned')
          setItems([])
          setCart([])
        }
      } catch (err) {
        console.error('[Cart] Fetch error:', err)
        setItems([])
        setCart([])
      } finally {
        setLoading(false)
      }
    }

    loadCart()
  }, []) // ← EMPTY dependency array = run ONLY once on mount

  // Helper to refetch after cart operations
  const refetchCart = async () => {
    try {
      const res = await fetchCart(1)
      if (res?.success && Array.isArray(res.data)) {
        setItems(res.data)
        setCart(res.data)
      } else {
        setItems([])
        setCart([])
      }
    } catch (err) {
      console.error('[Cart] Refetch error:', err)
    }
  }

  // Handle quantity increase
  const handleIncreaseQty = async (item) => {
    try {
      const newQty = item.quantity + 1
      console.log(`[Cart] Increasing qty for cartId ${item.cartId} to ${newQty}`)
      
      await updateCartItem(item.cartId, newQty)
      
      // Refetch to display updated state
      await refetchCart()
    } catch (err) {
      console.error('[Cart] Increase qty error:', err)
      setOrderMessage('Failed to update quantity')
    }
  }

  // Handle quantity decrease
  const handleDecreaseQty = async (item) => {
    try {
      const newQty = Math.max(1, item.quantity - 1)
      console.log(`[Cart] Decreasing qty for cartId ${item.cartId} to ${newQty}`)
      
      await updateCartItem(item.cartId, newQty)
      
      // Refetch to display updated state
      await refetchCart()
    } catch (err) {
      console.error('[Cart] Decrease qty error:', err)
      setOrderMessage('Failed to update quantity')
    }
  }

  // Handle remove item
  const handleRemoveItem = async (item) => {
    try {
      console.log(`[Cart] Removing cartId ${item.cartId}`)
      
      await removeCartItem(item.cartId)
      
      // Refetch to display updated state
      await refetchCart()
    } catch (err) {
      console.error('[Cart] Remove item error:', err)
      setOrderMessage('Failed to remove item')
    }
  }

  // Handle place order with transaction
  const handlePlaceOrder = async () => {
    if (processing) return
    setOrderMessage(null)

    try {
      setProcessing(true)
      
      console.log('[Cart] Placing order...')
      const response = await orderAPI.createOrder({ 
        userId: 1, 
        shippingAddress: null 
      })

      if (response?.success) {
        console.log('[Cart] Order successful, clearing cart')
        
        // Clear local state
        setItems([])
        
        // Clear CartContext (for navbar)
        clearContextCart()
        
        // Add to order history
        addOrder({
          orderId: response.data.orderId,
          totalAmount: response.data.totalAmount,
          itemCount: response.data.itemCount,
          createdAt: new Date().toISOString()
        })
        
        setOrderMessage('✅ Order placed successfully!')
        console.log('[Cart] Order complete and cart cleared')
      } else {
        setOrderMessage(`❌ ${response?.message || 'Unable to place order'}`)
      }
    } catch (err) {
      console.error('[Cart] Order error:', err)
      setOrderMessage('❌ Something went wrong — please try again')
    } finally {
      setProcessing(false)
    }
  }

  // Display data
  const displayItems = Array.isArray(items) ? items : []
  const total = displayItems.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  )

  // Render loading state
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="cart-page" style={{ maxWidth: 1100, margin: '0 auto', marginTop: 20 }}>
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p className="muted" style={{ fontSize: 16 }}>Loading your cart...</p>
          </div>
        </div>
      </>
    )
  }

  // Render empty state
  if (displayItems.length === 0) {
    return (
      <>
        <Navbar />
        <div className="cart-page" style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="card empty-cart" style={{ marginTop: 18, textAlign: 'center', padding: '60px 20px' }}>
            <h2>Your cart is empty</h2>
            <p className="muted">Start shopping to add items</p>
          </div>
        </div>
      </>
    )
  }

  // Render cart with items
  return (
    <>
      <Navbar />
      <div className="cart-page" style={{ maxWidth: 1100, margin: '0 auto', marginTop: 20 }}>
        <h1>Shopping Cart</h1>
        
        <div className="cart-items">
          {displayItems.map(item => (
            <div key={item.cartId} className="cart-item card" style={{ marginBottom: 10, padding: 15 }}>
              <div style={{ display: 'flex', gap: 15 }}>
                <div style={{ flex: '0 0 80px', height: 80 }}>
                  {/* Product image */}
                </div>
                <div style={{ flex: 1 }}>
                  <h3>{item.name}</h3>
                  <p>${item.price}</p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={() => handleDecreaseQty(item)}>−</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => handleIncreaseQty(item)}>+</button>
                    <button onClick={() => handleRemoveItem(item)} style={{ marginLeft: 'auto' }}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-summary card" style={{ padding: 20, marginTop: 20 }}>
          <h2>Total: ${total.toFixed(2)}</h2>
          {orderMessage && (
            <p style={{ marginTop: 10, color: orderMessage.includes('✅') ? 'green' : 'red' }}>
              {orderMessage}
            </p>
          )}
          <button 
            onClick={handlePlaceOrder} 
            disabled={processing}
            style={{ marginTop: 10, padding: '10px 20px' }}
          >
            {processing ? 'Processing...' : 'Place Order'}
          </button>
        </div>
      </div>
    </>
  )
}
```

### 4. Frontend: Refactored Navbar

```javascript
// components/Navbar.jsx
import { Link, useNavigate } from 'react-router-dom'
import { useContext, useEffect, useRef, useState } from 'react'
import { CartContext } from '../context/CartContext'
import { useCategory } from '../context/CategoryContext'
import { PRODUCTS } from '../services/products'

export default function Navbar() {
  const { cart } = useContext(CartContext)
  const [user, setUser] = useState(null)
  const [open, setOpen] = useState(false)
  const [imgError, setImgError] = useState(false)
  const navigate = useNavigate()
  const ref = useRef()
  const { selectedCategory, setSelectedCategory, searchQuery, setSearchQuery } = useCategory()
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef()

  // COMPUTED DIRECTLY from CartContext.cart (NO separate state, NO polling)
  const cartCount = Array.isArray(cart) 
    ? cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
    : 0

  useEffect(() => {
    const raw = localStorage.getItem('currentUser')
    if (raw) setUser(JSON.parse(raw))

    function onStorage(e) {
      if (e.key === 'currentUser') {
        setUser(e.newValue ? JSON.parse(e.newValue) : null)
      }
    }

    function onCurrentUserChanged(e) {
      const stored = localStorage.getItem('currentUser')
      setUser(stored ? JSON.parse(stored) : null)
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('currentUserChanged', onCurrentUserChanged)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('currentUserChanged', onCurrentUserChanged)
    }
  }, []) // User-related effects only

  useEffect(() => {
    setImgError(false)
  }, [user?.profilePic, user?.email, user?.firstName, user?.name])

  // ... rest of navbar code ...

  return (
    <nav>
      {/* Navbar content */}
      <Link to="/cart">
        Cart <span className="badge">{cartCount}</span>
      </Link>
    </nav>
  )
}
```

---

## Data Flow Diagram

### BROKEN Flow (Before)
```
User clicks +1
    ↓
ProductCard → addItem(CartContext)
    ↓ (CartContext re-renders)
Cart.jsx useEffect fires [addItem dependency]
    ↓
fetchBackendCart() called
    ↓ (creates new state)
Navbar polls backend every 2s
    ↓ (creates new cartCount)
Navbar re-renders
    ↓ (useEffect dependencies change)
INFINITE LOOP ← BACK TO TOP
```

### FIXED Flow (After)
```
User opens Cart page
    ↓
useEffect [] runs ONCE
    ↓
fetchCart(1) called
    ↓
setItems() + setCart() called
    ↓
Cart displays items
Navbar computes cartCount from cart (NO polling, computed property)
    ↓
User clicks +1 button
    ↓
handleIncreaseQty() → updateCartItem API → refetchCart()
    ↓
setItems() + setCart() updated
    ↓
Component re-renders with new values
    ↓
NO additional useEffect fires (no dependencies changed)
    ↓
Navbar automatically shows new count
    ↓
DONE - single consistent state
```

---

## Why Each Fix Works

| Problem | Root Cause | Fix | Result |
|---------|-----------|-----|--------|
| Badge increases infinitely | useEffect([addItem]) re-runs on every render | Empty dependency [] = run only once | No infinite loop |
| Cart shows items but backend empty | Cart.jsx using local state, backend cart table was cleared | Fetch backend on mount, display from backend | Always in sync |
| Order fails "cart empty" | Frontend CartContext full, but backend carts table empty | Backend queries live carts table, not context | Accurate cart check |
| Quantity buttons unstable | Multiple simultaneous updates, race conditions | Single refetch after each operation | Consistent state |
| Navbar count mismatch | Navbar polling every 2s, Cart using CartContext | Navbar derives from CartContext, Cart syncs from backend | Single source of truth |
| Cart not clearing after order | Order successful but CartContext not cleared | Order handler clears CartContext + local state | Consistent clearing |

---

## Migration Checklist

- [ ] Update backend orderController.js with transaction code
- [ ] Update CartContext.jsx to remove cart operations
- [ ] Update Cart.jsx with single useEffect on mount
- [ ] Update Navbar to compute count (no polling)
- [ ] Test: Add item to cart
- [ ] Test: Increase/decrease quantity
- [ ] Test: Remove item
- [ ] Test: Place order (should clear cart)
- [ ] Test: Refresh page (cart should persist)
- [ ] Test: Navbar count updates immediately
- [ ] Monitor console logs for transaction flow
