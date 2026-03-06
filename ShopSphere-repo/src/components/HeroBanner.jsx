import { useEffect, useState } from 'react'

export default function HeroBanner(){
  const images = [
    'https://picsum.photos/seed/collections-food/520/360',
    'https://picsum.photos/seed/collections-groceries/520/360',
    'https://picsum.photos/seed/collections-electronics/520/360',
    'https://picsum.photos/seed/collections-lifestyle/520/360',
    'https://picsum.photos/seed/collections-market/520/360'
  ]

  const [currentImageIndex, setCurrentImageIndex] = useState(0) 

  useEffect(()=>{
    const id = setInterval(()=>{
      setCurrentImageIndex(prev => (prev + 1) % images.length)
    }, 5000)
    return ()=> clearInterval(id)
  },[])

  return (
    <section className="hero card">
      <div className="hero-inner">
        <div className="hero-left">
          <div className="hero-tag">ShopSphere Collections</div>
          <h1 className="hero-title">Discover the best deals on products you love</h1>
          <p className="hero-sub">Best quality products in town</p>
          <div style={{marginTop:16}}>
            <a className="btn-primary" href="#flash">See Trending Products</a>
          </div>
        </div>

        <div className="hero-right">
          <img src={images[currentImageIndex]} alt={`collection ${currentImageIndex+1}`} />
        </div>
      </div>
    </section>
  )
}
