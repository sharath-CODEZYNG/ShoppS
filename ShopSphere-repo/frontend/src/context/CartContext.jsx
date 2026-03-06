import { createContext, useState } from 'react'

/**
 * PRODUCTION CART CONTEXT
 * 
 * Hybrid approach:
 * - cart: Display state synced from backend (for Navbar)
 * - orders: Order history for user
 * - addItem: Updates local CartContext state AFTER backend succeeds
 *   (Backend is the source of truth; CartContext is for UI optimization)
 * 
 * Backend (MySQL carts table) is still the single source of truth.
 * Frontend operations must call backend API first, then sync to context.
 */

export const CartContext = createContext({
  cart: [],
  orders: [],
  setCart: () => {},
  addItem: () => {},
  removeItem: () => {},
  updateQty: () => {},
  addOrder: () => {},
  clearCart: () => {},
})

export function CartProvider({ children }) {
  // cart: synced from backend, used for navbar display
  // This is updated by setCart (after backend operations)
  const [cart, setCart] = useState([])
  
  // orders: order history
  const [orders, setOrders] = useState([])

  /**
   * addItem: Updates CartContext after backend API succeeds
   * 
   * DO NOT call this directly - it should only be called
   * after a successful backend addToCart API call.
   * 
   * This keeps CartContext in sync without making redundant API calls.
   */
  function addItem(product, quantity = 1) {
    const qty = Number(quantity) || 1
    setCart(prev => {
      const found = prev.find(p => p.id === product.id)
      if (found) {
        // Item already in cart: increase quantity
        return prev.map(p =>
          p.id === product.id ? { ...p, quantity: p.quantity + qty } : p
        )
      }
      // New item: add to cart
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

  /**
   * addOrder: Add to order history after successful order creation
   */
  function addOrder(orderData) {
    setOrders(prev => [orderData, ...prev])
  }

  /**
   * clearCart: Empty the CartContext (called after successful order placement)
   */
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
