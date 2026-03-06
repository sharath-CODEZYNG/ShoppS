import HeroBanner from '../components/HeroBanner'
import CategoryRow from '../components/CategoryRow'
import FlashSale from '../components/FlashSale'
import ProductCard from '../components/ProductCard'
import StoreCard from '../components/StoreCard'
import Footer from '../components/Footer'
import { useCategory } from '../context/CategoryContext'
import { useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios' 
// import { getProducts } from '../services/api'
import { getProducts, trackProductView } from '../services/api'


const API_URL = import.meta.env.VITE_API_URL || 'https://shopsphere-repo.onrender.com/api';


import captureitLogo from '../assets/captureit.png'
import datasafeLogo from '../assets/datasafe.jpeg'
import homeeaseLogo from '../assets/homeease.png'
import novatechLogo from '../assets/Novatech.png'
import safeplugLogo from '../assets/safeplug.png'
import sonicLogo from '../assets/sonic.png'
import styleproLogo from '../assets/Stylepro.png'
import visionxLogo from '../assets/visionx.png'

const brandLogos = {
  VisionX: visionxLogo,
  HomeEase: homeeaseLogo,
  SafePlug: safeplugLogo,
  CaptureIt: captureitLogo,
  NovaTech: novatechLogo,
  StylePro: styleproLogo,
  DataSafe: datasafeLogo,
  Sonic: sonicLogo
}




const STORES = Array.from({length:4}).map((_,i)=>({
  name: `Store ${i+1}`,
  tagline: 'Quality picks everyday',
  thumbs: Array.from({length:4})
}))


export default function Home(){
  const navigate = useNavigate()
  const { selectedCategory, searchQuery } = useCategory()
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const [popularProducts, setPopularProducts] = useState([])

 
  
  useEffect(() => {
    setLoading(true)
    getProducts().then(data => {
      setProducts(data)
      setLoading(false)
    }).catch(() => {
      setProducts([])
      setLoading(false)
    })

    let currentUserId = null
    try {
      const userRaw = localStorage.getItem('user')
      const parsedUser = userRaw ? JSON.parse(userRaw) : null
      currentUserId = parsedUser?.id ? Number(parsedUser.id) : null
    } catch {
      currentUserId = null
    }

    const trendingUrl = currentUserId
      ? `${API_URL}/recommend/trending?userId=${currentUserId}`
      : `${API_URL}/recommend/trending`

    axios.get(trendingUrl)
.then(res => {

setPopularProducts(res.data?.products ?? [])

})
.catch(err => {

console.error("Failed to fetch trending products", err)
setPopularProducts([])

})
.finally(() => {

setLoading(false)

})
  }, [])
  

  

  const toggleBrand = (brand) => setSelectedBrand(prev => prev === brand ? null : brand)

  const filteredByCategory = selectedCategory === 'All' ? products : products.filter(p => p.category === selectedCategory)
  // Revert: brand selection should filter across all products (not restricted by currently selected category)
  const filteredByBrand = selectedBrand ? products.filter(p => p.brand === selectedBrand) : filteredByCategory
  const finalProducts = searchQuery.trim() === ''
    ? filteredByBrand
    : filteredByBrand.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const openProduct = async (prod) => { //98-102
    if (!prod?.id) return
    await trackProductView(prod.id)
    navigate(`/product/${prod.id}`)
    }

  return (
    <div className="home-page-root" style={{background:'#f5f6fa'}}>
      <main className="page-container container">

        {/* Search Results: appears immediately below Navbar when searching */}
        {searchQuery.trim() !== '' && (
          <section className="section card">
            <div className="section-head">
              <h3>Search Results</h3>
            </div>

            {finalProducts.length === 0 ? (
              <div className="no-results muted" style={{textAlign:'center', padding:'36px 12px'}}>No products found. Please check the spelling.</div>
            ) : (
              <div className="grid products-grid">
                {finalProducts.map(p => (
                  // <ProductCard key={p.id} product={{...p, progress: Math.floor(Math.random()*80)}} onCardClick={(prod)=> navigate(`/product/${prod.id}`)} />
                  <ProductCard key={p.id} product={{...p, progress: Math.floor(Math.random()*80)}} onCardClick={(prod)=> openProduct(prod)} />
                ))}
                
                
              </div>
            )}
          </section>
        )}

        <HeroBanner />
        <CategoryRow />

        <FlashSale 
  // products={popularProducts.length ? popularProducts : products} 
  // onCardClick={(prod)=> navigate(`/product/${prod.id}`)} 
  products={popularProducts.length ? popularProducts : products} 
  onCardClick={(prod)=> openProduct(prod)} 
/>



        <section className="section card">
          <div className="section-head">
            <h3>Today's For You</h3>
            <div className="tabs">
              <button className="tab active">Best Seller</button>
              <button className="tab">New Arrivals</button>
              <button className="tab">Special Discount</button>
            </div>
          </div>

          {searchQuery.trim() !== '' ? (
            <div className="muted" style={{textAlign:'center', padding:'20px'}}>Search results are shown above.</div>
          ) : (
            <div className="grid products-grid">
              {finalProducts.map(p => (
                // <ProductCard key={p.id} product={{...p, progress: Math.floor(Math.random()*80)}} onCardClick={(prod)=> navigate(`/product/${prod.id}`)} />
                <ProductCard key={p.id} product={{...p, progress: Math.floor(Math.random()*80)}} onCardClick={(prod)=> openProduct(prod)} />
              ))}
            </div>
          )}
        </section>

        <section className="section">
          <h3>Best Selling Brands</h3>

          <div className="stores-grid brands-grid">
            {(() => {
              // const brands = [
              //   { name: 'NutriFit', color: '#3b82f6' },
              //   { name: 'MilkyDay', color: '#60a5fa' },
              //   { name: 'BakeHouse', color: '#8b5cf6' },
              //   { name: 'ChocoLove', color: '#f97316' },
              //   { name: 'NatureFarm', color: '#10b981' },
              //   { name: 'GrainGold', color: '#f59e0b' },
              //   { name: 'CleanMate', color: '#06b6d4' },
              //   { name: 'NovaTech', color: '#7c3aed' }
              // ]

              const uniqueBrands = [
...new Map(
(popularProducts || [])
.filter(p => p?.brand)  
.map(p => [p.brand, { name: p.brand }])
).values()
]

// Generate color dynamically (simple hash-based color)
const generateColor = (str) => {
let hash = 0
for (let i = 0; i < str.length; i++) {
hash = str.charCodeAt(i) + ((hash << 5) - hash)
}
const hue = hash % 360
return `hsl(${hue}, 70%, 50%)`
}

const brands = uniqueBrands.map(b => ({
name: b.name,
color: generateColor(b.name)
}))

              const toDataUri = (label, bg) => {
                const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><rect rx='128' width='100%' height='100%' fill='${bg}'/><text x='50%' y='56%' font-family='Inter, Arial' font-weight='700' font-size='96' text-anchor='middle' fill='white'>${label[0]}</text></svg>`
                return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
              }

              return brands.map(b => (
                <div
                  className={`brand-card ${selectedBrand === b.name ? 'active' : ''}`}
                  key={b.name}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedBrand === b.name}
                  onClick={() => toggleBrand(b.name)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBrand(b.name) } }}
                >
                  {/* <div className={`brand-avatar-wrap ${selectedBrand === b.name ? 'active' : ''}`}>
                    <img className="brand-avatar" src={toDataUri(b.name, b.color)} alt={`${b.name} logo`} />
                  </div> */}


                  <div className={`brand-avatar-wrap ${selectedBrand === b.name ? 'active' : ''}`}>
 <img
  className="brand-avatar"
  src={brandLogos[b.name] || toDataUri(b.name, b.color)}
  alt={`${b.name} logo`}
/>

</div>

                  <div className="brand-name">{b.name}</div>
                </div>
              ))
            })()}
          </div>
        </section>

      </main>

      <Footer />
    </div>
  )
}
