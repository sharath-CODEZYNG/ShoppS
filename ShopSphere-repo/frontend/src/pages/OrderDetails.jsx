import { Link, useNavigate, useParams } from 'react-router-dom'
import { useContext, useEffect, useState, useMemo } from 'react'
import { CartContext } from '../context/CartContext'

// import { orderAPI } from '../services/api'
import Navbar from '../components/Navbar'
import { getProductImageUrl } from '../utils/imageUtils'
import { orderAPI, reviewAPI } from '../services/api'
export default function OrderDetails(){
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { orders = [] } = useContext(CartContext)

  const [fetchedOrderRaw, setFetchedOrderRaw] = useState(null)
  const [loading, setLoading] = useState(false)

  // Find raw order from context if present (support different id keys)
  const contextOrderRaw = orders.find(o => String(o.orderId) === String(orderId) || String(o.id) === String(orderId))

  // Normalize any incoming order shape into a consistent shape with numeric fields
  const normalizeOrder = (raw = {}) => {
    const items = Array.isArray(raw.items) ? raw.items : []
    return {
      orderId: raw.orderId ?? raw.id ?? raw.order_id ?? null,
      orderDate: raw.orderDate ?? raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
      totalAmount: Number(raw.total_amount ?? raw.totalAmount ?? raw.total ?? 0) || 0,
      orderStatus: raw.orderStatus ?? raw.status ?? 'Placed',
      items: items.map(it => ({
        productId: it.productId ?? it.product_id ?? it.id ?? null,
        name: it.name ?? it.title ?? '',
        price: Number(it.price ?? it.unit_price ?? it.unitPrice ?? 0) || 0,
        quantity: Number(it.quantity ?? it.qty ?? it.count ?? 0) || 0,
        images: typeof it.images === 'string'
  ? it.images.split(',')
  : Array.isArray(it.images)
  ? it.images
  : []

      }))
    }
  }

  useEffect(() => {
    let mounted = true
    const fetchOrder = async () => {
      if (contextOrderRaw) return
      setLoading(true)
      try {
        const res = await orderAPI.getOrderById(orderId)
        if (res && res.success && mounted) {
          // backend returns { success: true, data: { ... } }
          // prefer the nested payload when present
          setFetchedOrderRaw(res.data?.data ?? res.data)
        }
      } catch (err) {
        console.error('Failed to fetch order by id:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchOrder()
    return () => { mounted = false }
  }, [orderId, contextOrderRaw])

  // Memoized normalized order to avoid scatter of Number() in JSX
  const order = useMemo(() => {
    if (contextOrderRaw) return normalizeOrder(contextOrderRaw)
    if (fetchedOrderRaw) return normalizeOrder(fetchedOrderRaw)
    return null
  }, [contextOrderRaw, fetchedOrderRaw])

  if (loading) {
    return (
      <div style={{padding:24, maxWidth:980, margin:'24px auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="search-back" onClick={()=>navigate('/orders')}>← Back</button>
          <h2 style={{margin:0}}>Loading order...</h2>
        </div>
      </div>
    )
  }

  if(!order){
    return (
      <div style={{padding:24, maxWidth:980, margin:'24px auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="search-back" onClick={()=>navigate('/orders')}>← Back</button>
          <h2 style={{margin:0}}>Order not found</h2>
        </div>

        <div className="card" style={{marginTop:18,textAlign:'center'}}>
          <div className="muted">We couldn't find an order with ID <strong>{orderId}</strong>.</div>
          <div style={{marginTop:16}}><Link to="/orders" className="btn-enter-big">Back to My Orders</Link></div>
        </div>
      </div>
    )
  }
  const subtotal = order.items.reduce((s,it)=> s + (it.price || 0) * (it.quantity || 0), 0)
  const totalItems = order.items.reduce((s,it)=> s + (it.quantity || 0), 0)

  // Helper to get current logged-in user from localStorage (used for rating-status requests)
  const currentUser = (() => {
    try {
      const u = localStorage.getItem('user')
      return u ? JSON.parse(u) : null
    } catch (e) {
      return null
    }
  })()

  // Per-item component to preserve identical markup but add per-item rated state and effect
  function OrderItem({ item, idx }) {
    const [rated, setRated] = useState(false)
    const [selectedRating, setSelectedRating] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [reviewed, setReviewed] = useState(false)

    const [canReview, setCanReview] = useState(false)

    const [reviewText, setReviewText] = useState('')

    const [isSubmittingReview, setIsSubmittingReview] = useState(false)
    useEffect(() => {
      let mounted = true
      if (!currentUser) return // nothing to check when not logged in

      const check = async () => {
        try {
          const productId = item.productId ?? item.product_id
          const orderId = order.orderId ?? order.id
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
          const url = `${API_URL}/products/${productId}/order/${orderId}/rating-status?userId=${currentUser.id}`
         const token = localStorage.getItem('token')

        const resp = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`

  }
})

if (!resp.ok) {
  console.error('Rating status check failed:', resp.status)
  return
}

const data = await resp.json()

          if (!mounted) return
          setRated(data?.data?.rated || false)
        } catch (err) {
          console.error('Failed to fetch rating status for product', item.productId ?? item.product_id, err)
        }
      }

      check()
      return () => { mounted = false }
    }, [item.productId, order.orderId, currentUser])

//changes for review status check
useEffect(() => {

let mounted = true

if (!currentUser || !isDelivered) return

const checkReviewStatus = async () => {

try {

const productId = item.productId ?? item.product_id

const currentOrderId = order.orderId ?? order.id

const data = await reviewAPI.getReviewStatus(productId, currentOrderId)

if (!mounted) return

setCanReview(Boolean(data?.data?.canReview))

setReviewed(Boolean(data?.data?.reviewed))

} catch (err) {

  console.error('Failed to fetch review status for product', item.productId ?? item.product_id, err)

}

}

checkReviewStatus()

return () => { mounted = false }

}, [item.productId, order.orderId, currentUser, isDelivered])



    const handleSubmitRating = async () => {
      if (selectedRating < 1 || selectedRating > 5) return
      if (!currentUser || isSubmitting || rated) return

      setIsSubmitting(true)
      try {
        const productId = item.productId ?? item.product_id
        const orderId = order.orderId ?? order.id
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
        const token = localStorage.getItem('token')

        const resp = await fetch(`${API_URL}/products/${productId}/rate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            rating: selectedRating,
            orderId: orderId
          })
        })

        const data = await resp.json()
        if (data.success) {
          setRated(true)
          setSelectedRating(0)
        } else {
          alert('Failed to submit rating')
          console.error('Failed to submit rating:', data.message)
        }
      } catch (err) {
        alert('Failed to submit rating')
        console.error('Error submitting rating:', err)
      } finally {
        setIsSubmitting(false)
      }
    }


    const handleSubmitReview = async () => {

if (!currentUser || !canReview || reviewed || isSubmittingReview) return

const text = reviewText.trim()

if (!text) return

setIsSubmittingReview(true)

try {

const productId = item.productId ?? item.product_id

const currentOrderId = order.orderId ?? order.id

const data = await reviewAPI.submitReview(productId, {

orderId: currentOrderId,

reviewText: text

})

if (data?.success) {

setReviewed(true)

setReviewText('')

} else {

alert(data?.message || 'Failed to submit review')

}

} catch (err) {

console.error('Error submitting review:', err)

alert('Failed to submit review')

} finally {

setIsSubmittingReview(false)

}

}

    const img = getProductImageUrl(item.images, 0)

    return (
      <div key={idx} className="card" style={{display:'flex',gap:12,alignItems:'center'}}>
        <div style={{width:84,height:84,flex:'0 0 84px',borderRadius:10,overflow:'hidden',border:'1px solid #eef2f7',background:'#fbfdff',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <img src={img} alt={item.name} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
        </div>

        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700}}>{item.name}</div>
          <div className="muted" style={{marginTop:6}}>{item.quantity} × ₹{item.price.toFixed(2)}</div>
          {isDelivered && !rated && (
            <div style={{marginTop:10, display:'flex', alignItems:'center', gap:8}}>
              <div style={{display:'flex', gap:4}}>
                {[1, 2, 3, 4, 5].map(star => (
                  <span
                    key={star}
                    onClick={() => !rated && setSelectedRating(star)}
                    style={{
                      fontSize:18,
                      cursor: rated ? 'not-allowed' : 'pointer',
                      color: star <= selectedRating ? '#f5b301' : '#ccc',
                      transition:'color 0.2s',
                      opacity: rated ? 0.6 : 1,
                      pointerEvents: rated ? 'none' : 'auto'
                    }}
                  >
                    ★
                  </span>
                ))}
              </div>
              <button
                onClick={handleSubmitRating}
                disabled={selectedRating < 1 || isSubmitting || rated}
                style={{
                  padding:'4px 10px',
                  fontSize:12,
                  fontWeight:700,
                  background: (selectedRating < 1 || isSubmitting || rated) ? '#ccc' : '#3b82f6',
                  color:'white',
                  border:'none',
                  borderRadius:4,
                  cursor: (selectedRating < 1 || isSubmitting || rated) ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          )}
          {isDelivered && rated && (
            <div style={{marginTop:10, padding:'4px 10px', background:'#ecfdf5', color:'#059669', fontWeight:700, fontSize:12, borderRadius:4, display:'inline-block'}}>
              Rated ✓
            </div>
          )}
          {isDelivered && canReview && !reviewed && (

<div style={{marginTop:10}}>

<textarea

value={reviewText}

onChange={(e) => setReviewText(e.target.value)}

placeholder="Write your review..."

maxLength={2000}

style={{

width: '100%',

minHeight: 72,

resize: 'vertical',

border: '1px solid #d1d5db',

borderRadius: 8,

padding: 8,

fontSize: 13

}}

/>

<div style={{marginTop:8, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10}}>

<span className="muted" style={{fontSize:12}}>

{reviewText.trim().length}/2000

</span>

<button

onClick={handleSubmitReview}

disabled={!reviewText.trim() || isSubmittingReview}

style={{

padding:'6px 12px',

fontSize:12,

fontWeight:700,

background: (!reviewText.trim() || isSubmittingReview) ? '#ccc' : '#10b981',

color:'white',

border:'none',

borderRadius:4,

cursor: (!reviewText.trim() || isSubmittingReview) ? 'not-allowed' : 'pointer'

}}

>

{isSubmittingReview ? 'Submitting...' : 'Submit Review'}

</button>

</div>

</div>

)}

{isDelivered && reviewed && (

<div style={{marginTop:10, padding:'4px 10px', background:'#eff6ff', color:'#1d4ed8', fontWeight:700, fontSize:12, borderRadius:4, display:'inline-block'}}>

Reviewed ✓

</div>

)}
        </div>

        <div style={{textAlign:'right',minWidth:100,fontWeight:700}}>₹{((item.price) * (item.quantity)).toFixed(2)}</div>
      </div>
    )
  }

  const isDelivered = (order.orderStatus ?? order.status ?? '').toLowerCase() === 'delivered';

  return (
    <>
      <Navbar />
      <div className="page-container" style={{paddingTop:18}}>
        <div style={{padding:24, maxWidth:1100, margin:'24px auto'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <button className="search-back" onClick={()=>navigate('/orders')}>← Back</button>
              <div>
                <div style={{fontSize:18,fontWeight:800}}>Order {order.orderId}</div>
                <div className="muted" style={{marginTop:6}}>{new Date(order.orderDate).toLocaleString()}</div>
              </div>
            </div>

            <div style={{textAlign:'right'}}>
              <div className={`order-badge status-${(order.orderStatus || 'Placed').toLowerCase()}`} style={{display:'inline-block'}}>{order.orderStatus}</div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:20,marginTop:20}}>
            <div>
              <div style={{display:'grid',gap:12}}>
                {order.items.map((it, idx) => (
                  <OrderItem key={idx} item={it} idx={idx} />
                ))}
              </div>
            </div>

            <aside className="card" style={{height:'fit-content'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div className="muted">Subtotal ({totalItems} items)</div>
                <div style={{fontWeight:800}}>₹{subtotal.toFixed(2)}</div>
              </div>

              <div style={{marginTop:12,display:'grid',gap:8}}>
                <div style={{display:'flex',justifyContent:'space-between',color: 'var(--muted)'}}><div>Shipping</div><div>Calculated at checkout</div></div>
                <div style={{display:'flex',justifyContent:'space-between',fontWeight:800,fontSize:18}}><div>Total</div><div>₹{order.totalAmount.toFixed(2)}</div></div>
              </div>

              <div style={{marginTop:18}}>
                <Link to="/home" className="btn-add" style={{width:'100%',display:'inline-flex',justifyContent:'center'}}>Continue shopping</Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  )
}
