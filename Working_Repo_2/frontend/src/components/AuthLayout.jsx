import React from 'react'

export default function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <div className="bg-shape shape-a" />
      <div className="bg-shape shape-b" />

      <div className="auth-container">
        <aside className="branding-panel">
          <div className="brand-inner">
            <h1 className="brand-title">ShopSphere</h1>
            <p className="brand-tag">Commerce built for modern teams — fast, scalable, beautiful.</p>
            <div className="illustration-placeholder" aria-hidden />
          </div>
        </aside>

        <main className="auth-area">
          <div className="auth-card animate-enter">{children}</div>
        </main>
      </div>
    </div>
  )
}
