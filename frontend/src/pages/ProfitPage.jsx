import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
  teal: 'text-[#2A7A82] bg-[#E8F4F5]',
  muted: 'text-[#5B6B82] bg-[#F0EDE6]',
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
  return flattenErrorData(err.response?.data)
}
function flattenErrorData(data) {
  // Walks down nested DRF error shapes ({"field": [...]} , lists of
  // dicts, etc.) until it finds an actual string — a shallow one-level
  // unwrap here previously could hand setError() a raw object, which
  // React then throws trying to render as a child.
  if (!data) return ''
  if (typeof data === 'string') return data
  if (Array.isArray(data)) {
    for (const item of data) {
      const msg = flattenErrorData(item)
      if (msg) return msg
    }
    return ''
  }
  if (typeof data === 'object') {
    if (typeof data.error === 'string') return data.error
    const firstKey = Object.keys(data)[0]
    if (firstKey) return flattenErrorData(data[firstKey])
  }
  return String(data)
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

function fmtDateTime(d) {
  if (!d) return '—'
  const dt = d instanceof Date ? d : new Date(d)
  return (
    dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ', ' +
    dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

const extractList = (data) => {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.results)) return data.results
  return []
}

/* =========================================================================
   DECISION FEEDBACK — SUB-COMPONENTS
   ========================================================================= */

const ANSWER_META = {
  positive:      { label: 'Positive',      tone: 'success',  icon: '✓' },
  negative:      { label: 'Negative',      tone: 'critical', icon: '✗' },
  inconclusive:  { label: 'Inconclusive',  tone: 'muted',    icon: '?' },
  external:      { label: 'Likely External', tone: 'warning', icon: '↗' },
}

function ImpactCountdown({ target }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])
  if (!target) return null
  let diff = new Date(target).getTime() - now
  if (diff <= 0) return <>Ready to generate</>
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return <>Next in {d > 0 ? `${d}d ` : ''}{pad(h)}:{pad(m)}:{pad(s)}</>
}

function FeedbackActionCard({ action, impacts, isPast }) {
  const [isOpen, setIsOpen] = useState(false)
  const typeBadge = action.action_type === 'discount'
    ? { label: `Discount ${action.discount_pct ?? ''}%`.trim(), tone: 'warning' }
    : { label: 'Review Price', tone: 'teal' }

  const latestImpact = impacts.length > 0 ? impacts[0] : null

  return (
    <div className={`rounded-xl bg-white ${SHADOW_CARD} overflow-hidden transition-all ${
      isPast ? 'opacity-70' : ''
    }`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-[#FAFAF8] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className={`text-[15px] font-semibold truncate ${
              isPast ? 'text-[#8B96A6]' : 'text-[#18233D]'
            }`}>
              {action.title}
            </p>
            {isPast && (
              <span className={`text-[10px] font-bold uppercase tracking-wider ${TONE_BADGE.muted} rounded-full px-2 py-0.5 shrink-0`}>
                Past
              </span>
            )}
          </div>
          <p className="text-sm text-[#5B6B82] leading-relaxed line-clamp-1">{action.message}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${TONE_BADGE[typeBadge.tone] || TONE_BADGE.warning}`}>
            {typeBadge.label}
          </span>
          {latestImpact && (
            <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
              TONE_BADGE[ANSWER_META[latestImpact.answer]?.tone] || TONE_BADGE.muted
            }`}>
              {ANSWER_META[latestImpact.answer]?.icon} {ANSWER_META[latestImpact.answer]?.label}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-[#8B96A6] shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : 'rotate-0'
            }`}
            fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-[#E4E2DC]/60">
          {/* Action details */}
          <div className="px-4 sm:px-5 py-3 bg-[#FAFAF8]">
            <p className="text-sm text-[#5B6B82] leading-relaxed">{action.message}</p>
            <p className="text-[11px] font-medium text-[#8B96A6] mt-2">
              Acted {fmtDateTime(action.acted_at)}
            </p>
          </div>

          {/* Impact summaries */}
          {impacts.length > 0 ? (
            <div className="px-4 sm:px-5 py-3 space-y-3">
              <p className="text-[11px] font-bold text-[#8B96A6] uppercase tracking-wide">
                Impact Analysis{impacts.length > 1 ? ` (${impacts.length} checks)` : ''}
              </p>
              {impacts.map((check) => {
                const meta = ANSWER_META[check.answer] || ANSWER_META.inconclusive
                return (
                  <div key={check.id} className="rounded-lg bg-[#F7F5F0] px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${TONE_BADGE[meta.tone]}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-[11px] text-[#8B96A6]">
                        {fmtDateTime(check.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-[#5B6B82] leading-relaxed">{check.reasoning}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-4 sm:px-5 py-3">
              <p className="text-sm text-[#8B96A6] italic">
                {isPast
                  ? 'No summary was generated for this action.'
                  : 'No impact summary yet — generate one using the button above.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DecisionFeedbackTab() {
  const [actionsRaw, setActionsRaw] = useState([])
  const [impactData, setImpactData] = useState([])
  const [canGenerate, setCanGenerate] = useState(true)
  const [nextGenerateAt, setNextGenerateAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3500)
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [actionsRes, impactRes] = await Promise.all([
        api.get('/briefs/actions/').catch(() => null),
        api.get('/briefs/impact-history/').catch(() => null),
      ])
      setActionsRaw(extractList(actionsRes?.data))

      const impactBody = impactRes?.data
      if (impactBody && Array.isArray(impactBody.results)) {
        setImpactData(impactBody.results)
        setCanGenerate(impactBody.can_generate_now ?? true)
        setNextGenerateAt(impactBody.next_generate_at ?? null)
      } else {
        setImpactData(extractList(impactBody))
      }
    } catch (err) {
      // silently fail, show empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Split into active (≤30d) and past (>30d)
  const cutoff30d = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  }, [])

  const activeActions = useMemo(
    () => actionsRaw.filter((a) => a.acted_at && new Date(a.acted_at) >= cutoff30d),
    [actionsRaw, cutoff30d]
  )
  const pastActions = useMemo(
    () => actionsRaw.filter((a) => !a.acted_at || new Date(a.acted_at) < cutoff30d),
    [actionsRaw, cutoff30d]
  )

  // Group impacts by action id
  const impactsByAction = useMemo(() => {
    const map = {}
    for (const check of impactData) {
      const key = check.action
      if (!map[key]) map[key] = []
      map[key].push(check)
    }
    // Sort each group newest first
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    return map
  }, [impactData])

  async function handleGenerate() {
    if (!canGenerate) {
      showToast('Impact summary masih dalam cooldown 3 hari.')
      return
    }
    setGenerating(true)
    try {
      const res = await api.post('/briefs/generate-weekly-impact/')
      if (res.data.generated_count === 0) {
        showToast('AI API sedang sibuk atau gagal. Silakan coba lagi sebentar lagi.')
      } else {
        showToast(`Impact summary generated! (${res.data.generated_count} actions)`)
      }
      await load()
    } catch (err) {
      if (err.response?.status === 429) {
        setCanGenerate(false)
        setNextGenerateAt(err.response.data?.next_available_at ?? null)
        showToast('Masih cooldown — tunggu 3 hari sejak generate terakhir.')
      } else if (err.response?.status === 400) {
        showToast(err.response.data?.detail || 'Belum ada aksi yang bisa dianalisis.')
      } else {
        showToast('Gagal generate impact summary.')
      }
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-[#5B6B82] px-1 py-10 text-center">Loading...</p>
  }

  const noActions = activeActions.length === 0 && pastActions.length === 0

  return (
    <div className="space-y-8">
      {/* Generate button */}
      <div className={`bg-white rounded-xl ${SHADOW_CARD} px-5 py-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-[#18233D]">
              AI Impact Summary
            </h2>
            <p className="text-sm text-[#5B6B82] mt-0.5">
              Generate an AI analysis of how your recent decisions impacted performance.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !canGenerate || activeActions.length === 0}
            title={
              activeActions.length === 0
                ? 'No active decisions to analyze'
                : !canGenerate && nextGenerateAt
                  ? `Available after ${fmtDateTime(nextGenerateAt)}`
                  : undefined
            }
            className="shrink-0 text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-full px-5 py-2.5"
          >
            {generating
              ? 'Generating…'
              : !canGenerate
                ? <ImpactCountdown target={nextGenerateAt} />
                : activeActions.length === 0
                  ? 'No eligible actions'
                  : 'Generate Impact Summary'}
          </button>
        </div>
      </div>

      {noActions ? (
        <div className={`bg-white rounded-xl ${SHADOW_CARD} px-5 py-8 text-center`}>
          <p className="text-sm font-semibold text-[#18233D]">No decisions yet.</p>
          <p className="text-sm text-[#5B6B82] mt-1">
            When you act on a recommendation in the Dashboard (discount or review menu), it will appear here for impact tracking.
          </p>
        </div>
      ) : (
        <>
          {/* Active Decisions (≤ 30 days) */}
          {activeActions.length > 0 && (
            <section>
              <p className="text-xs font-bold text-[#8B96A6] uppercase tracking-wide mb-3">
                Active Decisions
                <span className="ml-2 text-[#28579C] font-semibold normal-case">last 30 days</span>
              </p>
              <div className="space-y-2.5">
                {activeActions.map((a) => (
                  <FeedbackActionCard
                    key={a.id}
                    action={a}
                    impacts={impactsByAction[a.id] || []}
                    isPast={false}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past Decisions (> 30 days) */}
          {pastActions.length > 0 && (
            <section>
              <p className="text-xs font-bold text-[#8B96A6] uppercase tracking-wide mb-3">
                Past Decisions
                <span className="ml-2 text-[#5B6B82] font-semibold normal-case">older than 30 days</span>
              </p>
              <div className="space-y-2.5">
                {pastActions.map((a) => (
                  <FeedbackActionCard
                    key={a.id}
                    action={a}
                    impacts={impactsByAction[a.id] || []}
                    isPast={true}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-5 right-5 z-[70] max-w-xs rounded-lg bg-[#18233D] text-white px-4 py-3 shadow-lg text-sm font-medium"
          style={{ animation: 'fadeIn .15s ease-out' }}
        >
          {toast}
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity:0; transform: translateY(2px);} to { opacity:1; transform:none;} }`}</style>
    </div>
  )
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
  // Scaled by magnitude (abs), not raw value — a series of all-negative
  // days (e.g. profit) would otherwise make `max` collapse to the 1
  // floor, blowing bar heights up past 100000% since abs(value)/max is
  // used below to size loss bars too.
  const max = Math.max(1, ...values.map((v) => Math.abs(v)))
  const showTicks = series.length <= 31
  const minWidth = Math.max(360, series.length * 26)

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1.5 h-[180px] px-1" style={{ minWidth }}>
        {series.map((d, i) => {
          const value = values[i]
          // A negative day (profit can go below 0 with heavy discounts or
          // bad cost data) used to render as an indistinguishable tiny
          // bar, same as a genuinely small-but-positive day — only the
          // hover tooltip revealed it was actually a loss. Color it red
          // so a loss day is visible at a glance, not just on hover.
          const isLoss = value < 0
          const pct = Math.max(2, Math.round((Math.abs(value) / max) * 100))
          const label = metric === 'units' ? `${formatNumber(value)} unit` : formatRupiah(value)
          return (
            <div key={d.date} className="flex-1 flex items-end h-full" title={`${fmtDateShort(d.date)}: ${label}`}>
              <div
                className={`w-full transition-colors rounded-t-sm ${isLoss ? 'bg-[#B8433B] hover:bg-[#8F332C]' : 'bg-[#28579C] hover:bg-[#1E4278]'}`}
                style={{ height: `${pct}%` }}
              />
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
  { value: 'today', label: 'Hari ini' },
  { value: '7d', label: '7 hari terakhir' },
  { value: '30d', label: '30 hari terakhir' },
  { value: 'custom', label: 'Custom' },
]
const METRIC_OPTIONS = [
  { value: 'sales', label: 'Pendapatan' },
  { value: 'profit', label: 'Profit' },
  { value: 'units', label: 'Unit' },
]

export default function ProfitPage() {
  const [tab, setTab] = useState('overview') // 'overview' | 'compare' | 'feedback'
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
      setError(extractError(err) || 'Gagal ambil data performa.')
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

  const metricLabel = METRIC_OPTIONS.find((m) => m.value === metric)?.label || 'Pendapatan'
  const revenueTrend = overview ? pctChange(overview.current.revenue, overview.previous.revenue) : null
  const profitTrend = overview ? pctChange(overview.current.profit, overview.previous.profit) : null
  const volumeTrend = overview ? pctChange(overview.current.volume, overview.previous.volume) : null

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl px-5 sm:px-6 py-5 mb-6">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#18233D]">Performa</h1>
          <p className="text-sm text-[#5B6B82] mt-1">Gimana performa bisnis kamu.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl px-4 py-3 mb-6">
        <div className="inline-flex rounded-full bg-[#F7F5F0] p-1 gap-1">
          {[{ id: 'overview', label: 'Ringkasan' }, { id: 'compare', label: 'Bandingkan Menu' }, { id: 'feedback', label: 'Decision Feedback' }].map((t) => (
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

      {tab !== 'feedback' && (
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className={LABEL}>Periode</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={`${INPUT} w-40`}>
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {period === 'custom' ? (
          <>
            <div>
              <label className={LABEL}>Dari</label>
              <input type="date" value={customStart} max={customEnd || todayStr()} onChange={(e) => setCustomStart(e.target.value)} className={`${INPUT} w-40`} />
            </div>
            <div>
              <label className={LABEL}>Sampai</label>
              <input type="date" value={customEnd} min={customStart} max={todayStr()} onChange={(e) => setCustomEnd(e.target.value)} className={`${INPUT} w-40`} />
            </div>
          </>
        ) : (
          <div>
            <p className={LABEL}>Rentang</p>
            <p className="text-sm font-semibold text-[#18233D] px-1 py-2">{rangeLabelText(overview?.range)}</p>
          </div>
        )}
        {tab === 'overview' && (
          <>
            <div>
              <label className={LABEL}>Menu</label>
              <select value={menuFilter} onChange={(e) => setMenuFilter(e.target.value)} className={`${INPUT} w-44`}>
                <option value="all">Semua Menu</option>
                {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Metrik</label>
              <select value={metric} onChange={(e) => setMetric(e.target.value)} className={`${INPUT} w-36`}>
                {METRIC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
      )}

      {tab === 'overview' ? (
        <>
          {error && <p className={`${ERROR_BANNER} mb-6`}>{error}</p>}

          {loading || !overview ? (
            <p className="text-sm text-[#5B6B82] px-1 py-10 text-center">Memuat...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <StatCard label="Total Penjualan" value={formatRupiah(overview.current.revenue)} />
                <StatCard label="Estimasi Profit Kotor" value={formatRupiah(overview.current.profit)} />
                <StatCard label="Unit Terjual" value={formatNumber(overview.current.volume)} />
              </div>

              <div className="flex items-center gap-3 mb-8 px-1">
                <span className="text-xs font-semibold text-[#8B96A6] uppercase tracking-wide">vs. periode sebelumnya</span>
                <TrendBadge pct={revenueTrend} title={`Pendapatan: ${formatRupiah(overview.previous.revenue)} → ${formatRupiah(overview.current.revenue)}`} />
                <TrendBadge pct={profitTrend} title={`Profit: ${formatRupiah(overview.previous.profit)} → ${formatRupiah(overview.current.profit)}`} />
                <TrendBadge pct={volumeTrend} title={`Unit: ${formatNumber(overview.previous.volume)} → ${formatNumber(overview.current.volume)}`} />
              </div>

              <section className="mb-10">
                <h2 className="text-[17px] font-bold text-[#18233D] mb-3">Tren {metricLabel}</h2>
                {overview.daily_series.length < 2 ? (
                  <EmptyState title="Pilih periode lebih dari 1 hari buat liat trennya." />
                ) : (
                  <div className={`bg-white rounded-xl ${SHADOW_CARD} p-5`}>
                    <TrendChart series={overview.daily_series} metric={metric} />
                  </div>
                )}
              </section>

              <section>
                <h2 className="text-[17px] font-bold text-[#18233D] mb-3">Performa Menu</h2>
                {breakdown.every((r) => r.qty === 0) ? (
                  <EmptyState title="Tidak ada penjualan di periode ini." body="Pilih rentang tanggal yang lebih luas buat bandingin menu." />
                ) : (
                  <p className="text-xs text-[#8B96A6] mb-3">
                    Tren membandingkan <span className="font-medium text-[#5B6B82]">{rangeLabelText(overview.range)}</span> dengan periode sebelumnya yang durasinya sama, <span className="font-medium text-[#5B6B82]">{rangeLabelText(overview.previous_range)}</span>.
                  </p>
                )}
                <div className={`bg-white rounded-xl ${SHADOW_CARD} overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="bg-[#EAF1FB] text-left text-[11px] font-bold text-[#1E4278] uppercase tracking-wide">
                          <th className="px-4 py-3">Menu</th>
                          <th className="px-4 py-3 text-right">Qty terjual</th>
                          <th className="px-4 py-3 text-right">Pendapatan</th>
                          <th className="px-4 py-3 text-right">Biaya</th>
                          <th className="px-4 py-3 text-right">Margin</th>
                          <th className="px-4 py-3 text-right">Tren</th>
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
      ) : tab === 'compare' ? (
        <>
          {compareError && <p className={`${ERROR_BANNER} mb-6`}>{compareError}</p>}

          {menus.length < 2 ? (
            <EmptyState title="Butuh minimal dua menu." body="Tambah menu lain buat bandingin performa berdampingan." />
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
                <EmptyState title="Pilih dua menu yang beda." body="Pilih dua menu yang berbeda di atas buat bandingin performanya." />
              ) : compareLoading || compareData === null ? (
                <p className="text-sm text-[#5B6B82] px-1 py-10 text-center">Memuat...</p>
              ) : !compareData.a || !compareData.b ? (
                <EmptyState title="Salah satu menu tidak ketemu." body="Menu ini mungkin baru aja dihapus — pilih ulang menunya di atas." />
              ) : (
                <CompareTable data={compareData} />
              )}
            </>
          )}
        </>
      ) : (
        <DecisionFeedbackTab />
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
        Menampilkan <span className="font-medium text-[#5B6B82]">{rangeLabelText(range)}</span> · tren vs. periode sebelumnya, <span className="font-medium text-[#5B6B82]">{rangeLabelText(previous_range)}</span>.
      </p>
      <div className={`bg-white rounded-xl ${SHADOW_CARD} overflow-hidden`}>
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="bg-[#EAF1FB] text-left text-[11px] font-bold text-[#1E4278] uppercase tracking-wide">
              <th className="px-4 py-3">Metrik</th>
              <th className="px-4 py-3 text-right">{a.name}</th>
              <th className="px-4 py-3 text-right">{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {compareMetricRow('Qty terjual', formatNumber, a.current.volume, b.current.volume, true)}
            {compareMetricRow('Pendapatan', formatRupiah, a.current.revenue, b.current.revenue, true)}
            {compareMetricRow('Biaya', formatRupiah, a.current.cost, b.current.cost, false)}
            {compareMetricRow('Profit', formatRupiah, a.current.profit, b.current.profit, true)}
            {compareMetricRow('Margin', (v) => `${v.toFixed(1)}%`, a.margin_pct, b.margin_pct, true)}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#E4E2DC] bg-[#F7F5F0]/60">
              <td className="px-4 py-2.5 text-xs font-semibold text-[#8B96A6]">vs. periode sebelumnya</td>
              <td className="px-4 py-2.5 text-right">
                <TrendBadge pct={pctChange(a.current.revenue, a.previous.revenue)} title={`Pendapatan: ${formatRupiah(a.previous.revenue)} → ${formatRupiah(a.current.revenue)}`} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <TrendBadge pct={pctChange(b.current.revenue, b.previous.revenue)} title={`Pendapatan: ${formatRupiah(b.previous.revenue)} → ${formatRupiah(b.current.revenue)}`} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}
