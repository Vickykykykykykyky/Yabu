import type { AuthSession } from './auth-session'
import { clearAuthSession, loadAuthSession, saveAuthSession } from './auth-session'
import {
  profileAuthEmail,
  validatePassword,
} from './auth-constants'
import {
  ensureDemoLocalUsers,
  findLocalUserByDisplayName,
  findLocalUserByEmail,
  loadLocalUsers,
  saveLocalUsers,
  type LocalUserRecord,
} from './local-users'
import {
  fetchProfileByAuthUserId,
  fetchProfileById,
  fetchProfileRowByAuthUserId,
  findProfileByContactEmail,
  findProfileByDisplayName,
  isContactEmailTaken,
  isDisplayNameTaken,
  registerProfileAuthInDb,
  updateProfileContactEmail,
} from './supabase-profiles'
import { getSupabase, isSupabaseEnabled } from './supabase'
import { getAuthErrorMessage } from './supabase-errors'
import type { UserProfile } from '../types'
import type { Session, User } from '@supabase/supabase-js'

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

function mustChangePasswordFromUser(user: User): boolean {
  return Boolean(user.user_metadata?.must_change_password)
}

function sessionFromProfile(
  profile: Pick<UserProfile, 'id' | 'displayName'>,
  opts?: { mustChangePassword?: boolean; authUserId?: string },
): AuthSession {
  return {
    profileId: profile.id,
    displayName: profile.displayName,
    mustChangePassword: opts?.mustChangePassword,
    authUserId: opts?.authUserId,
  }
}

function localRecordToProfile(record: LocalUserRecord): UserProfile {
  const { password: _p, mustChangePassword: _m, contactEmail: _e, ...profile } = record
  return profile
}

async function persistSupabaseSession(
  profile: Pick<UserProfile, 'id' | 'displayName'>,
  authUser?: User,
): Promise<AuthSession> {
  const session = sessionFromProfile(profile, {
    mustChangePassword: authUser ? mustChangePasswordFromUser(authUser) : false,
    authUserId: authUser?.id,
  })
  saveAuthSession(session)
  return session
}

async function resolveProfileAfterSupabaseAuth(session: Session): Promise<AuthSession | null> {
  let row = await fetchProfileRowByAuthUserId(session.user.id)

  if (!row && session.user.user_metadata?.profile_id) {
    const { data } = await getSupabase()
      .from('profiles')
      .select('id, display_name, avatar_url, role')
      .eq('id', String(session.user.user_metadata.profile_id))
      .maybeSingle()
    row = data as Awaited<ReturnType<typeof fetchProfileRowByAuthUserId>>
  }

  if (!row) return null

  return persistSupabaseSession({ id: row.id, displayName: row.display_name }, session.user)
}

export async function checkNeedsProfileSetup(): Promise<boolean> {
  if (!isSupabaseEnabled()) return false
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return false
  const row = await fetchProfileRowByAuthUserId(data.session.user.id)
  return row === null
}

export async function completeOAuthProfile(displayName: string): Promise<AuthSession> {
  const name = validateDisplayName(displayName)

  if (!isSupabaseEnabled()) {
    throw new Error('需要连接 Supabase')
  }

  try {
    if (await isDisplayNameTaken(name)) {
      throw new Error('该名字已被占用，请换一个')
    }

    const supabase = getSupabase()
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    if (!sessionData.session) {
      throw new Error('登录已过期，请重新登录')
    }

    const profileId = newProfileId()
    const profile = await registerProfileAuthInDb(name, profileId)
    return persistSupabaseSession(profile, sessionData.session.user)
  } catch (err) {
    rethrowAuth(err)
  }
}

export async function sendEmailLoginOtp(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail.includes('@')) {
    throw new Error('请输入有效邮箱')
  }

  if (!isSupabaseEnabled()) {
    throw new Error('邮箱验证码登录需要连接 Supabase')
  }

  if (!(await isContactEmailTaken(normalizedEmail))) {
    throw new Error('该邮箱尚未注册。请切换到「注册」用邮箱验证码创建账号')
  }

  const supabase = getSupabase()
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: false,
    },
  })

  if (error) {
    if (/signups not allowed|user not found/i.test(error.message)) {
      throw new Error('该邮箱尚未注册，请先注册')
    }
    throw error
  }
}

export async function sendEmailRegisterOtp(email: string, displayName: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  const name = validateDisplayName(displayName)

  if (!normalizedEmail.includes('@')) {
    throw new Error('请输入有效邮箱')
  }

  if (!isSupabaseEnabled()) {
    throw new Error('邮箱验证码注册需要连接 Supabase')
  }

  if (await isDisplayNameTaken(name)) {
    throw new Error('该名字已被注册，请换一个或切换到「登录」')
  }

  if (await isContactEmailTaken(normalizedEmail)) {
    throw new Error('该邮箱已注册，请切换到「登录」')
  }

  const supabase = getSupabase()
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      data: {
        display_name: name,
        pending_email_register: true,
      },
    },
  })

  if (error) throw error

  sessionStorage.setItem(
    'yabu-pending-email-register',
    JSON.stringify({ email: normalizedEmail, displayName: name }),
  )
}

export async function verifyEmailRegisterOtp(
  email: string,
  token: string,
  displayName: string,
): Promise<AuthSession> {
  const normalizedEmail = email.trim().toLowerCase()
  const name = validateDisplayName(displayName)
  const code = token.trim()

  if (!normalizedEmail.includes('@')) {
    throw new Error('请输入有效邮箱')
  }
  if (code.length < 6) {
    throw new Error('请输入 6 位验证码')
  }

  if (!isSupabaseEnabled()) {
    throw new Error('邮箱验证码注册需要连接 Supabase')
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: code,
      type: 'email',
    })

    if (error) throw error
    if (!data.session) {
      throw new Error('验证码错误或已过期')
    }

    const existing = await fetchProfileByAuthUserId(data.session.user.id)
    if (existing) {
      sessionStorage.removeItem('yabu-pending-email-register')
      return persistSupabaseSession(existing, data.session.user)
    }

    if (await isDisplayNameTaken(name)) {
      throw new Error('该名字已被占用，请换一个名字后重新获取验证码')
    }

    if (await isContactEmailTaken(normalizedEmail)) {
      const byEmail = await findProfileByContactEmail(normalizedEmail)
      if (byEmail) {
        return persistSupabaseSession(byEmail, data.session.user)
      }
    }

    const profileId = newProfileId()
    const profile = await registerProfileAuthInDb(name, profileId)
    await updateProfileContactEmail(profileId, normalizedEmail)

    sessionStorage.removeItem('yabu-pending-email-register')
    return persistSupabaseSession(profile, data.session.user)
  } catch (err) {
    rethrowAuth(err)
  }
}

export async function verifyEmailLoginOtp(email: string, token: string): Promise<AuthSession> {
  const normalizedEmail = email.trim().toLowerCase()
  const code = token.trim()
  if (!normalizedEmail.includes('@')) {
    throw new Error('请输入有效邮箱')
  }
  if (code.length < 6) {
    throw new Error('请输入 6 位验证码')
  }

  if (!isSupabaseEnabled()) {
    throw new Error('邮箱验证码登录需要连接 Supabase')
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: code,
      type: 'email',
    })

    if (error) throw error
    if (!data.session) {
      throw new Error('验证码错误或已过期')
    }

    const session = await resolveProfileAfterSupabaseAuth(data.session)
    if (!session) {
      throw new Error('未找到该邮箱对应的账号资料')
    }
    return session
  } catch (err) {
    rethrowAuth(err)
  }
}

export async function signInWithGoogle(): Promise<void> {
  if (!isSupabaseEnabled()) {
    throw new Error('Google 登录需要连接 Supabase')
  }

  const supabase = getSupabase()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  })

  if (error) {
    throw new Error(
      'Google 登录未配置。请在 Supabase Dashboard → Authentication → Providers 启用 Google OAuth。',
    )
  }
}

export async function syncAuthFromSupabaseSession(): Promise<AuthSession | null> {
  if (!isSupabaseEnabled()) return null
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session) return null
  return resolveProfileAfterSupabaseAuth(data.session)
}

export async function registerWithName(name: string, password: string): Promise<AuthSession> {
  const displayName = validateDisplayName(name)
  const pwd = validatePassword(password)

  if (isSupabaseEnabled()) {
    try {
      if (await isDisplayNameTaken(displayName)) {
        throw new Error('该名字已被注册，请切换到「登录」')
      }

      const profileId = newProfileId()
      const email = profileAuthEmail(profileId)
      const supabase = getSupabase()

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: pwd,
        options: {
          data: {
            display_name: displayName,
            profile_id: profileId,
            must_change_password: false,
          },
        },
      })

      if (signUpError) throw signUpError
      if (!signUpData.user) {
        throw new Error('注册失败，请重试')
      }

      const profile = await registerProfileAuthInDb(displayName, profileId)
      return persistSupabaseSession(profile, signUpData.user)
    } catch (err) {
      rethrowAuth(err)
    }
  }

  ensureDemoLocalUsers()
  const users = loadLocalUsers()
  if (users.some((u) => u.displayName === displayName)) {
    throw new Error('该名字已被注册，请直接登录')
  }

  const profile: LocalUserRecord = {
    id: newProfileId(),
    displayName,
    avatarUrl: '',
    photoUrls: [],
    photos: [],
    posts: [],
    followerCount: 0,
    role: 'member',
    password: pwd,
    mustChangePassword: false,
  }
  saveLocalUsers([...users, profile])
  const session = sessionFromProfile(profile)
  saveAuthSession(session)
  return session
}

export async function loginWithName(name: string, password: string): Promise<AuthSession> {
  const displayName = validateDisplayName(name)
  const pwd = validatePassword(password)

  if (isSupabaseEnabled()) {
    try {
      const profile = await findProfileByDisplayName(displayName)
      if (!profile) {
        throw new Error('未找到该用户，请先注册')
      }

      const supabase = getSupabase()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: profileAuthEmail(profile.id),
        password: pwd,
      })

      if (error) {
        if (/invalid login credentials/i.test(error.message)) {
          throw new Error('用户名或密码错误')
        }
        throw error
      }

      if (!data.user) throw new Error('登录失败，请重试')
      return persistSupabaseSession(profile, data.user)
    } catch (err) {
      rethrowAuth(err)
    }
  }

  ensureDemoLocalUsers()
  const record = findLocalUserByDisplayName(displayName)
  if (!record) {
    throw new Error('未找到该用户，请先注册')
  }
  if (record.password !== pwd) {
    throw new Error('用户名或密码错误')
  }

  const session = sessionFromProfile(localRecordToProfile(record), {
    mustChangePassword: record.mustChangePassword,
  })
  saveAuthSession(session)
  return session
}

export async function loginWithEmail(email: string, password: string): Promise<AuthSession> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail.includes('@')) {
    throw new Error('请输入有效邮箱')
  }
  const pwd = validatePassword(password)

  if (isSupabaseEnabled()) {
    try {
      const supabase = getSupabase()
      let authEmail = normalizedEmail
      let profile =
        (await findProfileByContactEmail(normalizedEmail)) ?? null

      let signInResult = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: pwd,
      })

      if (signInResult.error && profile) {
        authEmail = profileAuthEmail(profile.id)
        signInResult = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: pwd,
        })
      }

      const { data, error } = signInResult

      if (error) {
        if (/invalid login credentials/i.test(error.message)) {
          throw new Error('邮箱或密码错误')
        }
        throw error
      }

      if (!data.user) throw new Error('登录失败，请重试')

      profile =
        (await fetchProfileByAuthUserId(data.user.id)) ??
        profile ??
        (await findProfileByContactEmail(normalizedEmail))

      if (!profile) {
        throw new Error('未找到该邮箱对应的账号')
      }

      return persistSupabaseSession(profile, data.user)
    } catch (err) {
      rethrowAuth(err)
    }
  }

  ensureDemoLocalUsers()
  const record = findLocalUserByEmail(normalizedEmail)
  if (!record) {
    throw new Error('未找到该邮箱对应的账号')
  }
  if (record.password !== pwd) {
    throw new Error('邮箱或密码错误')
  }

  const session = sessionFromProfile(localRecordToProfile(record), {
    mustChangePassword: record.mustChangePassword,
  })
  saveAuthSession(session)
  return session
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthSession> {
  const current = validatePassword(currentPassword, '当前密码')
  const next = validatePassword(newPassword, '新密码')
  if (current === next) {
    throw new Error('新密码不能与当前密码相同')
  }

  const stored = loadAuthSession()
  if (!stored) throw new Error('未登录')

  if (isSupabaseEnabled()) {
    try {
      const supabase = getSupabase()
      const email = profileAuthEmail(stored.profileId)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      })
      if (signInError) {
        throw new Error('当前密码不正确')
      }

      const { data, error } = await supabase.auth.updateUser({
        password: next,
        data: { must_change_password: false },
      })
      if (error) throw error

      const profile = await fetchProfileById(stored.profileId)
      if (!profile) throw new Error('账号资料不存在')
      return persistSupabaseSession(profile, data.user ?? undefined)
    } catch (err) {
      rethrowAuth(err)
    }
  }

  const users = loadLocalUsers()
  const idx = users.findIndex((u) => u.id === stored.profileId)
  if (idx < 0) throw new Error('账号资料不存在')
  if (users[idx].password !== current) {
    throw new Error('当前密码不正确')
  }

  users[idx] = {
    ...users[idx],
    password: next,
    mustChangePassword: false,
  }
  saveLocalUsers(users)

  const session = sessionFromProfile(users[idx], { mustChangePassword: false })
  saveAuthSession(session)
  return session
}

export async function linkEmailAccount(email: string, password: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail.includes('@')) {
    throw new Error('请输入有效邮箱')
  }
  validatePassword(password)

  const stored = loadAuthSession()
  if (!stored) throw new Error('未登录')

  if (!isSupabaseEnabled()) {
    const users = loadLocalUsers()
    const idx = users.findIndex((u) => u.id === stored.profileId)
    if (idx < 0) throw new Error('账号资料不存在')
    if (users.some((u) => u.contactEmail === normalizedEmail && u.id !== stored.profileId)) {
      throw new Error('该邮箱已被其他账号使用')
    }
    users[idx] = { ...users[idx], contactEmail: normalizedEmail, password }
    saveLocalUsers(users)
    return
  }

  const supabase = getSupabase()
  const taken = await findProfileByContactEmail(normalizedEmail)
  if (taken && taken.id !== stored.profileId) {
    throw new Error('该邮箱已被其他账号使用')
  }

  const { error: updateError } = await supabase.auth.updateUser({
    email: normalizedEmail,
    password,
    data: { must_change_password: false },
  })
  if (updateError) throw updateError

  await updateProfileContactEmail(stored.profileId, normalizedEmail)
}

export async function signInWithWeChat(): Promise<void> {
  if (!isSupabaseEnabled()) {
    throw new Error('微信登录需要连接 Supabase')
  }

  const provider = import.meta.env.VITE_WECHAT_OAUTH_PROVIDER?.trim() || 'wechat'
  const supabase = getSupabase()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: provider as 'github',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  })
  if (error) {
    throw new Error(
      '微信登录未配置。请在 Supabase Dashboard → Authentication → Providers 添加微信 OAuth，并设置 VITE_WECHAT_OAUTH_PROVIDER。',
    )
  }
}

export async function verifyAuthSession(session: AuthSession): Promise<boolean> {
  if (isSupabaseEnabled()) {
    const supabase = getSupabase()
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) return false
    const row = await fetchProfileRowByAuthUserId(data.session.user.id)
    return row !== null && row.id === session.profileId
  }

  ensureDemoLocalUsers()
  const users = loadLocalUsers()
  return users.some(
    (u) => u.id === session.profileId && u.displayName === session.displayName,
  )
}

export async function logout(): Promise<void> {
  if (isSupabaseEnabled()) {
    try {
      await getSupabase().auth.signOut()
    } catch {
      // ignore
    }
  }
  clearAuthSession()
}
