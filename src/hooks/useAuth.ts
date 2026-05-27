import { useCallback, useEffect, useState } from 'react'
import {
  loginWithName,
  logout as clearAuth,
  registerWithName,
  verifyAuthSession,
} from '../lib/auth'
import type { AuthSession } from '../lib/auth-session'
import { loadAuthSession } from '../lib/auth-session'

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession())
  const [booting, setBooting] = useState(() => loadAuthSession() !== null)

  useEffect(() => {
    const stored = loadAuthSession()
    if (!stored) {
      setBooting(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const valid = await verifyAuthSession(stored)
        if (cancelled) return
        if (valid) {
          setSession(stored)
        } else {
          clearAuth()
          setSession(null)
        }
      } catch {
        if (!cancelled) {
          clearAuth()
          setSession(null)
        }
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const register = useCallback(async (name: string) => {
    const next = await registerWithName(name)
    setSession(next)
    return next
  }, [])

  const login = useCallback(async (name: string) => {
    const next = await loginWithName(name)
    setSession(next)
    return next
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setSession(null)
  }, [])

  return {
    session,
    booting,
    isAuthenticated: session !== null,
    register,
    login,
    logout,
  }
}
