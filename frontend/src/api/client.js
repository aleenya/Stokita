import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
})

const savedToken = localStorage.getItem('stokita_token')
if (savedToken) {
  api.defaults.headers.common['Authorization'] = `Token ${savedToken}`
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('stokita_token')
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export default api