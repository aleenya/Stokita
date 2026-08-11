import { useState } from 'react'
import api from '../api/client'

// Contoh 3 baris Daily Brief buat preview di panel kiri — statis, cuma ilustrasi visual.
const PREVIEW_ITEMS = [
  { tag: 'HIGH RISK', label: 'Chicken breast — expires in 2 days', accent: 'border-[#E2A33D]' },
  { tag: 'PROFIT LEAK', label: 'Ayam Geprek — margin 18%', accent: 'border-[#C1443B]' },
  { tag: 'PURCHASE', label: 'Eggs — buy 5 trays today', accent: 'border-[#5C8B6E]' },
]

export default function LoginPage({ onLoginSuccess }) {
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
    <div className="min-h-screen flex flex-col md:flex-row font-[Inter,sans-serif]">

      {/* LEFT — dark ledger panel */}
      <div className="relative md:w-1/2 bg-[#16211B] text-[#F3EFE4] px-8 py-10 md:p-14 flex flex-col justify-between overflow-hidden">
        <div>
          <div className="flex items-center gap-2 mb-16 md:mb-24">
            <div className="w-2 h-2 rounded-full bg-[#E2A33D]" />
            <span className="text-sm tracking-[0.2em] uppercase text-[#9FAFA3] font-[IBM_Plex_Mono,monospace]">
              Stokita
            </span>
          </div>

          <h1 className="font-[Fraunces,serif] font-semibold text-4xl md:text-5xl leading-[1.1] tracking-[-0.01em] max-w-md">
            What should you do today?
          </h1>
          <p className="mt-5 text-[#9FAFA3] text-base max-w-sm leading-relaxed">
            Sign in to see today's stock risks, profit leaks, and what to buy — before the day gets away from you.
          </p>
        </div>

        {/* Signature element: torn-receipt style Daily Brief preview */}
        <div className="hidden md:block mt-12 max-w-sm">
          <div className="relative bg-[#1D2B23] rounded-b-md pt-1">
            {/* perforated edge */}
            <div
              className="h-3 w-full"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, transparent, transparent 6px, #16211B 6px, #16211B 10px)',
                backgroundColor: '#1D2B23',
                maskImage: 'radial-gradient(circle at 5px 0, transparent 4px, black 4.5px)',
                maskSize: '10px 100%',
                WebkitMaskImage: 'radial-gradient(circle at 5px 0, transparent 4px, black 4.5px)',
                WebkitMaskSize: '10px 100%',
              }}
            />
            <div className="px-5 pb-5 pt-3">
              <p className="font-[IBM_Plex_Mono,monospace] text-[11px] tracking-[0.15em] uppercase text-[#6F8578] mb-3">
                Today's Brief · 3 actions
              </p>
              <ul className="space-y-3">
                {PREVIEW_ITEMS.map((item) => (
                  <li key={item.tag} className={`border-l-2 pl-3 ${item.accent}`}>
                    <p className="font-[IBM_Plex_Mono,monospace] text-[10px] tracking-[0.1em] text-[#9FAFA3]">
                      {item.tag}
                    </p>
                    <p className="text-sm text-[#F3EFE4] leading-snug">{item.label}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — cream form panel */}
      <div className="md:w-1/2 bg-[#FAF6EC] flex items-center justify-center px-8 py-12 md:p-14">
        <div className="w-full max-w-sm">
          <h2 className="font-[Fraunces,serif] font-semibold text-2xl text-[#1F2A24] mb-1">
            Welcome back
          </h2>
          <p className="text-sm text-[#5C6B62] mb-8">
            Sign in with the account your owner set up for you.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white border border-[#D8D0BF] rounded-md px-4 py-2.5 text-[#1F2A24] placeholder:text-[#A8A196] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
                placeholder="rini"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-[#D8D0BF] rounded-md px-4 py-2.5 text-[#1F2A24] placeholder:text-[#A8A196] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-[#C1443B] bg-[#C1443B]/10 border border-[#C1443B]/30 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#16211B] text-[#F3EFE4] rounded-md py-2.5 font-medium tracking-wide hover:bg-[#1D2B23] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-xs text-[#8A8377] leading-relaxed">
            Don't have an account? Ask your outlet owner to add you from the Stokita dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}