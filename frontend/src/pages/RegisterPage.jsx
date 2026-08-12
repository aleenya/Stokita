import { useState } from 'react'
import api from '../api/client'

function extractError(err) {
  const data = err.response?.data
  if (!data) return ''
  if (typeof data === 'string') return data
  if (data.error) return data.error
  const firstKey = Object.keys(data)[0]
  if (firstKey) {
    const val = data[firstKey]
    return Array.isArray(val) ? val[0] : String(val)
  }
  return ''
}

// Slugify sederhana buat preview di sisi client — validasi final tetap di
// backend, ini cuma bantu owner liat kira-kira kode apa yang bakal
// dipakai stafnya buat join.
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function RegisterPage({ onRegisterSuccess, onSwitchToLogin }) {
  const [role, setRole] = useState('owner')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessSlug, setBusinessSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [staffCode, setStaffCode] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingApproval, setPendingApproval] = useState(false)

  function handleBusinessNameChange(value) {
    setBusinessName(value)
    // Auto-generate slug dari nama, KECUALI owner udah pernah edit manual
    // sendiri — begitu mereka ngetik di field slug, kita berhenti nimpa.
    if (!slugTouched) {
      setBusinessSlug(slugify(value))
    }
  }

  function handleSlugChange(value) {
    setSlugTouched(true)
    setBusinessSlug(slugify(value))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!username || !password) {
      setError('Username dan password wajib diisi.')
      return
    }
    if (role === 'owner' && !businessName.trim()) {
      setError('Nama business wajib diisi.')
      return
    }
    if (role === 'staff' && !staffCode.trim()) {
      setError('Masukkan kode business dari owner kamu.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        role,
        username,
        password,
        full_name: fullName,
        ...(role === 'owner'
          ? { business_name: businessName, business_username: businessSlug }
          : { business_username: staffCode }),
      }
      const res = await api.post('/auth/register/', payload)

      if (res.data.is_active === false) {
        // Staff account created but not yet approved by the owner — the
        // token won't work against the API until they're activated.
        setPendingApproval(true)
        return
      }

      const token = res.data.token
      localStorage.setItem('stokita_token', token)
      api.defaults.headers.common['Authorization'] = `Token ${token}`

      onRegisterSuccess?.(token)
    } catch (err) {
      setError(extractError(err) || 'Gagal mendaftar. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  if (pendingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6EC] px-4 py-12 font-[Inter,sans-serif]">
        <div className="w-full max-w-md text-center">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-2 h-2 rounded-full bg-[#E2A33D]" />
            <span className="text-sm tracking-[0.2em] uppercase text-[#5C6B62] font-[IBM_Plex_Mono,monospace]">
              Stokita
            </span>
          </div>

          <h1 className="font-[Fraunces,serif] font-semibold text-2xl text-[#1F2A24] mb-3">
            Account created
          </h1>
          <p className="text-sm text-[#5C6B62] mb-8">
            Your account is waiting for your business owner to activate it under People.
            You'll be able to sign in once they do.
          </p>

          <button
            type="button"
            onClick={onSwitchToLogin}
            className="w-full bg-[#16211B] text-[#F3EFE4] rounded-md py-2.5 font-medium tracking-wide hover:bg-[#1D2B23] transition"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF6EC] px-4 py-12 font-[Inter,sans-serif]">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-2 h-2 rounded-full bg-[#E2A33D]" />
          <span className="text-sm tracking-[0.2em] uppercase text-[#5C6B62] font-[IBM_Plex_Mono,monospace]">
            Stokita
          </span>
        </div>

        <h1 className="font-[Fraunces,serif] font-semibold text-2xl text-[#1F2A24] mb-1 text-center">
          Create your account
        </h1>
        <p className="text-sm text-[#5C6B62] mb-8 text-center">
          Owner or staff — tell us which, and we'll set things up right.
        </p>

        {/* Role toggle */}
        <div className="flex bg-white border border-[#D8D0BF] rounded-md p-1 mb-6">
          {[
            { key: 'owner', label: 'I own the business' },
            { key: 'staff', label: "I'm joining a team" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRole(opt.key)}
              className={`flex-1 text-sm py-2 rounded-md transition font-medium ${
                role === opt.key
                  ? 'bg-[#16211B] text-[#F3EFE4]'
                  : 'text-[#5C6B62] hover:bg-[#F3EFE4]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-white border border-[#D8D0BF] rounded-md px-4 py-2.5 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
              placeholder="Rini Wijaya"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white border border-[#D8D0BF] rounded-md px-4 py-2.5 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
                placeholder="rini"
              />
            </div>
            <div>
              <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-[#D8D0BF] rounded-md px-4 py-2.5 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>
          </div>

          {role === 'owner' ? (
            <>
              <div>
                <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
                  Business name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => handleBusinessNameChange(e.target.value)}
                  className="w-full bg-white border border-[#D8D0BF] rounded-md px-4 py-2.5 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
                  placeholder="Bu Rini's Cloud Kitchen"
                />
              </div>

              <div>
                <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
                  Business code
                </label>
                <input
                  type="text"
                  value={businessSlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className="w-full bg-white border border-[#D8D0BF] rounded-md px-4 py-2.5 text-[#1F2A24] font-[IBM_Plex_Mono,monospace] text-sm focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
                  placeholder="bu-rinis-cloud-kitchen"
                />
                <p className="text-xs text-[#8A8377] mt-1.5">
                  We'll add a random string to the end for security, so the final code won't be guessable.
                  You'll find the full code under People after signing up.
                </p>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
                Business code
              </label>
              <input
                type="text"
                value={staffCode}
                onChange={(e) => setStaffCode(e.target.value)}
                className="w-full bg-white border border-[#D8D0BF] rounded-md px-4 py-2.5 text-[#1F2A24] font-[IBM_Plex_Mono,monospace] text-sm focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
                placeholder="bu-rinis-cloud-kitchen"
              />
              <p className="text-xs text-[#8A8377] mt-1.5">
                Ask your owner for this code.
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-[#C1443B] bg-[#C1443B]/10 border border-[#C1443B]/30 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#16211B] text-[#F3EFE4] rounded-md py-2.5 font-medium tracking-wide hover:bg-[#1D2B23] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-[#5C6B62] text-center">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-[#1F2A24] font-medium hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}