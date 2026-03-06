import { useState } from 'react'

const DUMMY_ORDERS = [
  {id:1001, customer:'Alice', email:'alice@example.com', total:1499, status:'Placed', date:'2026-01-12', items:[{name:'Idli (pack of 4)', qty:2, price:149},{name:'Sambar Mix', qty:1, price:120}]},
  {id:1002, customer:'Bob', email:'bob@example.com', total:299, status:'Confirmed', date:'2026-01-15', items:[{name:'Packaged Rasam', qty:1, price:299}]},
  {id:1003, customer:'Charlie', email:'charlie@example.com', total:899, status:'Shipped', date:'2026-01-17', items:[{name:'Wireless Headset', qty:1, price:899}]},
]

const STATUS_LIST = ['Placed','Confirmed','Shipped','Delivered','Cancelled']
const STATUS_COLOR = {
  Placed: 'status-placed',
  Confirmed: 'status-confirmed',
  Shipped: 'status-shipped',
  Delivered: 'status-delivered',
  Cancelled: 'status-cancelled'
}

export default function AdminOrders(){
  const [orders, setOrders] = useState(DUMMY_ORDERS)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [workingStatus, setWorkingStatus] = useState('')

  function updateStatus(id, status){ setOrders(orders.map(o=> o.id===id ? {...o, status} : o)) }

  function openDetails(o){ setSelectedOrder(o); setWorkingStatus(o.status || 'Placed') }
  function closeDetails(){ setSelectedOrder(null); setWorkingStatus('') }

  function applyStatusUpdate(){
    if(!selectedOrder) return
    setOrders(orders.map(o=> o.id === selectedOrder.id ? {...o, status: workingStatus} : o))
    setSelectedOrder(prev => prev ? {...prev, status: workingStatus} : prev)
  }

  return (
    <div className="admin-content">
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h2 style={{margin:0}}>📦 Orders</h2>
          <div className="page-sub">Manage customer orders</div>
        </div>
      </div>

      <div style={{marginTop:12,display:'grid',gridTemplateColumns: selectedOrder ? '1fr 420px' : '1fr',gap:16}}>
        <div className="card orders-card">
          <table className="table orders-table" style={{marginTop:0}}>
            <thead>
              <tr>
                <th><span style={{display:'inline-flex',alignItems:'center',gap:8}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h16M4 12h16M4 18h16" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/></svg> ID</span></th>
                <th><span style={{display:'inline-flex',alignItems:'center',gap:8}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zM3 20a9 9 0 0118 0" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg> Customer</span></th>
                <th><span style={{display:'inline-flex',alignItems:'center',gap:8}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 1v22" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round"/></svg> Total</span></th>
                <th><span style={{display:'inline-flex',alignItems:'center',gap:8}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 12h18" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/></svg> Status</span></th>
                <th><span style={{display:'inline-flex',alignItems:'center',gap:8}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#6b7280" strokeWidth="1.2"/></svg> Date</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o=> (
                <tr key={o.id} onClick={() => openDetails(o)} style={{cursor:'pointer'}}>
                  <td>#{o.id}</td>
                  <td>{o.customer}</td>
                  <td>₹{o.total}</td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span className={`status-badge ${STATUS_COLOR[o.status] || ''}`}>{o.status}</span>
                      <select value={o.status} onClick={e=>e.stopPropagation()} onChange={e=>updateStatus(o.id, e.target.value)}>
                        {STATUS_LIST.map(s=> <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                  <td>{o.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedOrder && (
          <aside className="card order-details" aria-labelledby="order-details-title">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div>
                <button
                  className="small-btn back-btn"
                  onClick={closeDetails}
                  aria-label="Back to orders"
                  title="Back to Orders"
                >
                  <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon">
                    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Back to Orders</span>
                </button>

                <h3 id="order-details-title" style={{margin:'8px 0 0'}}>Order #{selectedOrder.id}</h3>
                <div style={{color:'#6b7280',fontSize:13,marginTop:4}}>{selectedOrder.date}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{color:'#6b7280',fontSize:13}}>Total</div>
                <div style={{fontWeight:700,fontSize:18}}>₹{selectedOrder.total}</div>
              </div>
            </div>

            <section style={{marginBottom:12}}>
              <h4 style={{margin:0,fontSize:15}}>Customer</h4>
              <div style={{marginTop:8}}>
                <div style={{fontWeight:700}}>{selectedOrder.customer}</div>
                <div style={{color:'#6b7280',fontSize:13}}>{selectedOrder.email || '—'}</div>
              </div>
            </section>

            <section style={{marginBottom:12}}>
              <h4 style={{margin:0,fontSize:15}}>Items</h4>
              <div style={{marginTop:8,display:'grid',gap:8}}>
                {selectedOrder.items?.map((it,idx)=> (
                  <div key={idx} style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}>
                    <div style={{display:'flex',gap:12,alignItems:'center'}}>
                      <div style={{width:48,height:40,background:'#f8fafc',border:'1px solid #eef2f7',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',color:'#6b7280'}}>
                        🧾
                      </div>
                      <div>
                        <div style={{fontWeight:600}}>{it.name}</div>
                        <div style={{color:'#6b7280',fontSize:13}}>Qty {it.qty} • ₹{it.price}</div>
                      </div>
                    </div>
                    <div style={{fontWeight:700}}>₹{it.qty * it.price}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{marginBottom:12}}>
              <h4 style={{margin:0,fontSize:15}}>Order status</h4>
              <div style={{display:'flex',gap:12,alignItems:'center',marginTop:8}}>
                <select
                  className="status-select"
                  value={workingStatus}
                  onChange={e=>setWorkingStatus(e.target.value)}
                  style={{padding:10,borderRadius:8,border:'1px solid #e5e7eb'}}
                >
                  {STATUS_LIST.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <button className="btn-primary" onClick={applyStatusUpdate}>Update Status</button>
              </div>

              <div style={{marginTop:12}}>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <div className={`status-badge ${STATUS_COLOR[selectedOrder.status] || ''}`}>{selectedOrder.status}</div>
                  <div style={{color:'#6b7280',fontSize:13}}>Last updated: {selectedOrder.date}</div>
                </div>
              </div>
            </section>

          </aside>
        )}
      </div>
    </div>
  )
}
