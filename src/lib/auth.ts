import type { AuthSession } from './auth-session'
import { clearAuthSession, saveAuthSession } from './auth-session'
import { loadLocalUsers, saveLocalUsers } from './local-users'
import {
  fetchProfileById,
  findProfileByDisplayName,
  isDisplayNameTaken,
  registerProfileInDb,
} from './supabase-profiles'
import { isSupabaseEnabled } from './supabase'
import { getAuthErrorMessage } from './supabase-errors'
import type { UserProfile } from '../types'

function rethrowAuth(err: unknown): never {
  throw new Error(getAuthErrorMessage(err))
}

export function normalizeDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function validateDisplayName(name: string): string {
  const trimmed = normalizeDisplayName(name)
  if (trimmed.length < 2) {
    throw new Error('名字至少需要 2 个字符')
  }
  if (trimmed.length > 24) {
    throw new Error('名字不能超过 24 个字符')
  }
  return trimmed
}

function newProfileId(): string {
  return `user-${crypto.randomUUID().slice(0, 8)}`
}

export async function registerWithName(name: string): Promise<AuthSession> {
  const displayName = validateDisplayName(name)

  if (isSupabaseEnabled()) {
    try {
      if (await isDisplayNameTaken(displayName)) {
        throw new Error('该名字已被注册，请切换到「登录」')
      }
      const profile = await registerProfileInDb(displayName)
      const session = { profileId: profile.id, displayName: profile.displayName }
      saveAuthSession(session)
      return session
    } catch (err) {
      rethrowAuth(err)
    }
  }

  const users = loadLocalUsers()
  if (users.some((u) => u.displayName === displayName)) {
    throw new Error('该名字已被注册，请直接登录')
  }

  const profile: UserProfile = {
    id: newProfileId(),
    displayName,
    avatarUrl: '',
    photoUrls: [],
    photos: [],
    posts: [],
    followerCount: 0,
    role: 'member',
  }
  saveLocalUsers([...users, profile])
  const session = { profileId: profile.id, displayName: profile.displayName }
  saveAuthSession(session)
  return session
}

export async function loginWithName(name: string): Promise<AuthSession> {
  const displayName = validateDisplayName(name)

  if (isSupabaseEnabled()) {
    try {
      const profile = await findProfileByDisplayName(displayName)
      if (!profile) {
        throw new Error('未找到该用户，请先注册')
      }
      const session = { profileId: profile.id, displayName: profile.displayName }
      saveAuthSession(session)
      return session
    } catch (err) {
      rethrowAuth(err)
    }
  }

  const users = loadLocalUsers()
  const profile = users.find((u) => u.displayName === displayName)
  if (!profile) {
    throw new Error('未找到该用户，请先注册')
  }
  const session = { profileId: profile.id, displayName: profile.displayName }
  saveAuthSession(session)
  return session
}

export async function verifyAuthSession(
  session: AuthSession,
): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const profile = await fetchProfileById(session.profileId)
    return profile !== null && profile.displayName === session.displayName
  }
  const users = loadLocalUsers()
  return users.some(
    (u) => u.id === session.profileId && u.displayName === session.displayName,
  )
}

export function logout(): void {
  clearAuthSession()
}
