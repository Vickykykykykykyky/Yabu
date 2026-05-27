import { useCallback, useEffect, useState } from 'react'
import { loadLocalUsers, saveLocalUsers } from '../lib/local-users'
import { checkR2Health, isR2Enabled, listUserPhotos } from '../lib/r2-api'
import {
  deletePhotoInDb,
  fetchAllProfiles,
  insertPhotoInDb,
  updateProfileInDb,
} from '../lib/supabase-profiles'
import { isSupabaseEnabled } from '../lib/supabase'
import { formatSupabaseError } from '../lib/supabase-errors'
import { isValidPhotoUrl } from '../utils/photos'
import { appendPhoto, removePhotoById, withSyncedPhotos } from '../utils/user-photos'
import type { AppState, Message, Notification, UserProfile } from '../types'

const STORAGE_KEY = 'yabu-app-state'

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

function defaultState(loggedInUserId: string): AppState {
  return {
    users: [],
    activeUserId: loggedInUserId,
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

function loadPersistedMeta(): Pick<AppState, 'messages' | 'notifications'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        messages: defaultMessages,
        notifications: defaultNotifications,
      }
    }
    const parsed = JSON.parse(raw) as AppState
    return {
      messages: parsed.messages ?? defaultMessages,
      notifications: parsed.notifications ?? defaultNotifications,
    }
  } catch {
    return {
      messages: defaultMessages,
      notifications: defaultNotifications,
    }
  }
}

async function loadUsers(): Promise<UserProfile[]> {
  const users = isSupabaseEnabled() ? await fetchAllProfiles() : loadLocalUsers()
  return users.map(withSyncedPhotos)
}

export function useAppState(loggedInUserId: string) {
  const [state, setState] = useState<AppState>(() => ({
    ...defaultState(loggedInUserId),
    ...loadPersistedMeta(),
  }))
  const [persistWarning, setPersistWarning] = useState<string | null>(null)
  const [r2Ready, setR2Ready] = useState(!isR2Enabled())
  const [supabaseReady, setSupabaseReady] = useState(!isSupabaseEnabled())
  const [usersLoading, setUsersLoading] = useState(true)

  const refetchUsers = useCallback(async () => {
    const users = await loadUsers()
    setState((prev) => ({
      ...prev,
      users,
      activeUserId: loggedInUserId,
    }))
    return users
  }, [loggedInUserId])

  useEffect(() => {
    setState((prev) => ({ ...prev, activeUserId: loggedInUserId }))
  }, [loggedInUserId])

  useEffect(() => {
    const ok = persistState(state)
    if (!isR2Enabled() && !isSupabaseEnabled()) {
      setPersistWarning(ok ? null : '本地存储空间不足，刷新后可能丢失最新照片。')
    }
  }, [state])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setUsersLoading(true)
      try {
        const users = await loadUsers()
        if (cancelled) return
        setState((prev) => ({
          ...prev,
          users,
          activeUserId: loggedInUserId,
        }))
        if (isSupabaseEnabled()) {
          setSupabaseReady(true)
          if (!isR2Enabled()) setPersistWarning(null)
        }
      } catch (err) {
        if (!cancelled && isSupabaseEnabled()) {
          setSupabaseReady(false)
          setPersistWarning(
            err instanceof Error
              ? `Supabase 连接失败：${err.message}`
              : 'Supabase 连接失败，请检查 .env.local 与表是否已创建',
          )
        }
      } finally {
        if (!cancelled) setUsersLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loggedInUserId])

  useEffect(() => {
    if (!isR2Enabled() || !supabaseReady) return

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
      if (isSupabaseEnabled()) setPersistWarning(null)

      try {
        setState((prev) => {
          Promise.all(
            prev.users.map(async (u) => {
              const photos = await listUserPhotos(u.id)
              const r2Urls = photos.map((p) => p.url)
              return { ...u, photoUrls: r2Urls.length > 0 ? r2Urls : u.photoUrls }
            }),
          ).then((usersWithPhotos) => {
            if (!cancelled) {
              setState((current) => ({ ...current, users: usersWithPhotos }))
            }
          })
          return prev
        })
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

  const updateUser = useCallback((id: string, patch: Partial<UserProfile>) => {
    setState((prev) => {
      const users = prev.users.map((u) => (u.id === id ? { ...u, ...patch } : u))
      if (!isSupabaseEnabled()) saveLocalUsers(users)
      return { ...prev, users }
    })

    if (isSupabaseEnabled() && (patch.displayName !== undefined || patch.avatarUrl !== undefined)) {
      void updateProfileInDb(id, patch).catch((err) => {
        setPersistWarning(`同步到 Supabase 失败：${formatSupabaseError(err)}`)
      })
    }
  }, [])

  const addPhoto = useCallback(async (userId: string, photoUrl: string) => {
    if (!isValidPhotoUrl(photoUrl)) return

    let photoId = `local-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`
    if (isSupabaseEnabled()) {
      try {
        photoId = await insertPhotoInDb(userId, photoUrl)
      } catch (err) {
        setPersistWarning(`照片写入 Supabase 失败：${formatSupabaseError(err)}`)
        throw err
      }
    }

    setState((prev) => {
      const user = prev.users.find((u) => u.id === userId)
      const notif: Notification = {
        id: `notif-${Date.now()}`,
        text: `${user?.displayName ?? '你'} 上传了一张新照片`,
        createdAt: Date.now(),
        read: false,
      }
      const nextUsers = prev.users.map((u) =>
        u.id === userId
          ? appendPhoto(u, { id: photoId, url: photoUrl })
          : u,
      )
      if (!isSupabaseEnabled()) {
        saveLocalUsers(nextUsers)
      }
      return {
        ...prev,
        users: nextUsers,
        notifications: [notif, ...prev.notifications].slice(0, 50),
      }
    })
  }, [])

  const removePhoto = useCallback(async (userId: string, photoId: string) => {
    if (isSupabaseEnabled()) {
      try {
        await deletePhotoInDb(photoId)
      } catch (err) {
        setPersistWarning(`删除照片失败：${formatSupabaseError(err)}`)
        throw err
      }
    }

    setState((prev) => {
      const nextUsers = prev.users.map((u) =>
        u.id === userId ? removePhotoById(u, photoId) : u,
      )
      if (!isSupabaseEnabled()) {
        saveLocalUsers(nextUsers)
      }
      return { ...prev, users: nextUsers }
    })
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

  const activeUser = withSyncedPhotos(
    state.users.find((u) => u.id === loggedInUserId) ?? {
      id: loggedInUserId,
      displayName: '我',
      avatarUrl: '',
      photoUrls: [],
      photos: [],
      followerCount: 0,
      role: 'member' as const,
    },
  )

  return {
    users: state.users,
    messages: state.messages,
    notifications: state.notifications,
    unreadCount,
    activeUser,
    currentUserId: loggedInUserId,
    persistWarning,
    r2Ready,
    r2Enabled: isR2Enabled(),
    supabaseReady,
    supabaseEnabled: isSupabaseEnabled(),
    usersLoading,
    updateUser,
    addPhoto,
    removePhoto,
    sendMessage,
    markNotificationsRead,
    refetchUsers,
  }
}
