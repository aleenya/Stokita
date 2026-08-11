import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import api from './api/client'
import IngredientsPage from './pages/IngredientsPage'
import MenusPage from './pages/MenusPage'
import SalesPage from './pages/SalesPage'
import ProfitPage from './pages/ProfitPage'
import BriefPage from './pages/BriefPage'

const PAGES = ['ingredients', 'menus', 'sales', 'profit', 'brief']

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('stokita_token'))
  const [page, setPage] = useState('ingredients')

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
        {page === 'ingredients' && <IngredientsPage />}
        {page === 'menus' && <MenusPage />}
        {page === 'sales' && <SalesPage />}
        {page === 'profit' && <ProfitPage />}
        {page === 'brief' && <BriefPage />}
      </main>
    </div>
  )
}

export default App
