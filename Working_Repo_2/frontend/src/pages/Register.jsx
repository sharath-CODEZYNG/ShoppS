import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/authAPI'
import AuthLayout from '../components/AuthLayout'
import '../styles/auth.css'

export default function Register() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const validate = () => {
    const err = {}
    if (!name.trim()) err.name = 'Name is required'
    if (!email.trim()) err.email = 'Email is required'
    else if (!/^\S+@\S+\.\S+$/.test(email)) err.email = 'Enter a valid email'
    if (!password) err.password = 'Password is required'
    else if (password.length < 6) err.password = 'Password must be at least 6 characters'
    if (password !== confirmPassword) err.confirmPassword = 'Passwords do not match'
    return err
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    setErrors(err)
    if (Object.keys(err).length) return

    try {
      setLoading(true)
      console.log('[Register] Attempting registration for:', email)

      // Call backend register API
      const response = await authAPI.register({
        name: name.trim(),
        email: email.trim(),
        password
      })

      if (response.success) {
        console.log('[Register] Registration successful, user:', response.data)
        alert('Account created successfully. Please login.')
        navigate('/login')
      } else {
        // Backend returned error
        console.log('[Register] Registration failed:', response.message)
        if (response.message.includes('email')) {
          setErrors({ email: response.message })
        } else {
          setErrors({ general: response.message })
        }
      }
    } catch (err) {
      console.error('[Register] Error:', err)
      setErrors({ general: 'Unable to connect to server. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h2>Create account</h2>
      <p className="lead">Start your free trial and grow with ShopSphere</p>

      {errors.general && <div className="error-box">{errors.general}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <input id="name" placeholder=" " value={name} onChange={(e)=>setName(e.target.value)} disabled={loading} />
          <label htmlFor="name">Full name</label>
        </div>
        {errors.name && <div className="error-box">{errors.name}</div>}

        <div className="form-field">
          <input id="email" type="email" placeholder=" " value={email} onChange={(e)=>setEmail(e.target.value)} disabled={loading} />
          <label htmlFor="email">Email</label>
        </div>
        {errors.email && <div className="error-box">{errors.email}</div>}

        <div className="form-field">
          <input id="password" type={showPassword? 'text':'password'} placeholder=" " value={password} onChange={(e)=>setPassword(e.target.value)} disabled={loading} />
          <label htmlFor="password">Password</label>
          <div className="field-icon">
            <button type="button" className="icon-btn" onClick={()=>setShowPassword(s=>!s)}>{showPassword? 'Hide':'Show'}</button>
          </div>
        </div>
        {errors.password && <div className="error-box">{errors.password}</div>}

        <div className="form-field">
          <input id="confirmPassword" type={showConfirm?'text':'password'} placeholder=" " value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} disabled={loading} />
          <label htmlFor="confirmPassword">Confirm password</label>
          <div className="field-icon">
            <button type="button" className="icon-btn" onClick={()=>setShowConfirm(s=>!s)}>{showConfirm? 'Hide':'Show'}</button>
          </div>
        </div>
        {errors.confirmPassword && <div className="error-box">{errors.confirmPassword}</div>}

        <div className="actions">
          <button className="primary-btn" type="submit" disabled={loading}>{loading? 'Creating account...':'Create account'}</button>
        </div>

        <div className="muted-row" style={{marginTop:12}}>
          <span>Already have an account?</span>
          <Link className="link-inline" to="/login">Sign in</Link>
        </div>
      </form>
    </AuthLayout>
  )
}
