import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS — sama persis dengan Sidebar.jsx / IngredientsPage.jsx /
   MenusPage.jsx / SalesPage.jsx / ProfitPage.jsx, biar Dashboard kerasa
   satu produk yang sama, bukan halaman yang di-desain terpisah.
   ========================================================================= */

const SHADOW_CARD =
  'shadow-[0_2px_6px_rgba(24,35,61,0.06),0_10px_24px_-8px_rgba(24,35,61,0.22)]'
const SHADOW_FLOAT =
  'shadow-[0_14px_32px_-10px_rgba(20,29,52,0.28),0_2px_8px_rgba(20,29,52,0.08)]'

const BTN_PRIMARY =
  'text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed'
const LINK_BRAND =
  'text-xs font-semibold text-[#28579C] hover:text-[#1E4278] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

// Satu token dipake di SEMUA row (PriorityRow/StockRow/ExpiryRow/
// ActionHistoryItem) buat judul/nama — sebelumnya masing-masing row nulis
// class string sendiri-sendiri, dan `truncate` cuma ada di sebagian row,
// jadi nama yang panjang kepotong beda-beda antar card (kesannya kayak
// ukuran font-nya beda padahal sama-sama text-sm).
const ROW_TITLE = 'text-sm font-semibold text-[#18233D] truncate'
const ROW_SUBTEXT = 'text-xs text-[#5B6B82] mt-0.5'

const HISTORY_LIMIT = 5

const TONE_BADGE = {
  critical: 'text-[#B8433B] bg-[#FBEBEA]',
  warning: 'text-[#A2670C] bg-[#FCF3E2]',
  success: 'text-[#2E7D53] bg-[#EAF5EE]',
  neutral: 'text-[#8B96A6] bg-[#F7F5F0]',
}

/* =========================================================================
   ICONS — inline SVG, stroke-based (sama konvensi kayak Sidebar.jsx /
   IngredientsPage.jsx / MenusPage.jsx / SalesPage.jsx).
   ========================================================================= */
const ic = {
  className: 'w-4 h-4', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}
const IconPlus = (p) => (
  <svg {...ic} {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
)
const IconWallet = (p) => (
  <svg {...ic} {...p}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
)
const IconBag = (p) => (
  <svg {...ic} {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
)
const IconChecklist = (p) => (
  <svg {...ic} {...p}><path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
)
const IconAlertTriangle = (p) => (
  <svg {...ic} {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
)
const IconClock = (p) => (
  <svg {...ic} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
)
const IconPackage = (p) => (
  <svg {...ic} {...p}><path d="M21 8V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v3" /><path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M10 12h4" /></svg>
)
const IconTag = (p) => (
  <svg {...ic} {...p}><path d="M12.6 2.6 21 11l-8.4 8.4a2 2 0 0 1-2.8 0L3 12.6V4a1.4 1.4 0 0 1 1.4-1.4h8.2z" /><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" /></svg>
)
const IconHistory = (p) => (
  <svg {...ic} {...p}><path d="M3 12a9 9 0 1 0 2.6-6.3L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>
)

/* =========================================================================
   UTILITIES
   ========================================================================= */

const rupiah = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID')

const fmtDate = (d) => {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d)
  return dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
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

// Nama ingredient di database gak konsisten casing-nya (ada yang "ayam
// potong" huruf kecil semua, ada yang "Ayam Potong") tergantung gimana
// staff ngetiknya pas nambahin bahan — dinormalisasi ke Title Case di sini
// biar tampilannya konsisten di seluruh Dashboard, gak peduli isi aslinya.
const toTitleCase = (str) =>
  String(str || '').toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())

// DRF list endpoints bisa balikin array langsung ATAU object paginated
// {count, next, previous, results: [...]} tergantung setting pagination —
// helper ini nerima keduanya biar tidak diam-diam kosong kalau backend
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
      label: a.action_type === 'discount' ? `Diskon ${a.discount_pct ?? ''}%`.trim() : 'Review Harga',
      tone: 'warning',
    },
    checkable: true,
    actionLabel: 'Lihat detail',
    recommendation: a.message,
    reasoning: a.message,
    // dulu dihitung tapi gak pernah ditampilin di mana pun — sekarang
    // dipakai PriorityRow biar tiap baris kerasa ada "isinya", bukan cuma
    // judul+deskripsi doang.
    impact: a.rupiah_impact ? rupiah(a.rupiah_impact) : null,
    signals: [
      a.discount_pct != null ? `Diskon: ${a.discount_pct}%` : null,
      `Estimasi dampak: ${rupiah(a.rupiah_impact)}`,
    ].filter(Boolean),
    suggestedAction: a.message,
    gotoLabel: 'Ke halaman Menu',
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
    impact: a.rupiah_impact ? rupiah(a.rupiah_impact) : null,
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
    title: toTitleCase(ing.name),
    currentStock,
    recommendedQty: ing.recommended_restock_qty != null ? num(ing.recommended_restock_qty) : null,
    unit: ing.unit || '',
    isZeroOrLess: currentStock <= 0,
    gotoPage: 'ingredients',
  }
}

function mapExpiryItem(ing) {
  // tone 'warning' (bukan 'critical') sengaja — buat owner, kehabisan stok
  // jauh lebih mendesak daripada bahan mau kadaluwarsa: mending rugi kecil
  // kebuang daripada pelanggan kecewa gara-gara stok abis. Jadi Peringatan
  // Kadaluwarsa gak boleh "berteriak" sama kerasnya kayak Perlu Restock.
  return {
    id: ing.id,
    refId: ing.id,
    title: toTitleCase(ing.name),
    summary: ing.expiry_date
      ? `Kadaluwarsa ${fmtDate(ing.expiry_date)}`
      : 'Segera kadaluwarsa',
    badge: { label: 'Segera', tone: 'warning' },
    actionLabel: 'Ke halaman Stok',
    gotoPage: 'ingredients',
  }
}

/* =========================================================================
   SMALL PRESENTATIONAL PIECES
   ========================================================================= */

function StatusBadge({ tone, label }) {
  return (
    <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${TONE_BADGE[tone] || TONE_BADGE.neutral}`}>
      {label}
    </span>
  )
}

function Trend({ pct, tooltip }) {
  if (pct === null || pct === undefined || !isFinite(pct)) {
    return (
      <span className="text-xs text-[#8B96A6]" title={tooltip}>—</span>
    )
  }
  const up = pct >= 0
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? TONE_BADGE.success : TONE_BADGE.critical
        } rounded px-1.5 py-0.5 cursor-help`}
    >
      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {up ? <path d="M12 4l8 10h-6v6h-4v-6H4z" /> : <path d="M12 20 4 10h6V4h4v6h6z" />}
      </svg>
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

/* =========================================================================
   STAT STRIP — sama pattern kayak StatCell di IngredientsPage.jsx (ikon
   dalam kotak brand-tinted + label kecil + angka besar), biar 3 halaman
   pertama yang dibuka user (Hari Ini, Stock, Menu) kerasa satu sistem.
   ========================================================================= */
function StatCell({ icon, label, value, sub, trend, tone = 'neutral' }) {
  const valueColor =
    tone === 'warning' ? 'text-[#A2670C]' : tone === 'critical' ? 'text-[#B8433B]' : 'text-[#18233D]'
  return (
    <div className="flex items-center gap-3.5 px-6 py-4">
      <div className="w-10 h-10 rounded-lg bg-[#1E4278] text-white flex items-center justify-center shrink-0 shadow-[0_2px_6px_rgba(30,66,120,0.35)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#5B6B82] uppercase tracking-wide">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className={`text-xl font-extrabold tabular-nums ${valueColor}`}>{value}</p>
          {trend}
        </div>
        {sub && <p className="text-[11px] text-[#8B96A6] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="w-5 h-5 rounded-full bg-[#F0EEE8] shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 w-40 rounded bg-[#F0EEE8]" />
        <div className="h-3 w-56 rounded bg-[#F0EEE8]" />
      </div>
      <div className="h-5 w-16 rounded-full bg-[#F0EEE8] shrink-0" />
    </div>
  )
}

// -------------------------------------------------------------------------
// Empty state — ikon dalam lingkaran + judul + deskripsi, sama persis
// pattern yang dipake IngredientsPage/MenusPage buat tabel kosong. Dipake
// biar card kosong gak cuma satu baris teks abu-abu doang.
// -------------------------------------------------------------------------
function EmptyState({ icon, title, body, action }) {
  return (
    <div className="py-9 px-6 text-center">
      <div className="w-11 h-11 rounded-full bg-[#F7F5F0] flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <p className="text-sm font-semibold text-[#18233D]">{title}</p>
      {body && <p className="text-sm text-[#5B6B82] mt-1 max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/* =========================================================================
   CARD SECTION — satu shell dipake ulang buat semua 4 daftar (Review
   Harga & Diskon, Riwayat Aksi, Stok Perlu Restock, Peringatan
   Kadaluwarsa), sama persis pattern "white card, header + divide-y rows"
   yang dipake Restock Recommendation / Expiry Alerts di IngredientsPage.
   ========================================================================= */
function CardSection({ title, count, subtitle, action, children, empty, loading }) {
  return (
    <section className={`bg-white rounded-2xl ${SHADOW_CARD} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#E4E2DC]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-[#18233D]">{title}</h2>
            {count != null && count > 0 && (
              <span className="text-xs font-semibold text-[#8B96A6] bg-[#F7F5F0] rounded-full px-2 py-0.5 tabular-nums">{count}</span>
            )}
          </div>
          {subtitle && <p className="text-xs text-[#8B96A6] mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {loading ? (
        <div className="animate-pulse divide-y divide-[#E4E2DC]">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : empty ? (
        empty
      ) : (
        <div className="divide-y divide-[#E4E2DC]">{children}</div>
      )}
    </section>
  )
}

// -------------------------------------------------------------------------
// Row: Review Menu & Discount (checkable — bagian dari brief, 24h cooldown)
// -------------------------------------------------------------------------
function PriorityRow({ p, onToggle, onDismiss }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#F7F5F0]/70 transition-colors">
      <button
        type="button"
        role="checkbox"
        aria-checked={p.completed}
        aria-label={`Tandai ${p.title} sebagai selesai`}
        onClick={() => onToggle(p.id)}
        className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center ${p.completed ? 'bg-[#2E7D53] border-[#2E7D53]' : 'border-[#CBD1DB] hover:border-[#28579C]'
          }`}
      >
        {p.completed && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${p.completed ? 'text-[#8B96A6] line-through' : 'text-[#18233D]'}`}>
          {p.title}
        </p>
        <p className={`${ROW_SUBTEXT} leading-relaxed`}>{p.summary}</p>
        {p.impact && !p.completed && (
          <p className="text-xs font-semibold text-[#2E7D53] mt-1">Estimasi dampak: {p.impact}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge label={p.badge.label} tone={p.badge.tone} />
        {!p.completed && (
          <button
            type="button"
            onClick={() => onDismiss(p.id)}
            className="text-xs font-medium text-[#8B96A6] hover:text-[#5B6B82] transition-colors"
          >
            Abaikan
          </button>
        )}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Row: Stock — severity ditunjukkin lewat warna teks (sama kayak tabel
// stok di IngredientsPage), bukan background card berwarna.
// -------------------------------------------------------------------------
function StockRow({ p }) {
  const isZero = p.isZeroOrLess
  const textColor = isZero ? 'text-[#B8433B]' : 'text-[#A2670C]'
  const stockText = isZero ? 'Habis' : `Sisa ${p.currentStock} ${p.unit}`.trim()

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#F7F5F0]/70 transition-colors">
      <IconAlertTriangle className={`w-4 h-4 shrink-0 ${textColor}`} />
      <div className="flex-1 min-w-0">
        <p className={ROW_TITLE}>{p.title}</p>
        {p.recommendedQty != null && (
          <p className={ROW_SUBTEXT}>
            Rekomendasi restock: {p.recommendedQty} {p.unit}
          </p>
        )}
      </div>
      <p className={`text-sm font-bold tabular-nums whitespace-nowrap shrink-0 ${textColor}`}>{stockText}</p>
    </div>
  )
}

// -------------------------------------------------------------------------
// Row: Expiry (gak bisa dicentang, cuma notifikasi & redirect)
// -------------------------------------------------------------------------
function ExpiryRow({ p, onGoto }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#F7F5F0]/70 transition-colors">
      <IconClock className="w-4 h-4 text-[#A2670C] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={ROW_TITLE}>{p.title}</p>
        <p className={ROW_SUBTEXT}>{p.summary}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge label={p.badge.label} tone={p.badge.tone} />
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); onGoto(p) }}
          className="flex items-center gap-1 text-xs font-semibold text-[#28579C] hover:text-[#1E4278] transition-colors"
        >
          {p.actionLabel}
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Row: History item — selalu kebuka penuh, gak perlu diklik buat baca.
// -------------------------------------------------------------------------
function ActionHistoryItem({ a }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <svg className="w-4 h-4 text-[#2E7D53] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className={`${ROW_TITLE} min-w-0`}>{a.title}</p>
          {a.discountLabel && <StatusBadge label={a.discountLabel} tone="success" />}
        </div>
        <p className={`${ROW_SUBTEXT} leading-relaxed`}>{a.summary}</p>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1">
          <p className="text-xs text-[#8B96A6]">Ditangani {fmtDateTime(a.actionTakenAt)}</p>
          {a.impact && <p className="text-xs font-semibold text-[#2E7D53]">Dampak: {a.impact}</p>}
        </div>
      </div>
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
  if (diff <= 0) return <>Siap digenerate</>

  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const pad = (n) => String(n).padStart(2, '0')

  return <>Bisa lagi dalam {pad(h)}:{pad(m)}:{pad(s)}</>
}

function Toast({ message }) {
  if (!message) return null
  return (
    <div
      className={`fixed bottom-5 right-5 z-[70] max-w-xs rounded-lg bg-[#18233D] text-white px-4 py-3 ${SHADOW_FLOAT} text-sm font-medium`}
      style={{ animation: 'fadeIn .15s ease-out' }}
    >
      {message}
    </div>
  )
}

/* =========================================================================
   PAGE
   ========================================================================= */

export default function Dashboard({ ownerName = 'Bos', onNavigate }) {
  const [status, setStatus] = useState('loading')
  const [brief, setBrief] = useState(null)
  const [regenerating, setRegenerating] = useState(false)
  const [salesToday, setSalesToday] = useState({ revenue: 0, volume: 0, orders: 0, prevRevenue: null })
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
      // history tidak hilang tiap kali brief baru di-generate.
      const historyRes = await api.get('/briefs/actions/').catch(() => null)
      setHistoryRaw(extractList(historyRes?.data))

      const today = new Date().toISOString().split('T')[0]
      const salesRes = await api.get(`/sales/?date=${today}`).catch(() => null)
      const salesList = extractList(salesRes?.data)

      if (salesList.length || salesRes) {
        let totalRevenue = 0
        let totalItemsSold = 0
        const totalOrders = salesList.length // jumlah transaksi/log yang disubmit

        salesList.forEach((sale) => {
          if (Array.isArray(sale.items)) {
            sale.items.forEach((item) => {
              totalRevenue += num(item.unit_price) * num(item.quantity)
              totalItemsSold += num(item.quantity) // jumlah menu yang beneran kejual
            })
          }
        })

        setSalesToday({
          revenue: totalRevenue,
          volume: totalItemsSold,
          orders: totalOrders,
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
      showToast('Brief berhasil digenerate.')
    } catch (err) {
      if (err.response?.status === 429) {
        setCanGenerateNow(false)
        setNextGenerateAt(err.response.data?.next_available_at ?? null)
        showToast('Masih cooldown, brief terakhir belum genap 24 jam.')
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
  // Dashboard cuma butuh "apa yang baru ditangani", bukan audit log lengkap
  // — dibatesin biar gak numpuk di kartu yang paling gak prioritas di
  // halaman ini (lihat HISTORY_LIMIT).
  const visibleHistoryItems = historyItems.slice(0, HISTORY_LIMIT)

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
    updateActionStatus(id, 'acted', 'Ditandai selesai.')
  }

  function dismissPriority(id) {
    updateActionStatus(id, 'dismissed', 'Diabaikan untuk sekarang.')
  }

  function goToAction(p) {
    if (onNavigate && p.gotoPage) onNavigate(p.gotoPage, p.refId)
  }

  const regenerateLabel = regenerating
    ? 'Membuat…'
    : !canGenerateNow
      ? <Countdown target={nextGenerateAt} />
      : 'Generate Ulang'

  // ownerName bisa '' (bukan cuma undefined) kalau full_name belum diisi
  // sama sekali di akun — default param aja gak nolong buat kasus itu,
  // jadi divalidasi manual biar gak nyisain "Selamat pagi," nge-gantung
  // tanpa nama.
  const firstName = String(ownerName || '').trim().split(' ')[0]
  const greeting = firstName ? `Selamat pagi, ${firstName}` : 'Selamat pagi!'

  return (
    <div className="max-w-5xl mx-auto">
      <style>{`@keyframes fadeIn { from { opacity:0; transform: translateY(2px);} to { opacity:1; transform:none;} }`}</style>

      {/* ============ HERO — dark navy, tanggal+greeting+subtitle digabung
          jadi satu, gak dipecah-pecah. ============ */}
      <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(155deg,#243559_0%,#131C33_100%)] px-6 sm:px-8 pt-7 pb-14">
        <p className="text-sm text-white/50 font-medium mb-1.5">{fmtDate(new Date())}</p>
        <h1 className="text-[24px] sm:text-[27px] font-extrabold tracking-tight text-white">
          {greeting}
        </h1>
        <p className="text-sm text-white/70 mt-2.5 max-w-xl leading-relaxed">
          {status === 'loading' ? (
            'Memuat brief hari ini…'
          ) : openCount === 0 ? (
            <>Semua udah beres, <span className="text-white font-semibold">gak ada prioritas yang perlu ditangani</span> sekarang.</>
          ) : (
            <><span className="text-white font-semibold">{openCount} item</span> butuh perhatian kamu hari ini.</>
          )}
        </p>
      </div>

      {/* ============ TICKET CARD — ngambang di atas hero (negative margin),
          isi stat Sales/Items/Prioritas + CTA catat penjualan di footer-nya,
          dipisahin garis putus-putus kayak sobekan tiket. ============ */}
      <div className={`relative -mt-8 mb-8 rounded-2xl bg-white ${SHADOW_FLOAT} ring-1 ring-white/60 overflow-hidden`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 divide-[#E4E2DC] sm:divide-x">
          <StatCell
            icon={<IconWallet className="w-4 h-4" />}
            label="Penjualan Hari Ini"
            value={rupiah(salesToday.revenue)}
            trend={<Trend pct={trendPct} tooltip="Dibanding periode yang sama kemarin" />}
          />
          <StatCell
            icon={<IconBag className="w-4 h-4" />}
            label="Item Terjual Hari Ini"
            value={salesToday.volume}
            sub={`${salesToday.orders} transaksi tercatat`}
          />
          <StatCell
            icon={<IconChecklist className="w-4 h-4" />}
            label="Prioritas"
            tone={status !== 'loading' && totalActions > 0 && openCount > 0 ? 'warning' : 'neutral'}
            value={
              status === 'loading' ? (
                '—'
              ) : totalActions === 0 ? (
                <span className="text-sm font-semibold text-[#2E7D53]">Semua Beres</span>
              ) : (
                <>
                  {handledCount}
                  <span className="text-sm font-medium text-[#8B96A6]">/{totalActions}</span>{' '}
                  <span className={`text-sm font-semibold ${openCount === 0 ? 'text-[#2E7D53]' : 'text-[#A2670C]'}`}>
                    selesai
                  </span>
                </>
              )
            }
          />
        </div>

        <div className="relative" aria-hidden="true">
          <div className="border-t-2 border-dashed border-[#CBD1DB]" />
          <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#F7F5F0]" />
          <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#F7F5F0]" />
        </div>

        <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 bg-[#F7F5F0]/60 px-4 sm:px-6 py-3">
          <p className="text-sm text-[#5B6B82]">
            <span className="text-[#18233D] font-semibold">Catat penjualan hari ini begitu terjadi.</span>{' '}
            Biar data revenue dan pemakaian stok tetap akurat.
          </p>
          <button
            type="button"
            onClick={() => (onNavigate ? onNavigate('sales') : showToast('Sambungkan ke halaman Record Sales di sini.'))}
            className={`shrink-0 ${BTN_PRIMARY}`}
          >
            <span className="inline-flex items-center gap-1.5"><IconPlus className="w-4 h-4" /> Catat Penjualan</span>
          </button>
        </div>
      </div>

      {status === 'error' ? (
        <div className={`rounded-2xl bg-white px-5 py-8 text-center ${SHADOW_CARD}`}>
          <p className="text-sm font-semibold text-[#18233D]">Gagal memuat data hari ini.</p>
          <p className="text-sm text-[#5B6B82] mt-1">Cek koneksi kamu dan coba lagi.</p>
          <button type="button" onClick={load} className={`${BTN_PRIMARY} mt-4`}>
            Coba Lagi
          </button>
        </div>
      ) : (
        <>
          {/* ============ STOK & PERLU RESTOCK — prioritas #1 owner, jadi
              section pertama & paling menonjol di halaman (full-width,
              ikon+count di header), bukan diselipin di kolom kanan. ============ */}
          <div className="mb-8">
            <CardSection
              title="Stok Perlu Restock"
              count={restockActions.length}
              subtitle="Kehabisan stok lebih mahal daripada rugi kecil, restock duluan."
              loading={status === 'loading'}
              action={
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('ingredients')}
                  className={LINK_BRAND}
                >
                  Ke halaman Stok →
                </button>
              }
              empty={status === 'loading' ? null : restockActions.length === 0 ? (
                <EmptyState
                  icon={<IconPackage className="w-5 h-5 text-[#8B96A6]" />}
                  title="Stok kamu aman"
                  body="Gak ada bahan yang perlu direstock sekarang. Kita bakal langsung kasih tau begitu ada yang mulai menipis."
                />
              ) : null}
            >
              {restockActions.map((p) => (
                <StockRow key={p.id} p={p} />
              ))}
            </CardSection>
          </div>

          {/* ============ SISANYA — 1 kolom, ditumpuk atas-bawah ============ */}
          <div className="space-y-6">
            <CardSection
              title="Review Harga & Diskon"
              count={priceActions.length}
              subtitle="Rekomendasi AI berdasarkan margin menu & bahan yang mau kadaluwarsa."
              loading={status === 'loading'}
              action={
                <button
                  type="button"
                  onClick={generateBrief}
                  disabled={regenerating || !canGenerateNow}
                  title={!canGenerateNow && nextGenerateAt ? `Bisa lagi setelah ${fmtDateTime(nextGenerateAt)}` : undefined}
                  className={LINK_BRAND}
                >
                  {regenerateLabel}
                </button>
              }
              empty={
                status === 'loading' || priceActions.length > 0 ? null : (
                  <EmptyState
                    icon={<IconTag className="w-5 h-5 text-[#8B96A6]" />}
                    title={brief ? 'Gak ada yang urgent hari ini' : 'Brief hari ini belum digenerate'}
                    body={
                      brief
                        ? 'Stokita bakal nampilin aksi harga/diskon baru di sini begitu ada yang butuh perhatian kamu.'
                        : 'Generate buat liat rekomendasi harga dari AI, berdasarkan margin menu & bahan yang mau kadaluwarsa.'
                    }
                    action={
                      !brief && (
                        <button
                          type="button"
                          onClick={generateBrief}
                          disabled={regenerating || !canGenerateNow}
                          className={BTN_PRIMARY}
                        >
                          {regenerateLabel === 'Generate Ulang' ? 'Generate brief hari ini' : regenerateLabel}
                        </button>
                      )
                    }
                  />
                )
              }
            >
              {priceActions.map((p) => (
                <PriorityRow key={p.id} p={p} onToggle={togglePriority} onDismiss={dismissPriority} />
              ))}
            </CardSection>

            {/* Expiry — LIVE, bukan bagian brief, gak kena cooldown. Tone-nya
                sengaja lebih adem dari Perlu Restock (lihat mapExpiryItem). */}
            <CardSection
              title="Peringatan Kadaluwarsa Stok"
              count={expiryActions.length}
              subtitle="Bahan yang bakal kadaluwarsa dalam 7 hari ke depan."
              loading={status === 'loading'}
              empty={status === 'loading' ? null : expiryActions.length === 0 ? (
                <EmptyState
                  icon={<IconClock className="w-5 h-5 text-[#8B96A6]" />}
                  title="Gak ada yang mau kadaluwarsa"
                  body="Semua bahan yang restock-nya punya tanggal kadaluwarsa masih aman buat 7 hari ke depan."
                />
              ) : null}
            >
              {expiryActions.map((p) => (
                <ExpiryRow key={p.id} p={p} onGoto={goToAction} />
              ))}
            </CardSection>

            <CardSection
              title="Riwayat Aksi"
              count={historyItems.length}
              subtitle={
                historyItems.length > HISTORY_LIMIT
                  ? `Menampilkan ${HISTORY_LIMIT} paling baru dari ${historyItems.length} total`
                  : 'Rekomendasi yang udah kamu tandai selesai atau diabaikan.'
              }
              loading={status === 'loading'}
              empty={
                status === 'loading' || visibleHistoryItems.length > 0 ? null : (
                  <EmptyState
                    icon={<IconHistory className="w-5 h-5 text-[#8B96A6]" />}
                    title="Belum ada aksi yang tercatat"
                    body="Begitu kamu tandai rekomendasi harga/diskon sebagai selesai, riwayatnya bakal muncul di sini."
                  />
                )
              }
            >
              {visibleHistoryItems.map((a) => (
                <ActionHistoryItem key={a.id} a={a} />
              ))}
            </CardSection>
          </div>
        </>
      )}

      <Toast message={toast} />
    </div>
  )
}
