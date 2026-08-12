import { useState } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS — sama persis dengan Dashboard.jsx / Sidebar.jsx / IngredientsPage.jsx
   ========================================================================= */
const LABEL = 'block text-xs uppercase tracking-wide text-[#8B96A6] mb-2'
const INPUT =
  'w-full bg-white border border-[#E4E2DC] rounded-md px-4 py-2.5 text-[#18233D] placeholder:text-[#8B96A6] focus:outline-none focus:ring-2 focus:ring-[#28579C]/25 focus:border-[#28579C] transition-colors'
const BTN_PRIMARY =
  'w-full text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
const ERROR_BANNER = 'text-sm text-[#B8433B] bg-[#FBEBEA] rounded-md px-3 py-2'

/* =========================================================================
   HERO VISUAL — animated analytics illustration, inline SVG + CSS only
   (no external image assets). Reads as a live "insights" chart behind two
   floating glass stat chips, matching the navy/brand-blue palette.
   ========================================================================= */
function HeroVisual() {
  return (
    <div className="relative h-64">
      <style>{`
        @keyframes drawLine { to { stroke-dashoffset: 0; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatChip { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes pulseDot { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.15; transform: scale(2.4); } }
      `}</style>

      {/* soft glow behind the chart */}
      <div
        className="absolute -right-10 -top-6 w-64 h-64 rounded-full opacity-25 blur-[70px]"
        style={{ background: '#3E6BB8' }}
        aria-hidden="true"
      />

      <svg
        viewBox="0 0 440 200"
        className="relative w-full h-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="heroAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5B8FD9" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#5B8FD9" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline grid */}
        {[40, 90, 140].map((y) => (
          <line key={y} x1="0" y1={y} x2="440" y2={y} stroke="white" strokeOpacity="0.06" />
        ))}

        {/* area under curve */}
        <path
          d="M0,150 C60,140 90,90 150,95 C210,100 230,60 290,55 C340,51 370,70 440,35 L440,190 L0,190 Z"
          fill="url(#heroAreaFill)"
        />

        {/* animated line */}
        <path
          d="M0,150 C60,140 90,90 150,95 C210,100 230,60 290,55 C340,51 370,70 440,35"
          fill="none"
          stroke="#8FB4E8"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength="1"
          style={{
            strokeDasharray: 1,
            strokeDashoffset: 1,
            animation: 'drawLine 1.6s ease-out 0.2s forwards',
          }}
        />

        {/* current-point marker with pulse */}
        <circle cx="440" cy="35" r="16" fill="#8FB4E8" style={{ animation: 'pulseDot 2.2s ease-out infinite' }} />
        <circle cx="440" cy="35" r="4.5" fill="#EAF1FB" />
      </svg>

      {/* floating stat chips */}
      <div
        className="absolute left-2 top-2 rounded-lg bg-white/[0.07] backdrop-blur-sm border border-white/10 px-3.5 py-2.5"
        style={{ animation: 'fadeInUp 0.5s ease-out 0.9s both, floatChip 4s ease-in-out 1.4s infinite' }}
      >
        <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-white/45 mb-0.5">Margin trend</p>
        <p className="text-sm font-bold text-white">+18% this week</p>
      </div>

      <div
        className="absolute right-4 bottom-2 rounded-lg bg-white/[0.07] backdrop-blur-sm border border-white/10 px-3.5 py-2.5"
        style={{ animation: 'fadeInUp 0.5s ease-out 1.15s both, floatChip 4s ease-in-out 1.7s infinite' }}
      >
        <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-white/45 mb-0.5">Stock sync</p>
        <p className="text-sm font-bold text-white">Live · every sale</p>
      </div>
    </div>
  )
}

export default function LoginPage({ onLoginSuccess, onSwitchToRegister }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!username || !password) {
      setError('Isi username dan password dulu.')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/login/', { username, password })
      const token = res.data.token

      localStorage.setItem('stokita_token', token)
      api.defaults.headers.common['Authorization'] = `Token ${token}`

      onLoginSuccess?.(token)
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 401) {
        setError('Username atau password salah.')
      } else {
        setError('Gagal connect ke server. Cek backend-nya udah jalan belum.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row antialiased"
      style={{
        fontFamily:
          "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >

      {/* LEFT — navy hero panel */}
      <div className="relative md:w-1/2 bg-[linear-gradient(155deg,#243559_0%,#131C33_100%)] text-white px-8 py-10 md:p-14 flex flex-col justify-between overflow-hidden">
        {/* subtle dot-grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden="true"
        />

        <div className="relative">
          <div className="flex items-center gap-2 mb-16 md:mb-24">
            <div className="w-2 h-2 rounded-full bg-[#5B8FD9]" />
            <span className="text-sm tracking-[0.2em] uppercase text-white/50 font-bold">
              Stokita
            </span>
          </div>

          <h1 className="font-extrabold text-4xl md:text-5xl leading-[1.1] tracking-tight max-w-md">
            What should you do today?
          </h1>
          <p className="mt-5 text-white/70 text-base max-w-sm leading-relaxed">
            Sign in to see today's stock risks, profit leaks, and what to buy — before the day gets away from you.
          </p>
        </div>

        {/* Signature element: animated analytics hero visual */}
        <div className="hidden md:block mt-12 max-w-sm">
          <HeroVisual />
        </div>
      </div>

      {/* RIGHT — form panel */}
      <div className="md:w-1/2 bg-[#F7F5F0] flex items-center justify-center px-8 py-12 md:p-14">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#18233D] mb-1">
            Welcome back
          </h2>
          <p className="text-sm text-[#5B6B82] mb-8">
            Sign in with the account your owner set up for you.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="username" className={LABEL}>
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={INPUT}
                placeholder="rini"
              />
            </div>

            <div>
              <label htmlFor="password" className={LABEL}>
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT}
                placeholder="••••••••"
              />
            </div>

            {error && <p className={ERROR_BANNER}>{error}</p>}

            <button type="submit" disabled={loading} className={BTN_PRIMARY}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-sm text-[#5B6B82] text-center">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-[#28579C] font-semibold hover:text-[#1E4278] transition-colors"
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
