import { useContext, useState, useEffect } from 'react'
import { CartContext } from '../context/CartContext'
import { fetchCart, updateCartItem, removeCartItem, orderAPI } from '../services/api'
import Navbar from '../components/Navbar'
import { getProductImageUrl } from '../utils/imageUtils'
const API_URL = import.meta.env.VITE_API_URL 
 
/**
 * PRODUCTION CART PAGE
 * 
 * Backend (MySQL) is the single source of truth.
 * All state comes from backend, never from CartContext.
 * 
 * Key principles:
 * 1. Fetch backend on mount only (useEffect with [])
 * 2. After operations (add/remove/update): refetch backend
 * 3. Display data comes from local state (items), not CartContext
 * 4. Sync CartContext for navbar after operations
 * 5. No polling, no duplicate dependencies
 */

export default function Cart() {
  const { setCart, addOrder, clearCart } = useContext(CartContext)
  
  // Local state: display data from backend
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [orderMessage, setOrderMessage] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [placedOrder, setPlacedOrder] = useState(null)

  /**
   * Helper: Get current logged-in user from localStorage
   * Returns user object or null if not logged in
   */
  const getCurrentUser = () => {
    try {
      const userJson = localStorage.getItem('user')
      return userJson ? JSON.parse(userJson) : null
    } catch (err) {
      console.error('Error parsing user from localStorage:', err)
      return null
    }
  }

  /**
   * CRITICAL: Fetch from backend ONLY on component mount
   * Empty dependency array [] = run exactly once
   */
  useEffect(() => {
    const loadCart = async () => {
      try {
        const user = getCurrentUser()
        if (!user || !user.id) {
          console.log('[Cart] User not logged in, skipping cart load')
          setItems([])
          setCart([])
          setLoading(false)
          return
        }

        console.log(`[Cart] Fetching cart for user ${user.id}...`)
        const res = await fetchCart(user.id)
        
        if (res?.success && Array.isArray(res.data)) {
          console.log(`[Cart] Loaded ${res.data.length} items`)
          setItems(res.data)
          // Also sync to CartContext for navbar
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
  }, []) // ← EMPTY: run only on mount

  /**
   * Helper: Refetch cart after operations
   * Used after add, remove, or update quantity
   */
  const refetchCart = async () => {
    try {
      const user = getCurrentUser()
      if (!user || !user.id) {
        console.log('[Cart] Cannot refetch: user not logged in')
        return
      }

      console.log(`[Cart] Refetching cart for user ${user.id}...`)
      const res = await fetchCart(user.id)
      if (res?.success && Array.isArray(res.data)) {
        console.log(`[Cart] Refetched: ${res.data.length} items`)
        setItems(res.data)
        setCart(res.data)
      } else {
        console.log('[Cart] Cart is now empty')
        setItems([])
        setCart([])
      }
    } catch (err) {
      console.error('[Cart] Refetch error:', err)
      setItems([])
      setCart([])
    }
  }

  /**
   * Handle quantity increase
   * Flow: API update → refetch from backend → display updates
   */
  const handleIncreaseQty = async (item) => {
    if (processing) return
    try {
      const newQty = item.quantity + 1
      console.log(`[Cart] Increasing qty for cartId ${item.cartId} to ${newQty}`)
      
      await updateCartItem(item.cartId, newQty)
      console.log('[Cart] Update successful, refetching...')
      
      await refetchCart()
    } catch (err) {
      console.error('[Cart] Increase qty error:', err)
      setOrderMessage('❌ Failed to update quantity')
    }
  }

  /**
   * Handle quantity decrease
   * Flow: API update → refetch from backend → display updates
   */
  const handleDecreaseQty = async (item) => {
    if (processing) return
    try {
      const newQty = Math.max(1, item.quantity - 1)
      console.log(`[Cart] Decreasing qty for cartId ${item.cartId} to ${newQty}`)
      
      await updateCartItem(item.cartId, newQty)
      console.log('[Cart] Update successful, refetching...')
      
      await refetchCart()
    } catch (err) {
      console.error('[Cart] Decrease qty error:', err)
      setOrderMessage('❌ Failed to update quantity')
    }
  }

  /**
   * Handle remove item from cart
   * Flow: API delete → refetch from backend → display updates
   */
  const handleRemoveItem = async (item) => {
    if (processing) return
    try {
      console.log(`[Cart] Removing cartId ${item.cartId}`)
      
      await removeCartItem(item.cartId)
      console.log('[Cart] Remove successful, refetching...')
      
      await refetchCart()
    } catch (err) {
      console.error('[Cart] Remove item error:', err)
      setOrderMessage('❌ Failed to remove item')
    }
  }

  /**
   * Handle place order
   * Uses ATOMIC TRANSACTION on backend:
   * - SELECT cart items (locked)
   * - INSERT order
   * - INSERT order_items
   * - UPDATE product availability
   * - DELETE cart items
   * - COMMIT (all succeed) or ROLLBACK (all fail)
   * 
   * Frontend:
   * - Clear local state
   * - Clear CartContext (for navbar)
   * - Add to order history
   */
  const handlePlaceOrder = async () => {
    if (processing) return
    setOrderMessage(null)

    try {
      // Get current logged-in user
      const user = getCurrentUser()
      if (!user || !user.id) {
        setOrderMessage('❌ Please log in before placing an order')
        return
      }

      setProcessing(true)
      
      console.log(`[Cart] Placing order for user ${user.id} with backend transaction...`)
      const response = await orderAPI.createOrder({ userId: user.id, shippingAddress: null })

      if (response?.success) {
        console.log('[Cart] Order successful, clearing cart...')
        
        // Store successful order for display
        setPlacedOrder(response.data)
        
        // Clear local display state
        setItems([])
        
        // Clear CartContext for navbar
        clearCart()
        
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
        const message = response?.message || 'Unable to place order'
        console.log('[Cart] Order failed:', message)
        setOrderMessage(`❌ ${message}`)
      }
    } catch (err) {
      console.error('[Cart] Order error:', err)
      setOrderMessage('❌ Something went wrong — please try again')
    } finally {
      setProcessing(false)
    }
  }

  // Compute totals
  const displayItems = Array.isArray(items) ? items : []
  const total = displayItems.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  )

  // Render helper for product thumbnail
  function Thumb({ src, alt }){
    const [err, setErr] = useState(false)
    if(src && !err){
      return <img src={src} alt={alt} onError={() => setErr(true)} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
    }
    return (
      <div className="thumb-placeholder" aria-hidden>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect x="3" y="5" width="14" height="12" rx="2" stroke="#9aa4b2" strokeWidth="1.6"/>
          <path d="M21 15v2M21 11v2" stroke="#9aa4b2" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </div>
    )
  }

  // DEFENSIVE: If still loading, show loading state ONLY
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="cart-page" style={{maxWidth:1100, margin:'0 auto', marginTop:20}}>
          <div className="card" style={{textAlign:'center', padding:'60px 20px'}}>
            <p className="muted" style={{fontSize:16}}>Loading your cart...</p>
          </div>
        </div>
      </>
    )
  }

  // DEFENSIVE: If not loading but no items, show empty cart ONLY
  if (!loading && displayItems.length === 0) {
    return (
      <>
        <Navbar />
        <div className="cart-page" style={{maxWidth:1100, margin:'0 auto'}}>
          <div className="card empty-cart" style={{marginTop:18, textAlign:'center', padding:'60px 20px'}}>
            <svg width="84" height="84" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M3 3h2l1.4 9.4a2 2 0 002 1.6h9.2a2 2 0 001.9-1.5L21 7H6" stroke="#9aa4b2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="10" cy="20" r="1" fill="#9aa4b2" />
              <circle cx="18" cy="20" r="1" fill="#9aa4b2" />
            </svg>
            <h3 style={{marginTop:12}}>Your cart is empty</h3>
            <div className="muted" style={{marginTop:8}}>Looks like you haven't added anything to your cart yet.</div>
            <div style={{marginTop:16}}><a href="/home" className="btn-enter-big">Continue shopping</a></div>
          </div>
        </div>
      </>
    )
  }

  // DEFENSIVE: Ensure displayItems is really an array before rendering items
  if (!Array.isArray(displayItems)) {
    return (
      <>
        <Navbar />
        <div className="cart-page" style={{maxWidth:1100, margin:'0 auto'}}>
          <div className="card" style={{marginTop:18, textAlign:'center', padding:'40px 20px'}}>
            <p className="muted">Unable to load cart data</p>
          </div>
        </div>
      </>
    )
  }

  // Now we're guaranteed: not loading, has items, displayItems is array
  return (
    <>
      <Navbar />
      <div className="cart-page" style={{maxWidth:1100,margin:'0 auto'}}> 
        <div style={{display:'flex',alignItems:'center',gap:12,justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M3 3h2l1.4 9.4a2 2 0 002 1.6h9.2a2 2 0 001.9-1.5L21 7H6" stroke="#0f1724" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="10" cy="20" r="1" fill="#0f1724" />
              <circle cx="18" cy="20" r="1" fill="#0f1724" />
            </svg>
            <h2 style={{margin:0}}>Shopping Cart</h2>
          </div>
          <div style={{color:'#6b7280'}}>{displayItems.length} item{displayItems.length!==1 ? 's' : ''}</div>
        </div>

        {placedOrder && (
          <div className="card" style={{display:'flex',gap:12,alignItems:'center',marginTop:14,border:'1px solid rgba(34,197,94,0.12)',background:'linear-gradient(180deg,#f6fffa,#ffffff)'}}>
            <div style={{width:52,height:52,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:999,background:'rgba(34,197,94,0.12)',color:'#059669'}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <div style={{flex:1}}>
              <div style={{fontWeight:800}}>Order placed successfully!</div>
              <div className="muted" style={{marginTop:6}}>Your order ({placedOrder.orderId}) has been placed and will be processed shortly.</div>
            </div>

            <div style={{marginLeft:12}}>
              <a href="/home" className="btn-enter-big">Continue shopping</a>
            </div>
          </div>
        )}

        <div className="cart-grid" style={{marginTop:18,display:'grid',gridTemplateColumns:'1fr 360px',gap:20}}>
          <div className="cart-items">
            {displayItems.map(item=> {
              const avail = Number(item.availability || 0)

              const imageSrc =Array.isArray(item.images) && item.images.length > 0 ? `${item.images[0]}`: null


              return (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-left">
                    <div className="cart-thumb" role="img" aria-label={item.name}>
                      <Thumb src={imageSrc} alt={item.name} />
                    </div>
                  </div>

                  <div className="cart-item-center">
                    <div className="cart-title">{item.name}</div>
                    <div className="cart-meta muted">₹{Number(item.price).toFixed(2)}</div>
                    {avail !== null && item.quantity > avail && (
                      <div style={{color:'#b91c1c', marginTop:6}}>Only {avail} available. Please reduce quantity.</div>
                    )}
                  </div>

                  <div className="cart-item-right">
                    <div className="qty-control" role="group" aria-label={`Quantity for ${item.name}`}>
                      <button 
                        className="qty-btn" 
                        onClick={() => handleDecreaseQty(item)} 
                        disabled={item.quantity <= 1} 
                        aria-label="Decrease quantity"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden><path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>

                      <div className="qty-val" aria-live="polite">{item.quantity}</div>

                      <button 
                        className="qty-btn" 
                        onClick={() => handleIncreaseQty(item)} 
                        aria-label="Increase quantity"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                    </div>

                    <button 
                      className="icon-btn" 
                      onClick={() => handleRemoveItem(item)} 
                      title="Remove item" 
                      aria-label="Remove item"
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden>
                        <path d="M3 6h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        <rect x="8" y="8" width="8" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M10 11v4M14 11v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}

            <div style={{display:'flex',justifyContent:'flex-end',marginTop:8,fontWeight:700}} className="cart-items-subtotal">Subtotal ({displayItems.length} items): ₹{total.toFixed(2)}</div>
          </div>

          <aside className="card cart-summary">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{color:'#6b7280'}}>Subtotal ({displayItems.length} items)</div>
              <div style={{fontSize:18,fontWeight:700}}>₹{total.toFixed(2)}</div>
            </div>

            <div style={{marginTop:14}}>
              <button
                className="btn-add"
                onClick={handlePlaceOrder}
                disabled={processing || displayItems.length === 0}
                aria-busy={processing}
                style={{width:'100%'}}
              >
                {processing ? 'Placing order...' : 'Place Order'}
              </button>
            </div>

            <div style={{marginTop:12,color:'#6b7280',fontSize:13}}>Shipping & taxes calculated at checkout (simulated)</div>
          </aside>
        </div>

        {orderMessage && (
          <div className="card" style={{marginTop:12, background:'#fff5f5', border: '1px solid rgba(185,28,28,0.08)', color:'#991b1b'}}>{orderMessage}</div>
        )}
      </div>
    </>
  )
}
