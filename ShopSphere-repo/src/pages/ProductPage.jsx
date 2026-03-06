import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { PRODUCTS } from '../services/products'
import { useContext } from 'react'
import { CartContext } from '../context/CartContext'
import './ProductPage.css'
import { getCategoryExtra } from '../services/categoryDescriptions' 

export default function ProductPage(){
  const { id } = useParams()
  const navigate = useNavigate()
  const product = PRODUCTS.find(p=> String(p.id) === String(id))
  const { addItem } = useContext(CartContext)
  const [qty, setQty] = useState(1)

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

  const total = (product.price || 0) * qty

  return (
    <div className="product-page-root">
      <Navbar />

      <main className="product-page container">
        <div className="product-main card">
          <div className="product-left">
            <div className="product-image">
              <img src={`https://picsum.photos/seed/prod${product.id}/640/480`} alt={product.name} />
            </div>

            <div className="product-thumbs">
              {[1,2,3].map(n=> (
                <div key={n} className="thumb">
                  <img src={`https://picsum.photos/seed/prod${product.id + n}/240/180`} alt={`${product.name} ${n}`} />
                </div>
              ))}
            </div>
          </div>

          <div className="product-right">
            <h1 className="product-title">{product.name}</h1>
            <div className="muted" style={{marginTop:6}}>{product.brand} • {product.category}</div>

            <div className="product-price-large">₹{product.price.toFixed(2)}</div>
            <div className="muted" style={{marginTop:6}}>In stock</div>

            <div className="product-actions" style={{marginTop:18}}>
              <select value={qty} onChange={e=>setQty(Number(e.target.value))} aria-label="Quantity" className="qty-select">
                {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}</option>)}
              </select>

              <button className="btn-add" onClick={()=> addItem(product, qty)}>Add to Cart</button>
              <button className="btn-primary" onClick={()=> alert('Buy Now clicked (placeholder)')}>Buy Now</button>
            </div>

            <div className="product-total muted" style={{marginTop:12}}>Total: <strong>₹{total.toFixed(2)}</strong></div>
          </div>
        </div>

        <div className="product-details card">
          <h3>Description</h3>
          <p className="muted">{product.description}</p>
          {getCategoryExtra(product.category).map((txt, idx) => (
            <p className="muted" key={idx} style={{marginTop:6}}>{txt}</p>
          ))}

          <h4 style={{marginTop:12}}>Features</h4>
          <p className="muted">{product.features}</p>

          <h4 style={{marginTop:12}}>Tags</h4>
          <p className="muted">{product.tags}</p>

          <h4 style={{marginTop:12}}>Attributes</h4>
          <div className="attributes">
            {product.attributes_json && Object.entries(product.attributes_json).map(([k,v])=> (
              <div className="attr" key={k}><span className="attr-key">{k}</span>: <span className="attr-val">{String(v)}</span></div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}