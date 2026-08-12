import axios from 'axios'

// Auth now lives in httpOnly cookies (set by the backend), not
// localStorage — withCredentials makes the browser send them, and the
// xsrf* options make axios read Django's csrftoken cookie and echo it
// back as a header on unsafe requests (double-submit CSRF check).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
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
