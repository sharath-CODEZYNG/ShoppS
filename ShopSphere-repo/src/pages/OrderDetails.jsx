import { Link, useNavigate, useParams } from 'react-router-dom'
import { useContext } from 'react'
import { CartContext } from '../context/CartContext'
import { PRODUCTS } from '../services/products'
import Navbar from '../components/Navbar'

export default function OrderDetails(){
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { orders = [] } = useContext(CartContext)

  const order = orders.find(o => String(o.orderId) === String(orderId))

  if(!order){
    return (
      <div style={{padding:24, maxWidth:980, margin:'24px auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="search-back" onClick={()=>navigate('/orders')}>← Back</button>
          <h2 style={{margin:0}}>Order not found</h2>
        </div>

        <div className="card" style={{marginTop:18,textAlign:'center'}}>
          <div className="muted">We couldn't find an order with ID <strong>{orderId}</strong>.</div>
          <div style={{marginTop:16}}><Link to="/orders" className="btn-enter-big">Back to My Orders</Link></div>
        </div>
      </div>
    )
  }

  const productFor = (pid) => PRODUCTS.find(p => p.id === pid)
  const subtotal = order.items.reduce((s,it)=> s + (it.price||0) * (it.quantity||0), 0)
  const totalItems = order.items.reduce((s,it)=> s + (it.quantity||0), 0)

  return (
    <>
      <Navbar />
      <div className="page-container" style={{paddingTop:18}}>
        <div style={{padding:24, maxWidth:1100, margin:'24px auto'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <button className="search-back" onClick={()=>navigate('/orders')}>← Back</button>
              <div>
                <div style={{fontSize:18,fontWeight:800}}>Order {order.orderId}</div>
                <div className="muted" style={{marginTop:6}}>{new Date(order.orderDate).toLocaleString()}</div>
              </div>
            </div>

            <div style={{textAlign:'right'}}>
              <div className={`order-badge status-${(order.orderStatus || 'Placed').toLowerCase()}`} style={{display:'inline-block'}}>{order.orderStatus}</div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:20,marginTop:20}}>
            <div>
              <div style={{display:'grid',gap:12}}>
                {order.items.map((it,idx) => {
                  const prod = productFor(it.productId) || {}
                  const img = prod.images?.[0] || `https://picsum.photos/seed/prod${prod.id||it.productId}/320/240`
                  return (
                    <div key={idx} className="card" style={{display:'flex',gap:12,alignItems:'center'}}>
                      <div style={{width:84,height:84,flex:'0 0 84px',borderRadius:10,overflow:'hidden',border:'1px solid #eef2f7',background:'#fbfdff',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <img src={img} alt={it.name} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                      </div>

                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700}}>{it.name}</div>
                        <div className="muted" style={{marginTop:6}}>{it.quantity} × ₹{(it.price||0).toFixed(2)}</div>
                      </div>

                      <div style={{textAlign:'right',minWidth:100,fontWeight:700}}>₹{((it.price||0) * (it.quantity||0)).toFixed(2)}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <aside className="card" style={{height:'fit-content'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div className="muted">Subtotal ({totalItems} items)</div>
                <div style={{fontWeight:800}}>₹{subtotal.toFixed(2)}</div>
              </div>

              <div style={{marginTop:12,display:'grid',gap:8}}>
                <div style={{display:'flex',justifyContent:'space-between',color: 'var(--muted)'}}><div>Shipping</div><div>Calculated at checkout</div></div>
                <div style={{display:'flex',justifyContent:'space-between',fontWeight:800,fontSize:18}}><div>Total</div><div>₹{order.totalAmount.toFixed(2)}</div></div>
              </div>

              <div style={{marginTop:18}}>
                <Link to="/home" className="btn-add" style={{width:'100%',display:'inline-flex',justifyContent:'center'}}>Continue shopping</Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  )
}
