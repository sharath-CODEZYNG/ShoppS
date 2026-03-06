import { createContext, useState } from 'react'

// Provide a simple cart context to manage cart items across pages.
export const CartContext = createContext({ cart: [], addItem: ()=>{}, removeItem: ()=>{}, updateQty: ()=>{} })

export function CartProvider({ children }){
  const [cart, setCart] = useState([])
  const [orders, setOrders] = useState([])

  function addItem(product, quantity=1){
    const qty = Number(quantity) || 1
    setCart(prev=>{
      const found = prev.find(p=>p.id===product.id)
      if(found){
        return prev.map(p=> p.id===product.id ? {...p, quantity: p.quantity + qty} : p)
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

  function removeItem(id){
    setCart(prev=>prev.filter(p=>p.id!==id))
  }

  function updateQty(id, quantity){
    setCart(prev=>prev.map(p=>p.id===id?{...p, quantity}:p))
  }

  function clearCart(){
    setCart([])
  }

  /**
   * placeOrder: creates a frontend-only order from current cart,
   * stores it in `orders` state and clears the cart.
   * Returns the created order object.
   */
  function placeOrder(metadata = {}){
    if(!cart || cart.length === 0) return null
    const total = cart.reduce((s,i)=> s + (i.price || 0) * (i.quantity || 0), 0)
    const order = {
      orderId: `ORD-${Date.now()}`,
      items: cart.map(i=> ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
      totalAmount: Number(total.toFixed(2)),
      orderStatus: 'Placed',
      orderDate: new Date().toISOString(),
      ...metadata
    }
    setOrders(prev => [order, ...prev])
    setCart([])
    return order
  }

  return (
    <CartContext.Provider value={{ cart, orders, addItem, removeItem, updateQty, clearCart, placeOrder }}>
      {children}
    </CartContext.Provider>
  )
}
