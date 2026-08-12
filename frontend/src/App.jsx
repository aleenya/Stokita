import { useState, useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import api from './api/client'
import IngredientsPage from './pages/IngredientsPage'
import MenusPage from './pages/MenusPage'
import SalesPage from './pages/SalesPage'
import ProfitPage from './pages/ProfitPage'
import PeoplePage from './pages/PeoplePage'
import Dashboard from './pages/Dashboard'
import Sidebar, { MobileTopbar, pageLabel } from './components/Sidebar'

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('stokita_token'))
  const [me, setMe] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [authView, setAuthView] = useState('login') // 'login' | 'register'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!token) return
    api.get('/me/').then((res) => setMe(res.data)).catch(() => setMe(null))
  }, [token])

  function handleLoginSuccess(newToken) {
    setToken(newToken)
  }

  function handleRegisterSuccess(newToken) {
    setToken(newToken)
  }

  function handleLogout() {
    localStorage.removeItem('stokita_token')
    delete api.defaults.headers.common['Authorization']
    setToken(null)
    setMe(null)
  }

  if (!token) {
    return authView === 'login' ? (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setAuthView('register')}
      />
    ) : (
      <RegisterPage
        onRegisterSuccess={handleRegisterSuccess}
        onSwitchToLogin={() => setAuthView('login')}
      />
    )
  }

  const isOwner = me?.role === 'owner'
  const PAGES = isOwner
    ? ['dashboard', 'ingredients', 'menus', 'sales', 'profit', 'people']
    : ['dashboard', 'ingredients', 'menus', 'sales', 'profit']

  // Dashboard punya hero full-bleed, jadi padding-nya diatur sendiri di dalam
  // komponennya. Halaman lain tetap dapat padding dari shell ini.
  const isFullBleed = page === 'dashboard'

  return (
    <div
      className="flex h-screen overflow-hidden bg-[#F7F5F0] text-[#18233D] antialiased"
      style={{
        fontFamily:
          "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <MobileTopbar
        title={pageLabel(page)}
        open={sidebarOpen}
        onOpenMenu={() => setSidebarOpen(true)}
      />

      <Sidebar
        page={page}
        onNavigate={setPage}
        pages={PAGES}
        businessName={me?.business_name || 'Stokita'}
        userName={me?.full_name || me?.username || 'User'}
        userRole={me?.role || 'staff'}
        onLogout={handleLogout}
        onAskStokita={() => {
          /* TODO: buka panel Ask Stokita */
        }}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className={isFullBleed ? '' : 'p-4 sm:p-6 md:p-8'}>
          {page === 'dashboard' && <Dashboard ownerName={me?.full_name} onNavigate={setPage} />}
          {page === 'ingredients' && <IngredientsPage onLogout={handleLogout} />}
          {page === 'menus' && <MenusPage onLogout={handleLogout} />}
          {page === 'sales' && <SalesPage onLogout={handleLogout} />}
          {page === 'profit' && <ProfitPage onLogout={handleLogout} />}
          {page === 'people' && isOwner && <PeoplePage onLogout={handleLogout} />}
        </div>
      </main>
    </div>
  )
}

export default App