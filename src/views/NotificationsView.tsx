import { useEffect, useState } from 'react'
import type { Notification, UserProfile } from '../types'
import { getSupabase, isSupabaseEnabled } from '../lib/supabase'
import './MediaViews.css'

type Props = {
  currentUserId: string
  users: UserProfile[]
  onMarkRead?: () => void
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

export function NotificationsView({ currentUserId, users, onMarkRead }: Props) {
  const [notifications, setNotifications] = useState<DbNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    onMarkRead?.()
    if (!isSupabaseEnabled()) { setLoading(false); return }
    const supabase = getSupabase()
    supabase
      .from('notifications')
      .select('id, sender_id, type, post_id, created_at')
      .eq('receiver_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setNotifications((data ?? []) as DbNotification[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentUserId])

  if (loading) return <div className="media-view--empty"><p>加载中...</p></div>

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
