import type { Notification } from '../types'
import './MediaViews.css'

type Props = {
  notifications: Notification[]
}

function formatTime(ts: number) {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

export function NotificationsView({ notifications }: Props) {
  if (notifications.length === 0) {
    return (
      <div className="media-view media-view--empty">
        <p>暂无通知</p>
      </div>
    )
  }

  return (
    <ul className="notifications-view">
      {notifications.map((n) => (
        <li
          key={n.id}
          className={`notifications-view__item ${n.read ? '' : 'notifications-view__item--unread'}`}
        >
          <p>{n.text}</p>
          <time>{formatTime(n.createdAt)}</time>
        </li>
      ))}
    </ul>
  )
}
