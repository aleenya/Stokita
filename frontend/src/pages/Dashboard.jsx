import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS
   Warna diambil persis dari tailwind.config di dashboard(2).html.
   Sengaja ditulis sebagai arbitrary value (bg-[#F7F5F0]) supaya file ini
   jalan tanpa perlu ngubah tailwind.config dulu.

   Kalau nanti mau dirapihin, tinggal pindahin map di bawah ke
   tailwind.config.js -> theme.extend.colors, lalu ganti class-nya:
     bg      #F7F5F0   surface #FFFFFF
     border  #E4E2DC   border-strong #CBD1DB
     navy    #18233D   navy-50 #EEF2F8
     slate   #5B6B82   slate-muted #8B96A6
     brand   #28579C   brand-dark #1E4278   brand-light #EAF1FB
     gold    #C68A34   gold-text #8A5A17
     success #2E7D53 / #EAF5EE
     warning #A2670C / #FCF3E2
     critical #B8433B / #FBEBEA
     teal    #2A7A82 / #E8F4F5
   Font: Plus Jakarta Sans (pastikan <link> Google Fonts ada di index.html)
   ========================================================================= */

const SHADOW_CARD =
    'shadow-[0_2px_6px_rgba(24,35,61,0.06),0_10px_24px_-8px_rgba(24,35,61,0.22)]'
const SHADOW_CARD_HOVER =
    'hover:shadow-[0_4px_10px_rgba(24,35,61,0.08),0_16px_32px_-8px_rgba(24,35,61,0.28)]'
const SHADOW_FLOAT =
    'shadow-[0_14px_32px_-10px_rgba(20,29,52,0.28),0_2px_8px_rgba(20,29,52,0.08)]'

const TONE = {
  critical: 'text-[#B8433B] bg-[#FBEBEA]',
  warning: 'text-[#A2670C] bg-[#FCF3E2]',
  success: 'text-[#2E7D53] bg-[#EAF5EE]',
  teal: 'text-[#2A7A82] bg-[#E8F4F5]',
}

/* =========================================================================
   UTILITIES
   ========================================================================= */

const rupiah = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID')

const fmtDate = (d) => {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d)
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const fmtDateTime = (d) => {
  const dt = d instanceof Date ? d : new Date(d)
  return (
      dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
      ', ' +
      dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v))

/* =========================================================================
   DERIVED LOGIC
   "Today's Priorities" is sourced straight from the backend's daily brief
   (F5/F6 — GET /briefs/today/, AI-ranked via Gemini) instead of being
   recomputed client-side. mapBriefAction() just reshapes one brief_action
   into the card/detail-panel shape the presentational components below
   already expect.
   ========================================================================= */

function actionDestination(actionType) {
  if (actionType === 'restock' || actionType === 'expiry_alert') {
    return { label: 'Go to Ingredients', page: 'ingredients' }
  }
  return { label: 'Go to Menus', page: 'menus' }
}

function mapBriefAction(a) {
  const impact = num(a.rupiah_impact)
  const dest = actionDestination(a.action_type)
  const typeLabel = String(a.action_type || '').replace(/_/g, ' ')

  return {
    id: a.id,
    kind: 'brief',
    refId: a.id,
    title: a.message,
    summary: `${typeLabel} · estimated impact ${rupiah(impact)}`,
    badge: {
      label: a.action_type === 'expiry_alert' ? 'Urgent' : `${rupiah(impact)} impact`,
      tone: a.action_type === 'expiry_alert' ? 'critical' : 'warning',
    },
    actionLabel: 'View details',
    recommendation: a.message,
    reasoning: a.message,
    signals: [`Action type: ${typeLabel}`, `Estimated impact: ${rupiah(impact)}`],
    suggestedAction: a.message,
    expectedImpact: impact
        ? `Estimated impact of acting on this is about ${rupiah(impact)}.`
        : 'Impact not estimated for this action.',
    metricLabel: 'Estimated impact',
    metricValue: rupiah(impact),
    gotoLabel: dest.label,
    gotoPage: dest.page,
  }
}

function mapHistoryItem(a) {
  return {
    id: a.id,
    title: a.message,
    kind: 'brief',
    actionTakenAt: a.acted_at,
    before: null,
    after: null,
    // F7 impact-check results (positive/negative/…) aren't joined in here
    // yet — GET /briefs/today/ doesn't include them. Once wired to
    // /briefs/impact-history/, matching entries can flip this to 'observed'.
    status: 'pending',
  }
}

/* =========================================================================
   SMALL PRESENTATIONAL PIECES
   ========================================================================= */

function Badge({ label, tone = 'warning' }) {
  return (
      <span className={`text-xs font-semibold ${TONE[tone] || TONE.warning} rounded-full px-2.5 py-1`}>
      {label}
    </span>
  )
}

function Trend({ pct, tooltip }) {
  if (pct === null || pct === undefined || !isFinite(pct)) {
    return (
        <span className="text-xs text-[#8B96A6]" title={tooltip}>
        —
      </span>
    )
  }
  const up = pct >= 0
  return (
      <span
          title={tooltip}
          className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
              up ? TONE.success : TONE.critical
          } rounded px-1.5 py-0.5 cursor-help`}
      >
      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {up ? <path d="M12 4l8 10h-6v6h-4v-6H4z" /> : <path d="M12 20 4 10h6V4h4v6h6z" />}
      </svg>
        {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function SkeletonPriority({ wide }) {
  return (
      <div
          className={`flex items-center gap-4 rounded-xl bg-white px-5 py-4 ${SHADOW_CARD} animate-pulse`}
      >
        <div className="w-5 h-5 rounded-full border-2 border-[#CBD1DB] shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className={`h-3.5 ${wide ? 'w-40' : 'w-32'} rounded bg-[#E4E2DC]`} />
          <div className={`h-3 ${wide ? 'w-48' : 'w-56'} rounded bg-[#E4E2DC]`} />
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className={`h-5 ${wide ? 'w-20' : 'w-24'} rounded-full bg-[#E4E2DC]`} />
          <div className="h-3 w-16 rounded bg-[#E4E2DC]" />
        </div>
      </div>
  )
}

function PriorityCard({ p, onToggle, onDetails }) {
  return (
      <div
          className={`group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl bg-white px-4 sm:px-5 py-4 ${SHADOW_CARD} ${SHADOW_CARD_HOVER} transition-shadow`}
      >
        <div className="flex items-start gap-4">
          <button
              type="button"
              role="checkbox"
              aria-checked={p.completed}
              aria-label={`Mark ${p.title} as handled`}
              onClick={() => onToggle(p.id)}
              className={`w-5 h-5 mt-0.5 sm:mt-0 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center ${
                  p.completed
                      ? 'bg-[#2E7D53] border-[#2E7D53]'
                      : 'border-[#CBD1DB] hover:border-[#28579C]'
              }`}
          >
            {p.completed && (
                <svg
                    className="w-3 h-3 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
            )}
          </button>
          {/* mobile: judul nempel di sebelah checkbox */}
          <div className="flex-1 min-w-0 sm:hidden">
            <p
                className={`text-[15px] font-semibold ${
                    p.completed ? 'text-[#8B96A6] line-through' : 'text-[#18233D]'
                }`}
            >
              {p.title}
            </p>
            <p className="text-sm text-[#5B6B82] mt-0.5">{p.summary}</p>
          </div>
        </div>

        {/* desktop: judul jadi kolom tengah */}
        <div className="hidden sm:block flex-1 min-w-0">
          <p
              className={`text-[15px] font-semibold ${
                  p.completed ? 'text-[#8B96A6] line-through' : 'text-[#18233D]'
              }`}
          >
            {p.title}
          </p>
          <p className="text-sm text-[#5B6B82] mt-0.5">{p.summary}</p>
        </div>

        <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1.5 shrink-0 pl-9 sm:pl-0">
          <div className="flex items-center gap-1.5">
            {p.completed ? (
                <span className="text-xs font-semibold text-[#2E7D53] bg-[#EAF5EE] rounded-full px-2.5 py-1">
              Handled
            </span>
            ) : (
                <Badge label={p.badge.label} tone={p.badge.tone} />
            )}
          </div>
          <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                onDetails(p.id)
              }}
              className="flex items-center gap-1 text-sm font-medium text-[#28579C] hover:text-[#1E4278]"
          >
            {p.actionLabel}
            <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </a>
        </div>
      </div>
  )
}

function ActionHistory({ items }) {
  if (!items.length) {
    return (
        <p className="text-sm text-[#8B96A6] px-1">
          No actions recorded yet. When you mark a recommendation as handled, it will show up here.
        </p>
    )
  }
  return (
      <div className="space-y-2">
        {items.map((a) => (
            <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-[#F7F5F0] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#18233D] truncate">{a.title}</p>
                <p className="text-xs text-[#8B96A6] mt-0.5">Handled {fmtDateTime(a.actionTakenAt)}</p>
              </div>
              <div className="shrink-0 text-right">
                {a.status === 'observed' ? (
                    <>
                      <p className="text-xs text-[#8B96A6]">
                        {a.before?.value} → <span className="font-semibold text-[#18233D]">{a.after}</span>
                      </p>
                      <p className="text-[11px] text-[#8B96A6] italic">Observed after the action</p>
                    </>
                ) : (
                    <span className="text-xs font-semibold text-[#2A7A82] bg-[#E8F4F5] rounded-full px-2 py-0.5">
                Pending observation
              </span>
                )}
              </div>
            </div>
        ))}
      </div>
  )
}

/* =========================================================================
   RECOMMENDATION DETAIL PANEL (slide-over kanan)
   ========================================================================= */

function DetailsPanel({ open, loading, priority, onClose, onPrimary, onDismiss }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  const p = priority

  return (
      <>
        <div
            className="fixed inset-0 z-40 bg-[#18233D]/40 backdrop-blur-[1px]"
            aria-hidden="true"
            onClick={onClose}
        />
        <div
            className={`fixed inset-y-0 right-0 z-50 w-full max-w-[440px] bg-white ${SHADOW_FLOAT} overflow-y-auto`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="details-title"
        >
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#E4E2DC]">
            <p className="text-xs font-bold text-[#18233D] uppercase tracking-wide">Recommendation</p>
            <button
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className="w-7 h-7 flex items-center justify-center rounded-full text-[#8B96A6] hover:bg-[#F7F5F0] hover:text-[#18233D] transition-colors"
            >
              <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {loading && (
              <div className="px-6 py-6 space-y-4 animate-pulse">
                <div className="h-5 w-2/3 rounded bg-[#E4E2DC]" />
                <div className="h-3 w-full rounded bg-[#E4E2DC]" />
                <div className="h-3 w-5/6 rounded bg-[#E4E2DC]" />
                <div className="h-20 w-full rounded-lg bg-[#E4E2DC]" />
              </div>
          )}

          {!loading && !p && (
              <div className="px-6 py-8 text-center">
                <p className="text-sm font-semibold text-[#18233D]">Details aren't available right now.</p>
                <p className="text-sm text-[#5B6B82] mt-1">
                  The recommendation is still active — you can try again in a moment.
                </p>
              </div>
          )}

          {!loading && p && (
              <div className="px-6 py-6 space-y-6">
                <div>
                  <h3 id="details-title" className="text-[19px] font-bold text-[#18233D]">
                    {p.recommendation || p.title}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge label={p.badge.label} tone={p.badge.tone} />
                    {p.completed && (
                        <span className="inline-block text-xs font-semibold text-[#2E7D53] bg-[#EAF5EE] rounded-full px-2.5 py-1">
                    Handled
                  </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-[#8B96A6] uppercase tracking-wide mb-1.5">
                    Why this matters
                  </p>
                  <p className="text-sm text-[#5B6B82] leading-relaxed">{p.reasoning}</p>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-[#8B96A6] uppercase tracking-wide mb-1.5">
                    What we looked at
                  </p>
                  <ul className="text-sm text-[#5B6B82] leading-relaxed space-y-1 list-disc list-inside">
                    {(p.signals || []).map((s, i) => (
                        <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg bg-[#EAF1FB] px-4 py-3">
                  <p className="text-[11px] font-bold text-[#1E4278] uppercase tracking-wide mb-1">
                    Suggested action
                  </p>
                  <p className="text-sm text-[#18233D] font-medium">{p.suggestedAction}</p>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-[#8B96A6] uppercase tracking-wide mb-1.5">
                    If you act on this
                  </p>
                  <p className="text-sm text-[#5B6B82] leading-relaxed">{p.expectedImpact}</p>
                  <p className="text-xs text-[#8B96A6] mt-1.5 italic">
                    Impact is an estimate. Outcomes are observed after the fact, not guaranteed.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-[#E4E2DC]">
                  <button
                      type="button"
                      onClick={() => onPrimary(p)}
                      className="text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-4 py-2.5"
                  >
                    {p.completed
                        ? 'Reopen this recommendation'
                        : p.gotoLabel
                            ? `Do this — ${p.gotoLabel}`
                            : 'Mark as handled'}
                  </button>
                  {!p.completed && (
                      <button
                          type="button"
                          onClick={() => onDismiss(p.id)}
                          className="text-sm font-semibold text-[#5B6B82] hover:text-[#18233D] transition-colors py-1"
                      >
                        Dismiss — not now
                      </button>
                  )}
                </div>
              </div>
          )}
        </div>
      </>
  )
}

/* =========================================================================
   TOAST
   ========================================================================= */

function Toast({ message }) {
  if (!message) return null
  return (
      <div
          className="fixed bottom-5 right-5 z-[70] max-w-xs rounded-lg bg-[#18233D] text-white px-4 py-3 shadow-lg text-sm font-medium"
          style={{ animation: 'fadeIn .15s ease-out' }}
          role="status"
      >
        {message}
      </div>
  )
}

/* =========================================================================
   PAGE
   ========================================================================= */

export default function Dashboard({ ownerName = 'there', onNavigate }) {
  const [status, setStatus] = useState('loading') // loading | error | empty | loaded
  const [brief, setBrief] = useState(null)
  const [regenerating, setRegenerating] = useState(false)
  const [salesToday, setSalesToday] = useState({ revenue: 0, volume: 0, prevRevenue: null })

  const [detailsId, setDetailsId] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  /* ---- load ----
     Today's Priorities comes straight from the daily brief (F5/F6):
     GET /briefs/today/ only. Generation is NOT triggered from the frontend
     anymore — it happens on a backend schedule (see tasks.py). If today's
     brief doesn't exist yet (404), we just show the empty state; the
     "Regenerate" button remains the only way to trigger generation manually. */
  const load = useCallback(async () => {
    setStatus('loading')
    try {
      let briefData = null
      try {
        briefData = (await api.get('/briefs/today/')).data
      } catch (err) {
        if (err.response?.status === 404) {
          briefData = null // no brief yet today — render empty state, don't auto-generate
        } else {
          throw err
        }
      }
      setBrief(briefData)

      const salesRes = await api
          .get('/sales/summary/', { params: { period: 'today' } })
          .catch(() => null)
      if (salesRes) {
        const d = salesRes.data || {}
        setSalesToday({
          revenue: num(d.revenue ?? d.total_revenue),
          volume: num(d.volume ?? d.total_orders ?? d.orders),
          prevRevenue: d.previous_revenue != null ? num(d.previous_revenue) : null,
        })
      }
      setStatus('ready')
    } catch (err) {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function refreshBrief() {
    try {
      const res = await api.get('/briefs/today/')
      setBrief(res.data)
    } catch (err) {
      // ignore — next full load() retries anyway
    }
  }

  // Dipakai tombol di empty state — aman diklik berkali-kali, backend
  // cuma bener-bener generate kalau brief hari ini belum ada.
  async function generateBrief() {
    setRegenerating(true)
    try {
      const res = await api.post('/briefs/generate/')
      setBrief(res.data)
      showToast('Brief generated.')
    } catch (err) {
      showToast('Gagal generate brief.')
    } finally {
      setRegenerating(false)
    }
  }

  // Dipakai tombol "Regenerate" — selalu bikin ulang (force=true).
  async function regenerateBrief() {
    setRegenerating(true)
    try {
      const res = await api.post('/briefs/generate/?force=true')
      setBrief(res.data)
      showToast('Brief regenerated.')
    } catch (err) {
      showToast('Gagal generate brief.')
    } finally {
      setRegenerating(false)
    }
  }

  /* ---- priorities ---- */
  const allActions = brief?.actions || []
  const priorities = useMemo(() => {
    if (status !== 'ready') return []
    return allActions.filter((a) => a.status === 'pending').map(mapBriefAction)
  }, [status, allActions])

  const historyItems = useMemo(() => {
    return allActions
        .filter((a) => a.status === 'acted')
        .sort((a, b) => new Date(b.acted_at) - new Date(a.acted_at))
        .slice(0, 5)
        .map(mapHistoryItem)
  }, [allActions])

  const totalActions = allActions.length
  const handledCount = allActions.filter((a) => a.status === 'acted').length
  const openCount = priorities.length
  const total = priorities.length
  const listStatus =
      status === 'loading' ? 'loading' : status === 'error' ? 'error' : total === 0 ? 'empty' : 'loaded'

  const trendPct =
      salesToday.prevRevenue != null && salesToday.prevRevenue > 0
          ? ((salesToday.revenue - salesToday.prevRevenue) / salesToday.prevRevenue) * 100
          : null

  /* ---- actions ----
     status can only move pending -> acted/dismissed (no revert), matching
     PATCH /briefs/actions/{id}/ — so handled/dismissed items simply drop
     out of Today's Priorities once refreshed. */
  async function updateActionStatus(id, newStatus, toastMsg) {
    try {
      await api.patch(`/briefs/actions/${id}/`, { status: newStatus })
      await refreshBrief()
      if (detailsId === id) setDetailsId(null)
      showToast(toastMsg)
    } catch (err) {
      showToast('Gagal update aksi.')
    }
  }

  function togglePriority(id) {
    updateActionStatus(id, 'acted', 'Marked as handled.')
  }

  function dismissPriority(id) {
    updateActionStatus(id, 'dismissed', 'Dismissed for now.')
  }

  function openDetails(id) {
    setDetailsId(id)
    setDetailsLoading(true)
    setTimeout(() => setDetailsLoading(false), 300)
  }

  function handleDetailsPrimary(p) {
    setDetailsId(null)
    if (onNavigate && p.gotoPage) onNavigate(p.gotoPage, p.refId)
    else togglePriority(p.id)
  }

  const activePriority = priorities.find((p) => p.id === detailsId) || null

  /* ---- render ---- */
  return (
      <div
          className="bg-[#F7F5F0] text-[#18233D] antialiased min-h-full"
          style={{
            fontFamily:
                "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          }}
      >
        <style>{`@keyframes fadeIn { from { opacity:0; transform: translateY(2px);} to { opacity:1; transform:none;} }`}</style>

        {/* ============ HERO ============ */}
        <div className="relative overflow-hidden bg-[linear-gradient(155deg,#243559_0%,#131C33_100%)] px-4 sm:px-6 md:px-10 pt-9 pb-16">
          <div className="relative max-w-[760px] mx-auto">
            <p className="text-sm text-white/50 font-medium mb-1.5">{fmtDate(new Date())}</p>
            <h1 className="text-[22px] sm:text-[27px] font-extrabold tracking-tight text-white">
              Good morning, {String(ownerName).split(' ')[0]}
            </h1>
            <p className="text-[15px] text-white/70 mt-3.5 leading-relaxed max-w-[560px]">
              {status === 'loading' ? (
                  'Loading today’s brief…'
              ) : openCount === 0 ? (
                  <>
                    All caught up — <span className="text-white font-semibold">no open priorities</span> right now.
                  </>
              ) : (
                  <>
                <span className="text-white font-semibold">
                  {openCount} item{openCount === 1 ? '' : 's'}
                </span>{' '}
                    need{openCount === 1 ? 's' : ''} your attention today.
                  </>
              )}
            </p>
          </div>
        </div>

        <div className="max-w-[760px] mx-auto px-4 sm:px-6 md:px-10 pb-10">
          {/* ============ STAT "TICKET" CARD ============ */}
          <div className="relative -mt-10 mb-9 rounded-2xl bg-white shadow-[0_14px_32px_-10px_rgba(20,29,52,0.28),0_2px_8px_rgba(20,29,52,0.08)] ring-1 ring-white/60 overflow-hidden">
            <div className="flex flex-col divide-y divide-[#E4E2DC] sm:flex-row sm:divide-y-0 sm:divide-x">
              <div className="flex-1 px-6 py-4">
                <p className="text-xs text-[#8B96A6] mb-1">Today's Sales</p>
                <div className="flex items-end justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[22px] font-bold text-[#18233D]">{rupiah(salesToday.revenue)}</p>
                    <Trend pct={trendPct} tooltip="Compared to the same period yesterday" />
                  </div>
                </div>
              </div>
              <div className="flex-1 px-6 py-4">
                <p className="text-xs text-[#8B96A6] mb-1">Orders</p>
                <p className="text-[22px] font-bold text-[#18233D]">{salesToday.volume}</p>
              </div>
              <div className="flex-1 px-6 py-4">
                <p className="text-xs text-[#8B96A6] mb-1">Priorities</p>
                <p className="text-[22px] font-bold text-[#18233D]">
                  {status === 'loading' ? (
                      '—'
                  ) : totalActions === 0 ? (
                      <span className="text-sm font-semibold text-[#2E7D53]">All clear</span>
                  ) : (
                      <>
                        {handledCount}
                        <span className="text-sm font-medium text-[#8B96A6]">/{totalActions}</span>{' '}
                        <span
                            className={`text-sm font-semibold ${
                                openCount === 0 ? 'text-[#2E7D53]' : 'text-[#A2670C]'
                            }`}
                        >
                      handled
                    </span>
                      </>
                  )}
                </p>
              </div>
            </div>

            {/* perforated divider */}
            <div className="relative" aria-hidden="true">
              <div className="border-t-2 border-dashed border-[#A2670C]/35" />
              <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#F7F5F0]" />
              <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#F7F5F0]" />
            </div>

            <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 bg-[#F7F5F0]/60 px-4 sm:px-6 py-3">
              <p className="text-sm text-[#5B6B82]">
                <span className="text-[#18233D] font-semibold">Record today's sales as they happen.</span>{' '}
                Keeps revenue and stock usage accurate.
              </p>
              <button
                  type="button"
                  onClick={() => (onNavigate ? onNavigate('sales') : showToast('Hook up Record sales here.'))}
                  className="shrink-0 text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-4 py-2"
              >
                Record sales
              </button>
            </div>
          </div>

          {/* ============ TODAY'S PRIORITIES ============ */}
          <section className="mb-10" aria-labelledby="priorities-heading">
            <div className="flex items-baseline justify-between mb-3">
              <h2
                  id="priorities-heading"
                  className="text-[13px] font-bold text-[#18233D] uppercase tracking-wide"
              >
                Today's Priorities
              </h2>
              <button
                  type="button"
                  onClick={regenerateBrief}
                  disabled={regenerating}
                  className="text-xs font-semibold text-[#28579C] hover:text-[#1E4278] disabled:opacity-50"
              >
                {regenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>

            <p className="sr-only" role="status" aria-live="polite">
              {listStatus === 'empty' ? 'No priorities today.' : `${total} priorities loaded.`}
            </p>

            {listStatus === 'loading' && (
                <div className="space-y-2.5" aria-hidden="true">
                  <SkeletonPriority />
                  <SkeletonPriority wide />
                </div>
            )}

            {listStatus === 'error' && (
                <div className={`rounded-xl bg-white px-5 py-6 text-center ${SHADOW_CARD}`}>
                  <p className="text-sm font-semibold text-[#18233D]">Couldn't load today's brief.</p>
                  <p className="text-sm text-[#5B6B82] mt-1">Check your connection and try again.</p>
                  <button
                      type="button"
                      onClick={load}
                      className="mt-3 text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-4 py-2"
                  >
                    Retry
                  </button>
                </div>
            )}

            {listStatus === 'empty' && (
                <div className={`rounded-xl bg-white px-5 py-6 text-center ${SHADOW_CARD}`}>
                  <p className="text-sm font-semibold text-[#18233D]">
                    {brief ? 'Nothing urgent today.' : "Today's brief hasn't been generated yet."}
                  </p>
                  <p className="text-sm text-[#5B6B82] mt-1">
                    {brief
                        ? 'Stokita will surface new priorities here as soon as something needs your attention.'
                        : 'Generate it to see AI-ranked priorities for today.'}
                  </p>
                  {!brief && (
                      <button
                          type="button"
                          onClick={generateBrief}
                          disabled={regenerating}
                          className="mt-3 text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-4 py-2 disabled:opacity-50"
                      >
                        {regenerating ? 'Generating…' : "Generate today's brief"}
                      </button>
                  )}
                </div>
            )}

            {listStatus === 'loaded' && (
                <div className="space-y-2.5">
                  {priorities.map((p) => (
                      <PriorityCard key={p.id} p={p} onToggle={togglePriority} onDetails={openDetails} />
                  ))}
                </div>
            )}
          </section>

          {/* ============ IMPACT / ACTION HISTORY ============ */}
          <section aria-labelledby="impact-heading">
            <div className="flex items-baseline justify-between mb-3">
              <h2
                  id="impact-heading"
                  className="text-[13px] font-bold text-[#18233D] uppercase tracking-wide"
              >
                Impact / Action History
              </h2>
            </div>
            <div className={`rounded-xl bg-white ${SHADOW_CARD}`}>
              <div className="p-4">
                <ActionHistory items={historyItems} />
              </div>
            </div>
          </section>
        </div>

        <DetailsPanel
            open={detailsId !== null}
            loading={detailsLoading}
            priority={activePriority}
            onClose={() => setDetailsId(null)}
            onPrimary={handleDetailsPrimary}
            onDismiss={dismissPriority}
        />

        <Toast message={toast} />
      </div>
  )
}