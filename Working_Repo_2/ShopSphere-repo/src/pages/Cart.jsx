import { useContext, useState } from 'react'
import { CartContext } from '../context/CartContext'
import { PRODUCTS } from '../services/products'
import Navbar from '../components/Navbar' 

// Cart page UI: shows items added to cart and allows quantity update
export default function Cart(){
  const { cart, removeItem, updateQty, placeOrder } = useContext(CartContext)
  const [orderMessage, setOrderMessage] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [placedOrder, setPlacedOrder] = useState(null)

  const total = cart.reduce((s,i)=>s + i.price * i.quantity, 0)

  async function handlePlaceOrder(){
    if(processing) return
    setOrderMessage(null)
    // Validate against availability (keep existing behavior)
    for(const item of cart){
      const prod = PRODUCTS.find(p=>p.id === item.productId)
      if(!prod) continue
      const avail = Number(prod.availability || 0)
      if(avail === 0 || item.quantity > avail){
        setOrderMessage('Stock updated. Please review your cart.')
        return
      }
    }

    try{
      setProcessing(true)
      // create frontend-only order and clear cart via context
      const order = placeOrder({ note: 'Placed from cart UI' })
      if(order){
        setPlacedOrder(order)
        setOrderMessage('Order placed successfully!')
      } else {
        setOrderMessage('Unable to place order — your cart may be empty.')
      }
    }catch(err){
      setOrderMessage('Something went wrong — please try again.')
    }finally{
      setProcessing(false)
    }
  }

  // small thumb component with error fallback
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
        <div style={{color:'#6b7280'}}>{cart.length} item{cart.length!==1 ? 's' : ''}</div>
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

      {cart.length === 0 ? (
        <div className="card empty-cart" style={{marginTop:18,textAlign:'center'}}>
          <svg width="84" height="84" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M3 3h2l1.4 9.4a2 2 0 002 1.6h9.2a2 2 0 001.9-1.5L21 7H6" stroke="#9aa4b2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="10" cy="20" r="1" fill="#9aa4b2" />
            <circle cx="18" cy="20" r="1" fill="#9aa4b2" />
          </svg>
          <h3 style={{marginTop:12}}>Your cart is empty</h3>
          <div className="muted" style={{marginTop:8}}>Looks like you haven't added anything to your cart yet.</div>
            <div style={{marginTop:16}}><a href="/home" className="btn-enter-big">Continue shopping</a></div>
        </div>
      ) : (
        <div className="cart-grid" style={{marginTop:18,display:'grid',gridTemplateColumns:'1fr 360px',gap:20}}>
          <div className="cart-items">
            {cart.map(item=> {
              const prod = PRODUCTS.find(p=>p.id === item.productId)
              const avail = prod ? Number(prod.availability || 0) : null
              const imageSrc = item.image || prod?.images?.[0] || (prod ? `https://picsum.photos/seed/prod${prod.id}/320/320` : null)
              return (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-left">
                    <div className="cart-thumb" role="img" aria-label={item.name}>
                      <Thumb src={imageSrc} alt={item.name} />
                    </div>
                  </div>

                  <div className="cart-item-center">
                    <div className="cart-title">{item.name}</div>
                    <div className="cart-meta muted">₹{item.price.toFixed(2)}</div>
                    {avail !== null && item.quantity > avail && (
                      <div style={{color:'#b91c1c', marginTop:6}}>Only {avail} available. Please reduce quantity.</div>
                    )}
                  </div>

                  <div className="cart-item-right">
                    <div className="qty-control" role="group" aria-label={`Quantity for ${item.name}`}>
                      <button className="qty-btn" onClick={() => updateQty(item.id, Math.max(1, item.quantity - 1))} disabled={item.quantity <= 1} aria-label="Decrease quantity">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden><path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>

                      <div className="qty-val" aria-live="polite">{item.quantity}</div>

                      <button className="qty-btn" onClick={() => updateQty(item.id, item.quantity + 1)} aria-label="Increase quantity">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      </button>
                    </div>

                    <button className="icon-btn" onClick={() => removeItem(item.id)} title="Remove item" aria-label="Remove item">
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

            <div style={{display:'flex',justifyContent:'flex-end',marginTop:8,fontWeight:700}} className="cart-items-subtotal">Subtotal ({cart.length} items): ₹{total.toFixed(2)}</div>
          </div>

          <aside className="card cart-summary">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{color:'#6b7280'}}>Subtotal ({cart.length} items)</div>
              <div style={{fontSize:18,fontWeight:700}}>₹{total.toFixed(2)}</div>
            </div>

            <div style={{marginTop:14}}>
              <button
                className="btn-add"
                onClick={handlePlaceOrder}
                disabled={processing || cart.length === 0}
                aria-busy={processing}
                style={{width:'100%'}}
              >
                {processing ? 'Placing order...' : 'Place Order'}
              </button>
            </div>

            <div style={{marginTop:12,color:'#6b7280',fontSize:13}}>Shipping & taxes calculated at checkout (simulated)</div>
          </aside>
        </div>
      )}

      {orderMessage && (
        <div className="card" style={{marginTop:12, background:'#fff5f5', border: '1px solid rgba(185,28,28,0.08)', color:'#991b1b'}}>{orderMessage}</div>
      )}
    </div>
    </>
  )
}
