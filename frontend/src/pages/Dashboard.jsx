import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS
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

// DRF list endpoints bisa balikin array langsung ATAU object paginated
// {count, next, previous, results: [...]} tergantung setting pagination —
// helper ini nerima keduanya biar gak diam-diam kosong kalau backend
// pagination-nya nyala.
const extractList = (data) => {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.results)) return data.results
  return []
}

/* =========================================================================
   DERIVED LOGIC
   ========================================================================= */

// Brief actions are ONLY 'discount' | 'review_menu' now (backend sends
// clean structured title/message directly — no more text-parsing needed).
// Restock & expiry are NOT brief actions anymore; they come from live
// inventory endpoints (see fetchInventoryAlerts) and are handled separately.

function mapBriefAction(a) {
  return {
    id: a.id,
    kind: 'brief',
    refId: a.id,
    title: a.title,
    summary: a.message,
    badge: {
      label: a.action_type === 'discount' ? `Discount ${a.discount_pct ?? ''}%`.trim() : 'Review Price',
      tone: 'warning',
    },
    checkable: true,
    actionLabel: 'View details',
    recommendation: a.message,
    reasoning: a.message,
    signals: [
      a.discount_pct != null ? `Discount: ${a.discount_pct}%` : null,
      `Est. impact: ${rupiah(a.rupiah_impact)}`,
    ].filter(Boolean),
    suggestedAction: a.message,
    gotoLabel: 'Go to Menus',
    gotoPage: 'menus',
    refMenuId: a.related_menu,
  }
}

function mapHistoryItem(a) {
  return {
    id: a.id,
    title: a.title,
    summary: a.message,
    discountLabel: a.action_type === 'discount' && a.discount_pct != null ? `Diskon ${a.discount_pct}% diterapkan` : null,
    kind: 'brief',
    actionTakenAt: a.acted_at,
  }
}

// Live inventory alerts (NOT part of the 24h-gated brief — always fresh,
// no acted/dismissed status, not checklist-able).
function mapRestockItem(ing) {
  const currentStock = num(ing.current_stock)
  return {
    id: ing.id,
    refId: ing.id,
    title: ing.name,
    currentStock,
    recommendedQty: ing.recommended_restock_qty ?? null,
    unit: ing.unit || '',
    isZeroOrLess: currentStock <= 0,
    gotoPage: 'ingredients',
  }
}

function mapExpiryItem(ing) {
  return {
    id: ing.id,
    refId: ing.id,
    title: ing.name,
    summary: ing.expiry_date
        ? `Kadaluwarsa ${fmtDate(ing.expiry_date)}`
        : 'Segera kadaluwarsa',
    badge: { label: 'Urgent', tone: 'critical' },
    actionLabel: 'Go to Ingredients',
    gotoPage: 'ingredients',
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
      </div>
  )
}

// -------------------------------------------------------------------------
// Komponen Khusus Review/Discount
// -------------------------------------------------------------------------
function ReviewCard({ p, onToggle, onDismiss }) {
  return (
      <div
          className={`group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl bg-white px-4 sm:px-5 py-4 ${SHADOW_CARD} ${SHADOW_CARD_HOVER} transition-shadow`}
      >
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <button
              type="button"
              role="checkbox"
              aria-checked={p.completed}
              aria-label={`Mark ${p.title} as handled`}
              onClick={() => onToggle(p.id)}
              className={`w-5 h-5 mt-0.5 sm:mt-1 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center ${
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
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p
                className={`text-[15px] font-semibold ${
                    p.completed ? 'text-[#8B96A6] line-through' : 'text-[#18233D]'
                }`}
            >
              {p.title}
            </p>
            <p className="text-sm text-[#5B6B82] mt-0.5 leading-relaxed">{p.summary}</p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1.5 shrink-0 pl-9 sm:pl-0">
          <Badge label={p.badge.label} tone={p.badge.tone} />
          {!p.completed && (
              <button
                  type="button"
                  onClick={() => onDismiss(p.id)}
                  className="text-xs font-medium text-[#8B96A6] hover:text-[#5B6B82]"
              >
                Dismiss
              </button>
          )}
        </div>
      </div>
  )
}

// -------------------------------------------------------------------------
// Komponen Khusus Stock
// -------------------------------------------------------------------------
function StockCard({ p }) {
  const isZero = p.isZeroOrLess;
  const cardStyle = isZero 
    ? 'bg-[#FBEBEA] border border-[#FCA5A5]' 
    : 'bg-[#FEF6F6] border border-[#FEE2E2]';
  const textColor = isZero ? 'text-[#B8433B]' : 'text-[#DC2626]';
  
  const stockText = isZero ? 'Habis!' : `Sisa ${p.currentStock} ${p.unit}`.trim();

  return (
      <div
          className={`flex items-center justify-between gap-3 rounded-xl px-4 sm:px-5 py-4 ${cardStyle} ${SHADOW_CARD} transition-shadow`}
      >
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-[15px] font-bold text-[#18233D] truncate">
            {p.title}
          </p>
          {p.recommendedQty != null && (
            <p className="text-[13px] font-medium text-[#B8433B]/70 mt-0.5">
              Rekomendasi restock: {p.recommendedQty} {p.unit}
            </p>
          )}
        </div>
        <p className={`text-[15px] font-extrabold ${textColor} whitespace-nowrap shrink-0`}>
          {stockText}
        </p>
      </div>
  )
}

// -------------------------------------------------------------------------
// Komponen Khusus Expiry (Tidak dapat dicentang, hanya notifikasi & redirect)
// -------------------------------------------------------------------------
function ExpiryCard({ p, onGoto }) {
  return (
      <div className={`group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-xl bg-white px-4 sm:px-5 py-4 ${SHADOW_CARD} ${SHADOW_CARD_HOVER} transition-shadow`}>
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <span aria-hidden="true" className="w-5 h-5 mt-0.5 sm:mt-1 rounded-full shrink-0 flex items-center justify-center bg-[#FBEBEA] text-[#B8433B]">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 1 21h22L12 2zm0 6 6.5 11h-13L12 8zm-.9 3v4h1.8v-4h-1.8zm0 5.2v1.8h1.8v-1.8h-1.8z" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[#18233D]">
              {p.title}
            </p>
            <p className="text-sm text-[#5B6B82] mt-0.5 leading-relaxed">{p.summary}</p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1.5 shrink-0 pl-9 sm:pl-0">
          <Badge label={p.badge.label} tone={p.badge.tone} />
          <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                onGoto(p)
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
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </a>
        </div>
      </div>
  )
}

// -------------------------------------------------------------------------
// Komponen Item History (Bisa di-expand/collapse)
// -------------------------------------------------------------------------
function ActionHistoryItem({ a }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg bg-[#F7F5F0] overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#F0EDE6] transition-colors"
      >
        <p className="text-sm font-semibold text-[#18233D] truncate flex-1">
          {a.title}
        </p>
        {a.discountLabel && (
            <span className="shrink-0 text-xs font-semibold text-[#2E7D53] bg-[#EAF5EE] rounded-full px-2 py-0.5">
              {a.discountLabel}
            </span>
        )}
        {/* Ikon panah yang akan muter kalau diklik */}
        <svg
          className={`w-4 h-4 text-[#8B96A6] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      
      {/* Isi deskripsi yang muncul saat isOpen bernilai true */}
      {isOpen && (
        <div className="px-4 pb-3 pt-1 border-t border-[#E4E2DC]/60 mt-1">
          <p className="text-sm text-[#5B6B82] leading-relaxed">{a.summary}</p>
          <p className="text-[11px] font-medium text-[#8B96A6] mt-2">
            Handled {fmtDateTime(a.actionTakenAt)}
          </p>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Container History Utama
// -------------------------------------------------------------------------
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
            <ActionHistoryItem key={a.id} a={a} />
        ))}
      </div>
  )
}

/* =========================================================================
   TOAST
   ========================================================================= */

function Countdown({ target }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!target) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])

  if (!target) return null
  let diff = new Date(target).getTime() - now
  if (diff <= 0) return <>Ready to generate</>

  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const pad = (n) => String(n).padStart(2, '0')

  return <>Next in {pad(h)}:{pad(m)}:{pad(s)}</>
}

function Toast({ message }) {
  if (!message) return null
  return (
      <div
          className="fixed bottom-5 right-5 z-[70] max-w-xs rounded-lg bg-[#18233D] text-white px-4 py-3 shadow-lg text-sm font-medium"
          style={{ animation: 'fadeIn .15s ease-out' }}
      >
        {message}
      </div>
  )
}

/* =========================================================================
   PAGE
   ========================================================================= */

export default function Dashboard({ ownerName = 'there', onNavigate }) {
  const [status, setStatus] = useState('loading')
  const [brief, setBrief] = useState(null)
  const [regenerating, setRegenerating] = useState(false)
  const [salesToday, setSalesToday] = useState({ revenue: 0, volume: 0, prevRevenue: null })
  const [lowStock, setLowStock] = useState([])
  const [expiringSoon, setExpiringSoon] = useState([])
  const [canGenerateNow, setCanGenerateNow] = useState(true)
  const [nextGenerateAt, setNextGenerateAt] = useState(null)
  const [historyRaw, setHistoryRaw] = useState([])

  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      let briefData = null
      try {
        const res = await api.get('/briefs/today/')
        briefData = res.data
        setCanGenerateNow(res.data.can_generate_now ?? true)
        setNextGenerateAt(res.data.next_generate_at ?? null)
      } catch (err) {
        if (err.response?.status === 404) {
          briefData = null
          setCanGenerateNow(err.response.data?.can_generate_now ?? true)
          setNextGenerateAt(null)
        } else {
          throw err
        }
      }
      setBrief(briefData)

      // Restock & expiry are live inventory state, not part of the brief.
      const [lowStockRes, expiringRes] = await Promise.all([
        api.get('/ingredients/low-stock/').catch(() => null),
        api.get('/ingredients/expiring/?days=7').catch(() => null),
      ])
      setLowStock(Array.isArray(lowStockRes?.data) ? lowStockRes.data : [])
      const expiring = Array.isArray(expiringRes?.data) ? expiringRes.data : []
      expiring.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date)) // paling deket duluan
      setExpiringSoon(expiring)

      // GET /briefs/actions/ -> semua BriefAction berstatus 'acted' milik
      // business ini, LINTAS brief (bukan cuma brief hari ini) — biar
      // history gak hilang tiap kali brief baru di-generate.
      const historyRes = await api.get('/briefs/actions/').catch(() => null)
      setHistoryRaw(extractList(historyRes?.data))

      const today = new Date().toISOString().split('T')[0]
      const salesRes = await api.get(`/sales/?date=${today}`).catch(() => null)
      const salesList = extractList(salesRes?.data)

      if (salesList.length || salesRes) {
        let totalRevenue = 0
        const totalVolume = salesList.length // Jumlah struk/order

        salesList.forEach((sale) => {
          if (Array.isArray(sale.items)) {
            sale.items.forEach((item) => {
              totalRevenue += num(item.unit_price) * num(item.quantity)
            })
          }
        })

        setSalesToday({
          revenue: totalRevenue,
          volume: totalVolume,
          prevRevenue: null, // Dikosongkan dulu karena butuh narik data H-1
        })
      }
      // ==========================================

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
    }
  }

  async function loadHistory() {
    try {
      const res = await api.get('/briefs/actions/')
      setHistoryRaw(extractList(res.data))
    } catch (err) {
    }
  }

  async function generateBrief() {
    if (!canGenerateNow) {
      showToast('Brief baru bisa digenerate lagi setelah 24 jam sejak generate terakhir.')
      return
    }
    setRegenerating(true)
    try {
      const res = await api.post('/briefs/generate/')
      setBrief(res.data)
      setCanGenerateNow(false)
      setNextGenerateAt(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      showToast('Brief generated.')
    } catch (err) {
      if (err.response?.status === 429) {
        setCanGenerateNow(false)
        setNextGenerateAt(err.response.data?.next_available_at ?? null)
        showToast('Masih cooldown — brief terakhir belum genap 24 jam.')
      } else {
        showToast('Gagal generate brief.')
      }
    } finally {
      setRegenerating(false)
    }
  }

  const allActions = brief?.actions || []
  
  const priorities = useMemo(() => {
    if (status !== 'ready') return []
    return allActions.filter((a) => a.status === 'pending').map(mapBriefAction)
  }, [status, allActions])

  const priceActions = priorities // brief cuma isi discount + review_menu sekarang

  const restockActions = useMemo(() => lowStock.map(mapRestockItem), [lowStock])
  const expiryActions = useMemo(() => expiringSoon.map(mapExpiryItem), [expiringSoon])

  const historyItems = useMemo(() => historyRaw.map(mapHistoryItem), [historyRaw])

  const totalActions = allActions.length
  const handledCount = allActions.filter((a) => a.status === 'acted').length
  const openCount = priceActions.length + restockActions.length + expiryActions.length

  const trendPct =
      salesToday.prevRevenue != null && salesToday.prevRevenue > 0
          ? ((salesToday.revenue - salesToday.prevRevenue) / salesToday.prevRevenue) * 100
          : null

  async function updateActionStatus(id, newStatus, toastMsg) {
    try {
      await api.patch(`/briefs/actions/${id}/`, { status: newStatus })
      await refreshBrief()
      await loadHistory()
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

  function goToAction(p) {
    if (onNavigate && p.gotoPage) onNavigate(p.gotoPage, p.refId)
  }

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
          <div className="relative max-w-[960px] mx-auto">
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

        <div className="max-w-[960px] mx-auto px-4 sm:px-6 md:px-10 pb-10">
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

          {/* ============ MAIN LAYOUT (2 COLUMNS) ============ */}
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[13px] font-bold text-[#18233D] uppercase tracking-wide">
              Today's Priorities
            </h2>
            <button
                type="button"
                onClick={generateBrief}
                disabled={regenerating || !canGenerateNow}
                title={!canGenerateNow && nextGenerateAt ? `Bisa lagi setelah ${fmtDateTime(nextGenerateAt)}` : undefined}
                className="text-xs font-semibold text-[#28579C] hover:text-[#1E4278] disabled:opacity-50"
            >
              {regenerating
                  ? 'Generating…'
                  : !canGenerateNow
                      ? <Countdown target={nextGenerateAt} />
                      : 'Regenerate'}
            </button>
          </div>

          {status === 'loading' && (
              <div className="space-y-2.5" aria-hidden="true">
                <SkeletonPriority />
                <SkeletonPriority wide />
              </div>
          )}

          {status === 'error' && (
              <div className={`rounded-xl bg-white px-5 py-6 text-center ${SHADOW_CARD}`}>
                <p className="text-sm font-semibold text-[#18233D]">Couldn't load today's data.</p>
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

          {status === 'ready' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start">

                {/* KOLOM KIRI: Review Menu & Discount (brief, 24h cooldown) + History */}
                <div className="space-y-8">
                  <section aria-labelledby="price-heading">
                    <p id="price-heading" className="text-xs font-semibold text-[#8B96A6] uppercase tracking-wide mb-3">
                      Review Price &amp; Discount
                    </p>
                    {priceActions.length > 0 ? (
                        <div className="space-y-2.5">
                          {priceActions.map((p) => (
                              <ReviewCard key={p.id} p={p} onToggle={togglePriority} onDismiss={dismissPriority} />
                          ))}
                        </div>
                    ) : (
                        <div className={`rounded-xl bg-white px-5 py-6 text-center ${SHADOW_CARD}`}>
                          <p className="text-sm font-semibold text-[#18233D]">
                            {brief ? 'Nothing urgent today.' : "Today's brief hasn't been generated yet."}
                          </p>
                          <p className="text-sm text-[#5B6B82] mt-1">
                            {brief
                                ? 'Stokita will surface new price/discount actions here as soon as something needs your attention.'
                                : 'Generate it to see AI-ranked pricing recommendations for today.'}
                          </p>
                          {!brief && (
                              <button
                                  type="button"
                                  onClick={generateBrief}
                                  disabled={regenerating || !canGenerateNow}
                                  className="mt-3 text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-4 py-2 disabled:opacity-50"
                              >
                                {regenerating
                                    ? 'Generating…'
                                    : !canGenerateNow
                                        ? <Countdown target={nextGenerateAt} />
                                        : "Generate today's brief"}
                              </button>
                          )}
                        </div>
                    )}
                  </section>

                  <section aria-labelledby="action-history-heading">
                    <p id="action-history-heading" className="text-xs font-semibold text-[#8B96A6] uppercase tracking-wide mb-3">
                      Action History
                    </p>
                    <div className={`rounded-xl bg-white ${SHADOW_CARD}`}>
                      <div className="p-4">
                        <ActionHistory items={historyItems} />
                      </div>
                    </div>
                  </section>
                </div>

                {/* KOLOM KANAN: Stock (Needs Restock) & Expiry — LIVE, bukan bagian brief, gak kena cooldown */}
                <div className="space-y-8">
                  <section aria-labelledby="stock-heading">
                    <div className="flex items-center justify-between mb-3">
                      <p id="stock-heading" className="text-xs font-semibold text-[#8B96A6] uppercase tracking-wide">
                        Stock — Needs Restock
                      </p>
                      <button
                          type="button"
                          onClick={() => onNavigate && onNavigate('ingredients')}
                          className="text-xs font-semibold text-[#28579C] hover:text-[#1E4278] underline decoration-[#28579C]/30 underline-offset-2"
                      >
                        Go to Restock →
                      </button>
                    </div>

                    {restockActions.length > 0 ? (
                        <div className="space-y-2.5">
                          {restockActions.map((p) => (
                              <StockCard key={p.id} p={p} />
                          ))}
                        </div>
                    ) : (
                        <p className="text-sm text-[#8B96A6]">Stock is looking good.</p>
                    )}
                  </section>

                  <section aria-labelledby="expiry-heading">
                    <p id="expiry-heading" className="text-xs font-semibold text-[#8B96A6] uppercase tracking-wide mb-3">
                      Stock — Expiry Alerts
                    </p>
                    {expiryActions.length > 0 ? (
                        <div className="space-y-2.5">
                          {expiryActions.map((p) => (
                              <ExpiryCard key={p.id} p={p} onGoto={goToAction} />
                          ))}
                        </div>
                    ) : (
                        <p className="text-sm text-[#8B96A6]">No upcoming expiry.</p>
                    )}
                  </section>
                </div>
                
              </div>
          )}
        </div>


        <Toast message={toast} />
      </div>
  )
}