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

/* =========================================================================
   DERIVED LOGIC
   ========================================================================= */

function actionDestination(actionType) {
  if (actionType === 'restock' || actionType === 'expiry_alert') {
    return { label: 'Go to Ingredients', page: 'ingredients' }
  }
  return { label: 'Go to Menus', page: 'menus' }
}

function isCheckable(actionType) {
  return actionType === 'review_menu' || actionType === 'discount'
}

// Title extractor (menjadikan Title Case)
function toTitleCase(str) {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

// Fungsi untuk membaca format dari AI dan fallback jika pesan kosong
function parseActionData(a) {
  let title = a.message ? a.message.trim() : "Item";
  let summary = a.message ? a.message.trim() : "Tidak ada deskripsi dari AI.";
  
  let currentStock = a.current_stock !== undefined ? a.current_stock : null;
  let recommendedQty = a.recommended_qty !== undefined ? a.recommended_qty : null;
  let unit = a.unit || "";

  // 1. Cek apakah ini format data pakai pipa (|) untuk restock
  if (a.action_type === 'restock' && a.message && a.message.includes('|')) {
    const parts = a.message.split('|');
    if (parts.length >= 4) {
      title = parts[0].trim();
      currentStock = parseFloat(parts[1]) || 0;
      recommendedQty = parseFloat(parts[2]) || null;
      unit = parts[3].trim();
      summary = `Butuh restock ${title}`; // Deskripsi cadangan
    }
  } else {
    // 2. Fallback baca dari narasi teks
    if (currentStock === null && a.message) {
      // Deteksi angka dan unit setelah kata "negative", "is", atau "sisa"
      const stockMatch = a.message.match(/(?:negative\s*\(?|is\s*|sisa\s*)([-0-9.]+)\s*([a-zA-Z]+)?/i);
      if (stockMatch) {
        currentStock = parseFloat(stockMatch[1]);
        unit = stockMatch[2] || '';
      }
    }
    
    if (a.message) {
      let text = a.message.trim();
      text = text.replace(/^restock\s+/i, '');
      const match = text.match(/^(.+?)(?:\s+(?:immediately|as|because|since|current|has|is|margin|expires|needs|terlalu|hampir|akan|sisa|tinggal)\b|;|,|\.)/i);
      title = match ? match[1].trim() : text.split(' ').slice(0, 3).join(' ');
    }
  }

  // Jika tetap null/NaN, anggap 0 biar logic alert jalan
  if (currentStock === null || isNaN(currentStock)) currentStock = 0;

  // Bersihkan karakter aneh di akhir judul
  title = toTitleCase(title.replace(/[^a-zA-Z0-9 ]+$/, '').trim());

  return { title, summary, currentStock, recommendedQty, unit };
}

function mapBriefAction(a) {
  const dest = actionDestination(a.action_type)
  const typeLabel = String(a.action_type || '').replace(/_/g, ' ')
  const checkable = isCheckable(a.action_type)
  const parsed = parseActionData(a);

  const isZeroOrLess = parsed.currentStock <= 0;

  let finalTitle = parsed.title;
  if (a.action_type === 'restock') finalTitle = `Restock ${parsed.title}`;
  if (a.action_type === 'review_menu') finalTitle = `Review Harga ${parsed.title}`;
  if (a.action_type === 'discount') finalTitle = `Review Diskon ${parsed.title}`;
  if (a.action_type === 'expiry_alert') finalTitle = `Cek Expired ${parsed.title}`;

  return {
    id: a.id,
    kind: 'brief',
    refId: a.id,
    title: finalTitle,
    summary: parsed.summary,
    currentStock: parsed.currentStock,
    recommendedQty: parsed.recommendedQty, 
    unit: parsed.unit,
    isZeroOrLess,
    badge: {
      label: a.action_type === 'expiry_alert' ? 'Urgent' : `Action Needed`,
      tone: a.action_type === 'expiry_alert' ? 'critical' : 'warning',
    },
    checkable,
    actionLabel: checkable ? 'View details' : dest.label,
    recommendation: a.message || "Tidak ada rekomendasi spesifik.",
    reasoning: a.message || "Tidak ada detail yang diberikan oleh AI.",
    signals: [`Action type: ${typeLabel}`],
    suggestedAction: a.message || "Silakan cek halaman terkait untuk tindakan lebih lanjut.",
    gotoLabel: dest.label,
    gotoPage: dest.page,
  }
}

function mapHistoryItem(a) {
  const parsed = parseActionData(a);
  let finalTitle = parsed.title;
  if (a.action_type === 'restock') finalTitle = `Restock ${parsed.title}`;
  if (a.action_type === 'review_menu') finalTitle = `Review Harga ${parsed.title}`;
  if (a.action_type === 'discount') finalTitle = `Review Diskon ${parsed.title}`;
  if (a.action_type === 'expiry_alert') finalTitle = `Cek Expired ${parsed.title}`;

  return {
    id: a.id,
    title: finalTitle,
    summary: parsed.summary,
    kind: 'brief',
    actionTakenAt: a.acted_at,
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
function ReviewCard({ p, onToggle, onDetails }) {
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
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </a>
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
                <p className="text-sm text-[#5B6B82] truncate mt-0.5">{a.summary}</p>
                <p className="text-xs text-[#8B96A6] mt-1">Handled {fmtDateTime(a.actionTakenAt)}</p>
              </div>
            </div>
        ))}
      </div>
  )
}

/* =========================================================================
   RECOMMENDATION DETAIL PANEL
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
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
                    {p.title}
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

                <div className="rounded-lg bg-[#EAF1FB] px-4 py-3">
                  <p className="text-[11px] font-bold text-[#1E4278] uppercase tracking-wide mb-1">
                    Suggested action
                  </p>
                  <p className="text-sm text-[#18233D] font-medium">{p.suggestedAction}</p>
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

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      let briefData = null
      try {
        briefData = (await api.get('/briefs/today/')).data
      } catch (err) {
        if (err.response?.status === 404) {
          briefData = null 
        } else {
          throw err
        }
      }
      setBrief(briefData)

const today = new Date().toISOString().split('T')[0]
      const salesRes = await api.get(`/sales?date=${today}`).catch(() => null)
      
      if (salesRes && Array.isArray(salesRes.data)) {
        let totalRevenue = 0
        let totalVolume = salesRes.data.length // Jumlah struk/order

        // Looping untuk menjumlahkan semua harga item
        salesRes.data.forEach(sale => {
          if (Array.isArray(sale.items)) {
             sale.items.forEach(item => {
                 totalRevenue += (num(item.unit_price) * num(item.quantity))
             })
          }
        })

        setSalesToday({
          revenue: totalRevenue,
          volume: totalVolume,
          prevRevenue: null // Dikosongkan dulu karena butuh narik data H-1
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

  const allActions = brief?.actions || []
  
  const priorities = useMemo(() => {
    if (status !== 'ready') return []
    return allActions.filter((a) => a.status === 'pending').map(mapBriefAction)
  }, [status, allActions])

  const priceActions = useMemo(() => priorities.filter((p) => p.checkable), [priorities])
  
  const restockActions = useMemo(
      () => priorities.filter((p) => allActions.find((a) => a.id === p.id)?.action_type === 'restock'),
      [priorities, allActions],
  )

  const expiryActions = useMemo(
      () => priorities.filter((p) => allActions.find((a) => a.id === p.id)?.action_type === 'expiry_alert'),
      [priorities, allActions],
  )

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

  function goToAction(p) {
    if (onNavigate && p.gotoPage) onNavigate(p.gotoPage, p.refId)
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
                onClick={regenerateBrief}
                disabled={regenerating}
                className="text-xs font-semibold text-[#28579C] hover:text-[#1E4278] disabled:opacity-50"
            >
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start">
                
                {/* KOLOM KIRI: Review Menu & Discount + History */}
                <div className="space-y-8">
                  <section aria-labelledby="price-heading">
                    <p id="price-heading" className="text-xs font-semibold text-[#8B96A6] uppercase tracking-wide mb-3">
                      Review Price &amp; Discount
                    </p>
                    {priceActions.length > 0 ? (
                        <div className="space-y-2.5">
                          {priceActions.map((p) => (
                              <ReviewCard key={p.id} p={p} onToggle={togglePriority} onDetails={openDetails} />
                          ))}
                        </div>
                    ) : (
                        <p className="text-sm text-[#8B96A6]">No price or discount actions needed.</p>
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

                {/* KOLOM KANAN: Stock (Needs Restock) & Expiry */}
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