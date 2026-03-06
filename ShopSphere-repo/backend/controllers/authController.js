import pool from '../config/db.js'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
const JWT_SECRET = process.env.JWT_SECRET || 'shopsphere_secret_key'
const JWT_EXPIRY = '1d' // Token expires in 1 day
import bcrypt from 'bcrypt'

//chnages made to email transporter for nodemailer
const transporter = nodemailer.createTransport({
host: process.env.EMAIL_HOST || 'smtp.gmail.com',
port: Number(process.env.EMAIL_PORT || 587),
secure: String(process.env.EMAIL_SECURE || 'false') === 'true',
auth: {
user: process.env.EMAIL_USER,
pass: process.env.EMAIL_PASS
}
})

//changes end to email transporter for nodemailer

/**
 * REGISTER CONTROLLER
 * POST /api/auth/register
 * 
 * Registers a new user:
 * 1. Validate required fields
 * 2. Check if email already exists
 * 3. Insert user into MySQL with default role "customer"
 * 4. Return created user (without password)
 * 
 * NOTE: Token is NOT generated on registration
 * User must login to get a token
 */
export async function register(req, res) {
  const { name, email, password } = req.body

  // Validation: required fields
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'name, email, and password are required'
    })
  }

  // Validation: email format
  const emailRegex = /^\S+@\S+\.\S+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    })
  }

  // Validation: password length
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters'
    })
  }

  try {
    const connection = await pool.getConnection()

    // Check if email already exists
    console.log('[Auth] Checking if email exists:', email)
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    )

    if (existingUsers.length > 0) {
      await connection.release()
      console.log('[Auth] Email already exists:', email)
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      })
    }


    //changes added
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    //changes end

    // Insert user with default role: "customer"
    console.log('[Auth] Creating new user:', email)
    const [result] = await connection.query(
      'INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())',
      [name, email.toLowerCase(), hashedPassword, 'customer']
    )

    const userId = result.insertId
    console.log('[Auth] User created with ID:', userId)

    // Fetch the created user (without password)
    const [newUsers] = await connection.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [userId]
    )

    await connection.release()

    return res.status(201).json({
      success: true,
      message: 'User registered successfully. Please login to continue.',
      data: newUsers[0]
    })
  } catch (err) {
    console.error('[Auth] Register error:', err)
    return res.status(500).json({
      success: false,
      message: 'Server error during registration'
    })
  }
}

/**
 * LOGIN CONTROLLER
 * POST /api/auth/login
 * 
 * Authenticates a user and generates JWT token:
 * 1. Validate email & password provided
 * 2. Fetch user from MySQL
 * 3. Compare password
 * 4. If valid:
 *    - Generate JWT token (expires in 1 day)
 *    - Return user + token (without password)
 * 5. If invalid → return 401
 * 
 * JWT Payload:
 * {
 *   id: user.id,
 *   email: user.email,
 *   role: user.role
 * }
 */
export async function login(req, res) {
  const { email, password } = req.body

  // Validation: required fields
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'email and password are required'
    })
  }

  try {
    const connection = await pool.getConnection()

    // Fetch user from database
    console.log('[Auth] Attempting login for:', email)
    const [users] = await connection.query(
      'SELECT id, name, email, password, role, created_at FROM users WHERE email = ?',
      [email.toLowerCase()]
    )

    if (users.length === 0) {
      await connection.release()
      console.log('[Auth] User not found:', email)
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    const user = users[0]

    // Compare password (for now: simple string comparison)
    // In production, use: const passwordMatch = await bcrypt.compare(password, user.password)
    // if (user.password !== password) {
    //   await connection.release()
    //   console.log('[Auth] Password mismatch for:', email)
    //   return res.status(401).json({
    //     success: false,
    //     message: 'Invalid email or password'
    //   })
    // }

    //chnages made to compare hashed password using bcrypt

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
    await connection.release();
    return res.status(401).json({
    success: false,
    message: "Invalid email or password"
    });
    }
    //changes end to compare hashed password using bcrypt
    await connection.release()

    // Generate JWT token
    console.log('[Auth] Generating JWT token for user:', user.id)
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    )

    // Return user without password + token
    const { password: _, ...userWithoutPassword } = user
    console.log('[Auth] Login successful for:', email)
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token: token
      }
    })
  } catch (err) {
    console.error('[Auth] Login error:', err)
    return res.status(500).json({
      success: false,
      message: 'Server error during login'
    })
  }
}

//changes adding for forgot password and reset password


/**
* FORGOT PASSWORD CONTROLLER
* POST /api/auth/forgot-password
*
* Handles forgot password request:
* 1. Validate email provided
* 2. Check if user exists with that email
* 3. Generate JWT reset token (expires in 30 minutes)
* 4. Send reset link to user's email
* 5. Return success message
*
* JWT Reset Token Payload:
* {
* id: user.id,
* email: user.email,
* type: 'password-reset'
* }
*/
export async function forgotPassword(req, res) {
const { email } = req.body

// Validation: email required
if (!email) {
return res.status(400).json({
success: false,
message: 'Email is required'
})
}

// Validation: email format
const emailRegex = /^\S+@\S+\.\S+$/
if (!emailRegex.test(email)) {
return res.status(400).json({
success: false,
message: 'Invalid email format'
})
}

try {
const connection = await pool.getConnection()

// Check if user exists
console.log('[ForgotPassword] Checking user with email:', email)
const [users] = await connection.query(
'SELECT id, name, email FROM users WHERE email = ?',
[email.toLowerCase()]
)

if (users.length === 0) {
await connection.release()
console.log('[ForgotPassword] User not found:', email)
// Return success anyway (security: don't reveal if email exists)
return res.status(200).json({
success: true,
message: 'If an account with this email exists, you will receive a password reset link'
})
}

const user = users[0]
await connection.release()

// Generate reset token (expires in 30 minutes)
console.log('[ForgotPassword] Generating reset token for user:', user.id)
const resetToken = jwt.sign(
{
id: user.id,
email: user.email,
type: 'password-reset'
},
JWT_SECRET,
{ expiresIn: '30m' }
)

// Create reset link
const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`

console.log('\n' + '='.repeat(80))
console.log('PASSWORD RESET LINK GENERATED')
console.log('='.repeat(80))
console.log(`User Email: ${user.email}`)
console.log(`User ID: ${user.id}`)
console.log(`Reset Link: ${resetLink}`)
console.log(`Token: ${resetToken}`)
console.log('Token Expires In: 30 minutes')
console.log('='.repeat(80) + '\n')

// Send email with reset link
try {
const mailOptions = {
from: process.env.EMAIL_USER,
to: user.email,
subject: 'ShopSphere - Password Reset Link',
html: `
<h1>Password Reset Request</h1>
<p>Hi ${user.name},</p>
<p>You requested a password reset for your ShopSphere account.</p>
<p>Click the link below to reset your password:</p>
<p>
<a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
Reset Password
</a>
</p>
<p>Or copy and paste this link in your browser:</p>
<p>${resetLink}</p>
<p style="color: red; font-weight: bold;">This link will expire in 30 minutes.</p>
<p>If you didn't request a password reset, please ignore this email.</p>
<p>Best regards,<br/>ShopSphere Team</p>
`
}

await transporter.sendMail(mailOptions)
console.log('[ForgotPassword] Email sent to:', user.email)
} catch (emailErr) {
console.error('[ForgotPassword] Email sending error:', emailErr)
// Still return success even if email fails (for demo purposes)
console.log('[ForgotPassword] Email failed, but reset link displayed in console')
}

return res.status(200).json({
success: true,
message: 'Password reset link sent to your email. Check your inbox.'
})
} catch (err) {
console.error('[ForgotPassword] Error:', err)
return res.status(500).json({
success: false,
message: 'Server error during password reset request'
})
}
}

/**
* RESET PASSWORD CONTROLLER
* POST /api/auth/reset-password
*
* Handles password reset:
* 1. Validate reset token
* 2. Validate new password
* 3. Verify token is valid and not expired
* 4. Update user password in database
* 5. Return success message
*/
export async function resetPassword(req, res) {
const { token, newPassword, confirmPassword } = req.body

// Validation: required fields
if (!token || !newPassword || !confirmPassword) {
return res.status(400).json({
success: false,
message: 'Token and new password are required'
})
}

// Validation: passwords match
if (newPassword !== confirmPassword) {
return res.status(400).json({
success: false,
message: 'Passwords do not match'
})
}

// Validation: password length
if (newPassword.length < 6) {
return res.status(400).json({
success: false,
message: 'Password must be at least 6 characters'
})
}

try {
// Verify and decode token
console.log('[ResetPassword] Verifying reset token')
let decoded
try {
decoded = jwt.verify(token, JWT_SECRET)
} catch (err) {
console.log('[ResetPassword] Invalid or expired token')
return res.status(401).json({
success: false,
message: 'Invalid or expired reset link. Please request a new one.'
})
}

// Verify token is correct type
if (decoded.type !== 'password-reset') {
console.log('[ResetPassword] Invalid token type')
return res.status(401).json({
success: false,
message: 'Invalid reset token'
})
}

const connection = await pool.getConnection()

// Verify user still exists
console.log('[ResetPassword] Verifying user:', decoded.id)
const [users] = await connection.query(
'SELECT id, email FROM users WHERE id = ?',
[decoded.id]
)

if (users.length === 0) {
await connection.release()
console.log('[ResetPassword] User not found:', decoded.id)
return res.status(404).json({
success: false,
message: 'User not found'
})
}

const user = users[0]

// Update password
// console.log('[ResetPassword] Updating password for user:', user.id)
// await connection.query(
// 'UPDATE users SET password = ? WHERE id = ?',
// [newPassword, user.id]. //change to hashedPassword in production
// )

const saltRounds = 10;
const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
console.log('[ResetPassword] Updating password for user:', user.id)
await connection.query(
'UPDATE users SET password = ? WHERE id = ?',
[hashedPassword, user.id]
)

await connection.release()

console.log('[ResetPassword] Password reset successful for:', user.email)
return res.status(200).json({
success: true,
message: 'Password reset successfully. You can now login with your new password.'
})
} catch (err) {
console.error('[ResetPassword] Error:', err)
return res.status(500).json({
success: false,
message: 'Server error during password reset'
})
}
}


