// API service for backend communication
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function getProducts() {
  try {
    const response = await fetch(`${API_URL}/products`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

export async function getProductById(id) {
  try {
    const response = await fetch(`${API_URL}/products/${id}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

export async function getProductsByCategory(category) {
  try {
    const response = await fetch(`${API_URL}/products/category/${category}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching products by category:', error);
    return [];
  }
}

// Admin product management
import axios from 'axios'

// Admin product management
export async function createProduct(productData) {
  try {
    // If FormData (contains files), use axios to send multipart/form-data
    if (productData instanceof FormData) {
      const resp = await axios.post(`${API_URL}/products`, productData)
      return resp.data
    }

    // Otherwise send JSON using fetch
    const response = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    })
    const data = await response.json()
    return data
  } catch (err) {
    console.error('Error creating product:', err)
    throw err
  }
}

export async function updateProduct(id, productData) {
  try {
    if (productData instanceof FormData) {
      const resp = await axios.put(`${API_URL}/products/${id}`, productData)
      return resp.data
    }

    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    })
    const data = await response.json()
    return data
  } catch (err) {
    console.error('Error updating product:', err)
    throw err
  }
}

export async function deleteProduct(id) {
  try {
    const response = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' })
    const data = await response.json()
    return data
  } catch (err) {
    console.error('Error deleting product:', err)
    throw err
  }
}

// Cart API
export async function addToCart(userId, productId, quantity = 1) {
  try {
    const response = await fetch(`${API_URL}/cart/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, productId, quantity })
    })
    const data = await response.json()
    return data
  } catch (err) {
    console.error('Error adding to cart:', err)
    throw err
  }
}

export async function fetchCart(userId) {
  try {
    const response = await fetch(`${API_URL}/cart/${userId}`)
    const data = await response.json()
    return data
  } catch (err) {
    console.error('Error fetching cart:', err)
    throw err
  }
}

export async function updateCartItem(cartId, quantity) {
  try {
    const response = await fetch(`${API_URL}/cart/item/${cartId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity })
    })
    const data = await response.json()
    return data
  } catch (err) {
    console.error('Error updating cart item:', err)
    throw err
  }
}

export async function removeCartItem(cartId) {
  try {
    const response = await fetch(`${API_URL}/cart/item/${cartId}`, { method: 'DELETE' })
    const data = await response.json()
    return data
  } catch (err) {
    console.error('Error removing cart item:', err)
    throw err
  }
}

export async function clearCart(userId) {
  try {
    const response = await fetch(`${API_URL}/cart/${userId}`, { method: 'DELETE' })
    const data = await response.json()
    return data
  } catch (err) {
    console.error('Error clearing cart:', err)
    throw err
  }
}

// Orders API
export const orderAPI = {
  createOrder: (data) => fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => res.json()),


  createVoiceOrder: (data) => fetch(`${API_URL}/orders/voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => res.json()),
  
  getOrderById: (id) => fetch(`${API_URL}/orders/${id}`).then(res => res.json()),
  
  getUserOrders: (userId) => fetch(`${API_URL}/orders/user/${userId}`).then(res => res.json()),
  
  getAllOrders: () => fetch(`${API_URL}/orders`).then(res => res.json()),
  
  updateOrderStatus: (id, status) => fetch(`${API_URL}/orders/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  }).then(res => res.json())
}
