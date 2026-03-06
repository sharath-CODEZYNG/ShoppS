import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminAPI } from '../services/adminAPI'
import { Link } from 'react-router-dom'

export default function AdminUsers(){
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

  // Check authorization on mount
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    const token = localStorage.getItem('token')
    
    // If not authenticated or not admin
    if (!token || !user || user.role !== 'admin') {
      console.warn('[AdminUsers] Unauthorized - redirecting to login')
      navigate('/login')
      return
    }
  }, [navigate])

  useEffect(()=>{
    const fetchUsers = async () => {
      try {
        console.log('[AdminUsers] Fetching users with token...')
        const response = await adminAPI.getUsers()
        console.log('[AdminUsers] API response:', response)

        if (response && response.success) {
          console.log('[AdminUsers] Setting users:', response.data || [])
          setUsers(response.data || [])
          setError('')
        } else {
          console.error('[AdminUsers] API returned success false')
          setError('Failed to load users')
          setUsers([])
        }
      } catch (error) {
        console.error('[AdminUsers] Error fetching users:', error?.response?.status, error?.message)
        
        // Handle specific error codes
        if (error?.response?.status === 401) {
          setError('Your session has expired. Please login again.')
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          navigate('/login')
        } else if (error?.response?.status === 403) {
          setError('You do not have permission to access this page.')
        } else {
          setError('Unable to load users. Please try again.')
        }
        setUsers([])
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  },[navigate])

  async function openUser(u){
    try{
      // fetch detailed user info (includes delivered totals)
      const resp = await adminAPI.getUser(u.id)
      if(resp?.success && resp.data){
        const { user, total_orders, total_spend, recent_orders } = resp.data
        setSelected({
          ...user,
          totalOrders: total_orders || 0,
          totalSpend: total_spend || 0,
          recentOrders: recent_orders || []
        })
      } else {
        // fallback to list item
        setSelected(u)
      }
    }catch(err){
      console.error('Error fetching user details',err)
      setSelected(u)
    }
  }

  function closeUser(){ setSelected(null) }

  function initials(name = ''){
    return (name || '').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()
  }

  function avatarColor(name = ''){
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
      hash = hash & hash
    }
    const hue = Math.abs(hash) % 360
    return `hsl(${hue} 64% 45%)`
  }

  const currentUser = JSON.parse(localStorage.getItem('user') || 'null')
  
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="admin-content">
        <h3>🔒 Access Denied</h3>
        <p>You must be logged in as an admin to view this page.</p>
        <p><Link to="/login">← Back to Login</Link></p>
      </div>
    )
  }

  if (loading) return <div className="admin-content"><p>Loading users...</p></div>

  if (error) {
    return (
      <div className="admin-content">
        <h3>⚠️ Error</h3>
        <p>{error}</p>
        <p><Link to="/">← Back to Home</Link></p>
      </div>
    )
  }

  return (
    <div className="admin-content">
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h2 style={{margin:0}}>👥 Users</h2>
          <div className="page-sub">Manage registered users</div>
        </div>
      </div>

      <div style={{marginTop:12,display:'grid',gridTemplateColumns: selected ? '1fr 420px' : '1fr',gap:16}}>
        <div className="card users-card">
          {(!users || users.length === 0) ? (
            <div style={{padding:24}}>No users found</div>
          ) : (
            <table className="table users-table" style={{marginTop:0}}>
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Created</th>
                </tr>
              </thead>

              <tbody>
                {users.map(user => (
                  <tr key={user.id} onClick={() => openUser(user)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openUser(user)} tabIndex={0} role="button" aria-label={`Open user ${user.name}`}>
                    <td style={{width:72}}>
                      <div
                        className="user-avatar user-avatar--placeholder"
                        style={{
                          width:40,
                          height:40,
                          background: avatarColor(user.name || ''),
                          color:'#fff',
                          fontWeight:700,
                          fontSize:14
                        }}
                      >
                        {(user.name || '?').slice(0,1).toUpperCase()}
                      </div>
                    </td>
                    <td style={{fontWeight:600}}>{user.name}</td>
                    <td style={{color:'#6b7280'}}>{user.email}</td>
                    <td style={{color:'#6b7280'}}>{new Date(user.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className="user-panel-wrap">
            <div className="panel-overlay" onClick={closeUser} />
            <aside className="card user-details" aria-labelledby="user-details-title">
              <button className="close-x" onClick={closeUser} aria-label="Close user details">✕</button>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div>
                  <h3 id="user-details-title" style={{margin:'8px 0 0'}}>User Details</h3>
                  <div style={{color:'#6b7280',fontSize:13,marginTop:4}}>Member since {new Date(selected.created_at || selected.created).toLocaleDateString()}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{color:'#6b7280',fontSize:13}}>Total spend</div>
                  <div style={{fontWeight:700,fontSize:18}}>{currency.format(selected.totalSpend || 0)}</div>
                </div>
              </div>

              <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:14}}>
                <div style={{width:60,height:60,borderRadius:999,display:'flex',alignItems:'center',justifyContent:'center',background: avatarColor(selected.name || ''), color:'#fff', fontWeight:700, fontSize:20}}>
                  {initials(selected.name || '')[0]}
                </div>
                <div>
                  <div style={{fontSize:18,fontWeight:700}}>{selected.name}</div>
                  <div style={{color:'#6b7280',marginTop:6}}>{selected.email}</div>
                  <div style={{color:'#6b7280',fontSize:13,marginTop:8}}>Role: <strong style={{color:'#111',marginLeft:6}}>{selected.role}</strong></div>
                </div>
              </div>

              <section style={{marginBottom:12}}>
                <h4 style={{margin:0,fontSize:15}}>Account</h4>
                <div style={{marginTop:8,display:'grid',gap:8}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}><div style={{color:'#6b7280'}}>User ID</div><div style={{fontWeight:700}}>#{selected.id}</div></div>
                  <div style={{display:'flex',justifyContent:'space-between'}}><div style={{color:'#6b7280'}}>Total orders</div><div style={{fontWeight:700}}>{selected.totalOrders || 0}</div></div>
                  <div style={{display:'flex',justifyContent:'space-between'}}><div style={{color:'#6b7280'}}>Total spend</div><div style={{fontWeight:700}}>{currency.format(selected.totalSpend || 0)}</div></div>
                </div>
              </section>

              <section>
                <h4 style={{margin:0,fontSize:15}}>Recent orders</h4>
                <div style={{marginTop:8,display:'grid',gap:8}}>
                  {Array.isArray(selected.recentOrders) && selected.recentOrders.length > 0 ? (
                    selected.recentOrders.map(ro => (
                      <div key={ro.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{fontWeight:700}}>Order #{ro.id}</div>
                        <div style={{color:'#6b7280'}}>{currency.format(Number(ro.total_amount) || Number(ro.total_amount) === 0 ? Number(ro.total_amount) : 0)}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div>—</div><div style={{color:'#6b7280'}}>—</div></div>
                  )}
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
