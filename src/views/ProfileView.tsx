import type { UserProfile } from '../types'
import './MediaViews.css'

type Props = {
  user: UserProfile
  onAvatarPick: () => void
  onUpdate: (patch: Partial<UserProfile>) => void
}

function getInitials(name: string) {
  return name.slice(0, 2) || '?'
}

export function ProfileView({ user, onAvatarPick, onUpdate }: Props) {
  return (
    <div className="profile-view">
      <header className="profile-view__header">
        <button type="button" className="profile-view__avatar" onClick={onAvatarPick}>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" />
          ) : (
            <span>{getInitials(user.displayName)}</span>
          )}
        </button>
        <div className="profile-view__stats">
          <div>
            <strong>{user.photoUrls.length}</strong>
            <span>帖子</span>
          </div>
          <div>
            <strong>3</strong>
            <span>用户栏</span>
          </div>
        </div>
      </header>

      <h1 className="profile-view__name">{user.displayName}</h1>
      <p className="profile-view__id">{user.id}</p>

      <label className="profile-view__field">
        <span>显示名称</span>
        <input
          type="text"
          value={user.displayName}
          maxLength={24}
          onChange={(e) => onUpdate({ displayName: e.target.value })}
        />
      </label>

      <div className="profile-view__grid">
        {user.photoUrls.length === 0 ? (
          <p className="profile-view__empty">还没有发布照片</p>
        ) : (
          user.photoUrls.map((url, i) => (
            <div key={`${user.id}-${i}`} className="profile-view__thumb">
              <img src={url} alt="" />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
