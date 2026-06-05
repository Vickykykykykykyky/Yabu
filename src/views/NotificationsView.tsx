import { useEffect, useState } from 'react'
import type { UserProfile } from '../types'
import { getSupabase, isSupabaseEnabled } from '../lib/supabase'
import './MediaViews.css'

type Props = {
  currentUserId: string
  users: UserProfile[]
  onMarkRead?: () => Promise<void> | void
  onRefetchUnread?: () => Promise<void> | void
}

type DbNotification = {
  id: string
  sender_id: string
  type: 'like' | 'collection' | 'follow'
  post_id: string | null
  created_at: string
}

function formatTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

function getActionText(type: string) {
  if (type === 'like') return '赞了你的作品'
  if (type === 'collection') return '收藏了你的作品'
  return '关注了你'
}

export function NotificationsView({ currentUserId, users, onMarkRead, onRefetchUnread }: Props) {
  const [notifications, setNotifications] = useState<DbNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)

      // 先标记已读，再查询列表，避免竞态
      try {
        await onMarkRead?.()
      } catch {
        // 标记失败不影响列表加载
      }

      if (!isSupabaseEnabled()) {
        if (!cancelled) setLoading(false)
        return
      }

      const supabase = getSupabase()
      try {
        const { data, error: queryError } = await supabase
          .from('notifications')
          .select('id, sender_id, type, post_id, created_at')
          .eq('receiver_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(20)

        if (cancelled) return

        if (queryError) {
          setError('加载通知失败')
          setNotifications([])
        } else {
          setNotifications((data ?? []) as DbNotification[])
        }
      } catch {
        if (!cancelled) {
          setError('加载通知失败')
          setNotifications([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }

      // 列表加载完后，重新拉一次未读数以校准红点
      try {
        await onRefetchUnread?.()
      } catch {
        // 忽略
      }
    })()

    return () => { cancelled = true }
  }, [currentUserId, onMarkRead, onRefetchUnread])

  if (loading) return <div className="media-view--empty"><p>加载中...</p></div>

  if (error) {
    return (
      <div className="media-view--empty">
        <p>{error}</p>
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="media-view--empty">
        <p>暂无通知</p>
      </div>
    )
  }

  return (
    <ul className="notifications-view">
      {notifications.map((n) => {
        const sender = users.find(u => u.id === n.sender_id)
        return (
          <li key={n.id} className="notifications-view__item">
            <p>
              <strong>{sender?.displayName ?? n.sender_id}</strong> {getActionText(n.type)}
            </p>
            <time>{formatTime(n.created_at)}</time>
          </li>
        )
      })}
    </ul>
  )
}
