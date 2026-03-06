// Admin UI placeholder. In a real app this route would be protected and show admin tools.
export default function Admin(){
  return (
    <div>
      <h2>Admin Panel (UI Placeholder)</h2>
      <div className="card">
        <p className="muted">This is a minimal admin layout. Admin logic and auth will be added later.</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:12}}>
          <div className="card">Products Management (placeholder)</div>
          <div className="card">Orders Management (placeholder)</div>
        </div>
      </div>
    </div>
  )
}
