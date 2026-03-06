import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function Profile(){
  const navigate = useNavigate()
  const fileRef = useRef()
  const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
  const parsed = raw ? JSON.parse(raw) : null

  const [form, setForm] = useState({
    firstName: parsed?.firstName || parsed?.name?.split(' ')?.[0] || '',
    lastName: parsed?.lastName || '',
    name: parsed?.name || parsed?.firstName || '',
    email: parsed?.email || '',
    phone: parsed?.phone || parsed?.mobile || '',
    profilePreview: parsed?.profilePic || null,
    profileFile: null
  })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(()=>{
    // keep `name` in sync with first/last fields if user edits them
    if(!form.name && (form.firstName || form.lastName)){
      setForm(f=>({...f, name: `${f.firstName || ''} ${f.lastName || ''}`.trim()}))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if(!parsed){
    return (
      <>
        <Navbar />
        <div style={{maxWidth:780,margin:'40px auto',padding:20}}>
          <div className="card" style={{textAlign:'center'}}>
            <h3 style={{margin:0}}>You are not signed in</h3>
            <div className="muted" style={{marginTop:8}}>Please sign in to view or edit your profile.</div>
            <div style={{marginTop:16,display:'flex',gap:12,justifyContent:'center'}}>
              <Link to="/login" className="btn-primary">Sign in</Link>
              <Link to="/register" className="btn-enter-big">Create account</Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  function onSelectFile(e){
    const file = e.target.files && e.target.files[0]
    if(!file) return
    const url = URL.createObjectURL(file)
    // revoke previous preview if it was an object URL
    if(form.profilePreview && form.profilePreview.startsWith('blob:')) URL.revokeObjectURL(form.profilePreview)
    setForm(f=> ({...f, profileFile: file, profilePreview: url}))
  }

  function removeImage(){
    if(form.profilePreview && form.profilePreview.startsWith('blob:')) URL.revokeObjectURL(form.profilePreview)
    setForm(f=>({ ...f, profileFile: null, profilePreview: null }))
    if(fileRef.current) fileRef.current.value = null
  }

  async function onSave(e){
    e.preventDefault()
    setSaving(true)
    try{
      const updated = {
        ...parsed,
        firstName: form.firstName || form.name,
        name: form.name || `${form.firstName || ''} ${form.lastName || ''}`.trim(),
        phone: form.phone || parsed.phone || parsed.mobile || '',
        profilePic: form.profilePreview || parsed.profilePic || null,
      }

      // persist to localStorage (frontend-only)
      localStorage.setItem('user', JSON.stringify(updated))

      // also update users[] if present so admin/user lists stay consistent
      try{
        const users = JSON.parse(localStorage.getItem('users') || '[]')
        const idx = users.findIndex(u => u.email === updated.email)
        if(idx > -1){ users[idx] = { ...users[idx], ...updated }; localStorage.setItem('users', JSON.stringify(users)) }
      }catch{ /* ignore — best-effort update for demo users[] in localStorage */ }

      // notify other UI (Navbar listens for this custom event)
      window.dispatchEvent(new CustomEvent('userChanged', { detail: updated }))

      setSavedAt(new Date())
    }finally{
      setSaving(false)
    }
  }

  return (
    <>
      <Navbar />

      <div className="page-container" style={{paddingTop:18}}>
        <div style={{maxWidth:720,margin:'28px auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
            <button className="search-back" onClick={()=>navigate(-1)}>← Back</button>
            <div>
              <h2 style={{margin:0}}>Your profile</h2>
              <div className="muted" style={{marginTop:6}}>Manage your account information</div>
            </div>
          </div>

          <form className="card" onSubmit={onSave} style={{display:'grid',gap:18}}>
            <div style={{display:'flex',gap:18,alignItems:'center'}}>
              <div style={{display:'grid',placeItems:'center'}}>
                <div className="profile-avatar-wrap" style={{position:'relative'}}>
                  <div
                    className="profile-avatar"
                    role="button"
                    tabIndex={0}
                    aria-label="Change profile photo"
                    title="Change profile photo"
                    onClick={() => fileRef.current?.click()}
                    onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
                  >
                    {form.profilePreview ? (
                      <img src={form.profilePreview} alt="Profile preview" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                    ) : (
                      <div className="avatar avatar--placeholder" aria-hidden style={{width:96,height:96,borderRadius:999,fontSize:22,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        { (form.name || parsed.email || 'U').split(' ').map(s=>s?.[0]).filter(Boolean).slice(0,2).join('').toUpperCase() }
                      </div>
                    )}

                    <div className="avatar-overlay" aria-hidden>
                      <div className="overlay-inner">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M21 15v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <div className="overlay-text">Change photo</div>
                        <button
                          type="button"
                          className="overlay-remove"
                          aria-label="Remove profile photo"
                          onClick={(e)=>{ e.stopPropagation(); removeImage(); }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <input ref={fileRef} type="file" accept="image/*" onChange={onSelectFile} style={{display:'none'}} />
                  </div>
                </div> 
              </div>

              <div style={{flex:1,display:'grid',gap:12}}>
                <div style={{display:'flex',gap:12}}>
                  <input placeholder="Full name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{flex:1,padding:12,borderRadius:10,border:'1px solid var(--border)'}} />
                </div>

                <div style={{display:'grid',gap:8}}>
                  <label style={{fontSize:13,color:'var(--muted)'}}>Email</label>
                  <input value={form.email} readOnly style={{padding:12,borderRadius:10,border:'1px solid var(--border)',background:'#f8fafc'}} />
                </div>

                <div style={{display:'grid',gap:8}}>
                  <label style={{fontSize:13,color:'var(--muted)'}}>Mobile number</label>
                  <input placeholder="Mobile number" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={{padding:12,borderRadius:10,border:'1px solid var(--border)'}} />
                </div>
              </div>
            </div>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
              <div className="muted">Your email is read-only for now.</div>
              <div style={{display:'flex',gap:12}}>
                <button type="button" className="btn-signup" onClick={()=>navigate(-1)}>Cancel</button>
                <button className="btn-add" type="submit" disabled={saving} aria-busy={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
              </div>
            </div>

            {savedAt && (<div className="muted" style={{fontSize:13}}>Last saved: {savedAt.toLocaleString()}</div>)}
          </form>
        </div>
      </div>
    </>
  )
}
