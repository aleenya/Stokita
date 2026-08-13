import { useEffect, useRef } from 'react'

// Loaded via the <script> tag in index.html — may not be ready yet when
// this component mounts (script is async/defer), so init polls briefly
// instead of assuming window.google exists on first render.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}

/**
 * Renders as a button styled like the rest of the app (not Google's own
 * widget, so it doesn't look bolted on). Click triggers the Google account
 * chooser; onCredential(credential) fires with the ID token once the user
 * picks an account. What happens with that token (login vs link) is up to
 * the caller.
 */
export default function GoogleSignInButton({ onCredential, label = 'Sign in with Google', disabled = false }) {
  const initialized = useRef(false)
  const onCredentialRef = useRef(onCredential)

  useEffect(() => {
    onCredentialRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false

    function tryInit() {
      if (cancelled || initialized.current) return
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => onCredentialRef.current?.(response.credential),
        })
        initialized.current = true
      } else {
        setTimeout(tryInit, 200)
      }
    }
    tryInit()

    return () => {
      cancelled = true
    }
  }, [])

  function handleClick() {
    if (!CLIENT_ID) {
      console.warn('VITE_GOOGLE_CLIENT_ID belum diset — Google Sign-In gak akan jalan.')
      return
    }
    window.google?.accounts?.id?.prompt()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2.5 text-sm font-semibold text-[#18233D] bg-white border border-[#E4E2DC] rounded-full py-2.5 hover:bg-[#F7F5F0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <GoogleLogo />
      {label}
    </button>
  )
}
