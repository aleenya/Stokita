import { useState, useEffect } from 'react'
import api from '../api/client'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function SalesPage() {
  const [menus, setMenus] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [saleDate, setSaleDate] = useState(todayStr())
  const [items, setItems] = useState([]) // [{ menu_id, quantity }]

  async function fetchAll() {
    setLoading(true)
    try {
      const [menusRes, salesRes] = await Promise.all([
        api.get('/menus/'),
        api.get('/sales/'),
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

  function addItem() {
    if (menus.length === 0) return
    setItems([...items, { menu_id: menus[0].id, quantity: 1 }])
  }

  function updateItem(index, field, value) {
    const next = [...items]
    next[index] = { ...next[index], [field]: value }
    setItems(next)
  }

  function removeItem(index) {
    setItems(items.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSuccess('')
    if (items.length === 0) {
      setError('Tambahin minimal 1 item dulu.')
      return
    }
    try {
      await api.post('/sales/', { sale_date: saleDate, items })
      setItems([])
      setSuccess('Sale recorded! Cek tab Ingredients, stock harusnya udah kepotong.')
      fetchAll()
    } catch (err) {
      setError('Gagal record sale. Cek stock ingredient cukup & recipe menu udah diisi.')
    }
  }

  function menuName(id) {
    return menus.find((m) => m.id === id)?.name || '?'
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-[Fraunces,serif] text-2xl text-[#1F2A24] mb-6">Sales</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-[#D8D0BF] rounded-md p-4 mb-8">
        <div className="mb-4">
          <label className="block text-xs uppercase text-[#5C6B62] mb-1">Sale date</label>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="border border-[#D8D0BF] rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2 mb-3">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={item.menu_id}
                onChange={(e) => updateItem(i, 'menu_id', e.target.value)}
                className="border border-[#D8D0BF] rounded-md px-2 py-1 text-sm"
              >
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input
                type="number" min="1"
                value={item.quantity}
                onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                className="border border-[#D8D0BF] rounded-md px-2 py-1 w-20 text-sm"
              />
              <button type="button" onClick={() => removeItem(i)} className="text-[#C1443B] text-xs">
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={addItem} className="text-[#5C8B6E] text-xs font-medium hover:underline">
            + Add item
          </button>
          <button type="submit" className="bg-[#16211B] text-[#F3EFE4] rounded-md px-4 py-2 text-sm">
            Record Sale
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-[#C1443B] mb-4">{error}</p>}
      {success && <p className="text-sm text-[#5C8B6E] mb-4">{success}</p>}

      {loading ? (
        <p className="text-sm text-[#5C6B62]">Loading...</p>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => (
            <div key={sale.id} className="bg-white border border-[#D8D0BF] rounded-md p-4">
              <p className="text-sm font-medium text-[#1F2A24]">{sale.sale_date}</p>
              <ul className="mt-1 text-xs text-[#5C6B62] space-y-1">
                {sale.items.map((it) => (
                  <li key={it.id}>
                    {menuName(it.menu)} × {it.quantity} — revenue {it.unit_price * it.quantity}, profit {(it.unit_price - it.unit_cost) * it.quantity}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
