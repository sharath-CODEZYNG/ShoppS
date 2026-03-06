import { useState, useContext } from 'react'
import { CartContext } from '../context/CartContext'

export default function ProductCard({product, compact, onAddToCart, onCardClick, showActions = true}){
  const { cart } = useContext(CartContext)
  const [quantity, setQuantity] = useState(1)
  const [isLiked, setIsLiked] = useState(false)
  const [error, setError] = useState(null)
  const totalPrice = (product.price || 0) * quantity
  const imgSrc = `https://picsum.photos/seed/prod${product.id}/320/240`
  const availability = Number(product.availability || 0)

  const currentInCart = cart.find(i=>i.productId === product.id)?.quantity || 0
  const remaining = Math.max(0, availability - currentInCart)

  const handleAdd = (e)=>{
    e && e.stopPropagation()
    const qty = Number(quantity) || 1
    if(qty < 1) return
    if(availability === 0){
      setError('Out of stock')
      return
    }
    if(currentInCart + qty > availability){
      setError(`Only ${remaining} items available for this product`)
      return
    }
    setError(null)
    if(typeof onAddToCart === 'function') onAddToCart(product, qty)
  }

  const handleCardClick = ()=>{
    if(typeof onCardClick === 'function') onCardClick(product)
  }

  const handleCardKeyDown = (e)=>{
    if((e.key === 'Enter' || e.key === ' ') && typeof onCardClick === 'function'){
      e.preventDefault()
      onCardClick(product)
    }
  }

  return (
    <article className={`product-card card ${compact ? 'compact' : ''}${!showActions ? ' no-actions' : ''}`} onClick={handleCardClick} onKeyDown={handleCardKeyDown} tabIndex={onCardClick ? 0 : -1} role={onCardClick ? 'button' : undefined}>
      <div className="product-media">
        <img src={imgSrc} alt={product.name} />
        <button
          className={`wish ${isLiked ? 'liked' : ''}`}
          aria-pressed={isLiked}
          title={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={(e)=>{ e.stopPropagation(); setIsLiked(v => !v) }}
        >
          <span className="heart">♥</span>
        </button>
      </div>

      <div className="product-body">
        <div className="product-title" style={{fontWeight:700}}>{product.name}</div>
        <div className="muted" style={{fontSize:12, marginTop:6}}>{product.brand}</div>
        <div className="product-meta" style={{marginTop:8}}>
          <div className="muted">{product.category}</div>
          {product.sold !== undefined && <div className="sold">{product.sold} sold</div>}
        </div>

        {showActions && (
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10}} className="product-actions">
            <div style={{display:'flex', flexDirection:'column'}}>
              <div className="product-price">₹{totalPrice.toFixed(2)}</div>
              <div style={{marginTop:8}}>
                {availability > 0 ? (
                  <select value={quantity} onChange={e=>setQuantity(Number(e.target.value))} onClick={(e)=>e.stopPropagation()} style={{padding:6,borderRadius:8}}>
                    {Array.from({length: availability}).map((_,i)=> (
                      <option key={i+1} value={i+1}>{i+1}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{padding:6,borderRadius:8, color:'#ff3b30', fontWeight:700}}>Out of stock</div>
                )}
              </div>
            </div>

            <button
              className="btn-add"
              onClick={handleAdd}
              disabled={availability === 0}
            >Add to Cart</button>
          </div>
        )}

        {showActions && error && (
          <div style={{marginTop:8, color:'#b91c1c', fontSize:13}} role="alert">{error}</div>
        )}

        {product.progress !== undefined && (
          <div className="progress" aria-hidden>
            <div className="progress-bar" style={{width: product.progress + '%'}}></div>
          </div>
        )}
      </div>
    </article>
  )
}
