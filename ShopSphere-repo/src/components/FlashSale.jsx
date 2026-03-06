import ProductCard from './ProductCard'
import { useCategory } from '../context/CategoryContext'
import { useContext } from 'react'
import { CartContext } from '../context/CartContext'

const FAKE = Array.from({length:8}).map((_,i)=>({
  id: i+1,
  title: `Flash Product ${i+1}`,
  img: `https://picsum.photos/seed/flash${i+1}/320/240`,
  price: (10 + i*5) + Math.random()*20,
  sold: Math.floor(Math.random()*200)+20,
  progress: 20 + i*10
}))

export default function FlashSale({ products = FAKE, onAddToCart, onCardClick }){
  const { selectedCategory } = useCategory()

  // group products by category
  const food = products.filter(p => p.category === 'Food')
  const groceries = products.filter(p => p.category === 'Groceries')
  const electronics = products.filter(p => p.category === 'Electronic Gadgets')

  let trendingProducts = []

  if(selectedCategory === 'All'){
    // Interleave items from each category to mix products deterministically
    const groups = [food, groceries, electronics]
    let idx = 0
    while(trendingProducts.length < 8){
      let added = false
      for(const g of groups){
        if(g[idx]){
          trendingProducts.push(g[idx])
          if(trendingProducts.length === 8) break
          added = true
        }
      }
      if(!added) break
      idx++
    }
  } else if(selectedCategory === 'Food'){
    trendingProducts = food.slice(0,8)
  } else if(selectedCategory === 'Groceries'){
    trendingProducts = groceries.slice(0,8)
  } else if(selectedCategory === 'Electronic Gadgets'){
    trendingProducts = electronics.slice(0,8)
  } else {
    // Fallback: first 8 products
    trendingProducts = products.slice(0,8)
  }

  return (
    <section id="flash" className="flash card">
      <div className="flash-header">
        <h3>Trending Products</h3>
        <div className="countdown">Ends in 02:12:45</div>
      </div>

      <div className="flash-list">
        {trendingProducts.map(p => (
          <div className="flash-item" key={p.id}>
            <ProductCard product={p} compact onAddToCart={onAddToCart} onCardClick={onCardClick} showActions={false} />
          </div>
        ))}
      </div>
    </section>
  )
}
