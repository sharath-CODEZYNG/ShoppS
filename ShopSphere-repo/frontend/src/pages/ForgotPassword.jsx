import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../services/authAPI'
import AuthLayout from '../components/AuthLayout'
import '../styles/auth.css'

export default function ForgotPassword() {
// const navigate = useNavigate()
const [email, setEmail] = useState('')
const [error, setError] = useState('')
const [success, setSuccess] = useState('')
const [loading, setLoading] = useState(false)
const [submitted, setSubmitted] = useState(false)

const handleSubmit = async (e) => {
e.preventDefault()
setError('')
setSuccess('')

// Validation
if (!email.trim()) {
setError('Email is required')
return
}

const emailRegex = /^\S+@\S+\.\S+$/
if (!emailRegex.test(email)) {
setError('Please enter a valid email address')
return
}

try {
setLoading(true)
console.log('[ForgotPassword] Requesting reset link for:', email)

// Call backend forgot-password API
const response = await authAPI.forgotPassword({ email: email.trim() })

if (response.success) {
console.log('[ForgotPassword] Success:', response.message)
setSuccess(response.message)
setSubmitted(true)
setEmail('')
} else {
// Backend returned error response
setError(response.message || 'Failed to send reset link')
console.log('[ForgotPassword] Error:', response.message)
}
} catch (err) {
console.error('[ForgotPassword] Error:', err)
setError('Unable to connect to server. Please try again.')
} finally {
setLoading(false)
}
}

if (submitted) {
return (
<AuthLayout>
<h2>Check your email</h2>
<p className="lead">We've sent a password reset link to your email</p>

<div className="success-box" style={{ marginBottom: '20px' }}>
<p>{success}</p>
</div>

<div style={{ textAlign: 'center', marginBottom: '20px' }}>
<p>The reset link will expire in 30 minutes.</p>
<p>If you don't see the email, check your spam folder.</p>
</div>

<div className="actions" style={{ marginTop: '30px' }}>
<button
className="primary-btn"
onClick={() => {
setSubmitted(false)
setEmail('')
}}
>
Send another email
</button>
</div>

<div style={{ textAlign: 'center', marginTop: '20px' }}>
<Link to="/login" className="link-inline">Back to login</Link>
</div>
</AuthLayout>
)
}

return (
<AuthLayout>
<h2>Forgot your password?</h2>
<p className="lead">Enter your email address and we'll send you a link to reset your password</p>

{error && <div className="error-box">{error}</div>}
{success && <div className="success-box">{success}</div>}

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

<div className="actions">
<button className="primary-btn" type="submit" disabled={loading}>
{loading ? 'Sending...' : 'Send Reset Link'}
</button>
</div>

<div className="divider"><span>OR</span></div>

<div style={{ textAlign: 'center' }}>
<Link to="/login" className="link-inline">Back to login</Link>
<span style={{ margin: '0 10px' }}>•</span>
<Link to="/register" className="link-inline">Create account</Link>
</div>
</form>
</AuthLayout>
)
}
