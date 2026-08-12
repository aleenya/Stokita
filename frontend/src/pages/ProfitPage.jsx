import { useState, useEffect } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS — sama persis dengan Dashboard.jsx / Sidebar.jsx / lain-lain.
   ========================================================================= */
const SHADOW_CARD =
  'shadow-[0_2px_6px_rgba(24,35,61,0.06),0_10px_24px_-8px_rgba(24,35,61,0.22)]'
const LABEL = 'block text-xs uppercase tracking-wide text-[#8B96A6] mb-1.5'
const INPUT =
  'border border-[#E4E2DC] rounded-md px-3 py-2 text-sm text-[#18233D] focus:outline-none focus:ring-2 focus:ring-[#28579C]/25 focus:border-[#28579C] transition-colors'
const BTN_PRIMARY =
  'text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-5 py-2.5'
const BTN_SECONDARY =
  'text-sm font-semibold text-[#5B6B82] border border-[#E4E2DC] rounded-full px-4 py-2 hover:bg-[#F7F5F0] transition-colors'
const ERROR_BANNER = 'text-sm text-[#B8433B] bg-[#FBEBEA] rounded-md px-3 py-2'

// state key -> display label / tone / raw color, sama persis sama
// classify_margin_state di backend (sales/services.py): high/stable/low.
const STATE_META = {
  high: { label: 'Healthy', tone: 'success', color: '#2E7D53' },
  stable: { label: 'Stable', tone: 'warning', color: '#A2670C' },
  low: { label: 'At Risk', tone: 'critical', color: '#B8433B' },
}
const TONE_BADGE = {
  critical: 'text-[#B8433B] bg-[#FBEBEA]',
  warning: 'text-[#A2670C] bg-[#FCF3E2]',
  success: 'text-[#2E7D53] bg-[#EAF5EE]',
}

/* =========================================================================
   ICONS — inline SVG, stroke-based, konsisten sama halaman lain.
   ========================================================================= */
const ic = {
  className: 'w-4 h-4', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}
const IconSearch = (p) => (
  <svg {...ic} {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
)
const IconArrowUpDown = (p) => (
  <svg {...ic} {...p}><path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" /></svg>
)
const IconTrendingDown = (p) => (
  <svg {...ic} {...p}><polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" /></svg>
)

/* =========================================================================
   HELPERS
   ========================================================================= */
function StatusBadge({ tone, label }) {
  return (
    <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${TONE_BADGE[tone]}`}>
      {label}
    </span>
  )
}

/* =========================================================================
   HERO — margin-health distribution bar, the 4th distinct header treatment
   in the app (Ingredients = stat-strip card, Menus = inline pills, Sales =
   tinted banner + sparkline, Profit = segmented health bar). Fits the page:
   this is literally about the distribution of healthy vs at-risk margins.
   ========================================================================= */
function HeroBanner({ summary, from, to, onFromChange, onToChange, onFilter, stateFilter, onToggleState }) {
  const total = summary.total || 1
  const segments = ['high', 'stable', 'low'].map((key) => ({
    key, count: summary[key], ...STATE_META[key],
  }))

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#18233D]">Profit Leak Detection</h1>
          <p className="text-sm text-[#5B6B82] mt-1">Spot menus whose margin is drifting below target before it eats your profit.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={LABEL}>From</label>
            <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>To</label>
            <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className={INPUT} />
          </div>
          <button onClick={onFilter} className={BTN_PRIMARY}>Filter</button>
        </div>
      </div>

      <div className={`bg-white rounded-2xl ${SHADOW_CARD} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-xs uppercase tracking-wide text-[#8B96A6] font-bold">Margin Health Distribution</p>
          <p className="text-sm text-[#18233D]">
            Avg margin: <span className="font-bold tabular-nums">{summary.avgMargin === null ? '—' : `${summary.avgMargin.toFixed(1)}%`}</span>
          </p>
        </div>

        <div className="flex h-3 rounded-full overflow-hidden bg-[#F7F5F0]">
          {summary.total === 0 ? null : segments.map((s) => (
            s.count > 0 && (
              <div
                key={s.key}
                style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
                title={`${s.label}: ${s.count}`}
              />
            )
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {segments.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onToggleState(s.key)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-3 py-1.5 transition-colors ${
                stateFilter === s.key ? 'border-[#28579C] ring-2 ring-[#28579C]/25' : 'border-[#E4E2DC] hover:border-[#CBD1DB]'
              } bg-white`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              {s.label}: <span className="text-[#18233D] font-bold">{s.count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   PAGE
   ========================================================================= */
export default function ProfitPage() {
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [stateFilter, setStateFilter] = useState(null) // null | 'high' | 'stable' | 'low'
  const [sortAsc, setSortAsc] = useState(true) // asc = worst margin first (most urgent)

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

  const summary = {
    total: menus.length,
    high: menus.filter((m) => m.state === 'high').length,
    stable: menus.filter((m) => m.state === 'stable').length,
    low: menus.filter((m) => m.state === 'low').length,
    avgMargin: menus.length ? menus.reduce((a, m) => a + Number(m.margin_pct), 0) / menus.length : null,
  }

  const visibleMenus = menus
    .filter((m) => (stateFilter ? m.state === stateFilter : true))
    .filter((m) => (searchQuery.trim() ? m.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) : true))
    .slice()
    .sort((a, b) => (sortAsc ? a.margin_pct - b.margin_pct : b.margin_pct - a.margin_pct))

  return (
    <div className="max-w-4xl mx-auto">
      <HeroBanner
        summary={summary}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onFilter={fetchProfit}
        stateFilter={stateFilter}
        onToggleState={(key) => setStateFilter((f) => (f === key ? null : key))}
      />

      {error && <p className={`${ERROR_BANNER} mb-6`}>{error}</p>}

      <div className={`bg-white rounded-2xl ${SHADOW_CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#E4E2DC]">
          <h2 className="text-[15px] font-bold text-[#18233D]">
            Menus
            <span className="ml-2 text-xs font-medium text-[#8B96A6]">{visibleMenus.length} of {menus.length}</span>
          </h2>
          <div className="flex flex-wrap gap-2.5">
            <div className="relative">
              <IconSearch className="w-4 h-4 text-[#8B96A6] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menus…"
                className={`${INPUT} w-52 pl-9`}
              />
            </div>
            <button
              type="button"
              onClick={() => setSortAsc((v) => !v)}
              className={`${BTN_SECONDARY} inline-flex items-center gap-1.5`}
              title={sortAsc ? 'Showing worst margin first' : 'Showing best margin first'}
            >
              <IconArrowUpDown className="w-3.5 h-3.5" /> {sortAsc ? 'Worst first' : 'Best first'}
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[#5B6B82] px-5 py-10 text-center">Loading...</p>
        ) : visibleMenus.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[#5B6B82]">
              {menus.length === 0 ? (
                <span className="inline-flex items-center gap-1.5"><IconTrendingDown className="w-4 h-4" /> Gak ada data profit di periode ini.</span>
              ) : (
                'Gak ada menu yang cocok sama filter ini.'
              )}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F5F0] text-left text-xs uppercase tracking-wide text-[#8B96A6]">
                  <th className="px-5 py-3 font-bold">Menu</th>
                  <th className="px-5 py-3 font-bold text-right">Margin</th>
                  <th className="px-5 py-3 font-bold">State</th>
                </tr>
              </thead>
              <tbody>
                {visibleMenus.map((m) => {
                  const meta = STATE_META[m.state] || STATE_META.stable
                  return (
                    <tr key={m.menu_id} className="border-t border-[#E4E2DC] hover:bg-[#F7F5F0]/60 transition-colors">
                      <td className="px-5 py-3 text-[#18233D] font-medium">{m.name}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: meta.color }}>
                        {m.margin_pct}%
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge tone={meta.tone} label={meta.label} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
