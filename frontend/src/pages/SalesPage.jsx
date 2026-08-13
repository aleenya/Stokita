import { useState, useEffect, useRef } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS — sama persis dengan Dashboard.jsx / Sidebar.jsx / lain-lain.
   ========================================================================= */
const SHADOW_CARD =
  'shadow-[0_2px_6px_rgba(24,35,61,0.06),0_10px_24px_-8px_rgba(24,35,61,0.22)]'
const SHADOW_FLOAT =
  'shadow-[0_14px_32px_-10px_rgba(20,29,52,0.28),0_2px_8px_rgba(20,29,52,0.08)]'

const LABEL = 'block text-xs uppercase tracking-wide text-[#8B96A6] mb-1.5'
const INPUT =
  'w-full border border-[#E4E2DC] rounded-md px-3 py-2 text-sm text-[#18233D] placeholder:text-[#8B96A6] focus:outline-none focus:ring-2 focus:ring-[#28579C]/25 focus:border-[#28579C] transition-colors'
const BTN_PRIMARY =
  'text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'text-sm font-semibold text-[#5B6B82] border border-[#E4E2DC] rounded-full px-5 py-2.5 hover:bg-[#F7F5F0] transition-colors disabled:opacity-50'
const LINK_BRAND = 'text-[#28579C] hover:text-[#1E4278] transition-colors'
const LINK_MUTED = 'text-[#5B6B82] hover:text-[#18233D] transition-colors'
const LINK_CRITICAL = 'text-[#B8433B] hover:text-[#8F332C] transition-colors'
const ERROR_BANNER = 'text-sm text-[#B8433B] bg-[#FBEBEA] rounded-md px-3 py-2'
const SUCCESS_BANNER = 'text-sm text-[#2E7D53] bg-[#EAF5EE] rounded-md px-3 py-2'

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
const IconPlus = (p) => (
  <svg {...ic} {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
)
const IconX = (p) => (
  <svg {...ic} {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
)
const IconUploadCloud = (p) => (
  <svg {...ic} {...p}><path d="M4 14.9A5 5 0 0 1 6 5.3 6 6 0 0 1 17.7 7 4.5 4.5 0 0 1 18 16" /><path d="M12 12v9" /><path d="m8 17 4-4 4 4" /></svg>
)
const IconTable = (p) => (
  <svg {...ic} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="10" x2="9" y2="20" /></svg>
)
const IconTrash = (p) => (
  <svg {...ic} {...p}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
)
const IconReceipt = (p) => (
  <svg {...ic} {...p}><path d="M4 3h16v18l-3-2-2 2-2-2-2 2-2-2-2 2-3-2Z" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
)

/* =========================================================================
   HELPERS
   ========================================================================= */
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function menuNormalPrice(menus, id) {
  return Number(menus.find((m) => m.id === id)?.sell_price) || null
}

function formatRupiah(n) {
  return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID')
}

function extractError(err) {
  return flattenErrorData(err.response?.data)
}

function flattenErrorData(data) {
  // DRF nested serializers (RecordSaleSerializer.items is a list of
  // SaleItemInputSerializer) return errors as a list of per-item dicts,
  // e.g. {"items": [{}, {"quantity": ["A valid integer is required."]}]}.
  // The old version only unwrapped one level (`val[0]`), so a nested-item
  // error surfaced as a raw object — setError(objectValue) then crashed
  // the page when React tried to render it as a child ("Objects are not
  // valid as a React child"). This walks down until it finds an actual
  // string message.
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

function confidenceTone(score) {
  if (score >= 85) return 'success'
  if (score >= 50) return 'warning'
  return 'critical'
}

function StatusBadge({ tone, label }) {
  return (
    <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${TONE_BADGE[tone]}`}>
      {label}
    </span>
  )
}

/* =========================================================================
   MODAL SHELL
   ========================================================================= */
function Modal({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18233D]/40 backdrop-blur-[1px] px-4">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} bg-white rounded-xl ${SHADOW_FLOAT} p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-[19px] font-bold text-[#18233D]">{title}</h3>
            {subtitle && <p className="text-sm text-[#8B96A6] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-[#8B96A6] hover:bg-[#F7F5F0] hover:text-[#18233D] transition-colors"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* =========================================================================
   HERO — light brand-tinted banner with a small animated sparkline, the
   3rd distinct header treatment in the app (Ingredients = stat-strip card,
   Menus = minimal inline pills, Sales = tinted banner + trend visual).
   ========================================================================= */
function SalesSparkline() {
  return (
    <div className="relative w-40 h-24 shrink-0">
      <style>{`
        @keyframes salesLineDraw { to { stroke-dashoffset: 0; } }
        @keyframes salesDotPulse { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.1; transform: scale(2.2); } }
      `}</style>
      <svg viewBox="0 0 160 96" className="w-full h-full" aria-hidden="true">
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#28579C" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#28579C" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,70 C20,66 30,50 45,48 C64,45 70,60 88,52 C108,43 115,20 160,16 L160,96 L0,96 Z" fill="url(#salesFill)" />
        <path
          d="M0,70 C20,66 30,50 45,48 C64,45 70,60 88,52 C108,43 115,20 160,16"
          fill="none" stroke="#28579C" strokeWidth="2.5" strokeLinecap="round"
          pathLength="1"
          style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: 'salesLineDraw 1.4s ease-out 0.2s forwards' }}
        />
        <circle cx="160" cy="16" r="14" fill="#28579C" style={{ animation: 'salesDotPulse 2.2s ease-out infinite' }} />
        <circle cx="160" cy="16" r="4" fill="#1E4278" />
      </svg>
    </div>
  )
}

function HeroBanner({ metrics, onRecordSale, onGoToImport }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#EAF1FB_0%,#F7F5F0_65%)] border border-[#E4E2DC] px-6 sm:px-8 py-7 mb-8">
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[24px] font-extrabold tracking-tight text-[#18233D]">
            Catat Penjualan
          </h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs font-semibold text-[#18233D] bg-white border border-[#E4E2DC] rounded-full px-3 py-1">
              Penjualan Hari Ini: {metrics.todayCount}
            </span>
            <span className="text-xs font-semibold text-[#18233D] bg-white border border-[#E4E2DC] rounded-full px-3 py-1">
              Total Pendapatan: {formatRupiah(metrics.totalRevenue)}
            </span>
            <span className="text-xs font-semibold text-[#18233D] bg-white border border-[#E4E2DC] rounded-full px-3 py-1">
              Total Profit: {formatRupiah(metrics.totalProfit)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5 mt-5">
            <button onClick={onRecordSale} className={BTN_PRIMARY}>
              <span className="inline-flex items-center gap-1.5"><IconPlus className="w-4 h-4" /> Catat Penjualan</span>
            </button>
            <button onClick={onGoToImport} className={`${BTN_SECONDARY} bg-white inline-flex items-center gap-1.5`}>
              <IconUploadCloud className="w-4 h-4" /> Import dari CSV
            </button>
          </div>
        </div>
        <SalesSparkline />
      </div>
    </div>
  )
}

/* =========================================================================
   RECORD SALE MODAL (manual entry — same logic as before, just moved
   out of an always-open inline form and into a modal).
   ========================================================================= */
function RecordSaleModal({ menus, onClose, onSaved }) {
  const [saleDate, setSaleDate] = useState(todayStr())
  const [items, setItems] = useState(() => (menus.length ? [{ menu_id: menus[0].id, quantity: 1 }] : []))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function addItem() {
    if (menus.length === 0) return
    setItems((prev) => [...prev, { menu_id: menus[0].id, quantity: 1 }])
  }

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)))
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (items.length === 0) {
      setError('Tambahin minimal 1 item dulu.')
      return
    }
    setSaving(true)
    try {
      await api.post('/sales/', { sale_date: saleDate, items })
      onSaved()
    } catch (err) {
      setError(extractError(err) || 'Gagal catat penjualan. Cek stock ingredient cukup & recipe menu udah diisi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Catat Penjualan" subtitle="Catat penjualan hari ini secara manual." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className={LABEL}>Tanggal penjualan</label>
          <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className={INPUT} />
        </div>

        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={item.menu_id}
                onChange={(e) => updateItem(i, 'menu_id', e.target.value)}
                className={INPUT}
              >
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input
                type="number" min="1"
                value={item.quantity}
                onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                className={`${INPUT} w-20`}
              />
              <button type="button" onClick={() => removeItem(i)} className="text-xs font-semibold shrink-0" style={{ color: '#B8433B' }}>
                Hapus
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-[#8B96A6]">Belum ada item.</p>}
        </div>

        <button type="button" onClick={addItem} className={`text-sm font-semibold ${LINK_BRAND}`}>
          + Tambah item
        </button>

        {error && <p className={ERROR_BANNER}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${BTN_SECONDARY}`}>
            Batal
          </button>
          <button type="submit" disabled={saving} className={`flex-1 ${BTN_PRIMARY}`}>
            {saving ? 'Menyimpan…' : 'Catat Penjualan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* =========================================================================
   CSV IMPORT SECTION — dropzone -> column mapping -> fuzzy-match review.
   Note: matching is plain string similarity (rapidfuzz), NOT AI — so this
   intentionally does not use the AI/indigo badge style from Ingredients.
   ========================================================================= */
function CsvImportSection({ menus, onImported }) {
  const [file, setFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [stage, setStage] = useState('idle') // idle | detecting | mapping | matching | review
  const [headers, setHeaders] = useState([])
  const [sampleRows, setSampleRows] = useState([])
  const [menuColumn, setMenuColumn] = useState('')
  const [qtyColumn, setQtyColumn] = useState('')
  const [rows, setRows] = useState([])
  const [saleDate, setSaleDate] = useState(todayStr())
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  function reset() {
    setFile(null); setStage('idle'); setHeaders([]); setSampleRows([])
    setMenuColumn(''); setQtyColumn(''); setRows([]); setError('')
  }

  async function handleFile(selected) {
    if (!selected) return
    setFile(selected)
    setError('')
    setStage('detecting')
    try {
      const formData = new FormData()
      formData.append('file', selected)
      const res = await api.post('/sales/parse-csv/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setHeaders(res.data.headers)
      setSampleRows(res.data.sample_rows)
      setMenuColumn(res.data.suggested_menu_column || '')
      setQtyColumn(res.data.suggested_qty_column || '')
      setStage('mapping')
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal baca file CSV.')
      setStage('idle')
    }
  }

  async function handleConfirmColumns() {
    if (!menuColumn || !qtyColumn || !file) return
    setStage('matching')
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('menu_column', menuColumn)
      formData.append('qty_column', qtyColumn)
      const res = await api.post('/sales/parse-csv/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setRows(
        res.data.rows.map((r) => ({
          csv_name: r.csv_name,
          quantity: r.quantity,
          menu_id: r.matched_menu_id || '',
          confidence_score: r.confidence_score,
          candidates: (r.candidates || []).filter((c) => c.score > 0),
        }))
      )
      setStage('review')
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal proses CSV.')
      setStage('mapping')
    }
  }

  function updateRow(i, patch) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function removeRow(i) {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleConfirmSales() {
    // Sale quantity is "servings sold", always a whole number — the
    // input allows typing a decimal even with step=1 (step only affects
    // the spinner buttons), and the backend's IntegerField rejects
    // anything but a whole number, failing the ENTIRE batch with a
    // generic error instead of pointing at the one bad row. Round here so
    // a stray "2.5" can't silently sink the whole import.
    const validRows = rows.filter((r) => r.menu_id && Math.round(Number(r.quantity)) > 0)
    if (validRows.length === 0) {
      setError('Tidak ada baris valid buat direcord — pilih menu & pastiin qty > 0 di minimal 1 baris.')
      return
    }
    const aggregated = {}
    validRows.forEach((r) => {
      aggregated[r.menu_id] = (aggregated[r.menu_id] || 0) + Math.round(Number(r.quantity))
    })
    const items = Object.entries(aggregated).map(([menu_id, quantity]) => ({ menu_id, quantity }))

    setSubmitting(true)
    setError('')
    try {
      await api.post('/sales/', { sale_date: saleDate, items })
      reset()
      onImported()
    } catch (err) {
      setError(extractError(err) || 'Gagal record sales dari CSV.')
    } finally {
      setSubmitting(false)
    }
  }

  const matchedCount = rows.filter((r) => r.menu_id).length

  return (
    <div className={`bg-white rounded-xl ${SHADOW_CARD} p-5`}>
      {stage === 'idle' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false) }}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files?.[0]) }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors px-6 py-10 text-center ${
            dragActive ? 'border-[#28579C] bg-[#EAF1FB]' : 'border-[#CBD1DB] bg-[#F7F5F0] hover:border-[#8B96A6]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <IconTable className="w-8 h-8 text-[#8B96A6] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#18233D]">Drag &amp; drop CSV penjualan kamu di sini</p>
          <p className="text-xs text-[#8B96A6] mt-1">atau klik buat pilih file — kolom nama menu + qty, dicocokin otomatis ke katalog kamu</p>
        </div>
      )}

      {stage === 'detecting' && (
        <p className="text-sm text-[#5B6B82] text-center py-10">Membaca CSV…</p>
      )}

      {stage === 'mapping' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-[#E4E2DC] bg-[#F7F5F0] px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 text-[#28579C]">
              <IconTable className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#18233D] truncate">{file?.name}</p>
              <p className="text-xs text-[#8B96A6]">{headers.length} kolom terdeteksi</p>
            </div>
            <button type="button" onClick={reset} className="text-xs font-semibold text-[#5B6B82] hover:text-[#18233D] transition-colors shrink-0">
              Hapus
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Kolom nama menu</label>
              <select value={menuColumn} onChange={(e) => setMenuColumn(e.target.value)} className={INPUT}>
                <option value="">— pilih kolom —</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Kolom quantity</label>
              <select value={qtyColumn} onChange={(e) => setQtyColumn(e.target.value)} className={INPUT}>
                <option value="">— pilih kolom —</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          {sampleRows.length > 0 && (
            <div className="rounded-lg border border-[#E4E2DC] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F7F5F0] text-[#8B96A6] text-xs uppercase tracking-wide">
                  <tr>{headers.map((h) => <th key={h} className="text-left px-3 py-2 font-bold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {sampleRows.map((row, i) => (
                    <tr key={i} className="border-t border-[#E4E2DC] text-[#5B6B82]">
                      {headers.map((h) => <td key={h} className="px-3 py-2">{row[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && <p className={ERROR_BANNER}>{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={reset} className={BTN_SECONDARY}>Batal</button>
            <button
              type="button"
              onClick={handleConfirmColumns}
              disabled={!menuColumn || !qtyColumn}
              className={BTN_PRIMARY}
            >
              Cocokin ke katalog
            </button>
          </div>
        </div>
      )}

      {stage === 'matching' && (
        <p className="text-sm text-[#5B6B82] text-center py-10">Mencocokkan ke katalog menu kamu…</p>
      )}

      {stage === 'review' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[#5B6B82]">
              <span className="font-semibold text-[#18233D]">{matchedCount}</span> dari {rows.length} baris cocok ke sebuah menu.
              Cek dan benerin yang belum cocok sebelum dicatat.
            </p>
            <button type="button" onClick={reset} className={`text-xs font-semibold ${LINK_MUTED}`}>Mulai ulang</button>
          </div>

          <div className="rounded-lg border border-[#E4E2DC] overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-[#F7F5F0] text-[#8B96A6] text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2.5 font-bold">Nama di CSV</th>
                  <th className="text-right px-3 py-2.5 font-bold">Qty</th>
                  <th className="text-left px-3 py-2.5 font-bold">Menu tercocok</th>
                  <th className="text-left px-3 py-2.5 font-bold">Confidence</th>
                  <th className="text-left px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-[#E4E2DC] align-top">
                    <td className="px-3 py-2.5 text-[#18233D]">{row.csv_name}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number" step="1" min="1"
                        value={row.quantity}
                        onChange={(e) => updateRow(i, { quantity: e.target.value })}
                        className={`${INPUT} w-20 text-right`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={row.menu_id}
                        onChange={(e) => updateRow(i, { menu_id: e.target.value })}
                        className={INPUT}
                      >
                        <option value="">— pilih menu —</option>
                        {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      {!row.menu_id && row.candidates.length > 0 && (
                        <p className="text-xs text-[#8B96A6] mt-1">
                          Mungkin maksud kamu:{' '}
                          {row.candidates.map((c, ci) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => updateRow(i, { menu_id: c.id })}
                              className={`${LINK_BRAND} font-semibold`}
                            >
                              {c.name} ({c.score}%){ci < row.candidates.length - 1 ? ', ' : ''}
                            </button>
                          ))}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge
                        tone={confidenceTone(row.confidence_score)}
                        label={`${row.confidence_score}%`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => removeRow(i)} className={LINK_CRITICAL}>
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={LABEL}>Tanggal penjualan</label>
              <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className={INPUT} />
            </div>
            <div className="flex gap-3 ml-auto">
              <button type="button" onClick={reset} className={BTN_SECONDARY}>Batal</button>
              <button type="button" onClick={handleConfirmSales} disabled={submitting} className={BTN_PRIMARY}>
                {submitting ? 'Mencatat…' : `Konfirmasi & Catat ${matchedCount} Penjualan`}
              </button>
            </div>
          </div>

          {error && <p className={ERROR_BANNER}>{error}</p>}
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   PAGE
   ========================================================================= */
export default function SalesPage() {
  const [menus, setMenus] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const [recordModalOpen, setRecordModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const importSectionRef = useRef(null)

  async function fetchAll(date) {
    setLoading(true)
    try {
      const [menusRes, salesRes] = await Promise.all([
        api.get('/menus/'),
        api.get('/sales/', { params: date ? { date } : {} }),
      ])
      setMenus(menusRes.data)
      setSales(salesRes.data)
      setError('')
    } catch (err) {
      setError('Gagal ambil data. Cek backend & login.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  function menuName(id) {
    return menus.find((m) => m.id === id)?.name || '?'
  }

  function showSuccessToast(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3500)
  }

  async function handleDeleteSale(sale) {
    if (!window.confirm(`Batalkan sale tanggal ${sale.sale_date}? Stok bahan yang kepotong bakal dikembalikan.`)) return
    setDeletingId(sale.id)
    try {
      await api.delete(`/sales/${sale.id}/`)
      setSales((prev) => prev.filter((s) => s.id !== sale.id))
      showSuccessToast('Sale dibatalkan, stok udah dikembalikan.')
    } catch (err) {
      setError(extractError(err) || 'Gagal membatalkan sale.')
    } finally {
      setDeletingId(null)
    }
  }

  const metrics = {
    todayCount: sales.filter((s) => s.sale_date === todayStr()).length,
    totalRevenue: sales.reduce((sum, s) => sum + s.items.reduce((a, it) => a + it.unit_price * it.quantity, 0), 0),
    totalProfit: sales.reduce((sum, s) => sum + s.items.reduce((a, it) => a + (it.unit_price - it.unit_cost) * it.quantity, 0), 0),
  }

  return (
    <div className="max-w-5xl mx-auto">
      <HeroBanner
        metrics={metrics}
        onRecordSale={() => setRecordModalOpen(true)}
        onGoToImport={() => importSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      />

      {error && <p className={`${ERROR_BANNER} mb-6`}>{error}</p>}
      {success && <p className={`${SUCCESS_BANNER} mb-6`}>{success}</p>}

      {/* Import from CSV */}
      <section ref={importSectionRef} className="mb-8">
        <h2 className="text-[13px] font-bold text-[#18233D] uppercase tracking-wide mb-3">Import dari CSV</h2>
        <CsvImportSection
          menus={menus.filter((m) => m.is_active)}
          onImported={() => { showSuccessToast('Sales berhasil dicatat dari CSV.'); fetchAll(dateFilter) }}
        />
      </section>

      {/* Recent Sales — unified panel: toolbar header + list body */}
      <section>
        <div className={`bg-white rounded-2xl ${SHADOW_CARD} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#E4E2DC]">
            <h2 className="text-[15px] font-bold text-[#18233D]">
              Penjualan Terbaru
              <span className="ml-2 text-xs font-medium text-[#8B96A6]">{sales.length} riwayat</span>
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className={`${INPUT} w-40`}
              />
              <button onClick={() => fetchAll(dateFilter)} className={BTN_SECONDARY}>Filter</button>
              {dateFilter && (
                <button
                  onClick={() => { setDateFilter(''); fetchAll() }}
                  className={`text-xs font-semibold ${LINK_MUTED}`}
                >
                  Bersihkan
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-[#5B6B82] px-5 py-10 text-center">Memuat...</p>
          ) : sales.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[#5B6B82]">Belum ada sale tercatat.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E4E2DC]">
              {sales.map((sale) => {
                const revenue = sale.items.reduce((a, it) => a + it.unit_price * it.quantity, 0)
                const profit = sale.items.reduce((a, it) => a + (it.unit_price - it.unit_cost) * it.quantity, 0)
                return (
                  <div key={sale.id} className="px-5 py-4 hover:bg-[#F7F5F0]/60 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <IconReceipt className="w-4 h-4 text-[#8B96A6]" />
                        <p className="text-sm font-semibold text-[#18233D]">{sale.sale_date}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-[#5B6B82]">Pendapatan <span className="font-semibold text-[#18233D] tabular-nums">{formatRupiah(revenue)}</span></span>
                        <span className="text-[#5B6B82]">Profit <span className="font-semibold text-[#2E7D53] tabular-nums">{formatRupiah(profit)}</span></span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSale(sale)}
                          disabled={deletingId === sale.id}
                          title="Batalkan sale ini"
                          className="flex items-center gap-1 text-[#B8433B] hover:text-[#8F332C] transition-colors disabled:opacity-50"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                          {deletingId === sale.id ? 'Membatalkan…' : 'Batalkan'}
                        </button>
                      </div>
                    </div>
                    <ul className="text-xs text-[#8B96A6] space-y-1">
                      {sale.items.map((it) => {
                        const normalPrice = menuNormalPrice(menus, it.menu)
                        const isDiscounted = normalPrice && Number(it.unit_price) < normalPrice
                        const discountPct = isDiscounted ? Math.round((1 - it.unit_price / normalPrice) * 100) : null
                        return (
                          <li key={it.id} className="flex items-center gap-1.5">
                            <span>
                              {menuName(it.menu)} × {it.quantity} — {formatRupiah(it.unit_price * it.quantity)}
                            </span>
                            {isDiscounted && (
                              <span
                                className="text-[10px] font-bold text-[#2E7D53] bg-[#EAF5EE] rounded-full px-1.5 py-0.5"
                                title={`Harga normal Rp${formatRupiah(normalPrice)}`}
                              >
                                Diskon ~{discountPct}%
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {recordModalOpen && (
        <RecordSaleModal
          menus={menus.filter((m) => m.is_active)}
          onClose={() => setRecordModalOpen(false)}
          onSaved={() => {
            setRecordModalOpen(false)
            showSuccessToast('Sale recorded! Cek tab Ingredients, stock harusnya udah kepotong.')
            fetchAll(dateFilter)
          }}
        />
      )}
    </div>
  )
}