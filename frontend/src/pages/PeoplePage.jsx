import { useState, useEffect } from 'react'
import api from '../api/client'

const FEATURES = [
  { code: 'ingredients_manage', label: 'Manage Ingredients' },
  { code: 'menus_manage', label: 'Manage Menus' },
  { code: 'profit_analytics', label: 'Profit Analytics' },
  { code: 'brief', label: 'Daily Brief' },
]

export default function PeoplePage() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(null) // id staff yang lagi disave
  const [togglingStatus, setTogglingStatus] = useState(null) // id staff yang lagi diaktif/nonaktifin
  const [draft, setDraft] = useState({}) // { [staffId]: Set(feature codes) }

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
      <h1 className="font-[Fraunces,serif] text-2xl text-[#1F2A24] mb-2">People</h1>
      <p className="text-sm text-[#5C6B62] mb-6">
        Kasih akses tambahan ke staff tertentu yang kamu percaya — di luar akses default staff.
      </p>

      {error && <p className="text-sm text-[#C1443B] mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#5C6B62]">Loading...</p>
      ) : staff.length === 0 ? (
        <p className="text-sm text-[#5C6B62]">Belum ada staff di business ini.</p>
      ) : (
        <div className="space-y-4">
          {staff.map((s) => (
            <div key={s.id} className={`bg-white border border-[#D8D0BF] rounded-md p-4 ${s.is_active === false ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-[#1F2A24]">
                  {s.full_name || s.username} <span className="text-xs text-[#5C6B62]">({s.username})</span>
                  {s.is_active === false && (
                    <span className="ml-2 text-xs text-[#C1443B]">Nonaktif</span>
                  )}
                </p>
                <button
                  onClick={() => toggleStatus(s.id, s.is_active === false)}
                  disabled={togglingStatus === s.id}
                  className="text-xs border border-[#D8D0BF] rounded-md px-3 py-1 text-[#1F2A24] disabled:opacity-50"
                >
                  {togglingStatus === s.id
                    ? '...'
                    : s.is_active === false ? 'Aktifkan' : 'Nonaktifkan'}
                </button>
              </div>

              <div className="flex flex-wrap gap-4 mb-3">
                {FEATURES.map((f) => (
                  <label key={f.code} className="flex items-center gap-2 text-sm text-[#1F2A24]">
                    <input
                      type="checkbox"
                      checked={draft[s.id]?.has(f.code) || false}
                      onChange={() => toggleFeature(s.id, f.code)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>

              <button
                onClick={() => saveGrants(s.id)}
                disabled={saving === s.id}
                className="bg-[#16211B] text-[#F3EFE4] rounded-md px-4 py-2 text-sm disabled:opacity-50"
              >
                {saving === s.id ? 'Saving...' : 'Save Access'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
