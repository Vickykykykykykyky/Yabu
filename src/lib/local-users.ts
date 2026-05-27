import type { UserProfile } from '../types'

const LOCAL_USERS_KEY = 'yabu-local-users'

export function loadLocalUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as UserProfile[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveLocalUsers(users: UserProfile[]): void {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users))
}

export function upsertLocalUser(user: UserProfile): UserProfile[] {
  const users = loadLocalUsers()
  const next = users.some((u) => u.id === user.id)
    ? users.map((u) => (u.id === user.id ? user : u))
    : [...users, user]
  saveLocalUsers(next)
  return next
}
