import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useEffect } from 'react'



export default function Login(){
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
useEffect(() => {
  const user = JSON.parse(localStorage.getItem("user"))
  if (user?.role === "admin") {
    navigate("/admin", { replace: true })
  }
}, [])

  
  async function handleSubmit(e)
{
    e.preventDefault()
    setError('')
    if(!email.trim() || !password){
      setError('Email and password are required')
      return
    }

   
    // Login success
    try {
  const response = await axios.post(
    'http://localhost:4000/api/auth/login',
    { email: email.trim(), password }
  )

  const { user, token } = response.data.data

  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))

  if (user.role === 'admin') {
    navigate('/admin', { replace: true })

  } else {
   navigate('/', { replace: true })

  }
console.log("Logged in user:", user)

} catch (err) {
  setError('Invalid email or password')
}


  }

  return (
    <div style={{maxWidth:480}}>
      <h2>Login</h2>
      <form className="card" onSubmit={handleSubmit}>
        <label style={{display:'block',marginBottom:8}}>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={{width:'100%',padding:8,marginBottom:12}} />

        <label style={{display:'block',marginBottom:8}}>Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••" style={{width:'100%',padding:8,marginBottom:12}} />

        {error && <div style={{color:'red',marginBottom:12}}>{error}</div>}

        <div style={{display:'flex',gap:8}}>
          <button type="submit">Login</button>
          <Link to="/register" style={{alignSelf:'center'}}>Register</Link>
        </div>
      </form>
    </div>
  )
}
