import type { UserProfile } from '../types'
import './MediaViews.css'

type Props = {
  user: UserProfile
  onAvatarPick: () => void
  onDeletePhoto: (photoId: string) => void
  onLogout: () => void
}

function getInitials(name: string) {
  return name.slice(0, 2) || '?'
}

export function ProfileView({
  user,
  onAvatarPick,
  onDeletePhoto,
  onLogout,
}: Props) {
  const followerCount = user.followerCount ?? 0

  const handleDelete = (photoId: string) => {
    if (!window.confirm('确定删除这张照片吗？')) return
    void onDeletePhoto(photoId)
  }

  return (
    <div className="profile-view">
      <header className="profile-view__hero">
        <button
          type="button"
          className="profile-view__avatar"
          onClick={onAvatarPick}
          aria-label="更换头像"
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" />
          ) : (
            <span>{getInitials(user.displayName)}</span>
          )}
        </button>

        <div className="profile-view__hero-meta">
          <h1 className="profile-view__name">{user.displayName}</h1>
          <p className="profile-view__followers">
            <strong>{followerCount}</strong> 粉丝
          </p>
        </div>
      </header>

      <section className="profile-view__works" aria-labelledby="profile-works-title">
        <h2 id="profile-works-title" className="profile-view__works-title">
          作品
          <span className="profile-view__works-count">{user.photos.length}</span>
        </h2>

        <div className="profile-view__grid">
          {user.photos.length === 0 ? (
            <p className="profile-view__empty">还没有发布作品，点击 + 上传第一张照片</p>
          ) : (
            user.photos.map((photo) => (
              <figure key={photo.id} className="profile-view__thumb">
                <img src={photo.url} alt="" />
                <button
                  type="button"
                  className="profile-view__delete"
                  onClick={() => handleDelete(photo.id)}
                  aria-label="删除照片"
                >
                  删除
                </button>
              </figure>
            ))
          )}
        </div>
      </section>

      <button type="button" className="profile-view__logout" onClick={onLogout}>
        退出登录
      </button>
    </div>
  )
}
