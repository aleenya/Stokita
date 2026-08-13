import { useState, useRef, useEffect } from 'react'
import api from '../api/client'

/* =========================================================================
   DESIGN TOKENS — sama persis dengan token yang dipakai di halaman lain
   (IngredientsPage.jsx / MenusPage.jsx / SalesPage.jsx / Sidebar.jsx).
   ========================================================================= */
const SHADOW_FLOAT =
  'shadow-[0_14px_32px_-10px_rgba(20,29,52,0.28),0_2px_8px_rgba(20,29,52,0.08)]'
const INPUT =
  'w-full bg-white border border-[#E4E2DC] rounded-md px-3 py-2 text-sm text-[#18233D] placeholder:text-[#8B96A6] focus:outline-none focus:ring-2 focus:ring-[#28579C]/25 focus:border-[#28579C] transition-colors'
const BTN_PRIMARY =
  'text-xs font-semibold text-white bg-[#28579C] hover:bg-[#1E4278] transition-colors rounded-full px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'text-xs font-semibold text-[#5B6B82] border border-[#E4E2DC] rounded-full px-3 py-1.5 hover:bg-[#F7F5F0] transition-colors disabled:opacity-50'

const ic = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}
const IconChat = (p) => (
  <svg {...ic} {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
)
const IconX = (p) => (
  <svg {...ic} {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
)
const IconSend = (p) => (
  <svg {...ic} {...p}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
)

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-3.5 py-2.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#8B96A6] animate-bounce"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </span>
  )
}

// Bubble AI yang isinya action dari Gemini (restock, dst) — butuh konfirmasi
// manusia sebelum beneran nulis ke database (PendingAction di backend).
function ActionBubble({ action, onDecide }) {
  const status = action.status || 'pending'
  return (
    <div className="bg-[#F7F5F0] border border-[#E4E2DC] rounded-2xl rounded-bl-sm px-3.5 py-3 max-w-[85%]">
      <p className="text-sm text-[#18233D] whitespace-pre-wrap">{action.message}</p>
      {status === 'pending' && (
        <div className="flex gap-2 mt-2.5">
          <button type="button" className={BTN_PRIMARY} onClick={() => onDecide('confirm')}>
            Konfirmasi
          </button>
          <button type="button" className={BTN_SECONDARY} onClick={() => onDecide('cancel')}>
            Batal
          </button>
        </div>
      )}
      {status === 'confirming' && <p className="text-xs text-[#8B96A6] mt-2">Memproses…</p>}
      {status === 'confirmed' && (
        <p className="text-xs font-semibold text-[#2E7D53] mt-2">✓ Dikonfirmasi</p>
      )}
      {status === 'cancelled' && (
        <p className="text-xs text-[#8B96A6] mt-2">Dibatalkan.</p>
      )}
      {status === 'failed' && (
        <p className="text-xs font-semibold text-[#B8433B] mt-2">{action.error || 'Gagal diproses.'}</p>
      )}
    </div>
  )
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  // message shape:
  //  { role: 'user', text }
  //  { role: 'model', text }
  //  { role: 'model', action: { id, message, status, error? } }
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, sending, open])

  function updateActionAt(index, patch) {
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, action: { ...m.action, ...patch } } : m))
    )
  }

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')
    setSending(true)
    try {
      const res = await api.post('/chat/message/', { message: text })
      const data = res.data
      if (data.type === 'action') {
        setMessages((prev) => [...prev, { role: 'model', action: { ...data.action, status: 'pending' } }])
      } else {
        // 'answer' | 'unsupported' (dan bentuk lain) sama-sama nampilin field "answer"
        setMessages((prev) => [...prev, { role: 'model', text: data.answer || 'Maaf, gak ada jawaban.' }])
      }
    } catch (err) {
      const data = err.response?.data
      const text = data?.message || data?.error || 'Gagal kirim pesan. Coba lagi.'
      setMessages((prev) => [...prev, { role: 'model', text, isError: true }])
    } finally {
      setSending(false)
    }
  }

  async function handleDecide(index, action, decision) {
    updateActionAt(index, { status: 'confirming' })
    try {
      if (decision === 'confirm') {
        const res = await api.post(`/chat/actions/${action.id}/confirm/`)
        updateActionAt(index, { status: 'confirmed', message: res.data.result?.message || action.message })
      } else {
        await api.post(`/chat/actions/${action.id}/cancel/`)
        updateActionAt(index, { status: 'cancelled' })
      }
    } catch (err) {
      updateActionAt(index, {
        status: 'failed',
        error: err.response?.data?.error || 'Gagal diproses. Coba lagi.',
      })
    }
  }

  return (
    <>
      {open && (
        <div
          className={`fixed z-50 bottom-24 right-6 w-96 max-w-[calc(100vw-2rem)] h-[32rem] max-h-[70vh] bg-white rounded-2xl ${SHADOW_FLOAT} border border-[#E4E2DC] flex flex-col overflow-hidden`}
          role="dialog"
          aria-label="Ask Stokita chat"
        >
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E4E2DC] bg-[#F7F5F0]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#EAF1FB] text-[#1E4278] flex items-center justify-center shrink-0">
                <IconChat className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#18233D] leading-tight">Ask Stokita</p>
                <p className="text-[11px] text-[#8B96A6] leading-tight">AI business copilot</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup chat"
              className="w-7 h-7 flex items-center justify-center rounded-full text-[#8B96A6] hover:bg-white hover:text-[#18233D] transition-colors"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-[#8B96A6] text-center mt-6">
                Halo! Tanya soal stok, menu, atau penjualan kamu — atau minta restock
                langsung dari sini, tetap perlu dikonfirmasi dulu sebelum kesimpen.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.action ? (
                  <ActionBubble action={m.action} onDecide={(d) => handleDecide(i, m.action, d)} />
                ) : (
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-[#28579C] text-white rounded-br-sm'
                        : m.isError
                          ? 'bg-[#FBEBEA] text-[#B8433B] rounded-bl-sm'
                          : 'bg-[#F7F5F0] text-[#18233D] rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-[#F7F5F0] rounded-2xl rounded-bl-sm">
                  <TypingDots />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-[#E4E2DC]">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tulis pesan…"
              className={INPUT}
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Kirim"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-[#28579C] text-white hover:bg-[#1E4278] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IconSend className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Tutup Ask Stokita' : 'Buka Ask Stokita'}
        aria-expanded={open}
        className={`fixed z-50 bottom-6 right-6 w-14 h-14 rounded-full bg-[#28579C] text-white flex items-center justify-center hover:bg-[#1E4278] transition-colors ${SHADOW_FLOAT}`}
      >
        {open ? <IconX className="w-5 h-5" /> : <IconChat className="w-5 h-5" />}
      </button>
    </>
  )
}
