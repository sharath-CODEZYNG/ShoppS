// Main application router and layout
import './App.css'
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import PremiumLanding from './pages/PremiumLanding'
import LandingPage from './pages/LandingPage'
import Home from './pages/Home'
import ProductPage from './pages/ProductPage'
import Products from './pages/Products'
import Cart from './pages/Cart'
import Orders from './pages/Orders'
import OrderDetails from './pages/OrderDetails'
import Profile from './pages/Profile'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminRoute from './components/AdminRoute'
import AdminLayout from './admin/AdminLayout'
import Dashboard from './admin/Dashboard'
import AdminProducts from './admin/AdminProducts'
import AdminOrders from './admin/AdminOrders'
import AdminUsers from './admin/AdminUsers'
import { CartProvider } from './context/CartContext'
import { CategoryProvider } from './context/CategoryContext'

function App() {
  useEffect(()=>{
    const users = JSON.parse(localStorage.getItem('users') || '[]')
    if(!users.find(u=> u.email === 'admin@shopsphere.com')){
      users.push({id:1, firstName:'Admin', name:'Admin User', email:'admin@shopsphere.com', password:'admin123', created:'2025-10-01'})
      localStorage.setItem('users', JSON.stringify(users))
    }
  }, [])

  return (
    <BrowserRouter>
      <CartProvider>
        <CategoryProvider>
          <AppLayout />
        </CategoryProvider>
      </CartProvider>
    </BrowserRouter>
  )
}

function AppLayout(){
  const location = useLocation()
  const showNavbar = location.pathname === '/home'

  return (
    <div className="app-root">
      {showNavbar && <Navbar />}
      <main className="page-container">
        <Routes>
          <Route path="/" element={<LandingPage />} />

          <Route path="/home" element={<Home />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/products" element={<Products />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:orderId" element={<OrderDetails />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/home/admin" element={<Navigate to="/admin" replace />} />

          <Route path="/admin/*" element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
        </Routes>
      </main>
    </div>
  )
}

export default App
