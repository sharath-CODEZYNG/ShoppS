import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api"
});

/**
 * Request interceptor - Attach JWT token to all requests
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - Handle auth errors
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If token expired or invalid, redirect to login
    if (error.response?.status === 401) {
      console.warn("[axios] 401 Unauthorized - Token expired or invalid");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      // Redirect to login (only on client-side)
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    // If forbidden (not admin), show warning
    if (error.response?.status === 403) {
      console.warn("[axios] 403 Forbidden - Insufficient permissions");
    }

    return Promise.reject(error);
  }
);

export default api;
