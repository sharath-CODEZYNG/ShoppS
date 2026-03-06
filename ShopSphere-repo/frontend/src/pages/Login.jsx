import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/authAPI'
import AuthLayout from '../components/AuthLayout'
import '../styles/auth.css'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!email.trim() || !password) {
      setError('Email and password are required')
      return  
    }

    try {
      setLoading(true)
      console.log('[Login] Attempting login for:', email)

      // Call backend login API
      const response = await authAPI.login({ email: email.trim(), password })

      if (response.success && response.data) {
        console.log('[Login] Login successful, user:', response.data)
        
        // Store token and user in localStorage (also done in authAPI.login)
        localStorage.setItem('token', response.data.token)
        localStorage.setItem('user', JSON.stringify(response.data.user))
        
        // Show success message
        alert(`Welcome back, ${response.data.user.name}!`)
        
        // Redirect to home
     if (response.data.user.role === 'admin') {
  navigate('/admin', { replace: true })
} else {
  navigate('/home', { replace: true })
}

      } else {
        // Backend returned error response
        setError(response.message || 'Login failed')
        console.log('[Login] Login failed:', response.message)
      }
    } catch (err) {
      console.error('[Login] Error:', err)
      setError('Unable to connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h2>Welcome back</h2>
      <p className="lead">Sign in to your account to continue to ShopSphere</p>

      {error && <div className="error-box">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <input
            id="email"
            type="email"
            placeholder=" "
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <label htmlFor="email">Email</label>
        </div>

        <div className="form-field">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder=" "
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <label htmlFor="password">Password</label>
          <div className="field-icon">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setShowPassword((s) => !s)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="muted-row">
          <Link className="link-inline" to="/forgot">Forgot password?</Link>
          <Link className="link-inline" to="/register">Create account</Link>
        </div>

        <div className="actions">
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Sign in'}
          </button>
        </div>

        <div className="divider"><span>OR</span></div>

        <div style={{ textAlign: 'center' }}>
          <Link to="/" className="link-inline">Back to store</Link>
        </div>
      </form>
    </AuthLayout>
  )
}
