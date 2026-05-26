import { useCallback, useEffect, useState } from 'react'
import { checkR2Health, isR2Enabled, listUserPhotos } from '../lib/r2-api'
import {
  fetchAllProfiles,
  insertPhotoInDb,
  updateProfileInDb,
} from '../lib/supabase-profiles'
import { isSupabaseEnabled } from '../lib/supabase'
import { formatSupabaseError } from '../lib/supabase-errors'
import type { AppState, Message, Notification, UserProfile } from '../types'

const STORAGE_KEY = 'yabu-app-state'

const defaultUsers: UserProfile[] = [
  { id: 'user-1', displayName: '小蓝', avatarUrl: '', photoUrls: [], role: 'member' },
  { id: 'user-2', displayName: '小橙', avatarUrl: '', photoUrls: [], role: 'member' },
  { id: 'user-3', displayName: '小绿', avatarUrl: '', photoUrls: [], role: 'member' },
]

const defaultMessages: Message[] = [
  {
    id: 'msg-1',
    fromUserId: 'user-2',
    text: '你好，你的照片墙很好看！',
    createdAt: Date.now() - 3600000,
  },
  {
    id: 'msg-2',
    fromUserId: 'user-3',
    text: '周末一起上传新照片吗？',
    createdAt: Date.now() - 7200000,
  },
]

const defaultNotifications: Notification[] = [
  {
    id: 'notif-1',
    text: '小橙 赞了你的照片墙',
    createdAt: Date.now() - 1800000,
    read: false,
  },
  {
    id: 'notif-2',
    text: '欢迎使用 Yabu，点击 + 上传第一张照片',
    createdAt: Date.now() - 86400000,
    read: false,
  },
]

function defaultState(): AppState {
  return {
    users: defaultUsers,
    activeUserId: defaultUsers[0].id,
    messages: defaultMessages,
    notifications: defaultNotifications,
  }
}

function stateForStorage(state: AppState): AppState {
  if (isSupabaseEnabled()) {
    return { ...state, users: [] }
  }
  if (isR2Enabled()) {
    return {
      ...state,
      users: state.users.map((u) => ({ ...u, photoUrls: [] })),
    }
  }
  return state
}

function persistState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateForStorage(state)))
    return true
  } catch {
    try {
      const trimmed: AppState = {
        ...stateForStorage(state),
        users: [],
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
      return true
    } catch {
      return false
    }
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()

    const parsed = JSON.parse(raw) as AppState
    const base = {
      activeUserId: parsed.activeUserId ?? defaultUsers[0].id,
      messages: parsed.messages ?? defaultMessages,
      notifications: parsed.notifications ?? defaultNotifications,
    }

    if (isSupabaseEnabled()) {
      return { ...base, users: defaultUsers }
    }

    if (!parsed.users?.length) {
      return { ...base, users: defaultUsers }
    }

    return {
      ...base,
      users: parsed.users.map((u) => ({
        ...u,
        photoUrls: isR2Enabled() ? [] : Array.isArray(u.photoUrls) ? u.photoUrls : [],
      })),
    }
  } catch {
    return defaultState()
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState)
  const [persistWarning, setPersistWarning] = useState<string | null>(null)
  const [r2Ready, setR2Ready] = useState(!isR2Enabled())
  const [supabaseReady, setSupabaseReady] = useState(!isSupabaseEnabled())

  useEffect(() => {
    const ok = persistState(state)
    if (!isR2Enabled() && !isSupabaseEnabled()) {
      setPersistWarning(ok ? null : '本地存储空间不足，刷新后可能丢失最新照片。')
    }
  }, [state])

  useEffect(() => {
    if (!isSupabaseEnabled()) return

    let cancelled = false

    ;(async () => {
      try {
        const users = await fetchAllProfiles()
        if (cancelled) return
        setState((prev) => ({
          ...prev,
          users: users.length ? users : defaultUsers,
          activeUserId: users.some((u) => u.id === prev.activeUserId)
            ? prev.activeUserId
            : (users[0]?.id ?? defaultUsers[0].id),
        }))
        setSupabaseReady(true)
        if (!isR2Enabled()) setPersistWarning(null)
      } catch (err) {
        if (!cancelled) {
          setSupabaseReady(false)
          setPersistWarning(
            err instanceof Error
              ? `Supabase 连接失败：${err.message}`
              : 'Supabase 连接失败，请检查 .env.local 与表是否已创建',
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isR2Enabled()) return

    let cancelled = false

    ;(async () => {
      const healthy = await checkR2Health()
      if (cancelled) return

      if (!healthy) {
        setR2Ready(false)
        setPersistWarning(
          '未连接到 Cloudflare API。请先运行：npm run dev:api（另开一个终端）',
        )
        return
      }

      setR2Ready(true)
      if (isSupabaseEnabled() && supabaseReady) setPersistWarning(null)

      try {
        const usersWithPhotos = await Promise.all(
          state.users.map(async (u) => {
            const photos = await listUserPhotos(u.id)
            const r2Urls = photos.map((p) => p.url)
            // R2 有图用 R2；否则保留 Supabase 里旧数据（如 base64）
            const photoUrls = r2Urls.length > 0 ? r2Urls : u.photoUrls
            return { ...u, photoUrls }
          }),
        )
        if (!cancelled) {
          setState((prev) => ({ ...prev, users: usersWithPhotos }))
        }
      } catch (err) {
        if (!cancelled) {
          setPersistWarning(
            err instanceof Error ? err.message : '从 R2 加载照片失败',
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [supabaseReady])

  const setActiveUserId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, activeUserId: id }))
  }, [])

  const updateUser = useCallback((id: string, patch: Partial<UserProfile>) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    }))

    if (isSupabaseEnabled() && (patch.displayName !== undefined || patch.avatarUrl !== undefined)) {
      void updateProfileInDb(id, patch).catch((err) => {
        setPersistWarning(`同步到 Supabase 失败：${formatSupabaseError(err)}`)
      })
    }
  }, [])

  const addPhoto = useCallback((userId: string, photoUrl: string) => {
    setState((prev) => {
      const user = prev.users.find((u) => u.id === userId)
      const notif: Notification = {
        id: `notif-${Date.now()}`,
        text: `${user?.displayName ?? '你'} 上传了一张新照片`,
        createdAt: Date.now(),
        read: false,
      }
      return {
        ...prev,
        users: prev.users.map((u) =>
          u.id === userId ? { ...u, photoUrls: [...u.photoUrls, photoUrl] } : u,
        ),
        notifications: [notif, ...prev.notifications].slice(0, 50),
      }
    })

    if (isSupabaseEnabled()) {
      void insertPhotoInDb(userId, photoUrl).catch((err) => {
        setPersistWarning(`照片写入 Supabase 失败：${formatSupabaseError(err)}`)
      })
    }
  }, [])

  const sendMessage = useCallback((text: string, fromUserId: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setState((prev) => ({
      ...prev,
      messages: [
        {
          id: `msg-${Date.now()}`,
          fromUserId,
          text: trimmed,
          createdAt: Date.now(),
        },
        ...prev.messages,
      ].slice(0, 100),
    }))
  }, [])

  const markNotificationsRead = useCallback(() => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }))
  }, [])

  const unreadCount = state.notifications.filter((n) => !n.read).length

  const activeUser =
    state.users.find((u) => u.id === state.activeUserId) ?? state.users[0]

  return {
    users: state.users,
    messages: state.messages,
    notifications: state.notifications,
    unreadCount,
    activeUser,
    activeUserId: state.activeUserId,
    persistWarning,
    r2Ready,
    r2Enabled: isR2Enabled(),
    supabaseReady,
    supabaseEnabled: isSupabaseEnabled(),
    setActiveUserId,
    updateUser,
    addPhoto,
    sendMessage,
    markNotificationsRead,
  }
}
