import { useState, useEffect } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS — sama persis dengan Dashboard.jsx / Sidebar.jsx / IngredientsPage.jsx
   ========================================================================= */
const SHADOW_CARD =
  'shadow-[0_2px_6px_rgba(24,35,61,0.06),0_10px_24px_-8px_rgba(24,35,61,0.22)]'
const LABEL = 'block text-xs uppercase tracking-wide text-[#8B96A6] mb-1.5'
const INPUT =
  'border border-[#E4E2DC] rounded-md px-3 py-2 text-sm text-[#18233D] focus:outline-none focus:ring-2 focus:ring-[#28579C]/25 focus:border-[#28579C] transition-colors'
const BTN_PRIMARY =
  'text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-5 py-2.5'

// same tone map as F3's classify_margin_state: high/stable/low
const STATE_COLOR = {
  high: 'text-[#2E7D53]',
  stable: 'text-[#A2670C]',
  low: 'text-[#B8433B]',
}

export default function ProfitPage() {
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  async function fetchProfit() {
    setLoading(true)
    try {
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      const res = await api.get('/analytics/profit/', { params })
      setMenus(res.data.menus)
      setError('')
    } catch (err) {
      setError('Gagal ambil data profit.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfit()
  }, [])

  return (
    <div className="max-w-4xl">
      <h1 className="text-[22px] font-extrabold tracking-tight text-[#18233D] mb-6">Profit Analytics</h1>

      <div className="flex gap-3 items-end mb-6">
        <div>
          <label className={LABEL}>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={INPUT} />
        </div>
        <button onClick={fetchProfit} className={BTN_PRIMARY}>
          Filter
        </button>
      </div>

      {error && <p className="text-sm text-[#B8433B] mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#5B6B82]">Loading...</p>
      ) : (
        <div className={`bg-white rounded-xl ${SHADOW_CARD} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead className="bg-[#F7F5F0] text-[#8B96A6] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-bold">Menu</th>
                <th className="text-left px-4 py-3 font-bold">Margin %</th>
                <th className="text-left px-4 py-3 font-bold">State</th>
              </tr>
            </thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m.menu_id} className="border-t border-[#E4E2DC]">
                  <td className="px-4 py-3 text-[#18233D] font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-[#18233D]">{m.margin_pct}%</td>
                  <td className={`px-4 py-3 font-semibold uppercase text-xs ${STATE_COLOR[m.state]}`}>
                    {m.state}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
