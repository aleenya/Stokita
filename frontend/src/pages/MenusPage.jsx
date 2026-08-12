import { useEffect, useState, useRef } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS — sama persis dengan Dashboard.jsx / Sidebar.jsx / IngredientsPage.jsx
   (bg #F7F5F0 · navy #18233D · slate #5B6B82/#8B96A6 · border #E4E2DC/#CBD1DB ·
   brand #28579C/#1E4278/#EAF1FB · success #2E7D53/#EAF5EE · critical #B8433B/#FBEBEA)
   ========================================================================= */
const SHADOW_CARD =
  'shadow-[0_2px_6px_rgba(24,35,61,0.06),0_10px_24px_-8px_rgba(24,35,61,0.22)]'
const SHADOW_FLOAT =
  'shadow-[0_14px_32px_-10px_rgba(20,29,52,0.28),0_2px_8px_rgba(20,29,52,0.08)]'

const LABEL = 'block text-xs uppercase tracking-wide text-[#8B96A6] mb-1.5'
const INPUT =
  'w-full bg-white border border-[#E4E2DC] rounded-md px-3 py-2 text-[#18233D] focus:outline-none focus:ring-2 focus:ring-[#28579C]/25 focus:border-[#28579C] transition-colors'
const BTN_PRIMARY =
  'text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'text-sm font-semibold text-[#5B6B82] border border-[#E4E2DC] rounded-full px-4 py-2.5 hover:bg-[#F7F5F0] transition-colors'
const LINK_BRAND = 'text-[#28579C] hover:text-[#1E4278] transition-colors'
const LINK_MUTED = 'text-[#5B6B82] hover:text-[#18233D] transition-colors'
const LINK_CRITICAL = 'text-[#B8433B] hover:text-[#8F332C] transition-colors'
const ERROR_BANNER = 'text-sm text-[#B8433B] bg-[#FBEBEA] rounded-md px-3 py-2'

const TONE_BADGE = {
  critical: 'text-[#B8433B] bg-[#FBEBEA]',
  warning: 'text-[#A2670C] bg-[#FCF3E2]',
  success: 'text-[#2E7D53] bg-[#EAF5EE]',
  neutral: 'text-[#8B96A6] bg-[#F7F5F0]',
}

/* =========================================================================
   ICONS — inline SVG, stroke-based (sama konvensi kayak Sidebar.jsx /
   IngredientsPage.jsx), gak nambah dependency icon library baru.
   ========================================================================= */
const ic = {
  className: 'w-4 h-4', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}
const IconSearch = (p) => (
  <svg {...ic} {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
)
const IconPlus = (p) => (
  <svg {...ic} {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
)
const IconX = (p) => (
  <svg {...ic} {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
)
const IconMoreVertical = (p) => (
  <svg {...ic} {...p}><circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" /></svg>
)
const IconPencil = (p) => (
  <svg {...ic} {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
)
const IconPower = (p) => (
  <svg {...ic} {...p}><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.8 0" /></svg>
)
const IconTrash = (p) => (
  <svg {...ic} {...p}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
)
const IconBook = (p) => (
  <svg {...ic} {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
)
const IconAlertTriangle = (p) => (
  <svg {...ic} {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
)

/* =========================================================================
   HELPERS
   ========================================================================= */
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

function formatRupiah(n) {
  return (Number(n) || 0).toLocaleString('id-ID')
}

function marginPct(menu) {
  const price = Number(menu.sell_price) || 0
  const cost = Number(menu.unit_cost) || 0
  if (price <= 0) return null
  return ((price - cost) / price) * 100
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
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18233D]/40 backdrop-blur-[1px] px-4">
      <div className={`w-full max-w-md bg-white rounded-xl ${SHADOW_FLOAT} p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[19px] font-bold text-[#18233D]">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#8B96A6] hover:bg-[#F7F5F0] hover:text-[#18233D] transition-colors"
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
   HERO — minimal flat header: title + actions, stats as plain inline pills
   with no card/banner wrapper at all. Deliberately the leanest of the 3
   list-page headers (Ingredients uses a light stat-strip card, Sales uses
   a tinted banner) so the app doesn't read as one template copy-pasted.
   ========================================================================= */
function InlinePill({ label, value, tone = 'neutral', onClick, active }) {
  const toneClass =
    tone === 'warning'
      ? 'text-[#A2670C] bg-[#FCF3E2] border-[#A2670C]/20'
      : 'text-[#5B6B82] bg-white border-[#E4E2DC]'
  const Comp = onClick ? 'button' : 'span'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-3 py-1.5 transition-colors ${toneClass} ${
        onClick ? 'hover:border-[#28579C]/40 cursor-pointer' : ''
      } ${active ? 'ring-2 ring-[#28579C]/30 border-[#28579C]' : ''}`}
    >
      {label}: <span className="text-[#18233D] font-bold">{value}</span>
    </Comp>
  )
}

function HeroBanner({ metrics, onAddMenu, onViewAtRisk, atRiskActive }) {
  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-3.5">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#18233D]">
            Menu &amp; Recipe Management
          </h1>
          <p className="text-sm text-[#5B6B82] mt-1">Manage your catalog, recipes, and profit margins.</p>
        </div>
        <button onClick={onAddMenu} className={BTN_PRIMARY}>
          <span className="inline-flex items-center gap-1.5"><IconPlus className="w-4 h-4" /> Add Menu</span>
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <InlinePill label="Total Menus" value={metrics.total} />
        <InlinePill
          label="Below Target Margin"
          value={metrics.belowTarget}
          tone={metrics.belowTarget > 0 ? 'warning' : 'neutral'}
          onClick={onViewAtRisk}
          active={atRiskActive}
        />
        <InlinePill label="Avg Margin" value={metrics.avgMargin === null ? '—' : `${metrics.avgMargin.toFixed(1)}%`} />
      </div>
    </div>
  )
}

/* =========================================================================
   ADD / EDIT MENU MODAL
   ========================================================================= */
function MenuFormModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial)
  const [form, setForm] = useState({
    name: initial?.name || '',
    sell_price: initial?.sell_price ?? '',
    target_margin: initial?.target_margin ?? '',
    is_active: initial?.is_active ?? true,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Nama menu wajib diisi.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        sell_price: form.sell_price === '' ? 0 : form.sell_price,
        target_margin: form.target_margin === '' ? 0 : form.target_margin,
        is_active: form.is_active,
      }
      const res = isEdit
        ? await api.patch(`/menus/${initial.id}/`, payload)
        : await api.post('/menus/', payload)
      onSaved(res.data)
    } catch (err) {
      setError(extractError(err) || 'Gagal menyimpan menu.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? 'Edit menu' : 'Tambah menu'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className={LABEL}>Nama menu</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={INPUT}
            placeholder="Chicken Rice Bowl"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Harga jual</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.sell_price}
              onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
              className={INPUT}
              placeholder="0.00"
            />
          </div>

          <div>
            <label className={LABEL}>Target margin (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.target_margin}
              onChange={(e) => setForm({ ...form, target_margin: e.target.value })}
              className={INPUT}
              placeholder="30"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-[#18233D]">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="rounded border-[#E4E2DC] text-[#28579C] focus:ring-[#28579C]"
          />
          Menu aktif (tampil di daftar jual)
        </label>

        {error && <p className={ERROR_BANNER}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${BTN_SECONDARY}`}>
            Batal
          </button>
          <button type="submit" disabled={saving} className={`flex-1 ${BTN_PRIMARY}`}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* =========================================================================
   RECIPE MODAL
   ========================================================================= */
function RecipeModal({ menu, ingredients, onClose, onSaved }) {
  const [lines, setLines] = useState(() =>
    menu.recipe_lines.map((l) => ({ ingredient_id: l.ingredient, qty_per_serving: String(l.qty_per_serving) }))
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function addLine() {
    const used = new Set(lines.map((l) => l.ingredient_id))
    const next = ingredients.find((ing) => !used.has(ing.id))
    setLines([...lines, { ingredient_id: next?.id || '', qty_per_serving: '' }])
  }

  function updateLine(idx, patch) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  function removeLine(idx) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (lines.some((l) => !l.ingredient_id)) {
      setError('Pilih ingredient untuk setiap baris, atau hapus barisnya.')
      return
    }
    if (lines.some((l) => !l.qty_per_serving || Number(l.qty_per_serving) <= 0)) {
      setError('Jumlah per porsi harus lebih dari 0.')
      return
    }
    const ids = lines.map((l) => l.ingredient_id)
    if (new Set(ids).size !== ids.length) {
      setError('Satu ingredient cuma boleh muncul sekali di resep.')
      return
    }

    setSaving(true)
    try {
      const res = await api.put(`/menus/${menu.id}/recipe/`, {
        lines: lines.map((l) => ({ ingredient_id: l.ingredient_id, qty_per_serving: l.qty_per_serving })),
      })
      onSaved(res.data)
    } catch (err) {
      setError(extractError(err) || 'Gagal menyimpan resep.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Resep — ${menu.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {lines.length === 0 && (
          <p className="text-sm text-[#5B6B82]">Belum ada ingredient di resep ini.</p>
        )}

        <div className="space-y-3">
          {lines.map((line, idx) => {
            const ing = ingredients.find((i) => i.id === line.ingredient_id)
            return (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className={LABEL}>Ingredient</label>
                  <select
                    value={line.ingredient_id}
                    onChange={(e) => updateLine(idx, { ingredient_id: e.target.value })}
                    className={INPUT}
                  >
                    <option value="">— pilih —</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className={LABEL}>Qty ({ing?.unit || 'unit'})</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={line.qty_per_serving}
                    onChange={(e) => updateLine(idx, { qty_per_serving: e.target.value })}
                    className={INPUT}
                    placeholder="0"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  aria-label="Hapus baris"
                  className={`mb-0.5 h-[38px] px-2 text-sm font-semibold ${LINK_CRITICAL}`}
                >
                  Hapus
                </button>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={addLine}
          disabled={lines.length >= ingredients.length}
          className={`text-sm font-semibold ${LINK_BRAND} disabled:opacity-50`}
        >
          + Tambah ingredient
        </button>

        {error && <p className={ERROR_BANNER}>{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${BTN_SECONDARY}`}>
            Batal
          </button>
          <button type="submit" disabled={saving} className={`flex-1 ${BTN_PRIMARY}`}>
            {saving ? 'Menyimpan…' : 'Simpan resep'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* =========================================================================
   ROW ACTION MENU — Edit / Deactivate / Delete (Recipe stays as a visible
   primary link since it's the most frequent action on a menu row).
   ========================================================================= */
function RowActionMenu({ isActive, onEdit, onToggleActive, onDelete, deleting }) {
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
        <div className={`absolute right-0 top-8 z-10 w-44 rounded-lg bg-white border border-[#E4E2DC] ${SHADOW_FLOAT} py-1`}>
          <button
            type="button"
            onClick={() => { setOpen(false); onEdit() }}
            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-[#18233D] hover:bg-[#F7F5F0] transition-colors"
          >
            <IconPencil className="w-3.5 h-3.5 text-[#8B96A6]" /> Edit
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onToggleActive() }}
            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-[#18233D] hover:bg-[#F7F5F0] transition-colors"
          >
            <IconPower className="w-3.5 h-3.5 text-[#8B96A6]" /> {isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete() }}
            disabled={deleting}
            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-[#B8433B] hover:bg-[#FBEBEA] transition-colors disabled:opacity-50"
          >
            <IconTrash className="w-3.5 h-3.5" /> {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   PAGE
   ========================================================================= */
export default function MenusPage({ onLogout }) {
  const [menus, setMenus] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formTarget, setFormTarget] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [recipeTarget, setRecipeTarget] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | active | inactive | at_risk

  useEffect(() => {
    let ignore = false

    async function load() {
      try {
        const [menusRes, ingredientsRes] = await Promise.all([
          api.get('/menus/'),
          api.get('/ingredients/'),
        ])
        if (ignore) return
        setMenus(menusRes.data)
        setIngredients(ingredientsRes.data)
        setError('')
      } catch (err) {
        if (ignore) return
        if (err.response?.status === 401) {
          onLogout?.()
          return
        }
        setError('Gagal memuat data menu. Cek backend-nya udah jalan belum.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [onLogout, reloadToken])

  function handleSaved(menu) {
    setMenus((prev) => {
      const exists = prev.some((m) => m.id === menu.id)
      return exists ? prev.map((m) => (m.id === menu.id ? menu : m)) : [...prev, menu]
    })
    setFormTarget(null)
    setShowAddForm(false)
    setRecipeTarget(null)
  }

  async function handleToggleActive(menu) {
    try {
      const res = await api.patch(`/menus/${menu.id}/`, { is_active: !menu.is_active })
      setMenus((prev) => prev.map((m) => (m.id === menu.id ? res.data : m)))
    } catch {
      setError(`Gagal update status ${menu.name}.`)
    }
  }

  async function handleDelete(menu) {
    if (!window.confirm(`Hapus menu "${menu.name}"?`)) return
    setDeletingId(menu.id)
    try {
      await api.delete(`/menus/${menu.id}/`)
      setMenus((prev) => prev.filter((m) => m.id !== menu.id))
    } catch {
      setError(`Gagal menghapus ${menu.name}.`)
    } finally {
      setDeletingId(null)
    }
  }

  // === derived: metrics + filtered list ===
  const marginValues = menus.map((m) => marginPct(m)).filter((v) => v !== null)
  const metrics = {
    total: menus.length,
    belowTarget: menus.filter((m) => {
      const margin = marginPct(m)
      return margin !== null && margin < Number(m.target_margin)
    }).length,
    avgMargin: marginValues.length ? marginValues.reduce((a, b) => a + b, 0) / marginValues.length : null,
  }

  const visibleMenus = menus.filter((menu) => {
    if (searchQuery.trim() && !menu.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false
    if (statusFilter === 'active' && !menu.is_active) return false
    if (statusFilter === 'inactive' && menu.is_active) return false
    if (statusFilter === 'at_risk') {
      const margin = marginPct(menu)
      if (margin === null || margin >= Number(menu.target_margin)) return false
    }
    return true
  })

  return (
    <div className="max-w-5xl mx-auto">
      <HeroBanner
        metrics={metrics}
        onAddMenu={() => setShowAddForm(true)}
        onViewAtRisk={() => setStatusFilter((f) => (f === 'at_risk' ? 'all' : 'at_risk'))}
        atRiskActive={statusFilter === 'at_risk'}
      />

      {error && (
        <p className={`${ERROR_BANNER} mb-6 flex items-center justify-between gap-3`}>
          <span>{error}</span>
          <button
            onClick={() => {
              setLoading(true)
              setReloadToken((n) => n + 1)
            }}
            className={`shrink-0 text-sm font-semibold ${LINK_BRAND}`}
          >
            Retry
          </button>
        </p>
      )}

      {/* Menu list — single unified panel: toolbar header + table body */}
      <div className={`bg-white rounded-2xl ${SHADOW_CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#E4E2DC]">
          <h2 className="text-[15px] font-bold text-[#18233D]">
            Menus
            <span className="ml-2 text-xs font-medium text-[#8B96A6]">
              {visibleMenus.length} of {menus.length}
            </span>
          </h2>
          <div className="flex flex-wrap gap-2.5">
            <div className="relative">
              <IconSearch className="w-4 h-4 text-[#8B96A6] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menus…"
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
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="at_risk">Below target</option>
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
          <p className="text-sm text-[#8B96A6] px-5 py-10 text-center">Loading…</p>
        ) : visibleMenus.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[#5B6B82]">
              {menus.length === 0 ? 'Belum ada menu. Tambahkan yang pertama.' : 'Gak ada menu yang cocok sama filter ini.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-[#F7F5F0] text-left text-xs uppercase tracking-wide text-[#8B96A6]">
                  <th className="px-5 py-3 font-bold">Name</th>
                  <th className="px-5 py-3 font-bold text-right">Sell price</th>
                  <th className="px-5 py-3 font-bold text-right">Unit cost</th>
                  <th className="px-5 py-3 font-bold text-right">Margin</th>
                  <th className="px-5 py-3 font-bold">Recipe</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold w-12"></th>
                </tr>
              </thead>
              <tbody>
                {visibleMenus.map((menu) => {
                  const margin = marginPct(menu)
                  const belowTarget = margin !== null && margin < Number(menu.target_margin)
                  return (
                    <tr key={menu.id} className="border-t border-[#E4E2DC] hover:bg-[#F7F5F0]/60 transition-colors">
                      <td className="px-5 py-3 text-[#18233D] font-medium">{menu.name}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#18233D]">Rp {formatRupiah(menu.sell_price)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#5B6B82]">Rp {formatRupiah(menu.unit_cost)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          {belowTarget && <IconAlertTriangle className="w-3.5 h-3.5 text-[#B8433B]" />}
                          <span className={belowTarget ? 'font-semibold text-[#B8433B]' : 'text-[#2E7D53]'}>
                            {margin === null ? '—' : `${margin.toFixed(1)}%`}
                          </span>
                        </span>
                        <span className="block text-xs text-[#8B96A6]">target {Number(menu.target_margin)}%</span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setRecipeTarget(menu)}
                          className={`inline-flex items-center gap-1.5 text-sm font-semibold ${LINK_BRAND}`}
                        >
                          <IconBook className="w-3.5 h-3.5" />
                          {menu.recipe_lines.length === 0 ? 'Add recipe' : `${menu.recipe_lines.length} ingredient`}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge tone={menu.is_active ? 'success' : 'neutral'} label={menu.is_active ? 'Active' : 'Inactive'} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RowActionMenu
                          isActive={menu.is_active}
                          onEdit={() => setFormTarget(menu)}
                          onToggleActive={() => handleToggleActive(menu)}
                          onDelete={() => handleDelete(menu)}
                          deleting={deletingId === menu.id}
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

      {showAddForm && <MenuFormModal onClose={() => setShowAddForm(false)} onSaved={handleSaved} />}
      {formTarget && (
        <MenuFormModal initial={formTarget} onClose={() => setFormTarget(null)} onSaved={handleSaved} />
      )}
      {recipeTarget && (
        <RecipeModal
          menu={recipeTarget}
          ingredients={ingredients}
          onClose={() => setRecipeTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
