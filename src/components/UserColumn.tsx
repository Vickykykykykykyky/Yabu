import type { UserProfile } from '../types'
import { normalizePhotoUrls } from '../utils/photos'
import { UserPhotoCarousel } from './UserPhotoCarousel'
import './UserColumn.css'

type Props = {
  user: UserProfile
  isMine: boolean
}

function getInitials(name: string) {
  return name.slice(0, 2) || '?'
}

export function UserColumn({ user, isMine }: Props) {
  const photos = normalizePhotoUrls(user.photoUrls)

  return (
    <article
      className={`user-column ${isMine ? 'user-column--active' : ''}`}
      aria-label={isMine ? `我的照片墙：${user.displayName}` : `${user.displayName} 的照片墙`}
    >
      <div className="user-column__header">
        <div className="user-column__avatar" aria-hidden>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" />
          ) : (
            <span>{getInitials(user.displayName)}</span>
          )}
        </div>
        <div className="user-column__meta">
          {isMine && <span className="user-column__badge">我的</span>}
          <span className="user-column__name">{user.displayName}</span>
        </div>
      </div>

      <UserPhotoCarousel photos={photos} label={user.displayName} />

      <span className="user-column__count">{photos.length} 张</span>
    </article>
  )
}
