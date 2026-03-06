import { useNavigate } from 'react-router-dom'

export default function LandingPage(){
  const navigate = useNavigate()

  return (
    <div className="landing-root">
          <section className="landing-hero">
        <video className="landing-video" autoPlay muted loop playsInline>
          <source src="/videos/shopsphere.mp4" type="video/mp4" />
        </video>

        {/* HERO OVERLAY */}
        <div className="landing-overlay" role="banner" aria-label="ShopSphere landing">
          <div className="landing-inner">
            <h1 className="landing-title">ShopSphere</h1>
            <p className="landing-tagline">Discover curated products, groceries, and daily essentials — all in one smart place tailored for modern life.</p>
            <button className="landing-cta" onClick={()=> navigate('/home')} aria-label="Enter ShopSphere">Enter ShopSphere</button>
          </div>
        </div>
      </section>

      {/* INTRO / FEATURES */}
      <section className="offer-section container">
        <div className="offer-head">
          <h3>What’s waiting for you on ShopSphere?</h3>
          <p className="muted">Everything you need for your home — groceries, gadgets, and daily essentials, all in one smart place.</p>
        </div>

        <div className="offer-inner">
          <div className="offer-side offer-left">
            <div className="feature-card">
              <div className="feature-icon" aria-hidden>🥦</div>
              <div className="feature-label">Fresh Groceries</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon" aria-hidden>🍚</div>
              <div className="feature-label">Daily Essentials</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon" aria-hidden>🧼</div>
              <div className="feature-label">Home Care</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon" aria-hidden>🎁</div>
              <div className="feature-label">Gift Items</div>
            </div>
          </div>

          {/* <div className="offer-device" aria-hidden>
            <div className="device-frame">
              <div className="device-screen">
                <div className="mock-app">ShopSphere</div>
              </div>
            </div>
          </div> */}
   <div className="offer-device">
  <div className="spline-wrapper">
    <iframe
      src="https://my.spline.design/3dmovecopycopy-M5ynvMmUjfzW38DVwBymyb0l-FHC/"
      frameBorder="0"
      title="ShopSphere 3D"
    />
  </div>
</div>



          <div className="offer-side offer-right">
            <div className="feature-card">
              <div className="feature-icon" aria-hidden>🔌</div>
              <div className="feature-label">Smart Gadgets</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon" aria-hidden>📱</div>
              <div className="feature-label">Mobile Accessories</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon" aria-hidden>🔋</div>
              <div className="feature-label">Power &amp; Storage</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon" aria-hidden>🔥</div>
              <div className="feature-label">Trending Deals</div>
            </div>
          </div>
        </div>
      </section>

      {/* ECOSYSTEM */}
      <section className="ecosystem-section container">
        <div className="ecosystem-head">
          <h3>ShopSphere Ecosystem</h3>
          <p className="muted">A single destination for everything your home needs.</p>
        </div>

        <div className="ecosystem-inner" role="region" aria-label="ShopSphere ecosystem">
          <div className="ecosystem-card-large card">
            <div className="ecosystem-card-body">
              <h4 className="ecosystem-title">ShopSphere</h4>
              <p className="ecosystem-desc muted">Groceries, daily essentials, and smart gadgets — curated to make everyday shopping simple, fast, and reliable.</p>
              <div style={{marginTop:18}}>
                <button className="ecosystem-cta" onClick={()=>navigate('/home')}>Enter ShopSphere</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer" role="contentinfo">
        <div className="landing-footer-inner container">
          <div className="footer-left">
            <div className="footer-brand">ShopSphere</div>
            <div className="footer-tagline muted">Smart shopping for everyday living.</div>
          </div>

          <nav className="footer-nav" aria-label="Footer navigation">
            <a className="footer-link">About</a>
            <a className="footer-link">Contact</a>
            <a className="footer-link">Privacy Policy</a>
            <a className="footer-link">Terms of Service</a>
          </nav>
        </div>

        <div className="landing-footer-bottom">
          © {new Date().getFullYear()} ShopSphere. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
