import { useNavigate } from 'react-router-dom'
export default function PremiumLanding(){
  const navigate = useNavigate()

  return (
    <div className="premium-landing-root">
      {/* HERO Video Section */}
      <section className="pl-hero">
        <video className="pl-video" autoPlay muted loop playsInline aria-hidden>
          <source src="/videos/shopsphere.mp4" type="video/mp4" />
          {/* Fallback image */}
        </video>

        <div className="pl-overlay" aria-hidden></div>

        <div className="pl-hero-content container">
          <div className="pl-hero-inner">
            <div className="pl-hero-text">
              <h1 className="pl-brand">ShopSphere</h1>
              <p className="pl-tagline">Everything you need. One smart place.</p>
              <div style={{marginTop:20}}>
                <button className="btn-enter-big" onClick={()=>navigate('/home')}>Enter ShopSphere</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About section */}
      <section className="pl-about container card">
        <h3>Smarter shopping for everyday life</h3>
        <p className="muted">ShopSphere brings essential food, groceries, and gadgets together, designed for a simple and reliable local shopping experience.</p>
      </section>

      {/* Credibility / Stats section */}
      <section className="pl-stats container">
        <div className="pl-stats-card card">
          <div className="stats-grid" role="list">
            <div className="stat-block" role="listitem">
              <div className="stat-icon" aria-hidden>🗂️</div>
              <div className="stat-number">3+</div>
              <div className="stat-label muted">Product Categories</div>
            </div>

            <div className="stat-block" role="listitem">
              <div className="stat-icon" aria-hidden>📍</div>
              <div className="stat-number">Udupi</div>
              <div className="stat-label muted">Serving Location</div>
            </div>

            <div className="stat-block" role="listitem">
              <div className="stat-icon" aria-hidden>🤝</div>
              <div className="stat-number">3k+</div>
              <div className="stat-label muted">Trusted Customers</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="pl-features container">
        <div className="features-grid">
          <div className="feature card">
            <div className="icon">⚡️</div>
            <h4>Fast & Easy Shopping</h4>
            <p className="muted">Quick checkout and efficient deliveries to keep your life moving.</p>
          </div>

          <div className="feature card">
            <div className="icon">🔍</div>
            <h4>Smart Search</h4>
            <p className="muted">Find products, brands, and categories in seconds.</p>
          </div>

          <div className="feature card">
            <div className="icon">📦</div>
            <h4>Category-Based Discovery</h4>
            <p className="muted">Explore curated collections across groceries, food and electronics.</p>
          </div>

          <div className="feature card">
            <div className="icon">✨</div>
            <h4>Modern UI Experience</h4>
            <p className="muted">A clean interface that helps you shop with confidence and speed.</p>
          </div>
        </div>
      </section>

      {/* Ecosystem card */}
      <section className="pl-ecosystem container">
        <div className="ecosystem-card card">
          <h4>ShopSphere Platform</h4>
          <p className="muted">One home for essentials, tech, and groceries with tools to make shopping effortless.</p>
          <div style={{marginTop:12}}>
            <button className="btn-enter" onClick={()=>navigate('/home')}>Go to ShopSphere</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="pl-footer container muted">
        <div>ShopSphere © 2026</div>
        <div>Internship Project – Codezyng</div>
      </footer>
    </div>
  )
}
