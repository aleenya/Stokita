import { useState, useEffect } from 'react'
import api from '../api/client'

const STATE_COLOR = {
  high: 'text-[#5C8B6E]',
  stable: 'text-[#E2A33D]',
  low: 'text-[#C1443B]',
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
      <h1 className="font-[Fraunces,serif] text-2xl text-[#1F2A24] mb-6">Profit Analytics</h1>

      <div className="flex gap-3 items-end mb-6">
        <div>
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm" />
        </div>
        <button onClick={fetchProfit} className="bg-[#16211B] text-[#F3EFE4] rounded-md px-4 py-2 text-sm">
          Filter
        </button>
      </div>

      {error && <p className="text-sm text-[#C1443B] mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#5C6B62]">Loading...</p>
      ) : (
        <table className="w-full text-sm bg-white border border-[#D8D0BF] rounded-md overflow-hidden">
          <thead className="bg-[#FAF6EC] text-[#5C6B62] text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Menu</th>
              <th className="text-left px-4 py-2">Margin %</th>
              <th className="text-left px-4 py-2">State</th>
            </tr>
          </thead>
          <tbody>
            {menus.map((m) => (
              <tr key={m.menu_id} className="border-t border-[#D8D0BF]">
                <td className="px-4 py-2">{m.name}</td>
                <td className="px-4 py-2">{m.margin_pct}%</td>
                <td className={`px-4 py-2 font-medium uppercase text-xs ${STATE_COLOR[m.state]}`}>
                  {m.state}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
