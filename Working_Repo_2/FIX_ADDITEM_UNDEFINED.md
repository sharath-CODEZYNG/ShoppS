# Fix: TypeError addItem is not a function

## The Problem

You were getting:
```
TypeError: addItem is not a function
(In 'addItem(product, qty)', 'addItem' is undefined)
Location: ProductCard.jsx:37
```

## Root Cause

During the cart refactor, I removed `addItem`, `removeItem`, and `updateQty` from CartContext to enforce "backend-first" architecture. However, ProductCard still had code that called `addItem` after successful backend API calls.

**The Disconnect:**
```javascript
// CartContext had this
export const CartContext = createContext({
  cart: [],
  orders: [],
  setCart: () => {},
  addOrder: () => {},
  clearCart: () => {},
  // ❌ addItem was MISSING
})

// But ProductCard tried to use this
const { cart, addItem } = useContext(CartContext)  // ← addItem = undefined
addItem(product, qty)  // ← TypeError!
```

## The Solution

Restore `addItem`, `removeItem`, `updateQty` to CartContext, but with clear documentation that they should ONLY be called after successful backend API calls.

### Correct CartContext Structure

**File:** `frontend/src/context/CartContext.jsx`

```javascript
import { createContext, useState } from 'react'

export const CartContext = createContext({
  cart: [],
  orders: [],
  setCart: () => {},
  addItem: () => {},         // ← RESTORED
  removeItem: () => {},      // ← RESTORED
  updateQty: () => {},       // ← RESTORED
  addOrder: () => {},
  clearCart: () => {},
})

export function CartProvider({ children }) {
  const [cart, setCart] = useState([])
  const [orders, setOrders] = useState([])

  /**
   * addItem: Updates CartContext after backend API succeeds
   * 
   * DO NOT call this directly - it should only be called
   * after a successful backend addToCart API call.
   */
  function addItem(product, quantity = 1) {
    const qty = Number(quantity) || 1
    setCart(prev => {
      const found = prev.find(p => p.id === product.id)
      if (found) {
        return prev.map(p =>
          p.id === product.id ? { ...p, quantity: p.quantity + qty } : p
        )
      }
      const item = {
        id: product.id,
        productId: product.id,
        name: product.name,
        price: product.price || 0,
        quantity: qty
      }
      return [...prev, item]
    })
  }

  /**
   * removeItem: Remove from CartContext
   * Should be called after successful backend DELETE
   */
  function removeItem(productId) {
    setCart(prev => prev.filter(p => p.id !== productId))
  }

  /**
   * updateQty: Update quantity in CartContext
   * Should be called after successful backend PUT
   */
  function updateQty(productId, quantity) {
    const qty = Math.max(1, Number(quantity) || 1)
    setCart(prev =>
      prev.map(p => (p.id === productId ? { ...p, quantity: qty } : p))
    )
  }

  function addOrder(orderData) {
    setOrders(prev => [orderData, ...prev])
  }

  function clearCart() {
    setCart([])
  }

  return (
    <CartContext.Provider value={{
      cart,
      setCart,
      orders,
      addItem,
      removeItem,
      updateQty,
      addOrder,
      clearCart
    }}>
      {children}
    </CartContext.Provider>
  )
}
```

### Correct ProductCard Usage

**File:** `frontend/src/components/ProductCard.jsx`

```javascript
import { useState, useContext } from 'react'
import { CartContext } from '../context/CartContext'
import { addToCart } from '../services/api'

export default function ProductCard({ product, compact, onAddToCart, onCardClick, showActions = true }) {
  const { cart, addItem } = useContext(CartContext)  // ← Correct destructuring
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [error, setError] = useState(null)

  const handleAdd = async (e) => {
    e && e.stopPropagation()
    const qty = Number(quantity) || 1
    
    if (qty < 1) return
    if (!product.availability) {
      setError('Out of stock')
      return
    }

    setError(null)
    setIsAddingToCart(true)

    try {
      // STEP 1: Call backend API first
      const res = await addToCart(1, product.id, qty)
      
      if (res && res.success) {
        // STEP 2: Backend call succeeded, sync to CartContext
        addItem(product, qty)
        console.log(`✅ Added to cart: ${product.name}`)
      } else {
        // Backend API failed
        setError(res?.message || 'Failed to add to cart')
        console.error('Add to cart failed:', res?.message)
      }
    } catch (err) {
      // Network or other error
      setError('Failed to add to cart')
      console.error('Add to cart error:', err)
    } finally {
      setIsAddingToCart(false)
    }
  }

  return (
    <article className={`product-card card ${compact ? 'compact' : ''}`}>
      {/* ... UI code ... */}
      <button
        className="btn-add"
        onClick={handleAdd}
        disabled={!product.availability || isAddingToCart}
      >
        {isAddingToCart ? 'Adding...' : 'Add to Cart'}
      </button>
    </article>
  )
}
```

## Architecture: Backend First + Context Sync

**This is the correct flow:**

```
User clicks "Add to Cart"
    ↓
handleAdd() called
    ↓
STEP 1: Call backend API
    addToCart(userId, productId, qty) → POST /api/cart/add
    ↓
Backend inserts into carts table
    ↓
Backend returns: { success: true, cartId: 5 }
    ↓
STEP 2: Backend call succeeded
    ↓
STEP 3: Sync to CartContext
    addItem(product, qty)
    ↓
CartContext.cart updated
    ↓
Navbar re-renders with new count
    ↓
ProductCard displays success
```

**Why this works:**
- ✅ Backend is authoritative (single source of truth)
- ✅ CartContext is synchronized AFTER backend succeeds
- ✅ If backend fails, CartContext is NOT updated (no false state)
- ✅ Navbar always shows accurate count (from CartContext)
- ✅ No polling or conflicts

## Common Mistakes That Cause This Error

### Mistake 1: Forgetting to Export from Context

```javascript
// ❌ WRONG: Not exported in createContext default
export const CartContext = createContext({
  cart: [],
  // addItem not listed here
})

// ✅ CORRECT: Must be in default object
export const CartContext = createContext({
  cart: [],
  addItem: () => {},  // ← Must be here
})
```

### Mistake 2: Not Including Function in Provider Value

```javascript
export function CartProvider({ children }) {
  function addItem(product, qty) { ... }

  return (
    <CartContext.Provider value={{
      cart,
      // ❌ WRONG: Forgot to include addItem
    }}>
      {children}
    </CartContext.Provider>
  )
}

// ✅ CORRECT: Must be in value object
<CartContext.Provider value={{
  cart,
  addItem,  // ← Must be here
}}>
```

### Mistake 3: Wrong Destructuring in Component

```javascript
// ❌ WRONG: getContext instead of useContext
const { addItem } = getContext(CartContext)

// ❌ WRONG: Wrong hook name
const { addItem } = useContext(WrongContext)

// ✅ CORRECT:
const { addItem } = useContext(CartContext)
```

### Mistake 4: Not Wrapping App with Provider

```javascript
// ❌ WRONG: CartProvider not used
import App from './App'
export default App

// ✅ CORRECT: Wrap entire app
import { CartProvider } from './context/CartContext'
import App from './App'

export default function Root() {
  return (
    <CartProvider>
      <App />
    </CartProvider>
  )
}
```

### Mistake 5: Calling addItem Before Backend Succeeds

```javascript
// ❌ WRONG: Updates CartContext even if API fails
try {
  addItem(product, qty)          // ← Called before API
  const res = await addToCart()
  if (!res.success) {
    // Too late, CartContext already updated!
  }
}

// ✅ CORRECT: Only call after API succeeds
try {
  const res = await addToCart()
  if (res.success) {
    addItem(product, qty)        // ← Called after API confirms
  }
}
```

## Debug Checklist

If you're still getting "addItem is not a function":

- [ ] **Check CartContext export**
  ```javascript
  export const CartContext = createContext({
    addItem: () => {},  // Should be here
  })
  ```

- [ ] **Check CartProvider value**
  ```javascript
  <CartContext.Provider value={{
    addItem,  // Should be here
  }}>
  ```

- [ ] **Check component destructuring**
  ```javascript
  const { addItem } = useContext(CartContext)
  ```

- [ ] **Check app is wrapped**
  ```javascript
  <CartProvider>
    <App />
  </CartProvider>
  ```

- [ ] **Check hook name**
  Should be `useContext`, not `getContext` or anything else

- [ ] **Check call order**
  ```javascript
  const res = await addToCart()  // First
  if (res.success) {
    addItem(product, qty)        // Then
  }
  ```

## Minimal Working Example

**Complete working code from scratch:**

### 1. CartContext
```javascript
import { createContext, useState } from 'react'

export const CartContext = createContext({
  cart: [],
  addItem: () => {},
})

export function CartProvider({ children }) {
  const [cart, setCart] = useState([])

  function addItem(product, quantity = 1) {
    setCart(prev => {
      const exists = prev.find(p => p.id === product.id)
      if (exists) {
        return prev.map(p =>
          p.id === product.id 
            ? { ...p, quantity: p.quantity + quantity }
            : p
        )
      }
      return [...prev, { ...product, quantity }]
    })
  }

  return (
    <CartContext.Provider value={{ cart, addItem }}>
      {children}
    </CartContext.Provider>
  )
}
```

### 2. ProductCard
```javascript
import { useContext, useState } from 'react'
import { CartContext } from '../context/CartContext'
import { addToCart } from '../services/api'

export function ProductCard({ product }) {
  const { addItem } = useContext(CartContext)
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    setLoading(true)
    try {
      const res = await addToCart(1, product.id, 1)
      if (res.success) {
        addItem(product, 1)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h3>{product.name}</h3>
      <button onClick={handleAdd} disabled={loading}>
        {loading ? 'Adding...' : 'Add to Cart'}
      </button>
    </div>
  )
}
```

### 3. App
```javascript
import { CartProvider } from './context/CartContext'
import { ProductCard } from './ProductCard'

export default function App() {
  return (
    <CartProvider>
      <ProductCard product={{ id: 1, name: 'Product 1' }} />
    </CartProvider>
  )
}
```

**This will work without errors.**

## Summary

| Issue | Solution |
|-------|----------|
| addItem undefined | Add to CartContext createContext default |
| addItem not in value | Add to Provider value object |
| Wrong hook | Use `useContext`, not `getContext` |
| App not wrapped | Wrap with `<CartProvider>` |
| Called before API | Wait for API success before calling |
| Wrong destructuring | Use `const { addItem } = useContext(CartContext)` |

Your app should now work correctly! The "Add to Cart" button will call the backend, then sync to CartContext, then update the Navbar count.

