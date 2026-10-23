import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/authService'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  // On mount — verify token is still valid
  useEffect(() => {
    const verify = async () => {
      const stored = localStorage.getItem('token')
      if (!stored) { setLoading(false); return }
      try {
        const res = await authService.getMe()
        setUser(res.data.data.user)
        setToken(stored)
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await authService.login({ email, password })
    const { token: tk, user: u } = res.data.data
    localStorage.setItem('token', tk)
    setToken(tk)
    setUser(u)
    return u
  }, [])

  const register = useCallback(async (name, email, password, phone) => {
    const res = await authService.register({ name, email, password, phone })
    const { token: tk, user: u } = res.data.data
    localStorage.setItem('token', tk)
    setToken(tk)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    try { await authService.logout() } catch {}
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  const isAdmin   = user?.role === 'admin'
  const isCitizen = user?.role === 'citizen'

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAdmin, isCitizen, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
