import { useState, useEffect } from 'react'
import api from '../api/client'

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
      <h1 className="font-[Fraunces,serif] text-2xl text-[#1F2A24] mb-6">Ingredients</h1>

      {/* Create form */}
      <form onSubmit={handleCreate} className="bg-white border border-[#D8D0BF] rounded-md p-4 mb-8 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm"
            placeholder="Chicken breast"
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">Unit</label>
          <select
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm w-24"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">Initial stock</label>
          <input
            type="number" step="0.001"
            value={form.current_stock}
            onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm w-24"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">Total cost</label>
          <input
            type="number" step="0.01"
            value={form.total_cost}
            onChange={(e) => setForm({ ...form, total_cost: e.target.value })}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm w-28"
            placeholder="e.g. 150000"
            required
          />
          {form.current_stock > 0 && form.total_cost > 0 && (
            <p className="text-xs text-[#5C6B62] mt-1">
              ≈ {(Number(form.total_cost) / Number(form.current_stock)).toFixed(2)} / {form.unit}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">Low stock threshold</label>
          <input
            type="number" step="0.001"
            value={form.low_stock_threshold}
            onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm w-28"
            placeholder="min. qty"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">Expiry date</label>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
              className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleGenerateExpiryForCreate}
              disabled={!form.name || form.aiLoading}
              className="text-[#8B6E5C] text-xs font-medium hover:underline disabled:opacity-50 whitespace-nowrap"
            >
              {form.aiLoading ? 'Generating...' : '✨ AI expiry'}
            </button>
          </div>
        </div>
        <button type="submit" className="bg-[#16211B] text-[#F3EFE4] rounded-md px-4 py-2 text-sm">
          Add Ingredient
        </button>
        {form.aiNote && (
          <p className="basis-full text-xs text-[#5C6B62]">{form.aiNote}</p>
        )}
      </form>

      {error && <p className="text-sm text-[#C1443B] mb-4">{error}</p>}

      {/* List + per-row restock (tests: restock, estimate-expiry) */}
      {loading ? (
        <p className="text-sm text-[#5C6B62]">Loading...</p>
      ) : (
        <table className="w-full text-sm bg-white border border-[#D8D0BF] rounded-md overflow-hidden mb-8">
          <thead className="bg-[#FAF6EC] text-[#5C6B62] text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Stock</th>
              <th className="text-left px-4 py-2">Cost/unit</th>
              <th className="text-left px-4 py-2">Restock</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing) => {
              const row = restockState[ing.id] || {}
              return (
                <tr key={ing.id} className="border-t border-[#D8D0BF] align-top">
                  <td className="px-4 py-2">{ing.name}</td>
                  <td className="px-4 py-2">{ing.current_stock} {ing.unit}</td>
                  <td className="px-4 py-2">{ing.cost_per_unit}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        type="number" step="0.001"
                        value={row.qty || ''}
                        onChange={(e) => updateRestockRow(ing.id, { qty: e.target.value })}
                        className="border border-[#D8D0BF] rounded-md px-2 py-1 w-20 text-sm"
                        placeholder="qty"
                      />
                      <input
                        type="date"
                        value={row.expiry_date || ''}
                        onChange={(e) => updateRestockRow(ing.id, { expiry_date: e.target.value })}
                        className="border border-[#D8D0BF] rounded-md px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleGenerateExpiry(ing)}
                        disabled={row.aiLoading}
                        className="text-[#8B6E5C] text-xs font-medium hover:underline disabled:opacity-50"
                      >
                        {row.aiLoading ? 'Generating...' : '✨ AI expiry'}
                      </button>
                      <button
                        onClick={() => handleRestock(ing.id)}
                        className="text-[#5C8B6E] text-xs font-medium hover:underline"
                      >
                        Restock
                      </button>
                    </div>
                    {row.aiNote && (
                      <p className="text-xs text-[#5C6B62] mt-1">{row.aiNote}</p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Receipt upload (tests: parse-receipt, bulk-restock) */}
      <div className="bg-white border border-[#D8D0BF] rounded-md p-4">
        <h2 className="font-[Fraunces,serif] text-lg text-[#1F2A24] mb-3">Restock from Receipt</h2>

        <form onSubmit={handleParseReceipt} className="flex flex-wrap gap-3 items-end mb-3">
          <div>
            <label className="block text-xs uppercase text-[#5C6B62] mb-1">Receipt photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setReceiptFile(e.target.files[0] || null)}
              className="text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!receiptFile || receiptLoading}
            className="bg-[#16211B] text-[#F3EFE4] rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            {receiptLoading ? 'Reading receipt...' : 'Parse Receipt'}
          </button>
        </form>

        {receiptError && <p className="text-sm text-[#C1443B] mb-3">{receiptError}</p>}

        {receiptItems && receiptItems.length > 0 && (
          <>
            <table className="w-full text-sm border border-[#D8D0BF] rounded-md overflow-hidden mb-3">
              <thead className="bg-[#FAF6EC] text-[#5C6B62] text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Qty</th>
                  <th className="text-left px-3 py-2">Unit</th>
                  <th className="text-left px-3 py-2">Expiry date</th>
                  <th className="text-left px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {receiptItems.map((item, i) => (
                  <tr key={i} className="border-t border-[#D8D0BF]">
                    <td className="px-3 py-2">
                      <input
                        value={item.name}
                        onChange={(e) => updateReceiptItem(i, { name: e.target.value })}
                        className="border border-[#D8D0BF] rounded-md px-2 py-1 text-sm w-full"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number" step="0.001"
                        value={item.quantity}
                        onChange={(e) => updateReceiptItem(i, { quantity: e.target.value })}
                        className="border border-[#D8D0BF] rounded-md px-2 py-1 text-sm w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={item.unit}
                        onChange={(e) => updateReceiptItem(i, { unit: e.target.value })}
                        className="border border-[#D8D0BF] rounded-md px-2 py-1 text-sm w-16"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={item.expiry_date}
                        onChange={(e) => updateReceiptItem(i, { expiry_date: e.target.value })}
                        className="border border-[#D8D0BF] rounded-md px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeReceiptItem(i)}
                        className="text-[#C1443B] text-xs hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={handleBulkRestock}
              disabled={bulkSubmitting}
              className="bg-[#5C8B6E] text-[#F3EFE4] rounded-md px-4 py-2 text-sm disabled:opacity-50"
            >
              {bulkSubmitting ? 'Submitting...' : `Confirm & Restock ${receiptItems.length} item(s)`}
            </button>
          </>
        )}

        {receiptItems && receiptItems.length === 0 && (
          <p className="text-sm text-[#5C6B62]">Gak ada item terdeteksi dari struk ini.</p>
        )}
      </div>
    </div>
  )
}
