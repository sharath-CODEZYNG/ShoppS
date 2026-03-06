import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/authAPI'
import AuthLayout from '../components/AuthLayout'
import '../styles/auth.css'

export default function ResetPassword() {
const { token } = useParams()
const navigate = useNavigate()
const [newPassword, setNewPassword] = useState('')
const [confirmPassword, setConfirmPassword] = useState('')
const [error, setError] = useState('')
const [success, setSuccess] = useState('')
const [loading, setLoading] = useState(false)
const [showNewPassword, setShowNewPassword] = useState(false)
const [showConfirmPassword, setShowConfirmPassword] = useState(false)
const [validToken, setValidToken] = useState(true)

useEffect(() => {
// Validate token is provided
if (!token) {
setError('Invalid or missing reset link')
setValidToken(false)
}
}, [token])

const handleSubmit = async (e) => {
e.preventDefault()
setError('')
setSuccess('')

// Validation
if (!newPassword || !confirmPassword) {
setError('Both password fields are required')
return
}

if (newPassword.length < 6) {
setError('Password must be at least 6 characters')
return
}

if (newPassword !== confirmPassword) {
setError('Passwords do not match')
return
}

try {
setLoading(true)
console.log('[ResetPassword] Resetting password with token')

// Call backend reset-password API
const response = await authAPI.resetPassword({
token,
newPassword,
confirmPassword
})

if (response.success) {
console.log('[ResetPassword] Success:', response.message)
setSuccess(response.message)
// Redirect to login after 2 seconds
setTimeout(() => {
navigate('/login')
}, 2000)
} else {
// Backend returned error response
setError(response.message || 'Failed to reset password')
console.log('[ResetPassword] Error:', response.message)
}
} catch (err) {
console.error('[ResetPassword] Error:', err)
setError('Unable to connect to server. Please try again.')
} finally {
setLoading(false)
}
}

if (!validToken) {
return (
<AuthLayout>
<h2>Invalid Reset Link</h2>
<p className="lead">The reset link is invalid or has expired</p>

<div className="error-box" style={{ marginBottom: '20px' }}>
<p>{error}</p>
</div>

<div className="actions" style={{ marginTop: '30px' }}>
<Link to="/forgot" className="primary-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
Request New Reset Link
</Link>
</div>

<div style={{ textAlign: 'center', marginTop: '20px' }}>
<Link to="/login" className="link-inline">Back to login</Link>
</div>
</AuthLayout>
)
}

return (
<AuthLayout>
<h2>Reset Your Password</h2>
<p className="lead">Enter your new password below</p>

{error && <div className="error-box">{error}</div>}
{success && <div className="success-box">{success}</div>}

{!success && (
<form onSubmit={handleSubmit}>
<div className="form-field">
<input
id="newPassword"
type={showNewPassword ? 'text' : 'password'}
placeholder=" "
value={newPassword}
onChange={(e) => setNewPassword(e.target.value)}
disabled={loading}
/>
<label htmlFor="newPassword">New Password</label>
<div className="field-icon">
<button
type="button"
className="icon-btn"
onClick={() => setShowNewPassword((s) => !s)}
aria-label="Toggle password visibility"
>
{showNewPassword ? 'Hide' : 'Show'}
</button>
</div>
</div>

<div className="form-field">
<input
id="confirmPassword"
type={showConfirmPassword ? 'text' : 'password'}
placeholder=" "
value={confirmPassword}
onChange={(e) => setConfirmPassword(e.target.value)}
disabled={loading}
/>
<label htmlFor="confirmPassword">Confirm Password</label>
<div className="field-icon">
<button
type="button"
className="icon-btn"
onClick={() => setShowConfirmPassword((s) => !s)}
aria-label="Toggle password visibility"
>
{showConfirmPassword ? 'Hide' : 'Show'}
</button>
</div>
</div>

<div style={{ marginBottom: '20px', fontSize: '0.9em', color: '#666' }}>
<p>Password must be at least 6 characters</p>
</div>

<div className="actions">
<button className="primary-btn" type="submit" disabled={loading}>
{loading ? 'Resetting...' : 'Reset Password'}
</button>
</div>

<div className="divider"><span>OR</span></div>

<div style={{ textAlign: 'center' }}>
<Link to="/login" className="link-inline">Back to login</Link>
</div>
</form>
)}
</AuthLayout>
)
}
