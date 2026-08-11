import { useState, useEffect } from 'react'
import api from '../api/client'

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [form, setForm] = useState({ name: '', unit: 'kg', current_stock: '', cost_per_unit: '', low_stock_threshold: '' })
  const [restockQty, setRestockQty] = useState({}) // { [ingredientId]: value }

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
    try {
      await api.post('/ingredients/', {
        name: form.name,
        unit: form.unit,
        current_stock: form.current_stock || 0,
        cost_per_unit: form.cost_per_unit,
        low_stock_threshold: form.low_stock_threshold || null,
      })
      setForm({ name: '', unit: 'kg', current_stock: '', cost_per_unit: '', low_stock_threshold: '' })
      fetchIngredients()
    } catch (err) {
      setError('Gagal bikin ingredient. Cek isian form.')
    }
  }

  async function handleRestock(id) {
    const qty = restockQty[id]
    if (!qty || Number(qty) <= 0) return
    try {
      await api.post(`/ingredients/${id}/restock/`, { change_qty: qty })
      setRestockQty((prev) => ({ ...prev, [id]: '' }))
      fetchIngredients()
    } catch (err) {
      setError('Gagal restock.')
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
          <input
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm w-20"
          />
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
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">Cost/unit</label>
          <input
            type="number" step="0.01"
            value={form.cost_per_unit}
            onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm w-28"
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">Low stock alert</label>
          <input
            type="number" step="0.001"
            value={form.low_stock_threshold}
            onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm w-28"
            placeholder="optional"
          />
        </div>
        <button type="submit" className="bg-[#16211B] text-[#F3EFE4] rounded-md px-4 py-2 text-sm">
          Add Ingredient
        </button>
      </form>

      {error && <p className="text-sm text-[#C1443B] mb-4">{error}</p>}

      {/* List */}
      {loading ? (
        <p className="text-sm text-[#5C6B62]">Loading...</p>
      ) : (
        <table className="w-full text-sm bg-white border border-[#D8D0BF] rounded-md overflow-hidden">
          <thead className="bg-[#FAF6EC] text-[#5C6B62] text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Stock</th>
              <th className="text-left px-4 py-2">Cost/unit</th>
              <th className="text-left px-4 py-2">Restock</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing) => (
              <tr key={ing.id} className="border-t border-[#D8D0BF]">
                <td className="px-4 py-2">{ing.name}</td>
                <td className="px-4 py-2">{ing.current_stock} {ing.unit}</td>
                <td className="px-4 py-2">{ing.cost_per_unit}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <input
                      type="number" step="0.001"
                      value={restockQty[ing.id] || ''}
                      onChange={(e) => setRestockQty({ ...restockQty, [ing.id]: e.target.value })}
                      className="border border-[#D8D0BF] rounded-md px-2 py-1 w-20 text-sm"
                      placeholder="qty"
                    />
                    <button
                      onClick={() => handleRestock(ing.id)}
                      className="text-[#5C8B6E] text-xs font-medium hover:underline"
                    >
                      Restock
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
