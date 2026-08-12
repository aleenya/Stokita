import { useEffect, useState } from 'react'
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

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18233D]/40 backdrop-blur-[1px] px-4">
      <div className={`w-full max-w-md bg-white rounded-xl ${SHADOW_FLOAT} p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[19px] font-bold text-[#18233D]">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#8B96A6] hover:bg-[#F7F5F0] hover:text-[#18233D] transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#18233D]">Menus</h1>
          <p className="text-sm text-[#5B6B82] mt-1">{menus.length} menu terdaftar</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className={BTN_PRIMARY}>
          + Tambah menu
        </button>
      </div>

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

      {loading ? (
        <p className="text-sm text-[#8B96A6]">Loading…</p>
      ) : menus.length === 0 ? (
        <div className="border border-dashed border-[#CBD1DB] rounded-xl py-16 text-center">
          <p className="text-[#5B6B82]">Belum ada menu. Tambahkan yang pertama.</p>
        </div>
      ) : (
        <div className={`bg-white rounded-xl ${SHADOW_CARD} overflow-hidden overflow-x-auto`}>
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-[#F7F5F0] text-left text-xs uppercase tracking-wide text-[#8B96A6]">
                <th className="px-4 py-3 font-bold">Name</th>
                <th className="px-4 py-3 font-bold">Sell price</th>
                <th className="px-4 py-3 font-bold">Unit cost</th>
                <th className="px-4 py-3 font-bold">Margin</th>
                <th className="px-4 py-3 font-bold">Recipe</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {menus.map((menu) => {
                const margin = marginPct(menu)
                const belowTarget = margin !== null && margin < Number(menu.target_margin)
                return (
                  <tr key={menu.id} className="border-t border-[#E4E2DC]">
                    <td className="px-4 py-3 text-[#18233D] font-medium">{menu.name}</td>
                    <td className="px-4 py-3 text-[#18233D]">Rp {formatRupiah(menu.sell_price)}</td>
                    <td className="px-4 py-3 text-[#5B6B82]">Rp {formatRupiah(menu.unit_cost)}</td>
                    <td className="px-4 py-3">
                      {margin === null ? (
                        <span className="text-[#8B96A6]">—</span>
                      ) : (
                        <span className={belowTarget ? 'text-[#B8433B]' : 'text-[#2E7D53]'}>
                          {margin.toFixed(1)}%
                        </span>
                      )}
                      <span className="text-[#8B96A6]"> / target {Number(menu.target_margin)}%</span>
                    </td>
                    <td className="px-4 py-3 text-[#5B6B82]">
                      {menu.recipe_lines.length === 0
                        ? 'Belum ada'
                        : `${menu.recipe_lines.length} ingredient`}
                    </td>
                    <td className="px-4 py-3">
                      {menu.is_active ? (
                        <span className="text-xs font-semibold text-[#2E7D53] bg-[#EAF5EE] rounded-full px-2.5 py-1">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-[#8B96A6] bg-[#F7F5F0] rounded-full px-2.5 py-1">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3 text-xs font-semibold">
                        <button onClick={() => setRecipeTarget(menu)} className={LINK_BRAND}>
                          Recipe
                        </button>
                        <button onClick={() => setFormTarget(menu)} className={LINK_MUTED}>
                          Edit
                        </button>
                        <button onClick={() => handleToggleActive(menu)} className={LINK_MUTED}>
                          {menu.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(menu)}
                          disabled={deletingId === menu.id}
                          className={`${LINK_CRITICAL} disabled:opacity-50`}
                        >
                          {deletingId === menu.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

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
