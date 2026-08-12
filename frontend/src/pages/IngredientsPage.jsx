import { useState, useEffect, useRef } from 'react'
import api from '../api/client'
import { extractError } from '../utils/error'

/* =========================================================================
   DESIGN TOKENS — sama persis dengan Dashboard.jsx / Sidebar.jsx / MenusPage.jsx.
   Satu pengecualian: AI_* di bawah nambahin accent indigo/violet, dipakai
   KHUSUS buat elemen yang eksplisit "AI-powered" (estimasi expiry, parse
   struk) — konvensi umum enterprise SaaS (Notion AI, Copilot) buat nandain
   fitur AI beda dari aksi biasa, tanpa ganti palet utama app.
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
  'text-sm font-semibold text-[#5B6B82] border border-[#E4E2DC] rounded-full px-5 py-2.5 hover:bg-[#F7F5F0] transition-colors'
const BTN_GHOST_ON_DARK =
  'inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/15 rounded-full px-4 py-2 transition-colors'
const LINK_BRAND = 'text-[#28579C] hover:text-[#1E4278] transition-colors'
const LINK_MUTED = 'text-[#5B6B82] hover:text-[#18233D] transition-colors'
const LINK_CRITICAL = 'text-[#B8433B] hover:text-[#8F332C] transition-colors'
const ERROR_BANNER = 'text-sm text-[#B8433B] bg-[#FBEBEA] rounded-md px-3 py-2'

const AI_BADGE =
  'inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6D5FD1] bg-[#F1EEFC] rounded-full px-2.5 py-1'
const AI_BUTTON =
  'inline-flex items-center gap-1 text-xs font-semibold text-[#6D5FD1] bg-[#F1EEFC] hover:bg-[#E6E1FA] rounded-full px-2.5 py-1.5 transition-colors disabled:opacity-50 whitespace-nowrap'

const UNIT_OPTIONS = ['kg', 'g', 'liter', 'ml', 'pcs', 'pack', 'box', 'dozen']

/* =========================================================================
   ICONS — inline SVG, stroke-based (sama konvensi kayak Sidebar.jsx), gak
   nambah dependency icon library baru.
   ========================================================================= */
const ic = {
  className: 'w-4 h-4', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}
const IconPackage = (p) => (
  <svg {...ic} {...p}><path d="M21 8V7l-9-4-9 4v10l9 4 9-4v-1" /><path d="M3.3 7 12 11l8.7-4" /><path d="M12 22V11" /></svg>
)
const IconUploadCloud = (p) => (
  <svg {...ic} {...p}><path d="M4 14.9A5 5 0 0 1 6 5.3 6 6 0 0 1 17.7 7 4.5 4.5 0 0 1 18 16" /><path d="M12 12v9" /><path d="m8 17 4-4 4 4" /></svg>
)
const IconSparkles = (p) => (
  <svg {...ic} {...p} fill="currentColor" stroke="none"><path d="M12 2l1.6 4.8L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.2L12 2z" /><path d="M19 14l.9 2.6L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.4L19 14z" /></svg>
)
const IconAlertTriangle = (p) => (
  <svg {...ic} {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
)
const IconMoreVertical = (p) => (
  <svg {...ic} {...p}><circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" /></svg>
)
const IconSearch = (p) => (
  <svg {...ic} {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
)
const IconPlus = (p) => (
  <svg {...ic} {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
)
const IconX = (p) => (
  <svg {...ic} {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
)
const IconFile = (p) => (
  <svg {...ic} {...p}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" /><path d="M14 2v6h6" /></svg>
)
const IconPencil = (p) => (
  <svg {...ic} {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
)
const IconRefreshCw = (p) => (
  <svg {...ic} {...p}><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M3 21v-5h5" /></svg>
)

/* =========================================================================
   HELPERS
   ========================================================================= */
function stockStatus(ing) {
  const stock = Number(ing.current_stock) || 0
  const threshold = ing.low_stock_threshold != null ? Number(ing.low_stock_threshold) : null
  if (stock <= 0) return { key: 'out_of_stock', label: 'Out of Stock', tone: 'critical' }
  if (threshold != null && stock <= threshold) return { key: 'low_stock', label: 'Low Stock', tone: 'warning' }
  return { key: 'in_stock', label: 'In Stock', tone: 'success' }
}

const TONE_BADGE = {
  critical: 'text-[#B8433B] bg-[#FBEBEA]',
  warning: 'text-[#A2670C] bg-[#FCF3E2]',
  success: 'text-[#2E7D53] bg-[#EAF5EE]',
}

function StatusBadge({ tone, label }) {
  return (
    <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${TONE_BADGE[tone]}`}>
      {label}
    </span>
  )
}

function formatRupiah(n) {
  return 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID')
}

/* =========================================================================
   MODAL SHELL
   ========================================================================= */
function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18233D]/40 backdrop-blur-[1px] px-4">
      <div className={`w-full max-w-lg bg-white rounded-xl ${SHADOW_FLOAT} p-6 max-h-[90vh] overflow-y-auto`}>
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
   HERO — light "stat strip" header (title + actions above a divided card
   of live metrics). Deliberately NOT a dark gradient banner — kept flat,
   data-forward, closer to how Linear/Stripe list-page headers read.
   ========================================================================= */
function StatCell({ icon, label, value, tone = 'neutral', onClick, active }) {
  const valueColor =
    tone === 'warning' ? 'text-[#A2670C]' : tone === 'critical' ? 'text-[#B8433B]' : 'text-[#18233D]'
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex items-center gap-3 px-6 py-4 text-left w-full ${
        onClick ? 'hover:bg-[#F7F5F0] transition-colors cursor-pointer' : ''
      } ${active ? 'bg-[#EAF1FB]' : ''}`}
    >
      <div className="w-9 h-9 rounded-lg bg-[#EAF1FB] text-[#28579C] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[#8B96A6]">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${valueColor}`}>{value}</p>
      </div>
    </Comp>
  )
}

function HeroBanner({ metrics, onAddIngredient, onGoToUpload, lowStockActive, onToggleLowStock }) {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#18233D]">
            Ingredient &amp; Inventory Management
          </h1>
          <p className="text-sm text-[#5B6B82] mt-1">Track stock levels, cost per unit, and restock as it happens.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button onClick={onGoToUpload} className={`${BTN_SECONDARY} inline-flex items-center gap-1.5`}>
            <IconUploadCloud className="w-4 h-4" /> Upload Receipt (OCR)
          </button>
          <button onClick={onAddIngredient} className={BTN_PRIMARY}>
            <span className="inline-flex items-center gap-1.5"><IconPlus className="w-4 h-4" /> Add Ingredient</span>
          </button>
        </div>
      </div>

      <div className={`bg-white rounded-2xl ${SHADOW_CARD} overflow-hidden`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 divide-[#E4E2DC] sm:divide-x">
          <StatCell icon={<IconPackage className="w-4 h-4" />} label="Total Items" value={metrics.total} />
          <StatCell
            icon={<IconAlertTriangle className="w-4 h-4" />}
            label="Low Stock Alert"
            value={metrics.lowStock}
            tone={metrics.lowStock > 0 ? 'warning' : 'neutral'}
            onClick={onToggleLowStock}
            active={lowStockActive}
          />
          <StatCell icon={<IconFile className="w-4 h-4" />} label="Total Valuation" value={formatRupiah(metrics.valuation)} />
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   ADD INGREDIENT MODAL
   ========================================================================= */
function AddIngredientModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', unit: 'kg', current_stock: '', total_cost: '', low_stock_threshold: '',
    expiry_date: '', aiNote: '', aiLoading: false,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleGenerateExpiry() {
    if (!form.name) return
    setForm((prev) => ({ ...prev, aiLoading: true, aiNote: '' }))
    try {
      const res = await api.post('/ingredients/estimate-expiry/', { name: form.name })
      setForm((prev) => ({
        ...prev,
        expiry_date: res.data.suggested_expiry_date,
        aiNote: `${res.data.confidence}: ${res.data.note}`,
        aiLoading: false,
      }))
    } catch (err) {
      setForm((prev) => ({ ...prev, aiLoading: false, aiNote: 'Gagal estimasi, isi manual.' }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const qty = Number(form.current_stock) || 0
    const totalCost = Number(form.total_cost) || 0
    // backend nyimpen cost per-unit (dipakai buat hitung profit per menu),
    // tapi user cuma perlu input total yang dia bayar — konversinya di sini
    const costPerUnit = qty > 0 ? (totalCost / qty).toFixed(2) : totalCost.toFixed(2)

    setSaving(true)
    try {
      await api.post('/ingredients/', {
        name: form.name,
        unit: form.unit,
        current_stock: qty || 0,
        cost_per_unit: costPerUnit,
        low_stock_threshold: form.low_stock_threshold || null,
        // expiry cuma relevan kalau emang ada initial stock yang diisi
        expiry_date: qty ? (form.expiry_date || null) : null,
      })
      onSaved()
    } catch (err) {
      setError(extractError(err) || 'Gagal bikin ingredient. Cek isian form.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add Ingredient" subtitle="Daftarin bahan baku baru ke inventory." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className={LABEL}>Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={INPUT}
            placeholder="Chicken breast"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Unit</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className={INPUT}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Initial stock</label>
            <input
              type="number" step="0.001"
              value={form.current_stock}
              onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
              className={INPUT}
              placeholder="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Total cost</label>
            <input
              type="number" step="0.01"
              value={form.total_cost}
              onChange={(e) => setForm({ ...form, total_cost: e.target.value })}
              className={INPUT}
              placeholder="e.g. 150000"
              required
            />
            {form.current_stock > 0 && form.total_cost > 0 && (
              <p className="text-xs text-[#8B96A6] mt-1">
                ≈ {(Number(form.total_cost) / Number(form.current_stock)).toFixed(2)} / {form.unit}
              </p>
            )}
          </div>
          <div>
            <label className={LABEL}>Low stock threshold</label>
            <input
              type="number" step="0.001"
              value={form.low_stock_threshold}
              onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
              className={INPUT}
              placeholder="min. qty"
            />
          </div>
        </div>

        <div>
          <label className={LABEL}>Expiry date</label>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
              className={INPUT}
            />
            <button
              type="button"
              onClick={handleGenerateExpiry}
              disabled={!form.name || form.aiLoading}
              className={AI_BUTTON}
            >
              <IconSparkles className="w-3 h-3" /> {form.aiLoading ? 'Generating…' : 'AI expiry'}
            </button>
          </div>
          {form.aiNote && <p className="text-xs text-[#8B96A6] mt-1.5">{form.aiNote}</p>}
        </div>

        {error && <p className={ERROR_BANNER}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${BTN_SECONDARY}`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`flex-1 ${BTN_PRIMARY}`}>
            {saving ? 'Saving…' : 'Add Ingredient'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* =========================================================================
   RESTOCK MODAL
   ========================================================================= */
function RestockModal({ ingredient, onClose, onSaved }) {
  const [qty, setQty] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [aiNote, setAiNote] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerateExpiry() {
    setAiLoading(true)
    setAiNote('')
    try {
      const res = await api.post('/ingredients/estimate-expiry/', { name: ingredient.name })
      setExpiryDate(res.data.suggested_expiry_date)
      setAiNote(`${res.data.confidence}: ${res.data.note}`)
    } catch (err) {
      setAiNote('Gagal estimasi, isi manual.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!qty || Number(qty) <= 0) return
    setSaving(true)
    try {
      await api.post(`/ingredients/${ingredient.id}/restock/`, {
        change_qty: qty,
        total_cost: totalCost || 0,
        expiry_date: expiryDate || null,
      })
      onSaved()
    } catch (err) {
      setError(extractError(err) || 'Gagal restock.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Restock — ${ingredient.name}`} subtitle={`Current stock: ${ingredient.current_stock} ${ingredient.unit}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Qty to add ({ingredient.unit})</label>
            <input
              type="number" step="0.001"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={INPUT}
              placeholder="0"
              autoFocus
            />
          </div>
          <div>
            <label className={LABEL}>Total cost (optional)</label>
            <input
              type="number" step="0.01"
              value={totalCost}
              onChange={(e) => setTotalCost(e.target.value)}
              className={INPUT}
              placeholder="e.g. 150000"
            />
          </div>
        </div>
        {qty > 0 && totalCost > 0 && (
          <p className="text-xs text-[#8B96A6] -mt-2">
            Cost/unit bakal ke-update jadi rata-rata tertimbang sama stok yang ada.
          </p>
        )}
        <div>
          <label className={LABEL}>Expiry date</label>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className={INPUT}
            />
            <button type="button" onClick={handleGenerateExpiry} disabled={aiLoading} className={AI_BUTTON}>
              <IconSparkles className="w-3 h-3" /> {aiLoading ? 'Generating…' : 'AI expiry'}
            </button>
          </div>
          {aiNote && <p className="text-xs text-[#8B96A6] mt-1.5">{aiNote}</p>}
        </div>

        {error && <p className={ERROR_BANNER}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${BTN_SECONDARY}`}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !qty} className={`flex-1 ${BTN_PRIMARY}`}>
            {saving ? 'Saving…' : 'Confirm Restock'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* =========================================================================
   WASTE MODAL — write off spoiled/expired stock (F1: ADJUSTMENT movement)
   ========================================================================= */
function WasteModal({ ingredient, onClose, onSaved }) {
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!qty || Number(qty) <= 0) return
    if (Number(qty) > Number(ingredient.current_stock)) {
      setError('Qty gak boleh lebih dari stok yang ada.')
      return
    }
    setSaving(true)
    try {
      await api.post(`/ingredients/${ingredient.id}/waste/`, { qty })
      onSaved()
    } catch (err) {
      setError(extractError(err) || 'Gagal catat waste.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Mark as wasted — ${ingredient.name}`}
      subtitle={`Current stock: ${ingredient.current_stock} ${ingredient.unit}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className={LABEL}>Qty wasted ({ingredient.unit})</label>
          <input
            type="number" step="0.001"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className={INPUT}
            placeholder="0"
            autoFocus
          />
          <p className="text-xs text-[#8B96A6] mt-1.5">
            Bahan yang udah kedaluwarsa/rusak dan gak bisa dipakai lagi — dicatat sebagai
            adjustment, bukan restock.
          </p>
        </div>

        {error && <p className={ERROR_BANNER}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${BTN_SECONDARY}`}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !qty} className={`flex-1 ${BTN_PRIMARY}`}>
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* =========================================================================
   EDIT INGREDIENT MODAL
   ========================================================================= */
function EditIngredientModal({ ingredient, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: ingredient.name,
    unit: ingredient.unit,
    cost_per_unit: ingredient.cost_per_unit,
    low_stock_threshold: ingredient.low_stock_threshold ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.patch(`/ingredients/${ingredient.id}/`, {
        name: form.name,
        unit: form.unit,
        cost_per_unit: form.cost_per_unit,
        low_stock_threshold: form.low_stock_threshold || null,
      })
      onSaved()
    } catch (err) {
      setError(extractError(err) || 'Gagal update ingredient.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Edit — ${ingredient.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className={LABEL}>Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={INPUT}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Unit</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className={INPUT}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Cost / unit</label>
            <input
              type="number" step="0.01"
              value={form.cost_per_unit}
              onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })}
              className={INPUT}
            />
          </div>
        </div>
        <div>
          <label className={LABEL}>Low stock threshold</label>
          <input
            type="number" step="0.001"
            value={form.low_stock_threshold}
            onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
            className={INPUT}
            placeholder="min. qty"
          />
        </div>
        <p className="text-xs text-[#8B96A6]">
          Current stock: {ingredient.current_stock} {ingredient.unit} — locked, use Restock to change it.
        </p>

        {error && <p className={ERROR_BANNER}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${BTN_SECONDARY}`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`flex-1 ${BTN_PRIMARY}`}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* =========================================================================
   ROW ACTION MENU
   ========================================================================= */
function RowActionMenu({ onRestock, onEdit, onWaste }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-expanded={open}
        className="w-7 h-7 flex items-center justify-center rounded-full text-[#8B96A6] hover:bg-[#F7F5F0] hover:text-[#18233D] transition-colors"
      >
        <IconMoreVertical />
      </button>
      {open && (
        <div className={`absolute right-0 top-8 z-10 w-40 rounded-lg bg-white border border-[#E4E2DC] ${SHADOW_FLOAT} py-1`}>
          <button
            type="button"
            onClick={() => { setOpen(false); onRestock() }}
            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-[#18233D] hover:bg-[#F7F5F0] transition-colors"
          >
            <IconRefreshCw className="w-3.5 h-3.5 text-[#8B96A6]" /> Restock
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onEdit() }}
            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-[#18233D] hover:bg-[#F7F5F0] transition-colors"
          >
            <IconPencil className="w-3.5 h-3.5 text-[#8B96A6]" /> Edit
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onWaste() }}
            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-[#B8433B] hover:bg-[#FBEBEA] transition-colors"
          >
            <IconAlertTriangle className="w-3.5 h-3.5" /> Mark as wasted
          </button>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   PAGE
   ========================================================================= */
export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | in_stock | low_stock | out_of_stock

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [restockTarget, setRestockTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [wasteTarget, setWasteTarget] = useState(null)

  // receipt upload / dropzone state
  const [receiptFile, setReceiptFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptItems, setReceiptItems] = useState(null) // null = belum ada hasil, [] = hasil kosong
  const [receiptError, setReceiptError] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const fileInputRef = useRef(null)
  const uploadSectionRef = useRef(null)

  async function fetchIngredients() {
    setLoading(true)
    try {
      const res = await api.get('/ingredients/')
      setIngredients(res.data)
      setError('')
    } catch (err) {
      setError(extractError(err) || 'Gagal ambil data ingredients.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIngredients()
  }, [])

  // === Receipt flow (F1: parse-receipt + bulk-restock) ===

  function handleFiles(fileList) {
    const file = fileList?.[0]
    if (file) {
      setReceiptFile(file)
      setReceiptItems(null)
      setReceiptError('')
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    handleFiles(e.dataTransfer.files)
  }

  async function handleParseReceipt() {
    if (!receiptFile) return
    setReceiptLoading(true)
    setReceiptError('')
    setReceiptItems(null)
    try {
      const formData = new FormData()
      formData.append('image', receiptFile)
      const res = await api.post('/ingredients/parse-receipt/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setReceiptItems(
        res.data.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unit: it.unit,
          total_price: it.total_price ?? '',
          expiry_date: it.suggested_expiry_date || '',
          note: it.note || '',
        }))
      )
    } catch (err) {
      setReceiptError(extractError(err) || 'Gagal baca struk. Coba foto yang lebih jelas atau isi manual.')
    } finally {
      setReceiptLoading(false)
    }
  }

  function updateReceiptItem(index, patch) {
    setReceiptItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function removeReceiptItem(index) {
    setReceiptItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleBulkRestock() {
    if (!receiptItems || receiptItems.length === 0) return
    setBulkSubmitting(true)
    try {
      const res = await api.post('/ingredients/bulk-restock/', {
        items: receiptItems.map((it) => ({
          name: it.name,
          unit: it.unit,
          change_qty: it.quantity,
          total_price: it.total_price || null,
          expiry_date: it.expiry_date || null,
        })),
      })
      const skipped = res.data.skipped || []
      setReceiptItems(null)
      setReceiptFile(null)
      fetchIngredients()
      if (skipped.length > 0) {
        setReceiptError(
          `${skipped.length} baris di-skip: ` +
            skipped.map((s) => `${s.name} (${s.reason})`).join(', ')
        )
      }
    } catch (err) {
      setReceiptError(extractError(err) || 'Gagal submit bulk restock. Cek tiap baris (qty harus > 0).')
    } finally {
      setBulkSubmitting(false)
    }
  }

  // === derived: metrics + filtered list ===
  const metrics = {
    total: ingredients.length,
    lowStock: ingredients.filter((i) => stockStatus(i).key !== 'in_stock').length,
    valuation: ingredients.reduce((sum, i) => sum + (Number(i.current_stock) || 0) * (Number(i.cost_per_unit) || 0), 0),
  }

  const visibleIngredients = ingredients.filter((ing) => {
    if (statusFilter !== 'all' && stockStatus(ing).key !== statusFilter) return false
    if (searchQuery.trim() && !ing.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false
    return true
  })

  return (
    <div className="max-w-5xl mx-auto">
      <HeroBanner
        metrics={metrics}
        onAddIngredient={() => setAddModalOpen(true)}
        onGoToUpload={() => uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        lowStockActive={statusFilter === 'low_stock'}
        onToggleLowStock={() => setStatusFilter((f) => (f === 'low_stock' ? 'all' : 'low_stock'))}
      />

      {error && <p className={`${ERROR_BANNER} mb-6`}>{error}</p>}

      {/* Ingredient list — single unified panel: toolbar header + table body */}
      <section className="mb-8">
        <div className={`bg-white rounded-2xl ${SHADOW_CARD} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#E4E2DC]">
            <h2 className="text-[15px] font-bold text-[#18233D]">
              Ingredient List
              <span className="ml-2 text-xs font-medium text-[#8B96A6]">
                {visibleIngredients.length} of {ingredients.length}
              </span>
            </h2>
            <div className="flex flex-wrap gap-2.5">
              <div className="relative">
                <IconSearch className="w-4 h-4 text-[#8B96A6] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ingredients…"
                  className={`${INPUT} w-56 pl-9`}
                />
              </div>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`${INPUT} appearance-none pr-8 w-40`}
                >
                  <option value="all">All statuses</option>
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
                <svg
                  className="w-3.5 h-3.5 text-[#8B96A6] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-[#5B6B82] px-5 py-10 text-center">Loading...</p>
          ) : visibleIngredients.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[#5B6B82]">
                {ingredients.length === 0 ? 'Belum ada ingredient. Tambahkan yang pertama.' : 'Gak ada ingredient yang cocok sama filter ini.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-[#F7F5F0] text-left text-xs uppercase tracking-wide text-[#8B96A6]">
                    <th className="px-5 py-3 font-bold">Name</th>
                    <th className="px-5 py-3 font-bold text-right">Stock</th>
                    <th className="px-5 py-3 font-bold text-right">Cost/unit</th>
                    <th className="px-5 py-3 font-bold">Status</th>
                    <th className="px-5 py-3 font-bold w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleIngredients.map((ing) => {
                    const status = stockStatus(ing)
                    return (
                      <tr key={ing.id} className="border-t border-[#E4E2DC] hover:bg-[#F7F5F0]/60 transition-colors">
                        <td className="px-5 py-3 text-[#18233D] font-medium">{ing.name}</td>
                        <td className={`px-5 py-3 text-right tabular-nums ${status.key !== 'in_stock' ? 'font-semibold' : 'text-[#18233D]'} ${
                          status.key === 'out_of_stock' ? 'text-[#B8433B]' : status.key === 'low_stock' ? 'text-[#A2670C]' : ''
                        }`}>
                          {ing.current_stock} {ing.unit}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#5B6B82]">{formatRupiah(ing.cost_per_unit)}</td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1">
                            {status.key !== 'in_stock' && <IconAlertTriangle className={`w-3.5 h-3.5 ${status.tone === 'critical' ? 'text-[#B8433B]' : 'text-[#A2670C]'}`} />}
                            <StatusBadge tone={status.tone} label={status.label} />
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <RowActionMenu
                            onRestock={() => setRestockTarget(ing)}
                            onEdit={() => setEditTarget(ing)}
                            onWaste={() => setWasteTarget(ing)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Receipt upload (tests: parse-receipt, bulk-restock) */}
      <section ref={uploadSectionRef}>
        <h2 className="text-[13px] font-bold text-[#18233D] uppercase tracking-wide mb-3">Restock from Receipt</h2>
        <div className={`bg-white rounded-xl ${SHADOW_CARD} p-5`}>
          {!receiptFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false) }}
              onDrop={handleDrop}
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
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <IconUploadCloud className="w-8 h-8 text-[#8B96A6] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#18233D]">
                Drag &amp; drop your receipt/invoice image here
              </p>
              <p className="text-xs text-[#8B96A6] mt-1">or click to browse — JPG, PNG</p>
              <span className={`${AI_BADGE} mt-3`}>
                <IconSparkles className="w-3 h-3" /> Powered by Vision AI
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-[#E4E2DC] bg-[#F7F5F0] px-4 py-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 text-[#28579C]">
                <IconFile className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#18233D] truncate">{receiptFile.name}</p>
                <p className="text-xs text-[#8B96A6]">{(receiptFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => { setReceiptFile(null); setReceiptItems(null); setReceiptError('') }}
                className="text-xs font-semibold text-[#5B6B82] hover:text-[#18233D] transition-colors shrink-0"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={handleParseReceipt}
                disabled={receiptLoading}
                className={`${BTN_PRIMARY} shrink-0`}
              >
                {receiptLoading ? 'Reading receipt…' : 'Parse Receipt'}
              </button>
            </div>
          )}

          {receiptError && <p className={`${ERROR_BANNER} mt-4`}>{receiptError}</p>}

          {receiptItems && receiptItems.length > 0 && (
            <>
              <div className="rounded-lg border border-[#E4E2DC] overflow-hidden mt-4 mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-[#F7F5F0] text-[#8B96A6] text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-bold">Name</th>
                      <th className="text-right px-3 py-2.5 font-bold">Qty</th>
                      <th className="text-left px-3 py-2.5 font-bold">Unit</th>
                      <th className="text-right px-3 py-2.5 font-bold">Total price</th>
                      <th className="text-left px-3 py-2.5 font-bold">Expiry date</th>
                      <th className="text-left px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptItems.map((item, i) => (
                      <tr key={i} className="border-t border-[#E4E2DC]">
                        <td className="px-3 py-2">
                          <input
                            value={item.name}
                            onChange={(e) => updateReceiptItem(i, { name: e.target.value })}
                            className={INPUT}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" step="0.001"
                            value={item.quantity}
                            onChange={(e) => updateReceiptItem(i, { quantity: e.target.value })}
                            className={`${INPUT} text-right`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={item.unit}
                            onChange={(e) => updateReceiptItem(i, { unit: e.target.value })}
                            className={INPUT}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" step="0.01"
                            value={item.total_price}
                            onChange={(e) => updateReceiptItem(i, { total_price: e.target.value })}
                            className={`${INPUT} text-right`}
                            placeholder="opsional"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) => updateReceiptItem(i, { expiry_date: e.target.value })}
                            className={INPUT}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => removeReceiptItem(i)} className={`text-xs font-semibold ${LINK_CRITICAL}`}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={handleBulkRestock} disabled={bulkSubmitting} className={BTN_PRIMARY}>
                {bulkSubmitting ? 'Submitting...' : `Confirm & Restock ${receiptItems.length} item(s)`}
              </button>
            </>
          )}

          {receiptItems && receiptItems.length === 0 && (
            <p className="text-sm text-[#5B6B82] mt-4">Gak ada item terdeteksi dari struk ini.</p>
          )}
        </div>
      </section>

      {addModalOpen && (
        <AddIngredientModal
          onClose={() => setAddModalOpen(false)}
          onSaved={() => { setAddModalOpen(false); fetchIngredients() }}
        />
      )}
      {restockTarget && (
        <RestockModal
          ingredient={restockTarget}
          onClose={() => setRestockTarget(null)}
          onSaved={() => { setRestockTarget(null); fetchIngredients() }}
        />
      )}
      {editTarget && (
        <EditIngredientModal
          ingredient={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchIngredients() }}
        />
      )}
      {wasteTarget && (
        <WasteModal
          ingredient={wasteTarget}
          onClose={() => setWasteTarget(null)}
          onSaved={() => { setWasteTarget(null); fetchIngredients() }}
        />
      )}
    </div>
  )
}
