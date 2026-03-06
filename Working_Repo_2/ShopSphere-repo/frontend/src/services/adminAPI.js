import api from '../utils/axiosInstance'

export const adminAPI = {
  getUsers: async () => {
    const res = await api.get('/users')
    return res.data
  },

  getUser: async (id) => {
    const res = await api.get(`/users/${id}`)
    return res.data
  },

  getDashboard: async () => {
    const res = await api.get('/admin/dashboard')
    return res.data
  }
}

