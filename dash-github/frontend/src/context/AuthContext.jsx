import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api, {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  hasSession,
  isTokenExpired,
  refreshAccessToken,
  setTokens,
} from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      if (!hasSession()) {
        setInitializing(false)
        return
      }
      try {
        const access = getAccessToken()
        if ((!access || isTokenExpired(access)) && getRefreshToken()) {
          await refreshAccessToken()
        }
        const { data } = await api.get('/me/')
        if (!cancelled) setUser(data)
      } catch {
        if (!cancelled) {
          clearTokens()
          setUser(null)
        }
      } finally {
        if (!cancelled) setInitializing(false)
      }
    }

    restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => setUser(null)
    window.addEventListener('zamaniburger:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('zamaniburger:unauthorized', handleUnauthorized)
  }, [])

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/token/', { username, password })
    setTokens({ access: data.access, refresh: data.refresh })
    setUser(data.user)
    return data.user
  }, [])

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser)
  }, [])

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/me/')
    setUser(data)
    return data
  }, [])

  const value = useMemo(
    () => ({ user, initializing, login, logout, updateUser, refreshUser }),
    [user, initializing, login, logout, updateUser, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
