import axios from 'axios'

export const ACCESS_KEY = 'access_token'
export const REFRESH_KEY = 'refresh_token'

const configuredBase = import.meta.env.VITE_API_URL || '/api'
const baseURL = configuredBase.replace(/\/$/, '')

// Render's free plan can need 30–60 seconds to wake up after inactivity.
// 20s was too short and produced the intermittent "server response timed out"
// error on the login page.
export const API_TIMEOUT = 75000

const api = axios.create({
  baseURL,
  timeout: API_TIMEOUT,
})

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function hasSession() {
  return Boolean(getAccessToken() || getRefreshToken())
}

export function isTokenExpired(token, skewSeconds = 30) {
  if (!token) return true
  try {
    const payloadPart = token.split('.')[1]
    if (!payloadPart) return true
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded))
    if (!payload.exp) return false
    return payload.exp * 1000 <= Date.now() + skewSeconds * 1000
  } catch {
    return true
  }
}

export function setTokens({ access, refresh }) {
  if (access) localStorage.setItem(ACCESS_KEY, access)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

function notifyUnauthorized() {
  window.dispatchEvent(new CustomEvent('zamaniburger:unauthorized'))
}

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  const isTokenRequest = config.url?.includes('/token/')
  if (token && !isTokenRequest) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise = null

export async function refreshAccessToken() {
  const refresh = getRefreshToken()
  if (!refresh) throw new Error('No refresh token')

  const response = await axios.post(
    `${baseURL}/token/refresh/`,
    { refresh },
    { timeout: API_TIMEOUT },
  )
  const access = response.data?.access
  if (!access) throw new Error('Refresh response did not include an access token')
  localStorage.setItem(ACCESS_KEY, access)
  return access
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    const isTokenEndpoint = original?.url?.includes('/token/')

    if (status === 401 && original && !original._retry && !isTokenEndpoint) {
      original._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null
          })
        }
        const access = await refreshPromise
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${access}`
        return api(original)
      } catch {
        clearTokens()
        notifyUnauthorized()
      }
    }

    return Promise.reject(error)
  },
)

export default api
