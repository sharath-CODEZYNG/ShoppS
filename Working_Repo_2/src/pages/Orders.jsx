import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { CartContext } from '../context/CartContext'
import Navbar from '../components/Navbar'

export default function Orders(){
  const { orders = [] } = useContext(CartContext)

  return (
    <>
      <Navbar />

      <div className="page-container orders-page" style={{paddingTop:18}}>
        <div className="section-head" style={{alignItems:'center'}}>
          <div>
            <h2 style={{margin:0}}>My Orders</h2>
            <div className="muted" style={{marginTop:6}}>{orders.length} order{orders.length!==1? 's':''}</div>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="card orders-empty" role="status" style={{marginTop:18,textAlign:'center'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M3 7h18M8 7v-2a1 1 0 011-1h6a1 1 0 011 1v2" stroke="#9aa4b2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="4" y="8" width="16" height="10" rx="2" stroke="#9aa4b2" strokeWidth="1.6"/>
                <path d="M8 12h.01M12 12h.01M16 12h.01" stroke="#9aa4b2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <h3 style={{marginTop:6}}>You haven’t placed any orders yet</h3>
            <div className="muted" style={{marginTop:8}}>When you place an order it will appear here.</div>
            <div style={{marginTop:18}}><a href="/home" className="btn-enter-big">Continue shopping</a></div>
          </div>
        ) : (
          <div className="orders-grid" style={{marginTop:18}}>
            {orders.map(o => (
              <article key={o.orderId} className="order-card card" aria-labelledby={`order-${o.orderId}`}>
                <div className="order-left">
                  <div className="order-id" id={`order-${o.orderId}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden style={{marginRight:8}}>
                      <path d="M3 7h18M8 7v-2a1 1 0 011-1h6a1 1 0 011 1v2" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      <rect x="4" y="8" width="16" height="10" rx="2" stroke="#374151" strokeWidth="1.2"/>
                    </svg>
                    <div style={{display:'inline-block',verticalAlign:'middle',fontWeight:800}}>{o.orderId}</div>
                  </div>

                  <div className="order-meta muted">
                    <div className="meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M8 7V3M16 7V3M3 11h18" stroke="#9aa4b2" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{new Date(o.orderDate).toLocaleString()}</span></div>
                    <div className="meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 7h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="#9aa4b2" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{o.items.length} item{o.items.length!==1? 's':''}</span></div>
                  </div>
                </div>

                <div className="order-right">
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:800, fontSize:18}}>₹{o.totalAmount.toFixed(2)}</div>
                    <div className="muted" style={{marginTop:6}}>View details for more info</div>
                  </div>

                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:10,marginLeft:18}}>
                    <div className={`order-badge status-${(o.orderStatus || 'Placed').toLowerCase()}`}>{o.orderStatus}</div>
                    <div className="order-actions"><Link className="btn-primary" to={`/orders/${o.orderId}`}>View details</Link></div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
