import { useState } from 'react'

const DUMMY_USERS = [
  {id:1, name:'Admin User', email:'admin@shopsphere.com', created:'2025-10-01', avatar: '', role: 'admin', totalOrders: 12, totalSpend: 5499},
  {id:2, name:'Alice Smith', email:'alice@example.com', created:'2025-12-03', avatar: '', role: 'member', totalOrders: 3, totalSpend: 899},
  {id:3, name:'Bob Lee', email:'bob@example.com', created:'2026-01-02', avatar: '', role: 'member', totalOrders: 1, totalSpend: 299},
]

export default function AdminUsers(){
  const [users] = useState(DUMMY_USERS)
  const [selected, setSelected] = useState(null)

  function openUser(u){ setSelected(u) }
  function closeUser(){ setSelected(null) }

  function initials(name = ''){
    return name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()
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
          <table className="table users-table" style={{marginTop:0}}>
            <thead>
              <tr>
                <th>Profile</th>
                <th><span style={{display:'inline-flex',alignItems:'center',gap:8}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zM3 20a9 9 0 0118 0" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg> Name</span></th>
                <th><span style={{display:'inline-flex',alignItems:'center',gap:8}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v12H4zM4 8h16" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg> Email</span></th>
                <th><span style={{display:'inline-flex',alignItems:'center',gap:8}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#6b7280" strokeWidth="1.2"/></svg> Created</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u=> (
                <tr key={u.id} onClick={() => openUser(u)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openUser(u)} tabIndex={0} role="button" aria-label={`Open user ${u.name}`}>
                  <td style={{width:72}}>
                    {u.avatar ? (
                      <img className="user-avatar" src={u.avatar} alt={u.name} />
                    ) : (
                      <div className="user-avatar user-avatar--placeholder">{initials(u.name)}</div>
                    )}
                  </td>
                  <td style={{fontWeight:600}}>{u.name}</td>
                  <td style={{color:'#6b7280'}}>{u.email}</td>
                  <td style={{color:'#6b7280'}}>{u.created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <aside className="card user-details" aria-labelledby="user-details-title">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div>
                <button className="small-btn back-btn" onClick={closeUser} aria-label="Back to users" title="Back to users">← Back to Users</button>
                <h3 id="user-details-title" style={{margin:'8px 0 0'}}>User Details</h3>
                <div style={{color:'#6b7280',fontSize:13,marginTop:4}}>Member since {selected.created}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{color:'#6b7280',fontSize:13}}>Total spend</div>
                <div style={{fontWeight:700,fontSize:18}}>₹{selected.totalSpend}</div>
              </div>
            </div>

            <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:14}}>
              {selected.avatar ? <img className="user-avatar user-avatar--large" src={selected.avatar} alt={selected.name} /> : <div className="user-avatar user-avatar--large">{initials(selected.name)}</div>}
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
                <div style={{display:'flex',justifyContent:'space-between'}}><div style={{color:'#6b7280'}}>Total orders</div><div style={{fontWeight:700}}>{selected.totalOrders}</div></div>
                <div style={{display:'flex',justifyContent:'space-between'}}><div style={{color:'#6b7280'}}>Total spend</div><div style={{fontWeight:700}}>₹{selected.totalSpend}</div></div>
              </div>
            </section>

            <section>
              <h4 style={{margin:0,fontSize:15}}>Recent orders</h4>
              <div style={{marginTop:8,display:'grid',gap:8}}>
                {/* dummy recent orders list */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div>Order #1001</div><div style={{color:'#6b7280'}}>₹1499</div></div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div>Order #1007</div><div style={{color:'#6b7280'}}>₹299</div></div>
              </div>
            </section>
          </aside>
        )}
      </div>
    </div>
  )
}
