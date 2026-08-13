import { useState } from 'react'
import api from '../api/client'
import GoogleSignInButton from '../components/GoogleSignInButton'

// Cuma buat nampilin email-nya di UI — verifikasi asli tetep di backend,
// ini tidak dipakai buat keputusan keamanan apa pun.
function decodeGoogleEmail(credential) {
  try {
    return JSON.parse(atob(credential.split('.')[1])).email || ''
  } catch {
    return ''
  }
}

/* =========================================================================
   DESIGN TOKENS — sama persis dengan Dashboard.jsx / Sidebar.jsx / IngredientsPage.jsx
   ========================================================================= */
const LABEL = 'block text-xs uppercase tracking-wide text-[#8B96A6] mb-2'
const INPUT =
  'w-full bg-white border border-[#E4E2DC] rounded-md px-4 py-2.5 text-[#18233D] placeholder:text-[#8B96A6] focus:outline-none focus:ring-2 focus:ring-[#28579C]/25 focus:border-[#28579C] transition-colors'
const BTN_PRIMARY =
  'w-full text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed'
const ERROR_BANNER = 'text-sm text-[#B8433B] bg-[#FBEBEA] rounded-md px-3 py-2'

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
  const [googleCredential, setGoogleCredential] = useState(null)
  const [googleEmail, setGoogleEmail] = useState('')

  function handleGoogleCredential(credential) {
    setGoogleCredential(credential)
    setGoogleEmail(decodeGoogleEmail(credential))
    setError('')
  }

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

    if (!googleCredential && (!username || !password)) {
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
        full_name: fullName,
        ...(googleCredential ? { google_credential: googleCredential } : { username, password }),
        ...(role === 'owner'
          ? { business_name: businessName, business_username: businessSlug }
          : { business_username: staffCode }),
      }
      const res = await api.post('/auth/register/', payload)

      if (res.data.is_active === false) {
        // Staff account created but not yet approved by the owner — no
        // cookies were set for them (see backend RegisterView) until
        // they're activated.
        setPendingApproval(true)
        return
      }

      // Tokens come back as httpOnly cookies (Set-Cookie), not in the
      // response body — nothing for JS to store.
      onRegisterSuccess?.()
    } catch (err) {
      setError(extractError(err) || 'Gagal mendaftar. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  if (pendingApproval) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[#F7F5F0] px-4 py-12 antialiased"
        style={{
          fontFamily:
            "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div className="w-full max-w-md text-center">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-2 h-2 rounded-full bg-[#28579C]" />
            <span className="text-sm tracking-[0.2em] uppercase text-[#8B96A6] font-bold">
              Stokita
            </span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-[#18233D] mb-3">
            Akun berhasil dibuat
          </h1>
          <p className="text-sm text-[#5B6B82] mb-8">
            Akun kamu masih nunggu diaktifkan sama pemilik business di halaman Staff.
            Kamu bisa login begitu udah diaktifkan.
          </p>

          <button type="button" onClick={onSwitchToLogin} className={BTN_PRIMARY}>
            Kembali ke halaman login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#F7F5F0] px-4 py-12 antialiased"
      style={{
        fontFamily:
          "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-2 h-2 rounded-full bg-[#28579C]" />
          <span className="text-sm tracking-[0.2em] uppercase text-[#8B96A6] font-bold">
            Stokita
          </span>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-[#18233D] mb-1 text-center">
          Buat akun kamu
        </h1>
        <p className="text-sm text-[#5B6B82] mb-8 text-center">
          Pilih peran kamu sebagai pemilik bisnis atau staf.
        </p>

        {/* Role toggle */}
        <div className="flex bg-white border border-[#E4E2DC] rounded-md p-1 mb-6">
          {[
            { key: 'owner', label: 'Pemilik Bisnis' },
            { key: 'staff', label: 'Staf' },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRole(opt.key)}
              className={`flex-1 text-sm py-2 rounded-md transition-colors font-semibold ${
                role === opt.key
                  ? 'bg-[#28579C] text-white'
                  : 'text-[#5B6B82] hover:bg-[#F7F5F0]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {googleCredential ? (
          <div className="flex items-center justify-between gap-3 bg-white border border-[#E4E2DC] rounded-md px-4 py-2.5 mb-4">
            <p className="text-sm text-[#18233D] truncate">
              <span className="text-[#2E7D53] font-semibold">✓ Google</span>{' '}
              {googleEmail || 'account selected'}
            </p>
            <button
              type="button"
              onClick={() => { setGoogleCredential(null); setGoogleEmail('') }}
              className="text-xs font-semibold text-[#5B6B82] hover:text-[#18233D] transition-colors shrink-0"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <GoogleSignInButton label="Sign up with Google" onCredential={handleGoogleCredential} />
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-[#E4E2DC]" />
              <span className="text-xs text-[#8B96A6]">or</span>
              <div className="h-px flex-1 bg-[#E4E2DC]" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className={LABEL}>Nama lengkap</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={INPUT}
              placeholder="Sto Kita"
            />
          </div>

          {!googleCredential && <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={INPUT}
                placeholder="sto.kita"
              />
            </div>
            <div>
              <label className={LABEL}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT}
                placeholder="••••••••"
              />
            </div>
          </div>}

          {role === 'owner' ? (
            <>
              <div>
                <label className={LABEL}>Nama business</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => handleBusinessNameChange(e.target.value)}
                  className={INPUT}
                  placeholder="Dapur Stokita"
                />
              </div>

              <div>
                <label className={LABEL}>Kode business</label>
                <input
                  type="text"
                  value={businessSlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className={`${INPUT} text-sm`}
                  placeholder="dapur-stokita"
                />
                <p className="text-xs text-[#8B96A6] mt-1.5">
                  Kita bakal tambahin string acak di belakangnya biar aman, jadi kodenya tidak gampang ditebak.
                  Kode lengkapnya bisa kamu lihat di halaman Staff setelah daftar.
                </p>
              </div>
            </>
          ) : (
            <div>
              <label className={LABEL}>Kode business</label>
              <input
                type="text"
                value={staffCode}
                onChange={(e) => setStaffCode(e.target.value)}
                className={`${INPUT} text-sm`}
                placeholder="dapur-stokita"
              />
              <p className="text-xs text-[#8B96A6] mt-1.5">
                Minta kode ini ke pemilik business kamu.
              </p>
            </div>
          )}

          {error && <p className={ERROR_BANNER}>{error}</p>}

          <button type="submit" disabled={loading} className={BTN_PRIMARY}>
            {loading ? 'Membuat akun…' : 'Buat akun'}
          </button>
        </form>

        <p className="mt-6 text-sm text-[#5B6B82] text-center">
          Udah punya akun?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-[#28579C] font-semibold hover:text-[#1E4278] transition-colors"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  )
}
