import { useEffect, useState } from 'react'
import { orderAPI } from '../services/api'

const STATUS_LIST = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']

const STATUS_CLASS = {
  pending: 'status-pending',
  paid: 'status-paid',
  shipped: 'status-shipped',
  delivered: 'status-delivered',
  cancelled: 'status-cancelled'
}

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }

export default function AdminOrders(){
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [workingStatus, setWorkingStatus] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(()=>{
    let mounted = true
    const fetchAll = async ()=>{
      try{
        setLoading(true)
        setError(null)
        const res = await orderAPI.getAllOrders()
        if(res?.success && Array.isArray(res.data)){
          const transformed = res.data.map(o=>({
            id: o.id,
            customer: o.name || 'Unknown',
            email: o.email || '—',
            total: Number(o.total_amount) || 0,
            status: (o.status || 'pending').toLowerCase(),
            date: new Date(o.created_at).toLocaleString(),
          }))
          if(mounted) setOrders(transformed)
        } else {
          if(mounted) setOrders([])
        }
      }catch(err){
        console.error('Failed to fetch orders',err)
        if(mounted) { setError('Unable to load orders'); setOrders([]) }
      }finally{ if(mounted) setLoading(false) }
    }
    fetchAll()
    return ()=>{ mounted=false }
  }, [])

  // fetch full order details when opening
  const openDetails = async (order)=>{
    setSelectedOrder(null)
    try{
      const resp = await orderAPI.getOrderById(order.id)
      if(resp?.success && resp.data){
        const d = resp.data
        const items = Array.isArray(d.items) ? d.items.map(it=>({
          id: it.id,
          name: it.name || `Product ${it.product_id}`,
          qty: it.quantity || 0,
          price: Number(it.price) || 0,
          lineTotal: (Number(it.price) || 0) * (it.quantity || 0)
        })) : []

        setSelectedOrder({
          id: d.id,
          customer: d.name || order.customer || 'Unknown',
          email: d.email || order.email || '—',
          date: new Date(d.created_at).toLocaleString(),
          shipping: d.shipping_address || null,
          status: (d.status || 'pending').toLowerCase(),
          total: Number(d.total_amount) || 0,
          items
        })
        setWorkingStatus((d.status||'pending').toLowerCase())
      } else {
        alert('Unable to load order details')
      }
    }catch(err){ console.error('Error fetching order details',err); alert('Error loading details') }
  }

  const closeDetails = ()=>{ setSelectedOrder(null); setWorkingStatus('') }

  const applyStatusUpdate = async ()=>{
    if(!selectedOrder) return
    if(workingStatus === selectedOrder.status) return
    try{
      setUpdating(true)
      const resp = await orderAPI.updateOrderStatus(selectedOrder.id, workingStatus)
      if(resp?.success){
        // update selected and orders list
        setSelectedOrder(prev => prev ? { ...prev, status: workingStatus } : prev)
        setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: workingStatus } : o))
        // notify other pages to refetch (My Orders page)
        window.dispatchEvent(new Event('ordersUpdated'))
      } else {
        alert('Update failed: ' + (resp?.message || 'Unknown'))
      }
    }catch(err){ console.error('Error updating status',err); alert('Error updating status') }
    finally{ setUpdating(false) }
  }

  return (
    <div className="admin-content">
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h2 style={{margin:0}}>📦 Orders</h2>
          <div className="page-sub">Manage customer orders</div>
        </div>
      </div>

      <div style={{marginTop:12}}>
        {error && <div className="card" style={{background:'#fee2e2',border:'1px solid #fecaca',color:'#991b1b',padding:12,borderRadius:8}}><strong>Error:</strong> {error}</div>}

        <div className="orders-layout" style={{marginTop:12}}>
          <div className="orders-list-card card">
            {loading ? (
              <div style={{padding:32,textAlign:'center',color:'#6b7280'}}>Loading orders...</div>
            ) : orders.length === 0 ? (
              <div style={{padding:24,textAlign:'center',color:'#6b7280'}}>No orders found</div>
            ) : (
              <div className="orders-table-wrap">
                <table className="table orders-table modern">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o=> (
                      <tr key={o.id} className="order-row" onClick={()=>openDetails(o)}>
                        <td>#{o.id}</td>
                        <td>{o.customer}</td>
                        <td>{currency.format(o.total)}</td>
                        <td><span className={`status-pill ${STATUS_CLASS[o.status]||''}`}>{cap(o.status)}</span></td>
                        <td>{o.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="orders-detail-panel">
            {selectedOrder ? (
              <aside className="card order-details panel-fade" aria-labelledby="order-details-title">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div>
                    <button className="small-btn back-btn" onClick={closeDetails}>← Back</button>
                    <h3 id="order-details-title" style={{margin:'8px 0 0'}}>Order #{selectedOrder.id}</h3>
                    <div style={{color:'#6b7280',fontSize:13,marginTop:4}}>{selectedOrder.date}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{color:'#6b7280',fontSize:13}}>Total</div>
                    <div style={{fontWeight:700,fontSize:18}}>{currency.format(selectedOrder.total)}</div>
                  </div>
                </div>

                <section style={{marginBottom:12}}>
                  <h4 style={{margin:0,fontSize:15}}>Customer</h4>
                  <div style={{marginTop:8}}>
                    <div style={{fontWeight:700}}>{selectedOrder.customer}</div>
                    <div style={{color:'#6b7280',fontSize:13}}>{selectedOrder.email}</div>
                    {selectedOrder.shipping && <div style={{marginTop:8,color:'#374151'}}><strong>Shipping:</strong> {selectedOrder.shipping}</div>}
                  </div>
                </section>

                <section style={{marginBottom:12,borderTop:'1px solid #eef2f7',paddingTop:12}}>
                  <h4 style={{margin:0,fontSize:15}}>Items</h4>
                  <div style={{marginTop:8,display:'grid',gap:10}}>
                    {selectedOrder.items.map(it=> (
                      <div key={it.id} className="item-mini card" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:10}}>
                        <div>
                          <div style={{fontWeight:700}}>{it.name}</div>
                          <div style={{color:'#6b7280',fontSize:13}}>{currency.format(it.price)} × {it.qty}</div>
                        </div>
                        <div style={{fontWeight:700}}>{currency.format(it.lineTotal)}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section style={{borderTop:'1px solid #eef2f7',paddingTop:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:12,marginBottom:8}}>
                    <div style={{color:'#6b7280'}}>Subtotal</div>
                    <div style={{fontWeight:700}}>{currency.format(selectedOrder.items.reduce((s,i)=>s+i.lineTotal,0))}</div>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',gap:12,marginBottom:12}}>
                    <div style={{color:'#6b7280'}}>Shipping</div>
                    <div style={{fontWeight:700}}>-</div>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',gap:12}}>
                    <div style={{color:'#6b7280'}}>Total</div>
                    <div style={{fontWeight:800,fontSize:16}}>{currency.format(selectedOrder.total)}</div>
                  </div>
                </section>

                <section style={{marginTop:12,borderTop:'1px solid #eef2f7',paddingTop:12}}>
                  <h4 style={{margin:0,fontSize:15}}>Update status</h4>
                  <div style={{display:'flex',gap:12,alignItems:'center',marginTop:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span className={`status-pill ${STATUS_CLASS[selectedOrder.status]||''}`}>{cap(selectedOrder.status)}</span>
                      <select className="status-select" value={workingStatus} onChange={e=>setWorkingStatus(e.target.value)} style={{padding:10,borderRadius:8,border:'1px solid #e5e7eb'}}>
                        {STATUS_LIST.map(s=> <option key={s} value={s}>{cap(s)}</option>)}
                      </select>
                    </div>

                    <button className="btn-primary" onClick={applyStatusUpdate} disabled={updating || workingStatus === selectedOrder.status} style={{opacity: updating || workingStatus === selectedOrder.status ? 0.6 : 1}}>
                      {updating ? 'Updating...' : 'Update Status'}
                    </button>
                  </div>
                </section>
              </aside>
            ) : (
              <div className="card" style={{padding:20,border:'1px dashed #eef2f7',borderRadius:8,color:'#6b7280'}}>Select an order to view details</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
