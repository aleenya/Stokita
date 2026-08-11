import { useState, useEffect } from 'react'
import api from '../api/client'

export default function MenusPage() {
  const [menus, setMenus] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [form, setForm] = useState({ name: '', sell_price: '', target_margin: '' })

  const [editingMenuId, setEditingMenuId] = useState(null)
  const [recipeLines, setRecipeLines] = useState([]) // [{ ingredient_id, qty_per_serving }]

  async function fetchAll() {
    setLoading(true)
    try {
      const [menusRes, ingredientsRes] = await Promise.all([
        api.get('/menus/'),
        api.get('/ingredients/'),
      ])
      setMenus(menusRes.data)
      setIngredients(ingredientsRes.data)
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

  async function handleCreate(e) {
    e.preventDefault()
    try {
      await api.post('/menus/', {
        name: form.name,
        sell_price: form.sell_price,
        target_margin: form.target_margin,
      })
      setForm({ name: '', sell_price: '', target_margin: '' })
      fetchAll()
    } catch (err) {
      setError('Gagal bikin menu. Cek isian form.')
    }
  }

  function startEditRecipe(menu) {
    setEditingMenuId(menu.id)
    setRecipeLines(
      menu.recipe_lines.map((l) => ({ ingredient_id: l.ingredient, qty_per_serving: l.qty_per_serving }))
    )
  }

  function addRecipeLine() {
    if (ingredients.length === 0) return
    setRecipeLines([...recipeLines, { ingredient_id: ingredients[0].id, qty_per_serving: '' }])
  }

  function updateRecipeLine(index, field, value) {
    const next = [...recipeLines]
    next[index] = { ...next[index], [field]: value }
    setRecipeLines(next)
  }

  function removeRecipeLine(index) {
    setRecipeLines(recipeLines.filter((_, i) => i !== index))
  }

  async function saveRecipe() {
    try {
      await api.put(`/menus/${editingMenuId}/recipe/`, { lines: recipeLines })
      setEditingMenuId(null)
      fetchAll()
    } catch (err) {
      setError('Gagal simpan recipe.')
    }
  }

  function ingredientName(id) {
    return ingredients.find((i) => i.id === id)?.name || '?'
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-[Fraunces,serif] text-2xl text-[#1F2A24] mb-6">Menus</h1>

      {/* Create form */}
      <form onSubmit={handleCreate} className="bg-white border border-[#D8D0BF] rounded-md p-4 mb-8 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm"
            placeholder="Ayam Geprek"
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">Sell price</label>
          <input
            type="number" step="0.01"
            value={form.sell_price}
            onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm w-28"
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">Target margin %</label>
          <input
            type="number" step="0.01"
            value={form.target_margin}
            onChange={(e) => setForm({ ...form, target_margin: e.target.value })}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm w-28"
          />
        </div>
        <button type="submit" className="bg-[#16211B] text-[#F3EFE4] rounded-md px-4 py-2 text-sm">
          Add Menu
        </button>
      </form>

      {error && <p className="text-sm text-[#C1443B] mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#5C6B62]">Loading...</p>
      ) : (
        <div className="space-y-4">
          {menus.map((menu) => (
            <div key={menu.id} className="bg-white border border-[#D8D0BF] rounded-md p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-[#1F2A24]">{menu.name}</p>
                  <p className="text-xs text-[#5C6B62]">
                    Sell: {menu.sell_price} · Unit cost: {menu.unit_cost} · Target margin: {menu.target_margin}%
                  </p>
                </div>
                <button
                  onClick={() => startEditRecipe(menu)}
                  className="text-[#5C8B6E] text-xs font-medium hover:underline"
                >
                  Edit Recipe
                </button>
              </div>

              {/* Current recipe (read-only display) */}
              {editingMenuId !== menu.id && menu.recipe_lines.length > 0 && (
                <ul className="mt-3 text-xs text-[#5C6B62] space-y-1">
                  {menu.recipe_lines.map((l) => (
                    <li key={l.id}>{ingredientName(l.ingredient)} — {l.qty_per_serving}</li>
                  ))}
                </ul>
              )}

              {/* Recipe editor */}
              {editingMenuId === menu.id && (
                <div className="mt-3 border-t border-[#D8D0BF] pt-3 space-y-2">
                  {recipeLines.map((line, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select
                        value={line.ingredient_id}
                        onChange={(e) => updateRecipeLine(i, 'ingredient_id', e.target.value)}
                        className="border border-[#D8D0BF] rounded-md px-2 py-1 text-sm"
                      >
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>{ing.name}</option>
                        ))}
                      </select>
                      <input
                        type="number" step="0.001"
                        value={line.qty_per_serving}
                        onChange={(e) => updateRecipeLine(i, 'qty_per_serving', e.target.value)}
                        className="border border-[#D8D0BF] rounded-md px-2 py-1 w-24 text-sm"
                        placeholder="qty/serving"
                      />
                      <button onClick={() => removeRecipeLine(i)} className="text-[#C1443B] text-xs">
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button onClick={addRecipeLine} className="text-[#5C8B6E] text-xs font-medium hover:underline">
                      + Add ingredient
                    </button>
                    <button onClick={saveRecipe} className="bg-[#16211B] text-[#F3EFE4] rounded-md px-3 py-1 text-xs">
                      Save Recipe
                    </button>
                    <button onClick={() => setEditingMenuId(null)} className="text-[#5C6B62] text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
