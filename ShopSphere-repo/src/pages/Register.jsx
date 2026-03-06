import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Register(){
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [profilePreview, setProfilePreview] = useState(null)
  const [errors, setErrors] = useState({})

  function validate(){
    const err = {}
    if(!firstName.trim()) err.firstName = 'First name is required'
    if(!lastName.trim()) err.lastName = 'Last name is required'
    if(!email.trim()) err.email = 'Email is required'
    else if(!/^\S+@\S+\.\S+$/.test(email)) err.email = 'Enter a valid email'
    if(!phone.trim()) err.phone = 'Phone is required'
    else if(!/^\d{7,15}$/.test(phone)) err.phone = 'Enter a valid phone (7-15 digits)'
    if(!password) err.password = 'Password is required'
    else if(password.length < 6) err.password = 'Password must be at least 6 characters'
    if(password !== confirmPassword) err.confirmPassword = 'Passwords do not match'
    return err
  }

  function fileToBase64(file){
    return new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => res(reader.result)
      reader.onerror = () => rej('Failed to read file')
      reader.readAsDataURL(file)
    })
  }

  async function onProfileChange(e){
    const file = e.target.files?.[0]
    if(file){
      try{
        const base64 = await fileToBase64(file)
        setProfilePreview(base64)
      }catch(err){
        console.error(err)
      }
    }
  }

  function getUsers(){
    try{
      return JSON.parse(localStorage.getItem('users') || '[]')
    }catch(e){
      return []
    }
  }

  function saveUsers(users){
    localStorage.setItem('users', JSON.stringify(users))
  }

  function handleSubmit(e){
    e.preventDefault()
    const err = validate()
    setErrors(err)
    if(Object.keys(err).length) return

    const users = getUsers()
    const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if(exists){
      setErrors({ email: 'An account with this email already exists' })
      return
    }

    const newUser = {
      id: Date.now(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
      profilePic: profilePreview || null,
    }

    users.push(newUser)
    saveUsers(users)
    alert('Account created successfully. Please login.')
    navigate('/login')
  }

  return (
    <div style={{maxWidth:480}}>
      <h2>Register</h2>
      <form className="card" onSubmit={handleSubmit}>
        <div style={{display:'flex',gap:8}}>
          <div style={{flex:1}}>
            <label style={{display:'block',marginBottom:8}}>First name</label>
            <input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="First name" style={{width:'100%',padding:8,marginBottom:6}} />
            {errors.firstName && <div style={{color:'red',marginBottom:6}}>{errors.firstName}</div>}
          </div>

          <div style={{flex:1}}>
            <label style={{display:'block',marginBottom:8}}>Last name</label>
            <input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Last name" style={{width:'100%',padding:8,marginBottom:6}} />
            {errors.lastName && <div style={{color:'red',marginBottom:6}}>{errors.lastName}</div>}
          </div>
        </div>

        <label style={{display:'block',marginBottom:8}}>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={{width:'100%',padding:8,marginBottom:6}} />
        {errors.email && <div style={{color:'red',marginBottom:6}}>{errors.email}</div>}

        <label style={{display:'block',marginBottom:8}}>Phone</label>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone number" style={{width:'100%',padding:8,marginBottom:6}} />
        {errors.phone && <div style={{color:'red',marginBottom:6}}>{errors.phone}</div>}

        <label style={{display:'block',marginBottom:8}}>Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••" style={{width:'100%',padding:8,marginBottom:6}} />
        {errors.password && <div style={{color:'red',marginBottom:6}}>{errors.password}</div>}

        <label style={{display:'block',marginBottom:8}}>Confirm password</label>
        <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="••••••" style={{width:'100%',padding:8,marginBottom:6}} />
        {errors.confirmPassword && <div style={{color:'red',marginBottom:6}}>{errors.confirmPassword}</div>}

        <label style={{display:'block',marginBottom:8}}>Profile picture (optional)</label>
        <input type="file" accept="image/*" onChange={onProfileChange} style={{marginBottom:12}} />
        {profilePreview && (
          <div style={{marginBottom:12}}>
            <img src={profilePreview} alt="preview" style={{width:80,height:80,objectFit:'cover',borderRadius:8}} />
          </div>
        )}

        <div style={{display:'flex',gap:8}}>
          <button type="submit">Create account</button>
        </div>
      </form>
    </div>
  )
}
