import { useState, useEffect } from 'react'
import api from '../api/client'

export default function BriefPage() {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  async function fetchBrief() {
    setLoading(true)
    try {
      const res = await api.get('/briefs/today/')
      setBrief(res.data)
      setError('')
    } catch (err) {
      if (err.response?.status === 404) {
        setBrief(null)
        setError('Belum ada brief hari ini. Klik Generate.')
      } else {
        setError('Gagal ambil brief.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBrief()
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const res = await api.post('/briefs/generate/')
      setBrief(res.data)
    } catch (err) {
      setError('Gagal generate brief. Cek backend & API key Gemini.')
    } finally {
      setGenerating(false)
    }
  }

  async function updateActionStatus(actionId, status) {
    try {
      await api.patch(`/briefs/actions/${actionId}/`, { status })
      fetchBrief()
    } catch (err) {
      setError('Gagal update action.')
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-[Fraunces,serif] text-2xl text-[#1F2A24] mb-6">Daily Brief</h1>

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="bg-[#16211B] text-[#F3EFE4] rounded-md px-4 py-2 text-sm mb-6 disabled:opacity-50"
      >
        {generating ? 'Generating…' : 'Generate Brief'}
      </button>

      {error && <p className="text-sm text-[#C1443B] mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#5C6B62]">Loading...</p>
      ) : brief ? (
        <div className="bg-white border border-[#D8D0BF] rounded-md p-4">
          <p className="text-sm font-medium text-[#1F2A24] mb-1">{brief.brief_date}</p>
          <p className="text-sm text-[#5C6B62] mb-4">{brief.summary}</p>

          <div className="space-y-2">
            {brief.actions.map((a) => (
              <div key={a.id} className="border-l-2 border-[#E2A33D] pl-3 py-1">
                <p className="text-xs uppercase text-[#9FAFA3] font-[IBM_Plex_Mono,monospace]">
                  {a.action_type} · Rp {a.rupiah_impact} · {a.status}
                </p>
                <p className="text-sm text-[#1F2A24]">{a.message}</p>
                {a.status === 'pending' && (
                  <div className="flex gap-3 mt-1">
                    <button onClick={() => updateActionStatus(a.id, 'acted')} className="text-xs text-[#5C8B6E] hover:underline">
                      Mark acted
                    </button>
                    <button onClick={() => updateActionStatus(a.id, 'dismissed')} className="text-xs text-[#C1443B] hover:underline">
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
