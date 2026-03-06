import { Link, Outlet, useNavigate } from 'react-router-dom'
import './Admin.css'

export default function AdminLayout(){
  const navigate = useNavigate()
  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <div className="admin-brand">ShopSphere Admin</div>
        <nav>
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/products">Products</Link>
          <Link to="/admin/orders">Orders</Link>
          <Link to="/admin/users">Users</Link>
        </nav>
        <div style={{marginTop:'auto'}}>
          <button
            className="small-btn logout-btn"
            onClick={()=>{ localStorage.removeItem('currentUser'); navigate('/home') }}
            aria-label="Logout"
            title="Logout"
          >
            <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flex:'0 0 16px'}}>
              <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
            </svg>
            <span style={{marginLeft:10}}>Logout</span>
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
