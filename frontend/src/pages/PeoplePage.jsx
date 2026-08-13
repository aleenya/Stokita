import { useState, useEffect } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS — sama persis dengan Dashboard.jsx / Sidebar.jsx / IngredientsPage.jsx
   ========================================================================= */
const SHADOW_CARD =
  'shadow-[0_2px_6px_rgba(24,35,61,0.06),0_10px_24px_-8px_rgba(24,35,61,0.22)]'
const BTN_PRIMARY =
  'text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-4 py-2 disabled:opacity-50'
const BTN_SECONDARY =
  'text-xs font-semibold text-[#5B6B82] border border-[#E4E2DC] rounded-full px-3 py-1.5 hover:bg-[#F7F5F0] transition-colors disabled:opacity-50'

const FEATURES = [
  { code: 'ingredients_manage', label: 'Kelola Bahan' },
  { code: 'menus_manage', label: 'Kelola Menu' },
  { code: 'profit_analytics', label: 'Analitik Profit' },
  { code: 'brief', label: 'Brief Harian' },
]

export default function PeoplePage() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(null) // id staff yang lagi disave
  const [togglingStatus, setTogglingStatus] = useState(null) // id staff yang lagi diaktif/nonaktifin
  const [draft, setDraft] = useState({}) // { [staffId]: Set(feature codes) }
  const [businessCode, setBusinessCode] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.get('/me/')
      .then((res) => setBusinessCode(res.data.business_username || ''))
      .catch(() => {})
  }, [])

  function copyBusinessCode() {
    navigator.clipboard.writeText(businessCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  async function fetchStaff() {
    setLoading(true)
    try {
      const res = await api.get('/staff/')
      setStaff(res.data)
      const initialDraft = {}
      res.data.forEach((s) => {
        initialDraft[s.id] = new Set(s.granted_features)
      })
      setDraft(initialDraft)
      setError('')
    } catch (err) {
      setError('Gagal ambil data staff.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaff()
  }, [])

  function toggleFeature(staffId, code) {
    setDraft((prev) => {
      const next = new Set(prev[staffId])
      if (next.has(code)) {
        next.delete(code)
      } else {
        next.add(code)
      }
      return { ...prev, [staffId]: next }
    })
  }

  async function saveGrants(staffId) {
    setSaving(staffId)
    try {
      await api.put(`/staff/${staffId}/grants/`, {
        features: Array.from(draft[staffId] || []),
      })
      fetchStaff()
    } catch (err) {
      setError('Gagal simpan akses.')
    } finally {
      setSaving(null)
    }
  }

  async function toggleStatus(staffId, nextActive) {
    setTogglingStatus(staffId)
    try {
      await api.patch(`/staff/${staffId}/status/`, { is_active: nextActive })
      fetchStaff()
    } catch (err) {
      setError('Gagal ubah status staff.')
    } finally {
      setTogglingStatus(null)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-[22px] font-extrabold tracking-tight text-[#18233D] mb-1">Staf</h1>
      <p className="text-sm text-[#5B6B82] mb-6">
        Kasih akses tambahan ke staf tertentu yang kamu percaya.
      </p>

      {businessCode && (
        <div className={`bg-white rounded-xl ${SHADOW_CARD} p-5 mb-6 flex items-center justify-between gap-4`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8B96A6] mb-1">
              Kode join staf
            </p>
            <p className="font-mono text-sm text-[#18233D]">{businessCode}</p>
            <p className="text-xs text-[#8B96A6] mt-1">
              Kasih kode ini ke staf yang mau join business kamu.
            </p>
          </div>
          <button onClick={copyBusinessCode} className={BTN_SECONDARY}>
            {copied ? 'Tersalin!' : 'Salin'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-[#B8433B] mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#5B6B82]">Memuat...</p>
      ) : staff.length === 0 ? (
        <p className="text-sm text-[#5B6B82]">Belum ada staf di business ini.</p>
      ) : (
        <div className="space-y-4">
          {staff.map((s) => (
            <div
              key={s.id}
              className={`bg-white rounded-xl ${SHADOW_CARD} p-5 ${s.is_active === false ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="font-semibold text-[#18233D]">
                  {s.full_name || s.username} <span className="text-xs font-normal text-[#8B96A6]">({s.username})</span>
                  {s.is_active === false && !s.last_login && (
                    <span className="ml-2 text-xs font-semibold text-[#28579C] bg-[#EAF1FB] rounded-full px-2 py-0.5">
                      Menunggu approval
                    </span>
                  )}
                  {s.is_active === false && s.last_login && (
                    <span className="ml-2 text-xs font-semibold text-[#B8433B] bg-[#FBEBEA] rounded-full px-2 py-0.5">
                      Nonaktif
                    </span>
                  )}
                </p>
                <button
                  onClick={() => toggleStatus(s.id, s.is_active === false)}
                  disabled={togglingStatus === s.id}
                  className={BTN_SECONDARY}
                >
                  {togglingStatus === s.id
                    ? '...'
                    : s.is_active === false
                      ? (s.last_login ? 'Aktifkan' : 'Setujui')
                      : 'Nonaktifkan'}
                </button>
              </div>

              <div className="flex flex-wrap gap-4 mb-4">
                {FEATURES.map((f) => (
                  <label key={f.code} className="flex items-center gap-2 text-sm text-[#18233D]">
                    <input
                      type="checkbox"
                      checked={draft[s.id]?.has(f.code) || false}
                      onChange={() => toggleFeature(s.id, f.code)}
                      className="rounded border-[#E4E2DC] text-[#28579C] focus:ring-[#28579C]"
                    />
                    {f.label}
                  </label>
                ))}
              </div>

              <button
                onClick={() => saveGrants(s.id)}
                disabled={saving === s.id}
                className={BTN_PRIMARY}
              >
                {saving === s.id ? 'Menyimpan...' : 'Simpan Akses'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
