import { useCallback, useEffect, useState } from 'react'
import {
  changePassword,
  checkNeedsProfileSetup,
  completeOAuthProfile,
  linkEmailAccount,
  loginWithEmail,
  loginWithName,
  logout as clearAuth,
  registerWithName,
  sendEmailLoginOtp,
  sendEmailRegisterOtp as requestEmailRegisterOtp,
  signInWithGoogle,
  signInWithWeChat,
  syncAuthFromSupabaseSession,
  verifyAuthSession,
  verifyEmailLoginOtp,
  verifyEmailRegisterOtp as completeEmailRegisterOtp,
} from '../lib/auth'
import type { AuthSession } from '../lib/auth-session'
import { clearAuthSession, loadAuthSession, saveAuthSession } from '../lib/auth-session'
import { isSupabaseEnabled } from '../lib/supabase'
import { getSupabase } from '../lib/supabase'

const BOOT_TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('auth-verify-timeout')), ms)
    }),
  ])
}

async function resolveBootSession(): Promise<{
  session: AuthSession | null
  needsProfileSetup: boolean
}> {
  if (!isSupabaseEnabled()) {
    return { session: loadAuthSession(), needsProfileSetup: false }
  }

  const synced = await withTimeout(syncAuthFromSupabaseSession(), BOOT_TIMEOUT_MS).catch(() => null)
  if (synced) {
    return { session: synced, needsProfileSetup: false }
  }

  const pending = await withTimeout(checkNeedsProfileSetup(), BOOT_TIMEOUT_MS).catch(() => false)
  if (pending) {
    clearAuthSession()
    return { session: null, needsProfileSetup: true }
  }

  const stored = loadAuthSession()
  if (stored) {
    const valid = await withTimeout(verifyAuthSession(stored), BOOT_TIMEOUT_MS).catch(() => false)
    if (valid) {
      return { session: stored, needsProfileSetup: false }
    }
  }

  clearAuthSession()
  try {
    await withTimeout(clearAuth(), 2000)
  } catch {
    // ignore
  }
  return { session: null, needsProfileSetup: false }
}

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let alive = true
    const failSafe = window.setTimeout(() => {
      if (alive) setBooting(false)
    }, BOOT_TIMEOUT_MS + 500)

    void (async () => {
      try {
        const result = await resolveBootSession()
        if (!alive) return
        setSession(result.session)
        setNeedsProfileSetup(result.needsProfileSetup)
      } catch {
        if (!alive) return
        setSession(loadAuthSession())
        setNeedsProfileSetup(false)
      } finally {
        if (alive) setBooting(false)
        window.clearTimeout(failSafe)
      }
    })()

    return () => {
      alive = false
      window.clearTimeout(failSafe)
    }
  }, [])

  useEffect(() => {
    if (booting || !isSupabaseEnabled()) return

    const supabase = getSupabase()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, supabaseSession) => {
      if (!supabaseSession) {
        clearAuthSession()
        setSession(null)
        setNeedsProfileSetup(false)
        return
      }
      void syncAuthFromSupabaseSession()
        .then((next) => {
          if (next) {
            setSession(next)
            setNeedsProfileSetup(false)
            return
          }
          return checkNeedsProfileSetup().then((pending) => {
            setNeedsProfileSetup(pending)
            if (pending) setSession(null)
          })
        })
        .catch(() => {})
    })

    return () => sub.subscription.unsubscribe()
  }, [booting])

  const register = useCallback(async (name: string, password: string) => {
    const next = await registerWithName(name, password)
    setNeedsProfileSetup(false)
    setSession(next)
    return next
  }, [])

  const login = useCallback(async (name: string, password: string) => {
    const next = await loginWithName(name, password)
    setNeedsProfileSetup(false)
    setSession(next)
    return next
  }, [])

  const loginByEmail = useCallback(async (email: string, password: string) => {
    const next = await loginWithEmail(email, password)
    setNeedsProfileSetup(false)
    setSession(next)
    return next
  }, [])

  const sendEmailOtp = useCallback(async (email: string) => {
    await sendEmailLoginOtp(email)
  }, [])

  const sendEmailRegisterOtp = useCallback(async (email: string, displayName: string) => {
    await requestEmailRegisterOtp(email, displayName)
  }, [])

  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    const next = await verifyEmailLoginOtp(email, token)
    setNeedsProfileSetup(false)
    setSession(next)
    return next
  }, [])

  const verifyEmailRegisterOtp = useCallback(async (email: string, token: string, displayName: string) => {
    const next = await completeEmailRegisterOtp(email, token, displayName)
    setNeedsProfileSetup(false)
    setSession(next)
    return next
  }, [])

  const updatePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const next = await changePassword(currentPassword, newPassword)
    setSession(next)
    return next
  }, [])

  const linkEmail = useCallback(async (email: string, password: string) => {
    await linkEmailAccount(email, password)
  }, [])

  const loginWeChat = useCallback(async () => {
    await signInWithWeChat()
  }, [])

  const loginGoogle = useCallback(async () => {
    await signInWithGoogle()
  }, [])

  const finishOAuthProfile = useCallback(async (displayName: string) => {
    const next = await completeOAuthProfile(displayName)
    setNeedsProfileSetup(false)
    setSession(next)
    return next
  }, [])

  const completePasswordChange = useCallback((next: AuthSession) => {
    saveAuthSession(next)
    setSession(next)
  }, [])

  const logout = useCallback(async () => {
    clearAuthSession()
    setSession(null)
    setNeedsProfileSetup(false)
    try {
      await withTimeout(clearAuth(), 2000)
    } catch {
      // ignore
    }
  }, [])

  return {
    session,
    booting,
    needsProfileSetup,
    isAuthenticated: session !== null,
    register,
    login,
    loginByEmail,
    sendEmailOtp,
    sendEmailRegisterOtp,
    verifyEmailOtp,
    verifyEmailRegisterOtp,
    updatePassword,
    linkEmail,
    loginWeChat,
    loginGoogle,
    finishOAuthProfile,
    completePasswordChange,
    logout,
  }
}
