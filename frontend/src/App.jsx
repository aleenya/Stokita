import { useState, useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import api from './api/client'
import IngredientsPage from './pages/IngredientsPage'
import MenusPage from './pages/MenusPage'
import SalesPage from './pages/SalesPage'
import ProfitPage from './pages/ProfitPage'
import BriefPage from './pages/BriefPage'
import PeoplePage from './pages/PeoplePage'

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('stokita_token'))
  const [me, setMe] = useState(null)
  const [page, setPage] = useState('ingredients')

  useEffect(() => {
    if (!token) return
    api.get('/me/').then((res) => setMe(res.data)).catch(() => setMe(null))
  }, [token])

  function handleLoginSuccess(newToken) {
    setToken(newToken)
  }

  function handleLogout() {
    localStorage.removeItem('stokita_token')
    delete api.defaults.headers.common['Authorization']
    setToken(null)
    setMe(null)
  }

  if (!token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  const isOwner = me?.role === 'owner'
  const PAGES = isOwner
    ? ['ingredients', 'menus', 'sales', 'profit', 'brief', 'people']
    : ['ingredients', 'menus', 'sales', 'profit', 'brief']

  return (
    <div className="min-h-screen bg-[#FAF6EC] font-[Inter,sans-serif]">
      <nav className="bg-[#16211B] text-[#F3EFE4] px-6 py-3 flex items-center justify-between">
        <div className="flex gap-1">
          {PAGES.map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded-md text-sm capitalize transition ${
                page === p ? 'bg-[#E2A33D] text-[#16211B] font-medium' : 'hover:bg-[#1D2B23]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-[#9FAFA3] hover:text-[#F3EFE4] transition"
        >
          Logout
        </button>
      </nav>

      <main className="p-6">
        {page === 'ingredients' && <IngredientsPage onLogout={handleLogout} />}
        {page === 'menus' && <MenusPage onLogout={handleLogout} />}
        {page === 'sales' && <SalesPage onLogout={handleLogout} />}
        {page === 'profit' && <ProfitPage onLogout={handleLogout} />}
        {page === 'brief' && <BriefPage onLogout={handleLogout} />}
        {page === 'people' && isOwner && <PeoplePage onLogout={handleLogout} />}
      </main>
    </div>
  )
}

export default App