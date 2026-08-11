import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
})

const savedToken = localStorage.getItem('stokita_token')
if (savedToken) {
  api.defaults.headers.common['Authorization'] = `Token ${savedToken}`
}

export default api