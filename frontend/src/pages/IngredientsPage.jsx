import { useEffect, useMemo, useState } from 'react'
import api from '../api/client'

const UNIT_OPTIONS = ['kg', 'g', 'liter', 'ml', 'pcs', 'pack', 'box', 'dozen']

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

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

// Status per ingredient. Expiry data is optional — some ingredients may not
// have a next_expiry_date yet (never restocked with a date, or backend
// doesn't return one), the UI degrades gracefully in that case.
function getStatus(ing) {
  const stock = Number(ing.current_stock) || 0
  if (stock <= 0) return 'out'
  const days = daysUntil(ing.next_expiry_date ?? ing.expiry_date)
  if (days !== null && days <= 3) return 'expiring'
  const threshold = ing.low_stock_threshold
  if (threshold !== null && threshold !== undefined && stock <= Number(threshold)) return 'low'
  return 'healthy'
}

const STATUS_META = {
  healthy: { label: 'Healthy', dot: 'bg-[#5C8B6E]', text: 'text-[#5C8B6E]', bg: 'bg-[#5C8B6E]/10 border-[#5C8B6E]/30' },
  low: { label: 'Low stock', dot: 'bg-[#E2A33D]', text: 'text-[#B9812C]', bg: 'bg-[#E2A33D]/10 border-[#E2A33D]/40' },
  expiring: { label: 'Expiring soon', dot: 'bg-[#C1443B]', text: 'text-[#C1443B]', bg: 'bg-[#C1443B]/10 border-[#C1443B]/30' },
  out: { label: 'Out of stock', dot: 'bg-[#8A8377]', text: 'text-[#8A8377]', bg: 'bg-[#8A8377]/10 border-[#8A8377]/30' },
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'out', label: 'Out of stock' },
]

function StatusBadge({ status }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-[IBM_Plex_Mono,monospace] tracking-[0.05em] uppercase border rounded-full px-2 py-0.5 ${meta.text} ${meta.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

function Modal({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16211B]/50 px-4">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-sm'} bg-[#FAF6EC] rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-[Fraunces,serif] font-semibold text-xl text-[#1F2A24]">{title}</h3>
            {subtitle && <p className="text-sm text-[#5C6B62] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="text-[#8A8377] hover:text-[#1F2A24] transition text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------- Add ingredient ----------

function AddIngredientModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', unit: 'kg', current_stock: '', total_cost: '',
    low_stock_threshold: '', expiry_date: '',
  })
  const [aiLoading, setAiLoading] = useState(false)
  const [aiNote, setAiNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleGenerateExpiry() {
    if (!form.name) return
    setAiLoading(true)
    setAiNote('')
    try {
      const res = await api.post('/ingredients/estimate-expiry/', { name: form.name })
      setForm((prev) => ({ ...prev, expiry_date: res.data.suggested_expiry_date }))
      setAiNote(`${res.data.confidence}: ${res.data.note}`)
    } catch {
      setAiNote('Gagal estimasi, isi manual.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError('Nama ingredient wajib diisi.')
      return
    }

    const qty = Number(form.current_stock) || 0
    const totalCost = Number(form.total_cost) || 0
    const costPerUnit = qty > 0 ? (totalCost / qty).toFixed(2) : totalCost.toFixed(2)

    setSaving(true)
    try {
      const res = await api.post('/ingredients/', {
        name: form.name.trim(),
        unit: form.unit,
        current_stock: qty,
        cost_per_unit: costPerUnit,
        low_stock_threshold: form.low_stock_threshold || null,
        expiry_date: qty ? (form.expiry_date || null) : null,
      })
      onSaved(res.data)
    } catch (err) {
      setError(extractError(err) || 'Gagal menyimpan ingredient.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Add ingredient" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
            placeholder="Chicken breast"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">Unit</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
            >
              {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">Initial stock</label>
            <input
              type="number" step="0.001" min="0"
              value={form.current_stock}
              onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
              className="w-full bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">Total cost paid</label>
          <input
            type="number" step="0.01" min="0"
            value={form.total_cost}
            onChange={(e) => setForm({ ...form, total_cost: e.target.value })}
            className="w-full bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
            placeholder="e.g. 150000"
          />
          {Number(form.current_stock) > 0 && Number(form.total_cost) > 0 && (
            <p className="text-xs text-[#5C6B62] mt-1.5">
              ≈ Rp{(Number(form.total_cost) / Number(form.current_stock)).toFixed(2)} / {form.unit}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">Low-stock threshold</label>
          <input
            type="number" step="0.001" min="0"
            value={form.low_stock_threshold}
            onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
            className="w-full bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">Expiry date</label>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
              className="flex-1 bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={handleGenerateExpiry}
              disabled={!form.name || aiLoading}
              className="text-[#8B6E5C] text-xs font-medium hover:underline disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {aiLoading ? 'Generating…' : '✨ Suggest'}
            </button>
          </div>
          {aiNote && <p className="text-xs text-[#5C6B62] mt-1.5">{aiNote}</p>}
        </div>

        {error && (
          <p className="text-sm text-[#C1443B] bg-[#C1443B]/10 border border-[#C1443B]/30 rounded-md px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 border border-[#D8D0BF] text-[#5C6B62] rounded-md py-2.5 font-medium hover:bg-[#F3EFE4] transition">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 bg-[#16211B] text-[#F3EFE4] rounded-md py-2.5 font-medium hover:bg-[#1D2B23] disabled:opacity-50 disabled:cursor-not-allowed transition">
            {saving ? 'Saving…' : 'Add ingredient'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- Restock (single ingredient) ----------

function RestockModal({ ingredient, onClose, onRestocked }) {
  const [qty, setQty] = useState('')
  const [expiry, setExpiry] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiNote, setAiNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleGenerateExpiry() {
    setAiLoading(true)
    setAiNote('')
    try {
      const res = await api.post('/ingredients/estimate-expiry/', { name: ingredient.name })
      setExpiry(res.data.suggested_expiry_date)
      setAiNote(`${res.data.confidence}: ${res.data.note}`)
    } catch {
      setAiNote('Gagal estimasi, isi manual.')
    } finally {
      setAiLoading(false)
    }
  }

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
      onRestocked(ingredient.id, res.data)
    } catch (err) {
      setError(extractError(err) || 'Gagal restock.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Restock" subtitle={ingredient.name} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">
            Quantity in ({ingredient.unit})
          </label>
          <input
            type="number" step="0.001" min="0" autoFocus
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
            placeholder="0"
          />
          <p className="text-xs text-[#8A8377] mt-1.5">Current stock: {ingredient.current_stock} {ingredient.unit}</p>
        </div>

        <div>
          <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">Expiry date</label>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="flex-1 bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={handleGenerateExpiry}
              disabled={aiLoading}
              className="text-[#8B6E5C] text-xs font-medium hover:underline disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {aiLoading ? 'Generating…' : '✨ Suggest'}
            </button>
          </div>
          {aiNote && <p className="text-xs text-[#5C6B62] mt-1.5">{aiNote}</p>}
        </div>

        {error && (
          <p className="text-sm text-[#C1443B] bg-[#C1443B]/10 border border-[#C1443B]/30 rounded-md px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 border border-[#D8D0BF] text-[#5C6B62] rounded-md py-2.5 font-medium hover:bg-[#F3EFE4] transition">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 bg-[#5C8B6E] text-[#F3EFE4] rounded-md py-2.5 font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {saving ? 'Saving…' : 'Confirm restock'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- Restock from receipt (bulk) ----------

function ReceiptModal({ onClose, onDone }) {
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleParse(e) {
    e.preventDefault()
    if (!file) return
    setParsing(true)
    setError('')
    setItems(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await api.post('/ingredients/parse-receipt/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setItems(res.data.items.map((it) => ({
        name: it.name, quantity: it.quantity, unit: it.unit,
        expiry_date: it.suggested_expiry_date || '', note: it.note || '',
      })))
    } catch {
      setError('Gagal baca struk. Coba foto yang lebih jelas atau isi manual.')
    } finally {
      setParsing(false)
    }
  }

  function updateItem(i, patch) {
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)))
  }

  function removeItem(i) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleConfirm() {
    if (!items || items.length === 0) return
    setSubmitting(true)
    setError('')
    try {
      await api.post('/ingredients/bulk-restock/', {
        items: items.map((it) => ({
          name: it.name, unit: it.unit, change_qty: it.quantity, expiry_date: it.expiry_date || null,
        })),
      })
      onDone()
    } catch {
      setError('Gagal submit. Cek tiap baris (qty harus > 0).')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Restock from receipt" subtitle="Upload a photo, review the items, then confirm." onClose={onClose} wide>
      {!items && (
        <form onSubmit={handleParse} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium tracking-[0.05em] uppercase text-[#5C6B62] mb-2">Receipt photo</label>
            <input
              type="file" accept="image/*"
              onChange={(e) => setFile(e.target.files[0] || null)}
              className="text-sm w-full"
            />
          </div>
          <button
            type="submit"
            disabled={!file || parsing}
            className="bg-[#16211B] text-[#F3EFE4] rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          >
            {parsing ? 'Reading…' : 'Parse receipt'}
          </button>
        </form>
      )}

      {error && (
        <p className="text-sm text-[#C1443B] bg-[#C1443B]/10 border border-[#C1443B]/30 rounded-md px-3 py-2 mt-3">{error}</p>
      )}

      {items && items.length === 0 && (
        <p className="text-sm text-[#5C6B62] mt-3">No items detected on this receipt. Try a clearer photo, or add stock manually.</p>
      )}

      {items && items.length > 0 && (
        <>
          <div className="mt-4 border border-[#D8D0BF] rounded-md overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-[#F3EFE4] text-[#5C6B62] text-xs uppercase font-[IBM_Plex_Mono,monospace]">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Qty</th>
                  <th className="text-left px-3 py-2">Unit</th>
                  <th className="text-left px-3 py-2">Expiry</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-t border-[#D8D0BF] bg-white">
                    <td className="px-3 py-2">
                      <input value={item.name} onChange={(e) => updateItem(i, { name: e.target.value })}
                        className="border border-[#D8D0BF] rounded-md px-2 py-1 text-sm w-full" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.001" value={item.quantity}
                        onChange={(e) => updateItem(i, { quantity: e.target.value })}
                        className="border border-[#D8D0BF] rounded-md px-2 py-1 text-sm w-20" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={item.unit} onChange={(e) => updateItem(i, { unit: e.target.value })}
                        className="border border-[#D8D0BF] rounded-md px-2 py-1 text-sm w-16" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="date" value={item.expiry_date}
                        onChange={(e) => updateItem(i, { expiry_date: e.target.value })}
                        className="border border-[#D8D0BF] rounded-md px-2 py-1 text-sm" />
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => removeItem(i)} className="text-[#C1443B] text-xs hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 border border-[#D8D0BF] text-[#5C6B62] rounded-md py-2.5 font-medium hover:bg-[#F3EFE4] transition">
              Cancel
            </button>
            <button
              type="button" onClick={handleConfirm} disabled={submitting}
              className="flex-1 bg-[#5C8B6E] text-[#F3EFE4] rounded-md py-2.5 font-medium hover:opacity-90 disabled:opacity-50 transition"
            >
              {submitting ? 'Submitting…' : `Confirm & restock ${items.length} item${items.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

// ---------- Main page ----------

export default function IngredientsPage({ onLogout }) {
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const [showAdd, setShowAdd] = useState(false)
  const [restockTarget, setRestockTarget] = useState(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
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
        setError('Could not load ingredients. Check that the backend is running.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [onLogout, reloadToken])

  const withStatus = useMemo(
    () => ingredients.map((ing) => ({ ...ing, _status: getStatus(ing) })),
    [ingredients]
  )

  const filtered = useMemo(() => {
    let list = withStatus
    if (filter !== 'all') list = list.filter((ing) => ing._status === filter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((ing) => ing.name.toLowerCase().includes(q))
    }
    return list
  }, [withStatus, filter, search])

  const recommendations = useMemo(
    () => withStatus.filter((ing) => ing._status === 'low' || ing._status === 'out'),
    [withStatus]
  )

  const counts = useMemo(() => {
    const c = { healthy: 0, low: 0, expiring: 0, out: 0 }
    withStatus.forEach((ing) => { c[ing._status]++ })
    return c
  }, [withStatus])

  function upsert(ing) {
    setIngredients((prev) => {
      const exists = prev.some((i) => i.id === ing.id)
      return exists ? prev.map((i) => (i.id === ing.id ? ing : i)) : [ing, ...prev]
    })
  }

  function handleAdded(ing) {
    upsert(ing)
    setShowAdd(false)
  }

  function handleRestocked(id, updated) {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)))
    setRestockTarget(null)
  }

  function handleReceiptDone() {
    setShowReceipt(false)
    setReloadToken((n) => n + 1)
  }

  async function handleDelete(ing) {
    if (!window.confirm(`Remove "${ing.name}" from your ingredients?`)) return
    setDeletingId(ing.id)
    try {
      await api.delete(`/ingredients/${ing.id}/`)
      setIngredients((prev) => prev.filter((i) => i.id !== ing.id))
    } catch {
      setError(`Could not remove ${ing.name}.`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-[Fraunces,serif] font-semibold text-3xl text-[#1F2A24]">Stock</h1>
          <p className="text-sm text-[#5C6B62] mt-1">
            {counts.healthy + counts.low + counts.expiring + counts.out} ingredients tracked
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReceipt(true)}
            className="border border-[#D8D0BF] text-[#5C6B62] bg-white rounded-md px-4 py-2.5 text-sm font-medium hover:bg-[#F3EFE4] transition"
          >
            Restock from receipt
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-[#E2A33D] text-[#1F2A24] rounded-md px-4 py-2.5 text-sm font-medium hover:opacity-90 transition"
          >
            + Add ingredient
          </button>
        </div>
      </div>

      {/* Search + filter tabs */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ingredients…"
          className="bg-white border border-[#D8D0BF] rounded-md px-3 py-2 text-sm text-[#1F2A24] focus:outline-none focus:ring-2 focus:ring-[#E2A33D] focus:border-transparent transition w-full sm:w-64"
        />
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                filter === f.key
                  ? 'bg-[#16211B] text-[#F3EFE4] border-[#16211B]'
                  : 'bg-white text-[#5C6B62] border-[#D8D0BF] hover:bg-[#F3EFE4]'
              }`}
            >
              {f.label}
              {f.key !== 'all' && counts[f.key] > 0 && (
                <span className="ml-1.5 opacity-70">{counts[f.key]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-[#C1443B] bg-[#C1443B]/10 border border-[#C1443B]/30 rounded-md px-3 py-2 mb-6 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setReloadToken((n) => n + 1)} className="shrink-0 underline hover:no-underline">
            Retry
          </button>
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[#8A8377]">Loading…</p>
      ) : (
        <>
          {/* Restock recommendations */}
          {filter === 'all' && !search && recommendations.length > 0 && (
            <div className="mb-8">
              <h2 className="font-[IBM_Plex_Mono,monospace] text-xs tracking-[0.15em] uppercase text-[#5C6B62] mb-3">
                Restock recommendations
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {recommendations.map((ing) => (
                  <div key={ing.id} className="bg-white border border-[#E2A33D]/40 rounded-md p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#1F2A24]">{ing.name}</p>
                      <p className="text-xs text-[#5C6B62] mt-0.5">
                        {ing.current_stock} {ing.unit} remaining
                        {ing.low_stock_threshold != null && ` · threshold ${ing.low_stock_threshold}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setRestockTarget(ing)}
                      className="shrink-0 text-xs font-medium text-[#5C8B6E] hover:underline"
                    >
                      Restock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All ingredients */}
          <h2 className="font-[IBM_Plex_Mono,monospace] text-xs tracking-[0.15em] uppercase text-[#5C6B62] mb-3">
            {filter === 'all' ? 'All ingredients' : FILTERS.find((f) => f.key === filter)?.label}
          </h2>

          {filtered.length === 0 ? (
            <div className="border border-dashed border-[#D8D0BF] rounded-lg py-16 text-center">
              <p className="text-[#5C6B62]">
                {ingredients.length === 0 ? 'No ingredients yet. Add the first one.' : 'Nothing matches this view.'}
              </p>
            </div>
          ) : (
            <div className="border border-[#D8D0BF] rounded-lg overflow-hidden overflow-x-auto bg-white">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="bg-[#F3EFE4] text-left text-xs tracking-[0.05em] uppercase text-[#5C6B62] font-[IBM_Plex_Mono,monospace]">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Cost/unit</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ing) => {
                    const days = daysUntil(ing.next_expiry_date ?? ing.expiry_date)
                    return (
                      <tr key={ing.id} className="border-t border-[#D8D0BF]">
                        <td className="px-4 py-3 text-[#1F2A24] font-medium">{ing.name}</td>
                        <td className="px-4 py-3 text-[#1F2A24]">
                          {ing.current_stock} {ing.unit}
                          {ing._status === 'expiring' && days !== null && (
                            <span className="block text-xs text-[#C1443B] mt-0.5">
                              expires in {days} day{days === 1 ? '' : 's'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#5C6B62]">Rp{ing.cost_per_unit}</td>
                        <td className="px-4 py-3"><StatusBadge status={ing._status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-3 text-xs">
                            <button onClick={() => setRestockTarget(ing)} className="text-[#5C8B6E] hover:underline">
                              Restock
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
        </>
      )}

      {showAdd && <AddIngredientModal onClose={() => setShowAdd(false)} onSaved={handleAdded} />}
      {restockTarget && (
        <RestockModal ingredient={restockTarget} onClose={() => setRestockTarget(null)} onRestocked={handleRestocked} />
      )}
      {showReceipt && <ReceiptModal onClose={() => setShowReceipt(false)} onDone={handleReceiptDone} />}
    </div>
  )
}