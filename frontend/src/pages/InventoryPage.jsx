import { useEffect, useState } from 'react'
import api from '../api/client'

const UNIT_OPTIONS = ['kg', 'g', 'l', 'ml', 'pcs', 'pack']

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

function isLowStock(ing) {
  if (ing.low_stock_threshold === null || ing.low_stock_threshold === undefined || ing.low_stock_threshold === '') {
    return false
  }
  return Number(ing.current_stock) <= Number(ing.low_stock_threshold)
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16211B]/50 px-4">
      <div className="w-full max-w-sm bg-[#FAF6EC] rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-[Fraunces,serif] font-semibold text-xl text-[#1F2A24]">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="text-[#8A8377] hover:text-[#1F2A24] transition text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function IngredientFormModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial)
  const [form, setForm] = useState({
    name: initial?.name || '',
    unit: initial?.unit || 'kg',
    cost_per_unit: initial?.cost_per_unit ?? '',
    low_stock_threshold: initial?.low_stock_threshold ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Nama ingredient wajib diisi.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        unit: form.unit,
        cost_per_unit: form.cost_per_unit === '' ? 0 : form.cost_per_unit,
        low_stock_threshold: form.low_stock_threshold === '' ? null : form.low_stock_threshold,
      }
      const res = isEdit
        ? await api.patch(`/ingredients/${initial.id}/`, payload)
        : await api.post('/ingredients/', payload)
      onSaved(res.data)
    } catch (err) {
      setError(extractError(err) || 'Gagal menyimpan ingredient.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? 'Edit ingredient' : 'Tambah ingredient'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
            Nama
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
            placeholder="Chicken breast"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
              Unit
            </label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
              Cost/unit
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.cost_per_unit}
              onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })}
              className="w-full bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
            Low-stock threshold
          </label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.low_stock_threshold}
            onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
            className="w-full bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
            placeholder="Opsional"
          />
        </div>

        {error && (
          <p className="text-sm text-[#C1443B] bg-[#C1443B]/10 border border-[#C1443B]/30 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-[#D8D0BF] text-[#5C6B62] rounded-md py-2.5 font-medium hover:bg-[#F3EFE4] transition"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-[#16211B] text-[#F3EFE4] rounded-md py-2.5 font-medium hover:bg-[#1D2B23] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RestockModal({ ingredient, onClose, onRestocked }) {
  const [qty, setQty] = useState('')
  const [expiry, setExpiry] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const n = Number(qty)
    if (!qty || n <= 0) {
      setError('Jumlah restock harus lebih dari 0.')
      return
    }

    setSaving(true)
    try {
      const res = await api.post(`/ingredients/${ingredient.id}/restock/`, {
        change_qty: qty,
        expiry_date: expiry || null,
      })
      onRestocked(ingredient.id, res.data.current_stock)
    } catch (err) {
      setError(extractError(err) || 'Gagal restock.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Restock — ${ingredient.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
            Jumlah masuk ({ingredient.unit})
          </label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
            placeholder="0"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
            Tanggal kedaluwarsa (opsional)
          </label>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="w-full bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
          />
        </div>

        {error && (
          <p className="text-sm text-[#C1443B] bg-[#C1443B]/10 border border-[#C1443B]/30 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-[#D8D0BF] text-[#5C6B62] rounded-md py-2.5 font-medium hover:bg-[#F3EFE4] transition"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-[#5C8B6E] text-[#F3EFE4] rounded-md py-2.5 font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Menyimpan…' : 'Restock'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function InventoryPage({ onLogout }) {
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formTarget, setFormTarget] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [restockTarget, setRestockTarget] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let ignore = false

    async function loadIngredients() {
      try {
        const res = await api.get('/ingredients/')
        if (ignore) return
        setIngredients(res.data)
        setError('')
      } catch (err) {
        if (ignore) return
        if (err.response?.status === 401) {
          onLogout?.()
          return
        }
        setError('Gagal memuat data inventory. Cek backend-nya udah jalan belum.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadIngredients()
    return () => {
      ignore = true
    }
  }, [onLogout, reloadToken])

  function handleSaved(ing) {
    setIngredients((prev) => {
      const exists = prev.some((i) => i.id === ing.id)
      return exists ? prev.map((i) => (i.id === ing.id ? ing : i)) : [...prev, ing]
    })
    setFormTarget(null)
    setShowAddForm(false)
  }

  function handleRestocked(id, newStock) {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, current_stock: newStock } : i)))
    setRestockTarget(null)
  }

  async function handleDelete(ing) {
    if (!window.confirm(`Hapus "${ing.name}" dari inventory?`)) return
    setDeletingId(ing.id)
    try {
      await api.delete(`/ingredients/${ing.id}/`)
      setIngredients((prev) => prev.filter((i) => i.id !== ing.id))
    } catch {
      setError(`Gagal menghapus ${ing.name}.`)
    } finally {
      setDeletingId(null)
    }
  }

  const lowStockCount = ingredients.filter(isLowStock).length

  return (
    <div className="min-h-screen bg-[#FAF6EC] font-[Inter,sans-serif]">
      {/* Header */}
      <header className="bg-[#16211B] text-[#F3EFE4] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#E2A33D]" />
          <span className="text-sm tracking-[0.2em] uppercase text-[#9FAFA3] font-[IBM_Plex_Mono,monospace]">
            Stokita
          </span>
          <span className="text-[#6F8578]">/</span>
          <span className="text-sm text-[#F3EFE4]">Inventory</span>
        </div>
        <button
          onClick={onLogout}
          className="text-xs tracking-[0.05em] uppercase text-[#9FAFA3] hover:text-[#F3EFE4] transition"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-[Fraunces,serif] font-semibold text-3xl text-[#1F2A24]">Ingredients</h1>
            <p className="text-sm text-[#5C6B62] mt-1">
              {ingredients.length} item tracked
              {lowStockCount > 0 && (
                <span className="text-[#C1443B]"> · {lowStockCount} low on stock</span>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-[#E2A33D] text-[#1F2A24] rounded-md px-4 py-2.5 font-medium hover:opacity-90 transition"
          >
            + Add ingredient
          </button>
        </div>

        {error && (
          <p className="text-sm text-[#C1443B] bg-[#C1443B]/10 border border-[#C1443B]/30 rounded-md px-3 py-2 mb-6 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => {
                setLoading(true)
                setReloadToken((n) => n + 1)
              }}
              className="shrink-0 underline hover:no-underline"
            >
              Retry
            </button>
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[#8A8377]">Loading…</p>
        ) : ingredients.length === 0 ? (
          <div className="border border-dashed border-[#D8D0BF] rounded-lg py-16 text-center">
            <p className="text-[#5C6B62]">Belum ada ingredient. Tambahkan yang pertama.</p>
          </div>
        ) : (
          <div className="border border-[#D8D0BF] rounded-lg overflow-hidden overflow-x-auto bg-white">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-[#F3EFE4] text-left text-xs tracking-[0.05em] uppercase text-[#5C6B62] font-[IBM_Plex_Mono,monospace]">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Cost/unit</th>
                  <th className="px-4 py-3 font-medium">Threshold</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ing) => {
                  const low = isLowStock(ing)
                  return (
                    <tr key={ing.id} className="border-t border-[#D8D0BF]">
                      <td className="px-4 py-3 text-[#1F2A24] font-medium">{ing.name}</td>
                      <td className="px-4 py-3 text-[#1F2A24]">
                        {ing.current_stock} {ing.unit}
                      </td>
                      <td className="px-4 py-3 text-[#5C6B62]">{ing.cost_per_unit}</td>
                      <td className="px-4 py-3 text-[#5C6B62]">
                        {ing.low_stock_threshold ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {low ? (
                          <span className="inline-flex items-center gap-1 text-xs font-[IBM_Plex_Mono,monospace] tracking-[0.05em] uppercase text-[#C1443B] bg-[#C1443B]/10 border border-[#C1443B]/30 rounded-full px-2 py-0.5">
                            Low stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-[IBM_Plex_Mono,monospace] tracking-[0.05em] uppercase text-[#5C8B6E] bg-[#5C8B6E]/10 border border-[#5C8B6E]/30 rounded-full px-2 py-0.5">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3 text-xs">
                          <button
                            onClick={() => setRestockTarget(ing)}
                            className="text-[#5C8B6E] hover:underline"
                          >
                            Restock
                          </button>
                          <button
                            onClick={() => setFormTarget(ing)}
                            className="text-[#5C6B62] hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(ing)}
                            disabled={deletingId === ing.id}
                            className="text-[#C1443B] hover:underline disabled:opacity-50"
                          >
                            {deletingId === ing.id ? '…' : 'Delete'}
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
      </main>

      {showAddForm && (
        <IngredientFormModal onClose={() => setShowAddForm(false)} onSaved={handleSaved} />
      )}
      {formTarget && (
        <IngredientFormModal initial={formTarget} onClose={() => setFormTarget(null)} onSaved={handleSaved} />
      )}
      {restockTarget && (
        <RestockModal
          ingredient={restockTarget}
          onClose={() => setRestockTarget(null)}
          onRestocked={handleRestocked}
        />
      )}
    </div>
  )
}
