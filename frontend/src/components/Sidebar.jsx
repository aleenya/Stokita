import { useState, useEffect, useRef } from 'react'

/* =========================================================================
   SIDEBAR — port dari dashboard(2).html
   Warna ditulis sebagai hex arbitrary (bg-[#F7F5F0]) biar nggak butuh
   tailwind.config custom. Map-nya sama persis dengan Dashboard.jsx:
     bg #F7F5F0 · surface #FFFFFF · border #E4E2DC · border-strong #CBD1DB
     navy #18233D · slate #5B6B82 · slate-muted #8B96A6
     brand #28579C · brand-dark #1E4278 · brand-light #EAF1FB
   ========================================================================= */

/* ---- ikon (stroke 2, 17px) ---- */
const iconProps = {
  className: 'w-[17px] h-[17px]',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const IconToday = () => (
  <svg {...iconProps}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const IconStock = () => (
  <svg {...iconProps}>
    <path d="M21 8V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v3" />
    <path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    <path d="M10 12h4" />
  </svg>
)

const IconMenus = () => (
  <svg {...iconProps}>
    <path d="M3 2v7c0 1.1.9 2 2 2h1a2 2 0 0 0 2-2V2" />
    <path d="M5.5 2v20" />
    <path d="M18 2c-1.7 0-3 2.2-3 5s.6 4 3 4.5V22" />
  </svg>
)

const IconSales = () => (
  <svg {...iconProps}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
)

const IconPerformance = () => (
  <svg {...iconProps}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)

const IconPeople = () => (
  <svg {...iconProps}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

/* ---- daftar nav: key-nya SAMA dengan state `page` di App.jsx ----
   Label diubah biar match HTML (dashboard → "Today", ingredients → "Stock",
   profit → "Performance"), tapi value-nya nggak disentuh. */
export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Today', Icon: IconToday },
  { key: 'ingredients', label: 'Stock', Icon: IconStock },
  { key: 'menus', label: 'Menus', Icon: IconMenus },
  { key: 'sales', label: 'Sales', Icon: IconSales },
  { key: 'profit', label: 'Performance', Icon: IconPerformance },
  { key: 'people', label: 'People', Icon: IconPeople },
]

export const pageLabel = (key) => NAV_ITEMS.find((i) => i.key === key)?.label || 'Stokita'

/* ---- logo ---- */
function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M10 18 L38 18 L34.5 34 C34.2 35.4 33 36.4 31.6 36.4 L16.4 36.4 C15 36.4 13.8 35.4 13.5 34 L10 18 Z"
        fill="#1E4278"
      />
      <rect x="18.5" y="24" width="3" height="9" rx="0.5" fill="#28579C" />
      <rect x="22.5" y="21" width="3" height="12" rx="0.5" fill="#1E4278" />
      <rect x="26.5" y="19" width="3" height="14" rx="0.5" fill="#0F1A30" />
    </svg>
  )
}

export default function Sidebar({
  page,
  onNavigate,
  pages,
  businessName = 'Stokita',
  userName = 'User',
  userRole = 'Staff',
  onLogout,
  onAskStokita,
  mobileOpen,
  onMobileClose,
}) {
  const items = NAV_ITEMS.filter((i) => pages.includes(i.key))
  const [identityOpen, setIdentityOpen] = useState(false)
  const identityRef = useRef(null)

  // tutup popover identity kalau klik di luar
  useEffect(() => {
    if (!identityOpen) return
    const onClick = (e) => {
      if (identityRef.current && !identityRef.current.contains(e.target)) setIdentityOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [identityOpen])

  // Esc buat nutup drawer mobile
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e) => e.key === 'Escape' && onMobileClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, onMobileClose])

  const initial = String(userName || 'U').trim().charAt(0).toUpperCase()

  return (
    <>
      {/* backdrop mobile */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-[#18233D]/40"
          aria-hidden="true"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`w-56 shrink-0 bg-white border-r border-[#E4E2DC] flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:static md:translate-x-0 md:transition-none ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* logo */}
        <div className="h-14 flex items-center gap-2.5 px-5 pt-4">
          <Logo />
          <span className="text-[13px] font-bold tracking-tight text-[#8B96A6]">Stokita</span>
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            className="md:hidden ml-auto w-8 h-8 flex items-center justify-center rounded-md text-[#8B96A6] hover:bg-[#F7F5F0] transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* business switcher — sementara display only, belum ada endpoint multi-business */}
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-5 pb-3.5 pt-0.5 text-left hover:bg-[#F7F5F0] transition-colors border-b border-[#E4E2DC]"
        >
          <span className="text-[15px] font-bold text-[#18233D] truncate">{businessName}</span>
          <svg
            className="w-3.5 h-3.5 text-[#8B96A6] shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {/* nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
          {items.map(({ key, label, Icon }) => {
            const active = page === key
            return (
              <a
                key={key}
                href="#"
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  onNavigate(key)
                  onMobileClose()
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#EAF1FB] text-[#1E4278]'
                    : 'text-[#5B6B82] hover:bg-[#F7F5F0] hover:text-[#18233D]'
                }`}
              >
                <Icon />
                {label}
              </a>
            )
          })}
        </nav>

        {/* Ask Stokita */}
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onAskStokita}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md border border-[#E4E2DC] bg-[#F7F5F0] text-left text-sm text-[#8B96A6] hover:border-[#CBD1DB] hover:text-[#5B6B82] transition-colors"
          >
            <svg
              className="w-[15px] h-[15px] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Ask Stokita&hellip;</span>
          </button>
        </div>

        {/* identity block + logout */}
        <div className="relative" ref={identityRef}>
          {identityOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-[#E4E2DC] bg-white shadow-[0_14px_32px_-10px_rgba(20,29,52,0.28),0_2px_8px_rgba(20,29,52,0.08)] py-1">
              <button
                type="button"
                onClick={() => {
                  setIdentityOpen(false)
                  onLogout?.()
                }}
                className="w-full text-left px-3 py-2 text-sm font-medium text-[#B8433B] hover:bg-[#FBEBEA] transition-colors rounded-md"
              >
                Log out
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIdentityOpen((v) => !v)}
            aria-expanded={identityOpen}
            className="w-full flex items-center gap-2.5 px-5 py-4 border-t border-[#E4E2DC] text-left hover:bg-[#F7F5F0] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#EAF1FB] text-[#1E4278] text-xs font-bold flex items-center justify-center shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#18233D] truncate">{userName}</p>
              <p className="text-xs text-[#8B96A6] truncate capitalize">{userRole}</p>
            </div>
          </button>
        </div>
      </aside>
    </>
  )
}

/* =========================================================================
   MOBILE TOPBAR — dipakai App.jsx, ditaruh di luar <aside>
   ========================================================================= */
export function MobileTopbar({ title, onOpenMenu, open }) {
  return (
    <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-4 bg-white border-b border-[#E4E2DC]">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        aria-expanded={open}
        className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-md text-[#5B6B82] hover:bg-[#F7F5F0] transition-colors"
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>
      <span className="text-[13px] font-bold tracking-tight text-[#8B96A6]">{title}</span>
      <div className="w-9 h-9" />
    </div>
  )
}
