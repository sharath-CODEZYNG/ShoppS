import { useState, useEffect, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getProductById, addToCart, fetchCart } from '../services/api'
import { CartContext } from '../context/CartContext'
import { parseProductImages, getImageUrl } from '../utils/imageUtils'
import './ProductPage.css'
import { getCategoryExtra } from '../services/categoryDescriptions'
import StarRating from "../components/StarRating"

// Helper to get current logged-in user from localStorage
function getCurrentUser() {
  try {
    const userJson = localStorage.getItem('user')
    return userJson ? JSON.parse(userJson) : null
  } catch (err) {
    console.error('Error parsing currentUser:', err)
    return null
  }
} 

export default function ProductPage(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const { setCart } = useContext(CartContext)
  const [qty, setQty] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    setLoading(true)
    getProductById(id).then(data => {
      if (!data) {
        setProduct(null)
        setLoading(false)
        return
      }
      const prod = { ...data }
      // Parse attributes_json if it's a JSON string
      if (prod.attributes_json && typeof prod.attributes_json === 'string') {
        try { prod.attributes_json = JSON.parse(prod.attributes_json) } catch (e) { prod.attributes_json = {} }
      }
      // Ensure numeric price for calculations
      prod.price = prod.price !== undefined && prod.price !== null ? Number(prod.price) : 0
      setProduct(prod)
      setLoading(false)
    }).catch((err) => {
      console.error('Error loading product:', err)
      setProduct(null)
      setLoading(false)
    })
  }, [id])

  if(loading) return (
    <div className="product-page-root">
      <Navbar />
      <main className="product-page container">
        <div className="card" style={{padding:40, textAlign:'center'}}>
          <p className="muted">Loading product...</p>
        </div>
      </main>
    </div>
  )

  if(!product) return (
    <div className="product-page-root">
      <Navbar />
      <main className="product-page container">
        <div className="card" style={{padding:40, textAlign:'center'}}>
          <h2>Product not found</h2>
          <p className="muted">We couldn't locate this product. It may have been removed.</p>
          <div style={{marginTop:18}}>
            <button className="landing-cta" onClick={()=>navigate('/home')}>Back to Home</button>
          </div>
        </div>
      </main>
    </div>
  )

  const total = (Number(product.price) || 0) * qty

  return (
    <div className="product-page-root">
      <Navbar />

      <main className="product-page container">
        <div className="product-main card">
          <div className="product-left">
            <div className="product-image">
              <img src={getImageUrl(parseProductImages(product.images)[0], false)} alt={product.name} />
            </div>

            <div className="product-thumbs">
              {(() => {
                const images = parseProductImages(product.images)
                return images.length > 0 ? (
                  images.map((img, idx) => (
                    <div key={idx} className="thumb">
                      <img src={getImageUrl(img, false)} alt={`${product.name} ${idx+1}`} />
                    </div>
                  ))
                ) : (
                  [1,2,3].map(n=> (
                    <div key={n} className="thumb">
                      <img src={'/placeholder.png'} alt={`${product.name} ${n}`} />
                    </div>
                  ))
                )
              })()}
            </div>
          </div>

          <div className="product-right">
            <h1 className="product-title">{product.name}</h1>
            <div className="muted" style={{marginTop:6}}>{product.brand} • {product.category}</div>

            <div className="product-price-large">₹{Number(product.price).toFixed(2)}</div>
            <div style={{marginTop:10}}>
              <StarRating
                rating={product.rating_avg}
                count={product.rating_count}
                size={18}
              />
            </div>
            <div className="muted" style={{marginTop:6}}>
  {Number(product.availability) > 0
    ? `In stock (${product.availability})`
    : 'Out of stock'}
</div>


            <div className="product-actions" style={{marginTop:18}}>
              <select value={qty} onChange={e=>setQty(Number(e.target.value))} aria-label="Quantity" className="qty-select">
                {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}</option>)}
              </select>

              <button className="btn-add" onClick={async ()=>{
                // Step 1: Verify user is logged in
                const user = getCurrentUser()
                if (!user) {
                  setAddError('Please login first')
                  return
                }

                const quantity = Number(qty) || 1
                if(quantity < 1) return

                setAddError(null)
                setIsAddingToCart(true)

                try {
                  // Step 2: Call backend POST /api/cart/add with correct user ID
                  console.log(`[ProductPage] Adding to cart: userId=${user.id}, productId=${product.id}, qty=${quantity}`)
                  const addRes = await addToCart(user.id, product.id, quantity)

                  if(!addRes || !addRes.success) {
                    const errorMsg = addRes?.message || 'Failed to add to cart'
                    setAddError(errorMsg)
                    console.error('[ProductPage] Add to cart failed:', errorMsg)
                    return
                  }

                  // Step 3: Re-fetch cart from backend to sync CartContext
                  console.log('[ProductPage] Add successful, fetching updated cart from backend...')
                  const cartRes = await fetchCart(user.id)

                  if(!cartRes || !cartRes.success) {
                    const errorMsg = cartRes?.message || 'Failed to fetch updated cart'
                    setAddError(errorMsg)
                    console.error('[ProductPage] Fetch cart failed:', errorMsg)
                    return
                  }

                  // Step 4: Update CartContext with backend data (backend is single source of truth)
                  const cartData = cartRes.data || []
                  setCart(cartData)
                  console.log(`[ProductPage] Cart synced from backend: ${cartData.length} items`)

                  // Reset quantity selector
                  setQty(1)
                  setAddError(null)

                } catch(err) {
                  setAddError('Failed to add to cart')
                  console.error('[ProductPage] Add to cart error:', err)
                } finally {
                  setIsAddingToCart(false)
                }
              }} disabled={isAddingToCart}>{isAddingToCart ? 'Adding...' : 'Add to Cart'}</button>
              {/* <button className="btn-primary" onClick={()=> alert('Buy Now clicked (placeholder)')}>Buy Now</button> */}
            </div>

            {addError && (
              <div style={{marginTop:12, color:'#b91c1c', fontSize:13}} role="alert">{addError}</div>
            )}

            <div className="product-total muted" style={{marginTop:12}}>Total: <strong>₹{total.toFixed(2)}</strong></div>
          </div>
        </div>

        <div className="product-details card">
          <h3>Description</h3>
          <p className="muted">{product.description}</p>
          {product.category && getCategoryExtra(product.category).map((txt, idx) => (
            <p className="muted" key={idx} style={{marginTop:6}}>{txt}</p>
          ))}

          <h4 style={{marginTop:12}}>Features</h4>
          <p className="muted">{product.features}</p>

          <h4 style={{marginTop:12}}>Tags</h4>
          <p className="muted">{product.tags}</p>

          <h4 style={{marginTop:12}}>Attributes</h4>
          <div className="attributes">
            {product.attributes_json && typeof product.attributes_json === 'object' && Object.entries(product.attributes_json).map(([k,v])=> (
              <div className="attr" key={k}><span className="attr-key">{k}</span>: <span className="attr-val">{String(v)}</span></div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}