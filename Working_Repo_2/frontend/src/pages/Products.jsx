import { useEffect, useState, useContext } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getProducts } from '../services/api'
import { getCategoryExtra } from '../services/categoryDescriptions'
import { CartContext } from '../context/CartContext'
import StarRating from "../components/StarRating"

// Products page: list products and filter by category
export default function Products(){
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const category = searchParams.get('category')
  const { addItem } = useContext(CartContext)

  useEffect(()=>{
    setLoading(true)
    getProducts().then(res=>{
      setProducts(res)
      setLoading(false)
    }).catch(() => {
      setProducts([])
      setLoading(false)
    })
  },[])

  const filtered = category ? products.filter(p=>p.category===category) : products

  return (
    <div>
      <h2>Products {category?`— ${category}`:''}</h2>
      {loading ? <p className="muted">Loading...</p> : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
          {filtered.map(p=> (
            <div key={p.id} className="card">
              <h4>{p.name}</h4>
              <div className="muted">{p.category} • ₹{p.price.toFixed(2)}</div>
              <StarRating
                rating={p.rating_avg}
                count={p.rating_count}
              />
              <p style={{marginTop:8}}>{p.description}</p>
              {getCategoryExtra(p.category).map((txt, idx) => (
                <p key={idx} className="muted" style={{marginTop:6}}>{txt}</p>
              ))}
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button onClick={()=>addItem(p,1)}>Add to cart</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
