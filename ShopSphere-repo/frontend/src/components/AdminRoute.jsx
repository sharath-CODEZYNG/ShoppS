import { Navigate } from 'react-router-dom'
import { getCurrentUser } from '../services/authAPI'

export default function AdminRoute({ children }){
  try {
    const user = getCurrentUser()
    const role = user?.role
    if (typeof role === 'string' && role.toLowerCase() === 'admin') {
      return children
    }
  } catch (err) {
    // fall through to redirect
    console.warn('AdminRoute: failed to determine user role', err)
  }
  return <Navigate to="/" replace />
}
