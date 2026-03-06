// Authentication API service
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export const authAPI = {
  /**
   * Register new user
   * POST /api/auth/register
   * Body: { name, email, password }
   * Returns: { success, data: { id, name, email, role } }
   */
  register: async (data) => {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      return await response.json()
    } catch (err) {
      console.error('Register error:', err)
      throw err
    }
  },

  /**
   * Login user
   * POST /api/auth/login
   * Body: { email, password }
   * Returns: { success, data: { user: { id, name, email, role }, token } }
   */
  login: async (data) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      
      // Store token and user in localStorage after successful login
      if (result.success && result.data?.token && result.data?.user) {
        localStorage.setItem('token', result.data.token)
        localStorage.setItem('user', JSON.stringify(result.data.user))
      }
      
      return result
    } catch (err) {
      console.error('Login error:', err)
      throw err
    }
  },

  /**
   * Get current user from localStorage
   * Returns: user object or null
   */
  getCurrentUser: () => {
    try {
      const userJson = localStorage.getItem('user')
      return userJson ? JSON.parse(userJson) : null
    } catch (err) {
      console.error('Error parsing currentUser:', err)
      return null
    }
  },

  /**
   * Logout user (clear localStorage)
   */
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('currentUser')
  },
  //changes added for forgot password and reset password
  /**
* Forgot Password - Request reset link
* POST /api/auth/forgot-password
* Body: { email }
* Returns: { success, message }
*/
forgotPassword: async (data) => {
try {
const response = await fetch(`${API_URL}/auth/forgot-password`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(data)
})
return await response.json()
} catch (err) {
console.error('Forgot password error:', err)
throw err
}
},

/**
* Reset Password - Set new password with token
* POST /api/auth/reset-password
* Body: { token, newPassword, confirmPassword }
* Returns: { success, message }
*/
resetPassword: async (data) => {
try {
const response = await fetch(`${API_URL}/auth/reset-password`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(data)
})
return await response.json()
} catch (err) {
console.error('Reset password error:', err)
throw err
}
}
}




//changes end




// Named helper for getting current user (convenience export)
export function getCurrentUser() {
  try {
    const userJson = localStorage.getItem('user')
    return userJson ? JSON.parse(userJson) : null
  } catch (err) {
    console.error('Error parsing currentUser:', err)
    return null
  }
}
