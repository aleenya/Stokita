import { useEffect, useRef } from 'react'

// Loaded via the <script> tag in index.html — may not be ready yet when
// this component mounts (script is async/defer), so init polls briefly
// instead of assuming window.google exists on first render.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

/**
 * Renders Google's own button (not a custom-styled one) into a container
 * div. This used to be a custom button that called prompt() on click —
 * switched away from that because prompt() is the "One Tap" API, which is
 * *designed* to fail silently whenever conditions aren't ideal (browser
 * support, session eligibility, ITP, etc.) — fine for an automatic
 * passive prompt, wrong fit for a button someone explicitly clicked and
 * expects something to happen. renderButton() drives a real OAuth
 * popup/redirect instead and doesn't have that silent-failure mode
 * (confirmed broken specifically on Safari iOS: click did nothing, no
 * error, nothing in the console to act on).
 */
export default function GoogleSignInButton({ onCredential, label = 'Sign in with Google', disabled = false }) {
  const containerRef = useRef(null)
  const onCredentialRef = useRef(onCredential)
  const rendered = useRef(false)

  useEffect(() => {
    onCredentialRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false

    function tryRender() {
      if (cancelled || rendered.current) return
      if (window.google?.accounts?.id && containerRef.current) {
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => onCredentialRef.current?.(response.credential),
        })
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: label.toLowerCase().includes('sign up') ? 'signup_with' : 'signin_with',
          logo_alignment: 'center',
          width: Math.min(containerRef.current.offsetWidth || 320, 400),
        })
        rendered.current = true
      } else {
        setTimeout(tryRender, 200)
      }
    }
    tryRender()

    return () => {
      cancelled = true
    }
  }, [label])

  if (!CLIENT_ID) {
    return (
      <p className="text-xs text-[#8B96A6] text-center py-2.5">
        Google Sign-In belum dikonfigurasi.
      </p>
    )
  }

  return <div ref={containerRef} className={`flex justify-center ${disabled ? 'opacity-50 pointer-events-none' : ''}`} />
}
