import type { UserProfile } from '../types'
import { INITIAL_PASSWORD } from './auth-constants'

const LOCAL_USERS_KEY = 'yabu-local-users'

export type LocalUserRecord = UserProfile & {
  password: string
  mustChangePassword?: boolean
  contactEmail?: string
}

export function loadLocalUsers(): LocalUserRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LocalUserRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveLocalUsers(users: LocalUserRecord[]): void {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users))
}

/** 保存照片墙数据时保留 password / contactEmail 等登录字段 */
export function saveLocalUserProfiles(users: UserProfile[]): void {
  const existing = loadLocalUsers()
  const next: LocalUserRecord[] = users.map((user) => {
    const prev = existing.find((e) => e.id === user.id)
    if (prev) return { ...prev, ...user }
    return {
      ...user,
      password: INITIAL_PASSWORD,
      mustChangePassword: false,
    }
  })
  saveLocalUsers(next)
}

export function upsertLocalUser(user: LocalUserRecord): LocalUserRecord[] {
  const users = loadLocalUsers()
  const next = users.some((u) => u.id === user.id)
    ? users.map((u) => (u.id === user.id ? user : u))
    : [...users, user]
  saveLocalUsers(next)
  return next
}

/** 离线模式不预置固定演示名，由用户自行注册 */
export function ensureDemoLocalUsers(): void {
  const existing = loadLocalUsers()
  const needsPassword = existing.some((u) => !u.password)
  if (!needsPassword) return

  saveLocalUsers(
    existing.map((u) => ({
      ...u,
      password: u.password ?? INITIAL_PASSWORD,
      mustChangePassword: u.mustChangePassword ?? Boolean(u.password === INITIAL_PASSWORD),
      posts: u.posts ?? [],
    })),
  )
}

export function findLocalUserByDisplayName(displayName: string): LocalUserRecord | undefined {
  return loadLocalUsers().find((u) => u.displayName === displayName)
}

export function findLocalUserByEmail(email: string): LocalUserRecord | undefined {
  const normalized = email.trim().toLowerCase()
  return loadLocalUsers().find((u) => u.contactEmail?.toLowerCase() === normalized)
}
