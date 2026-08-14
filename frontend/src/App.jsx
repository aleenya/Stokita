import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import api, { setCsrfToken } from './api/client'
import IngredientsPage from './pages/IngredientsPage'
import MenusPage from './pages/MenusPage'
import SalesPage from './pages/SalesPage'
import ProfitPage from './pages/ProfitPage'
import PeoplePage from './pages/PeoplePage'
import Dashboard from './pages/Dashboard'
import Sidebar, { MobileTopbar, pageLabel } from './components/Sidebar'
import ChatWidget from './components/ChatWidget'

function AppLayout({ authStatus, authView, setAuthView, me, handleAuthSuccess, handleLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0]">
        <p className="text-sm text-[#5B6B82]">Loading…</p>
      </div>
    )
  }

  if (authStatus === 'out') {
    return authView === 'login' ? (
      <LoginPage
        onLoginSuccess={handleAuthSuccess}
        onSwitchToRegister={() => setAuthView('register')}
      />
    ) : (
      <RegisterPage
        onRegisterSuccess={handleAuthSuccess}
        onSwitchToLogin={() => setAuthView('login')}
      />
    )
  }

  const isOwner = me?.role === 'owner'
  const PAGES = isOwner
    ? ['dashboard', 'ingredients', 'menus', 'sales', 'profit', 'people']
    : ['dashboard', 'ingredients', 'menus', 'sales', 'profit']

  // Convert pathname like "/profit" to "profit"
  const page = location.pathname.split('/')[1] || 'dashboard'

  return (
    <div
      className="flex h-screen overflow-hidden bg-[#F7F5F0] text-[#18233D] antialiased relative"
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
        onNavigate={(p) => navigate(`/${p}`)}
        pages={PAGES}
        businessName={me?.business_name || 'Stokita'}
        userName={me?.full_name || me?.username || 'User'}
        userRole={me?.role || 'staff'}
        onLogout={handleLogout}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pt-14 md:pt-0 relative z-0">
        <div className="p-4 sm:p-6 md:p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard ownerName={me?.full_name} onNavigate={(p) => navigate(`/${p}`)} />} />
            <Route path="/ingredients" element={<IngredientsPage onLogout={handleLogout} />} />
            <Route path="/menus" element={<MenusPage onLogout={handleLogout} />} />
            <Route path="/sales" element={<SalesPage onLogout={handleLogout} />} />
            <Route path="/profit" element={<ProfitPage onLogout={handleLogout} />} />
            {isOwner && <Route path="/people" element={<PeoplePage onLogout={handleLogout} />} />}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>

      <ChatWidget />
    </div>
  )
}

function App() {
  const [authStatus, setAuthStatus] = useState('checking')
  const [me, setMe] = useState(null)
  const [authView, setAuthView] = useState('login')

  const checkSession = useCallback(async () => {
    try {
      const res = await api.get('/me/')
      setMe(res.data)
      setAuthStatus('in')
    } catch {
      setMe(null)
      setAuthStatus('out')
    }
  }, [])

  useEffect(() => {
    api.get('/auth/csrf/')
      .then((res) => setCsrfToken(res.data?.csrftoken))
      .catch(() => {})
    checkSession()
  }, [checkSession])

  function handleAuthSuccess() {
    checkSession()
  }

  async function handleLogout() {
    try {
      await api.post('/auth/logout/')
    } catch {
    }
    setMe(null)
    setAuthStatus('out')
  }

  return (
    <BrowserRouter>
      <AppLayout 
        authStatus={authStatus} 
        authView={authView} 
        setAuthView={setAuthView} 
        me={me} 
        handleAuthSuccess={handleAuthSuccess} 
        handleLogout={handleLogout} 
      />
    </BrowserRouter>
  )
}

export default App