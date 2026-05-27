export type AuthSession = {
  profileId: string
  displayName: string
}

const SESSION_KEY = 'yabu-auth-session'

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed.profileId || !parsed.displayName) return null
    return parsed
  } catch {
    return null
  }
}

export function saveAuthSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearAuthSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
