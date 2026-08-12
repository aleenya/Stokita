import { useState, useEffect } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS — sama persis dengan Dashboard.jsx / Sidebar.jsx, biar
   semua halaman kepake satu bahasa visual (lihat Dashboard.jsx untuk map
   warna lengkap: bg #F7F5F0 · navy #18233D · slate #5B6B82/#8B96A6 ·
   brand #28579C/#1E4278/#EAF1FB · success #2E7D53 · warning #A2670C ·
   critical #B8433B).
   ========================================================================= */
const SHADOW_CARD =
  'shadow-[0_2px_6px_rgba(24,35,61,0.06),0_10px_24px_-8px_rgba(24,35,61,0.22)]'

const LABEL = 'block text-xs uppercase tracking-wide text-[#8B96A6] mb-1.5'
const INPUT =
  'border border-[#E4E2DC] rounded-md px-3 py-2 text-sm text-[#18233D] placeholder:text-[#8B96A6] focus:outline-none focus:ring-2 focus:ring-[#28579C]/25 focus:border-[#28579C] transition-colors'
const BTN_PRIMARY =
  'text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-5 py-2.5 disabled:opacity-50'
const LINK_BRAND = 'text-xs font-semibold text-[#28579C] hover:text-[#1E4278] disabled:opacity-50 whitespace-nowrap'
const LINK_SUCCESS = 'text-xs font-semibold text-[#2E7D53] hover:text-[#1F6644]'
const LINK_MUTED = 'text-xs font-semibold text-[#8B96A6] hover:text-[#18233D]'
const LINK_CRITICAL = 'text-xs font-semibold text-[#B8433B] hover:text-[#8F332C]'

const UNIT_OPTIONS = ['kg', 'g', 'liter', 'ml', 'pcs', 'pack', 'box', 'dozen']

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '', unit: 'kg', current_stock: '', total_cost: '', low_stock_threshold: '',
    expiry_date: '', aiNote: '', aiLoading: false,
  })

  // restock state per-row: { [ingredientId]: { qty, expiry_date, aiNote, aiLoading } }
  const [restockState, setRestockState] = useState({})

  // receipt upload state
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptItems, setReceiptItems] = useState(null) // null = belum ada hasil, [] = hasil kosong
  const [receiptError, setReceiptError] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  // inline edit state (name/unit/cost/threshold — bukan stock, itu cuma lewat restock)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', unit: '', cost_per_unit: '', low_stock_threshold: '' })

  async function fetchIngredients() {
    setLoading(true)
    try {
      const res = await api.get('/ingredients/')
      setIngredients(res.data)
      setError('')
    } catch (err) {
      setError('Gagal ambil data ingredients. Cek backend jalan & login masih valid.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIngredients()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    const qty = Number(form.current_stock) || 0
    const totalCost = Number(form.total_cost) || 0
    // backend nyimpen cost per-unit (dipakai buat hitung profit per menu),
    // tapi user cuma perlu input total yang dia bayar — konversinya di sini
    const costPerUnit = qty > 0 ? (totalCost / qty).toFixed(2) : totalCost.toFixed(2)

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
      setForm({
        name: '', unit: 'kg', current_stock: '', total_cost: '', low_stock_threshold: '',
        expiry_date: '', aiNote: '', aiLoading: false,
      })
      fetchIngredients()
    } catch (err) {
      setError('Gagal bikin ingredient. Cek isian form.')
    }
  }

  // Generate expiry buat ingredient yang lagi diketik di form Add Ingredient
  // (belum ada id di DB, jadi pakai nama yang lagi diketik langsung)
  async function handleGenerateExpiryForCreate() {
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

  function updateRestockRow(id, patch) {
    setRestockState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  // Panggil AI buat prefill expiry_date berdasarkan nama ingredient
  async function handleGenerateExpiry(ing) {
    updateRestockRow(ing.id, { aiLoading: true, aiNote: '' })
    try {
      const res = await api.post('/ingredients/estimate-expiry/', { name: ing.name })
      updateRestockRow(ing.id, {
        expiry_date: res.data.suggested_expiry_date,
        aiNote: `${res.data.confidence}: ${res.data.note}`,
        aiLoading: false,
      })
    } catch (err) {
      updateRestockRow(ing.id, { aiLoading: false, aiNote: 'Gagal estimasi, isi manual.' })
    }
  }

  async function handleRestock(id) {
    const row = restockState[id] || {}
    const qty = row.qty
    if (!qty || Number(qty) <= 0) return
    try {
      await api.post(`/ingredients/${id}/restock/`, {
        change_qty: qty,
        expiry_date: row.expiry_date || null,
      })
      setRestockState((prev) => ({ ...prev, [id]: { qty: '', expiry_date: '', aiNote: '' } }))
      fetchIngredients()
    } catch (err) {
      setError('Gagal restock.')
    }
  }

  // === Edit ingredient (name/unit/cost/threshold — stock sengaja dikunci, cuma lewat restock) ===

  function startEdit(ing) {
    setEditingId(ing.id)
    setEditForm({
      name: ing.name,
      unit: ing.unit,
      cost_per_unit: ing.cost_per_unit,
      low_stock_threshold: ing.low_stock_threshold ?? '',
    })
  }

  async function saveEdit(id) {
    try {
      await api.patch(`/ingredients/${id}/`, {
        name: editForm.name,
        unit: editForm.unit,
        cost_per_unit: editForm.cost_per_unit,
        low_stock_threshold: editForm.low_stock_threshold || null,
      })
      setEditingId(null)
      fetchIngredients()
    } catch (err) {
      setError('Gagal update ingredient.')
    }
  }

  // === Receipt flow (F1: parse-receipt + bulk-restock) ===

  async function handleParseReceipt(e) {
    e.preventDefault()
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
          expiry_date: it.suggested_expiry_date || '',
          note: it.note || '',
        }))
      )
    } catch (err) {
      setReceiptError('Gagal baca struk. Coba foto yang lebih jelas atau isi manual.')
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
      await api.post('/ingredients/bulk-restock/', {
        items: receiptItems.map((it) => ({
          name: it.name,
          unit: it.unit,
          change_qty: it.quantity,
          expiry_date: it.expiry_date || null,
        })),
      })
      setReceiptItems(null)
      setReceiptFile(null)
      fetchIngredients()
    } catch (err) {
      setReceiptError('Gagal submit bulk restock. Cek tiap baris (qty harus > 0).')
    } finally {
      setBulkSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-[22px] font-extrabold tracking-tight text-[#18233D] mb-1">Ingredients</h1>
      <p className="text-sm text-[#5B6B82] mb-6">Track stock levels, cost per unit, and restock as it happens.</p>

      {/* Create form */}
      <section className="mb-8">
        <h2 className="text-[13px] font-bold text-[#18233D] uppercase tracking-wide mb-3">Add Ingredient</h2>
        <form
          onSubmit={handleCreate}
          className={`bg-white rounded-xl ${SHADOW_CARD} p-5 flex flex-wrap gap-4 items-end`}
        >
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
          <div>
            <label className={LABEL}>Unit</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className={`${INPUT} w-24`}
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
              className={`${INPUT} w-24`}
              placeholder="0"
            />
          </div>
          <div>
            <label className={LABEL}>Total cost</label>
            <input
              type="number" step="0.01"
              value={form.total_cost}
              onChange={(e) => setForm({ ...form, total_cost: e.target.value })}
              className={`${INPUT} w-28`}
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
              className={`${INPUT} w-28`}
              placeholder="min. qty"
            />
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
                onClick={handleGenerateExpiryForCreate}
                disabled={!form.name || form.aiLoading}
                className={LINK_BRAND}
              >
                {form.aiLoading ? 'Generating...' : '✨ AI expiry'}
              </button>
            </div>
          </div>
          <button type="submit" className={BTN_PRIMARY}>
            Add Ingredient
          </button>
          {form.aiNote && (
            <p className="basis-full text-xs text-[#8B96A6]">{form.aiNote}</p>
          )}
        </form>
      </section>

      {error && <p className="text-sm text-[#B8433B] mb-4">{error}</p>}

      {/* List + per-row restock (tests: restock, estimate-expiry) + inline edit */}
      <section className="mb-8">
        <h2 className="text-[13px] font-bold text-[#18233D] uppercase tracking-wide mb-3">Ingredient List</h2>
        {loading ? (
          <p className="text-sm text-[#5B6B82]">Loading...</p>
        ) : (
          <div className={`bg-white rounded-xl ${SHADOW_CARD} overflow-hidden`}>
            <table className="w-full text-sm">
              <thead className="bg-[#F7F5F0] text-[#8B96A6] text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">Name</th>
                  <th className="text-left px-4 py-3 font-bold">Stock</th>
                  <th className="text-left px-4 py-3 font-bold">Cost/unit</th>
                  <th className="text-left px-4 py-3 font-bold">Restock</th>
                  <th className="text-left px-4 py-3 font-bold">Edit</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ing) => {
                  const row = restockState[ing.id] || {}
                  const isEditing = editingId === ing.id
                  return (
                    <tr key={ing.id} className="border-t border-[#E4E2DC] align-top">
                      {isEditing ? (
                        <>
                          <td className="px-4 py-3">
                            <input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className={`${INPUT} w-full`}
                            />
                          </td>
                          <td className="px-4 py-3 text-xs text-[#8B96A6]">{ing.current_stock} {ing.unit} (locked)</td>
                          <td className="px-4 py-3">
                            <input
                              type="number" step="0.01"
                              value={editForm.cost_per_unit}
                              onChange={(e) => setEditForm({ ...editForm, cost_per_unit: e.target.value })}
                              className={`${INPUT} w-24`}
                            />
                          </td>
                          <td className="px-4 py-3 text-xs text-[#8B96A6]">—</td>
                          <td className="px-4 py-3 flex gap-3">
                            <button onClick={() => saveEdit(ing.id)} className={LINK_SUCCESS}>
                              Save
                            </button>
                            <button onClick={() => setEditingId(null)} className={LINK_MUTED}>
                              Cancel
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-[#18233D] font-medium">{ing.name}</td>
                          <td className="px-4 py-3 text-[#18233D]">{ing.current_stock} {ing.unit}</td>
                          <td className="px-4 py-3 text-[#18233D]">{ing.cost_per_unit}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2 items-center">
                              <input
                                type="number" step="0.001"
                                value={row.qty || ''}
                                onChange={(e) => updateRestockRow(ing.id, { qty: e.target.value })}
                                className={`${INPUT} w-20`}
                                placeholder="qty"
                              />
                              <input
                                type="date"
                                value={row.expiry_date || ''}
                                onChange={(e) => updateRestockRow(ing.id, { expiry_date: e.target.value })}
                                className={INPUT}
                              />
                              <button
                                type="button"
                                onClick={() => handleGenerateExpiry(ing)}
                                disabled={row.aiLoading}
                                className={LINK_BRAND}
                              >
                                {row.aiLoading ? 'Generating...' : '✨ AI expiry'}
                              </button>
                              <button
                                onClick={() => handleRestock(ing.id)}
                                className={LINK_SUCCESS}
                              >
                                Restock
                              </button>
                            </div>
                            {row.aiNote && (
                              <p className="text-xs text-[#8B96A6] mt-1">{row.aiNote}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => startEdit(ing)} className={LINK_BRAND}>
                              Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Receipt upload (tests: parse-receipt, bulk-restock) */}
      <section>
        <h2 className="text-[13px] font-bold text-[#18233D] uppercase tracking-wide mb-3">Restock from Receipt</h2>
        <div className={`bg-white rounded-xl ${SHADOW_CARD} p-5`}>
          <form onSubmit={handleParseReceipt} className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className={LABEL}>Receipt photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setReceiptFile(e.target.files[0] || null)}
                className="text-sm text-[#5B6B82]"
              />
            </div>
            <button
              type="submit"
              disabled={!receiptFile || receiptLoading}
              className={BTN_PRIMARY}
            >
              {receiptLoading ? 'Reading receipt...' : 'Parse Receipt'}
            </button>
          </form>

          {receiptError && <p className="text-sm text-[#B8433B] mb-4">{receiptError}</p>}

          {receiptItems && receiptItems.length > 0 && (
            <>
              <div className={`rounded-lg border border-[#E4E2DC] overflow-hidden mb-4`}>
                <table className="w-full text-sm">
                  <thead className="bg-[#F7F5F0] text-[#8B96A6] text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-bold">Name</th>
                      <th className="text-left px-3 py-2.5 font-bold">Qty</th>
                      <th className="text-left px-3 py-2.5 font-bold">Unit</th>
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
                            className={`${INPUT} w-full`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" step="0.001"
                            value={item.quantity}
                            onChange={(e) => updateReceiptItem(i, { quantity: e.target.value })}
                            className={`${INPUT} w-20`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={item.unit}
                            onChange={(e) => updateReceiptItem(i, { unit: e.target.value })}
                            className={`${INPUT} w-16`}
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
                          <button
                            type="button"
                            onClick={() => removeReceiptItem(i)}
                            className={LINK_CRITICAL}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleBulkRestock}
                disabled={bulkSubmitting}
                className={BTN_PRIMARY}
              >
                {bulkSubmitting ? 'Submitting...' : `Confirm & Restock ${receiptItems.length} item(s)`}
              </button>
            </>
          )}

          {receiptItems && receiptItems.length === 0 && (
            <p className="text-sm text-[#5B6B82]">Gak ada item terdeteksi dari struk ini.</p>
          )}
        </div>
      </section>
    </div>
  )
}
