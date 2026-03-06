import { Link, useNavigate } from 'react-router-dom'
import { useContext, useEffect, useRef, useState } from 'react'
import { CartContext } from '../context/CartContext'
import { useCategory } from '../context/CategoryContext'
import { PRODUCTS } from '../services/products'


export default function Navbar(){
  const { cart } = useContext(CartContext)
  const count = cart.reduce((s,i)=>s+i.quantity,0)
  const [user, setUser] = useState(null)
  const [open, setOpen] = useState(false)
  const [imgError, setImgError] = useState(false)
  const navigate = useNavigate()
  const ref = useRef()
  const { selectedCategory, setSelectedCategory, searchQuery, setSearchQuery } = useCategory()
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef()

  useEffect(()=>{
    const raw = localStorage.getItem('currentUser')
    if(raw) setUser(JSON.parse(raw))

    function onStorage(e){
      if(e.key === 'currentUser'){
        setUser(e.newValue ? JSON.parse(e.newValue) : null)
      }
    }

    function onCurrentUserChanged(e){
      // custom event dispatched by Profile page after save
      const stored = localStorage.getItem('currentUser')
      setUser(stored ? JSON.parse(stored) : null)
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('currentUserChanged', onCurrentUserChanged)
    return ()=>{
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('currentUserChanged', onCurrentUserChanged)
    }
  },[])

  // reset image-error when the user or their avatar changes
  useEffect(()=>{
    setImgError(false)
  }, [user?.profilePic, user?.email, user?.firstName, user?.name])

  useEffect(()=>{
    function onDoc(e){
      if(ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return ()=> document.removeEventListener('click', onDoc)
  },[])

  useEffect(()=>{
    function onDoc(e){
      if(searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false)
    }
    document.addEventListener('click', onDoc)
    return ()=> document.removeEventListener('click', onDoc)
  },[])

  function logout(){
    localStorage.removeItem('currentUser')
    setUser(null)
    setOpen(false)
    navigate('/')
  }

  const baseProducts = selectedCategory === 'All' ? PRODUCTS : PRODUCTS.filter(p => p.category === selectedCategory)
  const suggestions = searchQuery.trim() === '' ? [] : baseProducts
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .slice(0,5)

  function onSuggestionClick(name){
    setSearchQuery(name)
    setShowSuggestions(false)
  }

  return (
    <header className="site-header">
      <nav className="nav container nav-sticky">
        <div className="nav-left">
          <Link to="/" className="nav-brand">ShopSphere</Link>
        </div>

        <div className="nav-center">
          <div className="search" ref={searchRef}>
            {searchQuery.trim() !== '' && (
              <button
                className="search-back"
                aria-label="Clear search"
                onClick={()=>{ setSearchQuery(''); setShowSuggestions(false); searchRef.current.querySelector('input')?.focus(); }}
              >
                ←
              </button>
            )}

            <input value={searchQuery} onChange={e=>{ setSearchQuery(e.target.value); setShowSuggestions(true); }} placeholder="Search product or brand here..." />

            {showSuggestions && suggestions.length > 0 && (
              <div className="search-suggestions">
                {suggestions.map(s => (
                  <button key={s.id} className="search-suggestion-item" onClick={()=>onSuggestionClick(s.name)}>{s.name}</button>
                ))}
              </div>
            )}
          </div>

          {user ? (
            <select className="cat-select" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              <option value="All">All Categories</option>
              <option value="Food">Food</option>
              <option value="Groceries">Groceries</option>
              <option value="Electronic Gadgets">Electronic Gadgets</option>
            </select>
          ) : null}
        </div>

        <div className="nav-right">
          <Link to="/home" className="nav-link home-link" aria-label="Home">Home</Link>
          {user ? (
            <>
              <Link to="/orders" className="nav-link">Orders</Link>

              <Link to="/cart" className="nav-link cart-link" aria-label="Cart">
                <span className="cart-icon" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3h2l1.4 9.4a2 2 0 002 1.6h9.2a2 2 0 001.9-1.5L21 7H6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="20" r="1" fill="currentColor"/><circle cx="18" cy="20" r="1" fill="currentColor"/></svg>
                </span>
                <span className="cart-badge">{count}</span>
              </Link>

              <div className="user-menu" ref={ref}>
                <button className="user-btn" onClick={()=>setOpen(o=>!o)}>
                {(() => {
                  const avatarSrc = user?.profilePic && !imgError ? user.profilePic : null
                  const initials = (user?.firstName || user?.name || user?.email || 'U')
                    .split(' ')
                    .map(s=>s?.[0])
                    .filter(Boolean)
                    .slice(0,2)
                    .join('')
                    .toUpperCase()

                  return avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={`${user.firstName || user.name}'s avatar`}
                      className="avatar"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <div className="avatar avatar--placeholder" aria-hidden="true">{initials}</div>
                  )
                })()}

                <span className="user-name">Hi, {user.firstName || user.name}</span>
                </button>

                {open && (
                  <div className="user-dropdown">
                    <Link to="/profile" onClick={()=>setOpen(false)}>Profile</Link>
                    <button onClick={logout}>Logout</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="btn-signup">Sign Up</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
