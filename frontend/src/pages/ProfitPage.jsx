import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS — sama persis dengan Dashboard.jsx / Sidebar.jsx / lain-lain.
   ========================================================================= */
const SHADOW_CARD =
  'shadow-[0_2px_6px_rgba(24,35,61,0.06),0_10px_24px_-8px_rgba(24,35,61,0.22)]'
const LABEL = 'block text-xs uppercase tracking-wide text-[#8B96A6] mb-1.5'
const INPUT =
  'border border-[#E4E2DC] rounded-md px-3 py-2 text-sm text-[#18233D] focus:outline-none focus:ring-2 focus:ring-[#28579C]/25 focus:border-[#28579C] transition-colors bg-white'
const ERROR_BANNER = 'text-sm text-[#B8433B] bg-[#FBEBEA] rounded-md px-3 py-2'

const TONE_BADGE = {
  critical: 'text-[#B8433B] bg-[#FBEBEA]',
  warning: 'text-[#A2670C] bg-[#FCF3E2]',
  success: 'text-[#2E7D53] bg-[#EAF5EE]',
}

/* =========================================================================
   ICONS
   ========================================================================= */
const ic = {
  className: 'w-4 h-4', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}
const IconTrendUp = (p) => (
  <svg {...ic} {...p} fill="currentColor" stroke="none"><path d="M12 4l8 10h-6v6h-4v-6H4z" /></svg>
)
const IconTrendDown = (p) => (
  <svg {...ic} {...p} fill="currentColor" stroke="none"><path d="M12 20 4 10h6V4h4v6h6z" /></svg>
)

/* =========================================================================
   HELPERS
   ========================================================================= */
function formatRupiah(n) {
  return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID')
}
function formatNumber(n) {
  return Math.round(Number(n) || 0).toLocaleString('id-ID')
}
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
function pctChange(curr, prev) {
  if (!prev) return null
  return ((curr - prev) / prev) * 100
}
function fmtDateShort(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function fmtDayTick(iso) {
  return new Date(iso + 'T00:00:00').getDate()
}
function rangeLabelText(range) {
  if (!range) return ''
  return `${fmtDateShort(range.start)} – ${fmtDateShort(range.end)}`
}
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function TrendBadge({ pct, title }) {
  if (pct === null || pct === undefined || !isFinite(pct)) {
    return <span className="text-xs text-[#8B96A6]" title={title}>—</span>
  }
  const up = pct >= 0
  const tone = up ? 'success' : 'critical'
  return (
    <span title={title} className={`inline-flex items-center gap-0.5 text-xs font-semibold rounded px-1.5 py-0.5 ${TONE_BADGE[tone]}`}>
      {up ? <IconTrendUp className="w-2.5 h-2.5" /> : <IconTrendDown className="w-2.5 h-2.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function StatCard({ label, value }) {
  return (
    <div className={`bg-white rounded-xl ${SHADOW_CARD} px-6 py-5`}>
      <p className="text-xs font-semibold text-[#8B96A6] uppercase tracking-wide mb-2">{label}</p>
      <p className="text-[24px] font-extrabold text-[#18233D] tracking-tight">{value}</p>
    </div>
  )
}

function EmptyState({ title, body }) {
  return (
    <div className={`bg-white rounded-xl ${SHADOW_CARD} px-5 py-8 text-center`}>
      <p className="text-sm font-semibold text-[#18233D]">{title}</p>
      {body && <p className="text-sm text-[#5B6B82] mt-1">{body}</p>}
    </div>
  )
}

/* =========================================================================
   TREND BAR CHART — plain flex bars, no charting lib (consistent with the
   rest of the app not pulling in a chart dependency).
   ========================================================================= */
function TrendChart({ series, metric }) {
  const values = series.map((d) => d[metric === 'sales' ? 'revenue' : metric === 'profit' ? 'profit' : 'volume'])
  const max = Math.max(1, ...values)
  const showTicks = series.length <= 31
  const minWidth = Math.max(360, series.length * 26)

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1.5 h-[180px] px-1" style={{ minWidth }}>
        {series.map((d, i) => {
          const value = values[i]
          const pct = Math.max(2, Math.round((value / max) * 100))
          const label = metric === 'units' ? `${formatNumber(value)} unit` : formatRupiah(value)
          return (
            <div key={d.date} className="flex-1 flex items-end h-full" title={`${fmtDateShort(d.date)}: ${label}`}>
              <div className="w-full bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-t-sm" style={{ height: `${pct}%` }} />
            </div>
          )
        })}
      </div>
      {showTicks && (
        <div className="flex gap-1.5 px-1 mt-2" style={{ minWidth }}>
          {series.map((d) => (
            <div key={d.date} className="flex-1 text-center text-[10px] text-[#8B96A6]">{fmtDayTick(d.date)}</div>
          ))}
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   PAGE
   ========================================================================= */
const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
]
const METRIC_OPTIONS = [
  { value: 'sales', label: 'Revenue' },
  { value: 'profit', label: 'Profit' },
  { value: 'units', label: 'Units' },
]

export default function ProfitPage() {
  const [tab, setTab] = useState('overview') // 'overview' | 'compare'
  const [menus, setMenus] = useState([])

  const [period, setPeriod] = useState('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [menuFilter, setMenuFilter] = useState('all')
  const [metric, setMetric] = useState('sales')

  const [overview, setOverview] = useState(null)
  const [breakdown, setBreakdown] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [compareA, setCompareA] = useState('')
  const [compareB, setCompareB] = useState('')
  const [compareData, setCompareData] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState('')

  const customIncomplete = period === 'custom' && (!customStart || !customEnd)

  useEffect(() => {
    api.get('/menus/').then((res) => setMenus(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (menus.length >= 2 && !compareA && !compareB) {
      setCompareA(menus[0].id)
      setCompareB(menus[1].id)
    }
  }, [menus, compareA, compareB])

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    try {
      const params = { period }
      if (period === 'custom') { params.from = customStart; params.to = customEnd }
      if (menuFilter !== 'all') params.menu = menuFilter
      const [overviewRes, breakdownRes] = await Promise.all([
        api.get('/analytics/profit/overview/', { params }),
        api.get('/analytics/profit/menus/', { params }),
      ])
      setOverview(overviewRes.data)
      setBreakdown(breakdownRes.data.menus)
      setError('')
    } catch (err) {
      setError(extractError(err) || 'Gagal ambil data performance.')
    } finally {
      setLoading(false)
    }
  }, [period, customStart, customEnd, menuFilter])

  const fetchCompare = useCallback(async () => {
    if (!compareA || !compareB) return
    setCompareLoading(true)
    try {
      const params = { period, menu_a: compareA, menu_b: compareB }
      if (period === 'custom') { params.from = customStart; params.to = customEnd }
      const res = await api.get('/analytics/profit/compare/', { params })
      setCompareData(res.data)
      setCompareError('')
    } catch (err) {
      setCompareError(extractError(err) || 'Gagal ambil data perbandingan.')
    } finally {
      setCompareLoading(false)
    }
  }, [period, customStart, customEnd, compareA, compareB])

  useEffect(() => {
    if (tab !== 'overview' || customIncomplete) return
    fetchOverview()
  }, [tab, customIncomplete, fetchOverview])

  useEffect(() => {
    if (tab !== 'compare' || customIncomplete) return
    fetchCompare()
  }, [tab, customIncomplete, fetchCompare])

  const metricLabel = METRIC_OPTIONS.find((m) => m.value === metric)?.label || 'Revenue'
  const revenueTrend = overview ? pctChange(overview.current.revenue, overview.previous.revenue) : null
  const profitTrend = overview ? pctChange(overview.current.profit, overview.previous.profit) : null
  const volumeTrend = overview ? pctChange(overview.current.volume, overview.previous.volume) : null

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl px-5 sm:px-6 py-5 mb-6">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#18233D]">Performance</h1>
          <p className="text-sm text-[#5B6B82] mt-1">How your business is doing.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl px-4 py-3 mb-6">
        <div className="inline-flex rounded-full bg-[#F7F5F0] p-1 gap-1">
          {[{ id: 'overview', label: 'Overview' }, { id: 'compare', label: 'Compare Menus' }].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`text-sm font-semibold rounded-full px-4 py-2 transition-colors ${
                tab === t.id ? 'bg-[#28579C] text-white shadow-sm' : 'text-[#8B96A6] hover:text-[#18233D] hover:bg-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className={LABEL}>Period</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={`${INPUT} w-40`}>
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {period === 'custom' ? (
          <>
            <div>
              <label className={LABEL}>From</label>
              <input type="date" value={customStart} max={customEnd || todayStr()} onChange={(e) => setCustomStart(e.target.value)} className={`${INPUT} w-40`} />
            </div>
            <div>
              <label className={LABEL}>To</label>
              <input type="date" value={customEnd} min={customStart} max={todayStr()} onChange={(e) => setCustomEnd(e.target.value)} className={`${INPUT} w-40`} />
            </div>
          </>
        ) : (
          <div>
            <p className={LABEL}>Range</p>
            <p className="text-sm font-semibold text-[#18233D] px-1 py-2">{rangeLabelText(overview?.range)}</p>
          </div>
        )}
        {tab === 'overview' && (
          <>
            <div>
              <label className={LABEL}>Menu</label>
              <select value={menuFilter} onChange={(e) => setMenuFilter(e.target.value)} className={`${INPUT} w-44`}>
                <option value="all">All Menus</option>
                {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Metric</label>
              <select value={metric} onChange={(e) => setMetric(e.target.value)} className={`${INPUT} w-36`}>
                {METRIC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {tab === 'overview' ? (
        <>
          {error && <p className={`${ERROR_BANNER} mb-6`}>{error}</p>}

          {loading || !overview ? (
            <p className="text-sm text-[#5B6B82] px-1 py-10 text-center">Loading...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <StatCard label="Total Sales" value={formatRupiah(overview.current.revenue)} />
                <StatCard label="Estimated Gross Profit" value={formatRupiah(overview.current.profit)} />
                <StatCard label="Units Sold" value={formatNumber(overview.current.volume)} />
              </div>

              <div className="flex items-center gap-3 mb-8 px-1">
                <span className="text-xs font-semibold text-[#8B96A6] uppercase tracking-wide">vs. previous period</span>
                <TrendBadge pct={revenueTrend} title={`Revenue: ${formatRupiah(overview.previous.revenue)} → ${formatRupiah(overview.current.revenue)}`} />
                <TrendBadge pct={profitTrend} title={`Profit: ${formatRupiah(overview.previous.profit)} → ${formatRupiah(overview.current.profit)}`} />
                <TrendBadge pct={volumeTrend} title={`Units: ${formatNumber(overview.previous.volume)} → ${formatNumber(overview.current.volume)}`} />
              </div>

              <section className="mb-10">
                <h2 className="text-[17px] font-bold text-[#18233D] mb-3">{metricLabel} Trend</h2>
                {overview.daily_series.length < 2 ? (
                  <EmptyState title="Pick a period with more than one day to see a trend." />
                ) : (
                  <div className={`bg-white rounded-xl ${SHADOW_CARD} p-5`}>
                    <TrendChart series={overview.daily_series} metric={metric} />
                  </div>
                )}
              </section>

              <section>
                <h2 className="text-[17px] font-bold text-[#18233D] mb-3">Menu Performance</h2>
                {breakdown.every((r) => r.qty === 0) ? (
                  <EmptyState title="No sales in this period." body="Pick a wider date range to compare menus." />
                ) : (
                  <p className="text-xs text-[#8B96A6] mb-3">
                    Trend compares <span className="font-medium text-[#5B6B82]">{rangeLabelText(overview.range)}</span> to the previous period of the same length, <span className="font-medium text-[#5B6B82]">{rangeLabelText(overview.previous_range)}</span>.
                  </p>
                )}
                <div className={`bg-white rounded-xl ${SHADOW_CARD} overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="bg-[#EAF1FB] text-left text-[11px] font-bold text-[#1E4278] uppercase tracking-wide">
                          <th className="px-4 py-3">Menu</th>
                          <th className="px-4 py-3 text-right">Qty sold</th>
                          <th className="px-4 py-3 text-right">Revenue</th>
                          <th className="px-4 py-3 text-right">Cost</th>
                          <th className="px-4 py-3 text-right">Margin</th>
                          <th className="px-4 py-3 text-right">Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.map((r) => {
                          const trend = pctChange(r.revenue, r.prev_revenue)
                          const marginTone = r.margin_pct < 15 ? 'text-[#B8433B]' : r.margin_pct < 30 ? 'text-[#A2670C]' : 'text-[#2E7D53]'
                          return (
                            <tr key={r.menu_id} className="border-t border-[#E4E2DC]">
                              <td className="px-4 py-2.5 font-medium text-[#18233D]">{r.name}</td>
                              <td className="px-4 py-2.5 text-right text-[#5B6B82]">{formatNumber(r.qty)}</td>
                              <td className="px-4 py-2.5 text-right text-[#18233D]">{formatRupiah(r.revenue)}</td>
                              <td className="px-4 py-2.5 text-right text-[#5B6B82]">{formatRupiah(r.cost)}</td>
                              <td className={`px-4 py-2.5 text-right font-medium ${marginTone}`}>{r.margin_pct}%</td>
                              <td className="px-4 py-2.5 text-right">
                                <TrendBadge pct={trend} title={`${rangeLabelText(overview.previous_range)}: ${formatRupiah(r.prev_revenue)} → ${rangeLabelText(overview.range)}: ${formatRupiah(r.revenue)}`} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      ) : (
        <>
          {compareError && <p className={`${ERROR_BANNER} mb-6`}>{compareError}</p>}

          {menus.length < 2 ? (
            <EmptyState title="Need at least two menus." body="Add another menu to compare performance side by side." />
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-4 mb-5">
                <div>
                  <label className={LABEL}>Menu A</label>
                  <select value={compareA} onChange={(e) => setCompareA(e.target.value)} className={`${INPUT} w-48`}>
                    {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Menu B</label>
                  <select value={compareB} onChange={(e) => setCompareB(e.target.value)} className={`${INPUT} w-48`}>
                    {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              {compareA === compareB ? (
                <EmptyState title="Pick two different menus." body="Choose two distinct menus above to compare their performance." />
              ) : compareLoading || !compareData?.a || !compareData?.b ? (
                <p className="text-sm text-[#5B6B82] px-1 py-10 text-center">Loading...</p>
              ) : (
                <CompareTable data={compareData} />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function compareMetricRow(label, format, aVal, bVal, higherIsBetter) {
  const aBetter = higherIsBetter ? aVal >= bVal : aVal <= bVal
  return (
    <tr className="border-t border-[#E4E2DC]">
      <td className="px-4 py-3 text-sm font-medium text-[#5B6B82]">{label}</td>
      <td className={`px-4 py-3 text-sm text-right ${aBetter && aVal !== bVal ? 'font-bold text-[#2E7D53]' : 'text-[#18233D]'}`}>{format(aVal)}</td>
      <td className={`px-4 py-3 text-sm text-right ${!aBetter && aVal !== bVal ? 'font-bold text-[#2E7D53]' : 'text-[#18233D]'}`}>{format(bVal)}</td>
    </tr>
  )
}

function CompareTable({ data }) {
  const { a, b, range, previous_range } = data
  return (
    <>
      <p className="text-xs text-[#8B96A6] mb-3">
        Showing <span className="font-medium text-[#5B6B82]">{rangeLabelText(range)}</span> · trend vs. the previous period, <span className="font-medium text-[#5B6B82]">{rangeLabelText(previous_range)}</span>.
      </p>
      <div className={`bg-white rounded-xl ${SHADOW_CARD} overflow-hidden`}>
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="bg-[#EAF1FB] text-left text-[11px] font-bold text-[#1E4278] uppercase tracking-wide">
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3 text-right">{a.name}</th>
              <th className="px-4 py-3 text-right">{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {compareMetricRow('Qty sold', formatNumber, a.current.volume, b.current.volume, true)}
            {compareMetricRow('Revenue', formatRupiah, a.current.revenue, b.current.revenue, true)}
            {compareMetricRow('Cost', formatRupiah, a.current.cost, b.current.cost, false)}
            {compareMetricRow('Profit', formatRupiah, a.current.profit, b.current.profit, true)}
            {compareMetricRow('Margin', (v) => `${v.toFixed(1)}%`, a.margin_pct, b.margin_pct, true)}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#E4E2DC] bg-[#F7F5F0]/60">
              <td className="px-4 py-2.5 text-xs font-semibold text-[#8B96A6]">vs. previous period</td>
              <td className="px-4 py-2.5 text-right">
                <TrendBadge pct={pctChange(a.current.revenue, a.previous.revenue)} title={`Revenue: ${formatRupiah(a.previous.revenue)} → ${formatRupiah(a.current.revenue)}`} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <TrendBadge pct={pctChange(b.current.revenue, b.previous.revenue)} title={`Revenue: ${formatRupiah(b.previous.revenue)} → ${formatRupiah(b.current.revenue)}`} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}
