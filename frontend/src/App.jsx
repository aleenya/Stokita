import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import InventoryPage from './pages/InventoryPage'
import api from './api/client'

function App() {
  const [token, setToken] = useState(localStorage.getItem('stokita_token'))

  function handleLoginSuccess(newToken) {
    setToken(newToken)
  }

  function handleLogout() {
    localStorage.removeItem('stokita_token')
    delete api.defaults.headers.common['Authorization']
    setToken(null)
  }

  if (!token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  return <InventoryPage onLogout={handleLogout} />
}

export default App
