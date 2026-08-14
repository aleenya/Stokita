import axios from 'axios'

// Auth lives in httpOnly cookies (set by the backend) — withCredentials
// makes the browser send them.
//
// CSRF is trickier. axios's xsrfCookieName/withXSRFToken option reads the
// csrftoken cookie via document.cookie and echoes it as a header — but
// that only works when frontend and backend share an origin. In
// production they're on different top-level domains (the SPA's domain vs
// the API's Vercel domain), and document.cookie can never read a cookie
// set by a different origin, no matter its SameSite/Secure flags — those
// only govern whether the browser *sends* the cookie, not whether JS on
// another origin can *read* it. So the xsrf* options below are a no-op
// in production; the cookie still round-trips to the server fine, the
// frontend just can never see its value to put in the header.
// Kept anyway as a harmless fallback for same-origin setups (local dev,
// or if frontend/backend ever move under one domain) — csrfToken below
// is what actually carries production.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  withXSRFToken: true,
})

// Cross-origin fallback: GET /auth/csrf/ now also returns the token value
// in its body (not just as a cookie) specifically so the frontend can
// hold it in memory and set the header itself — see setCsrfToken below,
// called once from App.jsx on boot. Manually setting the header here
// always wins over (and works everywhere) the cookie-reading mechanism
// above.
let csrfToken = null
export function setCsrfToken(token) {
  csrfToken = token
}

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase()
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    config.headers['X-CSRFToken'] = csrfToken
  }
  return config
})

// Access tokens expire after 30min (see backend SIMPLE_JWT settings) —
// on a 401, try one silent refresh before giving up. Multiple requests
// failing at once share a single in-flight refresh instead of each
// firing their own.
let refreshing = null

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const { response, config } = err
    const isAuthRoute = config?.url?.includes('/auth/')

    if (response?.status === 401 && config && !config._retried && !isAuthRoute) {
      config._retried = true
      try {
        refreshing = refreshing || api.post('/auth/refresh/')
        await refreshing
        refreshing = null
        return api(config)
      } catch (refreshErr) {
        refreshing = null
        // No reload — there's no client-side auth header to reset anymore
        // (cookies are server-managed). Just let the 401 propagate so the
        // caller's own error handling runs (e.g. App.jsx's checkSession
        // sets authStatus to 'out' and renders the login page). Reloading
        // here caused an infinite reload loop for anyone not logged in:
        // reload -> GET /me/ -> 401 -> refresh fails -> reload -> ...
        return Promise.reject(err)
      }
    }

    return Promise.reject(err)
  }
)

export default api
