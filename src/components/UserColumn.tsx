import type { UserProfile } from '../types'
import './UserColumn.css'

type Props = {
  user: UserProfile
  isActive: boolean
  onSelect: () => void
}

function getInitials(name: string) {
  return name.slice(0, 2) || '?'
}

export function UserColumn({ user, isActive, onSelect }: Props) {
  const photos = user.photoUrls

  return (
    <button
      type="button"
      className={`user-column ${isActive ? 'user-column--active' : ''}`}
      onClick={onSelect}
      aria-pressed={isActive}
      aria-label={`选择用户 ${user.displayName}`}
    >
      <header className="user-column__header">
        <div className="user-column__avatar" aria-hidden>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" />
          ) : (
            <span>{getInitials(user.displayName)}</span>
          )}
        </div>
        <div className="user-column__meta">
          <span className="user-column__id">{user.id}</span>
          <span className="user-column__name">{user.displayName}</span>
        </div>
      </header>

      <div className="user-column__stack" aria-label={`${user.displayName} 的照片`}>
        {photos.length === 0 ? (
          <p className="user-column__empty">暂无照片</p>
        ) : (
          photos.map((url, index) => (
            <div
              key={`${user.id}-photo-${index}-${url.slice(-24)}`}
              className="user-column__photo"
              style={{
                zIndex: index + 1,
                transform: `translate(${Math.min(index * 6, 36)}px, ${Math.min(index * 8, 48)}px) rotate(${Math.max(-8, Math.min(8, (index - photos.length / 2) * 2))}deg)`,
              }}
            >
              <img src={url} alt="" loading="lazy" />
            </div>
          ))
        )}
      </div>

      <span className="user-column__count">{photos.length} 张</span>
    </button>
  )
}
