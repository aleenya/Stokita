import { useState, useEffect } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS — sama persis dengan Dashboard.jsx / Sidebar.jsx / IngredientsPage.jsx
   ========================================================================= */
const SHADOW_CARD =
  'shadow-[0_2px_6px_rgba(24,35,61,0.06),0_10px_24px_-8px_rgba(24,35,61,0.22)]'
const LABEL = 'block text-xs uppercase tracking-wide text-[#8B96A6] mb-1.5'
const INPUT =
  'border border-[#E4E2DC] rounded-md px-3 py-2 text-sm text-[#18233D] focus:outline-none focus:ring-2 focus:ring-[#28579C]/25 focus:border-[#28579C] transition-colors'
const BTN_PRIMARY =
  'text-sm font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-5 py-2.5'
const LINK_BRAND = 'text-xs font-semibold text-[#28579C] hover:text-[#1E4278] transition-colors'
const LINK_CRITICAL = 'text-xs font-semibold text-[#B8433B] hover:text-[#8F332C] transition-colors'

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
      setError(err.response?.data?.error || 'Gagal record sale. Cek stock ingredient cukup & recipe menu udah diisi.')
    }
  }

  function menuName(id) {
    return menus.find((m) => m.id === id)?.name || '?'
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-[22px] font-extrabold tracking-tight text-[#18233D] mb-1">Sales</h1>
      <p className="text-sm text-[#5B6B82] mb-6">Record today's sales and keep stock usage accurate.</p>

      <section className="mb-8">
        <h2 className="text-[13px] font-bold text-[#18233D] uppercase tracking-wide mb-3">Record Sale</h2>
        <form onSubmit={handleSubmit} className={`bg-white rounded-xl ${SHADOW_CARD} p-5`}>
          <div className="mb-4">
            <label className={LABEL}>Sale date</label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className={INPUT}
            />
          </div>

          <div className="space-y-2 mb-3">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={item.menu_id}
                  onChange={(e) => updateItem(i, 'menu_id', e.target.value)}
                  className={INPUT}
                >
                  {menus.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <input
                  type="number" min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  className={`${INPUT} w-20`}
                />
                <button type="button" onClick={() => removeItem(i)} className={LINK_CRITICAL}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button type="button" onClick={addItem} className={LINK_BRAND}>
              + Add item
            </button>
            <button type="submit" className={BTN_PRIMARY}>
              Record Sale
            </button>
          </div>
        </form>
      </section>

      {error && <p className="text-sm text-[#B8433B] mb-4">{error}</p>}
      {success && <p className="text-sm text-[#2E7D53] mb-4">{success}</p>}

      <section>
        <h2 className="text-[13px] font-bold text-[#18233D] uppercase tracking-wide mb-3">Recent Sales</h2>
        {loading ? (
          <p className="text-sm text-[#5B6B82]">Loading...</p>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div key={sale.id} className={`bg-white rounded-xl ${SHADOW_CARD} p-4`}>
                <p className="text-sm font-semibold text-[#18233D]">{sale.sale_date}</p>
                <ul className="mt-1 text-xs text-[#8B96A6] space-y-1">
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
      </section>
    </div>
  )
}
