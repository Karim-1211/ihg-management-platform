import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ihg_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Phase 25 security fix: previously there was no response interceptor at
// all, so an expired/invalid token (401) surfaced as a raw, inconsistent
// error in whichever component happened to make the request, rather than
// cleanly returning the user to login. This does not change the token
// storage mechanism (localStorage remains, per the locked decision not to
// redesign authentication storage in this phase) — it only ensures a 401
// response is handled consistently everywhere.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ihg_token')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api