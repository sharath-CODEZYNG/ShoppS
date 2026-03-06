import { useMemo, useState, useEffect } from 'react'
import { adminAPI } from '../services/adminAPI'

function formatCurrency(v){ return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v) }

const STATUS_CLASS = {
  pending: 'status-pending',
  paid: 'status-paid',
  shipped: 'status-shipped',
  delivered: 'status-delivered',
  cancelled: 'status-cancelled'
}

function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }

export default function Dashboard(){
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    const fetch = async ()=>{
      try{
        const res = await adminAPI.getDashboard()
        if(res?.success && res.data){
          setData(res.data)
        } else {
          setData(null)
        }
      }catch(err){
        console.error('Error fetching dashboard',err)
        setData(null)
      }finally{
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const totals = useMemo(()=>({
    users: data?.total_users || 0,
    orders: data?.total_orders || 0,
    revenue: data?.total_revenue || 0
  }), [data])

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthly = Array.isArray(data?.monthly_revenue) ? data.monthly_revenue : Array(12).fill(0)

  // prepare SVG path
  const chart = useMemo(()=>{
    const w = 700, h = 160, pad = 24
    const vals = monthly.map(v => {
      if (typeof v === 'object' && v !== null && v.revenue !== undefined) {
        return Number(v.revenue) || 0
      }
      return Number(v) || 0
    })
    const max = Math.max(...vals, 1)
    const points = vals.map((v,i)=>{
      const x = pad + (i/(vals.length-1))*(w-2*pad)
      const y = pad + (1 - v/max)*(h-2*pad)
      return [x,y]
    })

    // simple smoothing: cubic Bezier through points
    function pathFromPoints(pts){
      if(!pts.length) return ''
      let d = `M ${pts[0][0]} ${pts[0][1]}`
      for(let i=1;i<pts.length;i++){
        const [x0,y0] = pts[i-1]
        const [x1,y1] = pts[i]
        const cx = (x0 + x1)/2
        d += ` Q ${x0} ${y0} ${cx} ${(y0+y1)/2}`
        d += ` T ${x1} ${y1}`
      }
      return d
    }

    return { w,h,pad,pts:points, max, d: pathFromPoints(points) }
  }, [monthly])

  const recentOrders = [
    {id:1001, email:'alice@example.com', total:1499, status:'Placed'},
    {id:1002, email:'bob@example.com', total:299, status:'Confirmed'},
    {id:1003, email:'charlie@example.com', total:899, status:'Shipped'},
    {id:1004, email:'diana@example.com', total:3499, status:'Delivered'},
    {id:1005, email:'eric@example.com', total:1299, status:'Cancelled'},
  ]

  const recentUsers = [
    {name:'Alice Smith', email:'alice@example.com', created:'2026-01-02'},
    {name:'Bob Lee', email:'bob@example.com', created:'2026-01-10'},
    {name:'Charlie Kim', email:'charlie@example.com', created:'2026-01-15'},
    {name:'Diana West', email:'diana@example.com', created:'2026-01-18'},
    {name:'Eric Noon', email:'eric@example.com', created:'2026-01-20'},
  ]

  return (
    <div>
      <h2>Dashboard</h2>

      {loading && <div style={{marginTop:12, color:'#6b7280'}}>Loading dashboard...</div>}

      {!loading && (
      <>
      <div className="admin-cards" style={{marginTop:12}}>
        <div className="admin-card">
          <div style={{fontSize:12,color:'#666'}}>Total Users</div>
          <div style={{fontSize:22,fontWeight:700,marginTop:6}}>{totals.users.toLocaleString()}</div>
          <div style={{fontSize:12,color:'#999',marginTop:6}}>All registered users</div>
        </div>

        <div className="admin-card">
          <div style={{fontSize:12,color:'#666'}}>Total Orders</div>
          <div style={{fontSize:22,fontWeight:700,marginTop:6}}>{totals.orders.toLocaleString()}</div>
          <div style={{fontSize:12,color:'#999',marginTop:6}}>Orders placed to date</div>
        </div>

        <div className="admin-card">
          <div style={{fontSize:12,color:'#666'}}>Total Revenue</div>
          <div style={{fontSize:22,fontWeight:700,marginTop:6}}>{formatCurrency(totals.revenue)}</div>
          <div style={{fontSize:12,color:'#999',marginTop:6}}>Delivered orders only</div>
        </div>
      </div>

      <div className="card" style={{marginTop:18}}>
        <h4>Total Revenue</h4>
        <div style={{marginTop:12}} className="chart-card">
          <svg viewBox={`0 0 ${chart.w} ${chart.h}`} width="100%" height="220" preserveAspectRatio="xMidYMid meet">
            {/* grid lines */}
            {[0,0.25,0.5,0.75,1].map((t,i)=> (
              <line key={i} x1={chart.pad} x2={chart.w-chart.pad} y1={chart.pad + t*(chart.h-2*chart.pad)} y2={chart.pad + t*(chart.h-2*chart.pad)} stroke="#eee" strokeWidth={1} />
            ))}

            {/* y labels */}
            {[0,0.5,1].map((t,i)=> (
              <text key={i} x={6} y={chart.pad + t*(chart.h-2*chart.pad) + 4} fontSize={10} fill="#666">{formatCurrency(Math.round((1-t)*chart.max))}</text>
            ))}

            {/* path */}
            <path d={chart.d} fill="none" stroke="#0366d6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {/* points */}
            {chart.pts.map((p, i)=> (
              <circle key={i} cx={p[0]} cy={p[1]} r={3} fill="#0366d6" />
            ))}

            {/* x labels */}
            {months.map((m, i)=>{
              const x = chart.pad + (i/(months.length-1))*(chart.w-2*chart.pad)
              return <text key={m} x={x} y={chart.h - 6} fontSize={10} fill="#666" textAnchor="middle">{m}</text>
            })}
          </svg>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 420px',gap:12,marginTop:18}}>
        <div className="card">
          <h4>Recent Orders</h4>
          <table className="table" style={{marginTop:12}}>
            <thead>
              <tr><th>Order ID</th><th>User Email</th><th>Total</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data?.recent_orders && data.recent_orders.map(o=> (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td>{o.email}</td>
                  <td>{formatCurrency(Number(o.total_amount) || 0)}</td>
                  <td><span className={`status-pill ${STATUS_CLASS[o.status]||''}`}>{cap(o.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h4>Recent Users</h4>
          <table className="table" style={{marginTop:12}}>
            <thead>
              <tr><th>User Name</th><th>Email</th><th>Created</th></tr>
            </thead>
            <tbody>
              {data?.recent_users && data.recent_users.map(u=> (
                <tr key={u.email}><td>{u.name}</td><td>{u.email}</td><td>{new Date(u.created_at).toLocaleDateString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

    </div>
  )
}
