// import img1 from '../assets/1.jpeg'
// import img2 from '../assets/2.jpeg'
// import img3 from '../assets/3.jpeg'
// import img4 from '../assets/4.jpeg'
// import img5 from '../assets/5.jpeg'

export default function HeroBanner() {
  return (
    <section className="hero-card">
      <div className="hero-inner">
        
        <div className="hero-left">
          <div className="hero-tag">ShopSphere Collections</div>

          <h1 className="hero-title">
            Discover the best deals on products you love
          </h1>

          <p className="hero-sub">
            Best quality products in town
          </p>

          <div style={{ marginTop: 16 }}>
            <a className="btn-primary" href="#flash">
              See Trending Products
            </a>
          </div>
        </div>

        <div className="hero-right">
         <div className="hero-media-wrapper">
    <video
      className="hero-video"
      src="/videos/herovid.mp4"
      autoPlay
      loop
      muted
      playsInline
    />
  </div>
        </div>

      </div>
    </section>
  )
}
