import { useCallback, useState } from 'react'
import type { Post, UserPhoto, UserProfile } from '../types'
import './MediaViews.css'

type Props = {
  user: UserProfile
  onAvatarPick: () => void
  onOpenPost: (post: Post) => void
  onDeletePost: (post: Post) => void
  onOpenPhoto: (photo: UserPhoto) => void
  onDeletePhoto: (photoId: string) => void
  onUpdateCaption: (photoId: string, caption: string) => void
  onLogout: () => void
}

function getInitials(name: string) {
  return name.slice(0, 2) || '?'
}

export function ProfileView({
  user,
  onAvatarPick,
  onOpenPost,
  onDeletePost,
  onOpenPhoto,
  onDeletePhoto,
  onUpdateCaption,
  onLogout,
}: Props) {
  const followerCount = user.followerCount ?? 0
  const standalonePhotos = user.photos.filter((p) => !p.postId)

  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = useCallback((photoId: string, currentCaption: string) => {
    setEditingPhotoId(photoId)
    setEditValue(currentCaption)
  }, [])

  const saveEdit = useCallback((photoId: string) => {
    if (editValue.trim()) {
      onUpdateCaption(photoId, editValue.trim())
    }
    setEditingPhotoId(null)
    setEditValue('')
  }, [editValue, onUpdateCaption])

  const cancelEdit = useCallback(() => {
    setEditingPhotoId(null)
    setEditValue('')
  }, [])

  const totalCount = user.posts.length + standalonePhotos.length

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
          <span className="profile-view__works-count">{totalCount}</span>
        </h2>

        <div className="profile-view__grid">
          {totalCount === 0 ? (
            <p className="profile-view__empty">还没有发布作品，点击 + 上传第一张照片</p>
          ) : (
            <>
              {user.posts
                .filter((p) => p.photos.length > 0)
                .map((post) => {
                  const firstCaption = post.photos[0]?.caption ?? ''
                  return (
                    <div key={post.id} className="profile-view__card">
                      <div
                        className="profile-view__card-img"
                        onClick={() => onOpenPost(post)}
                        role="button"
                        tabIndex={0}
                        aria-label="查看这一组作品"
                      >
                        <div className="profile-view__post-stack">
                          <img src={post.photos[0].url} alt="" />
                          {post.photos.length > 1 && (
                            <img src={post.photos[1].url} alt="" aria-hidden />
                          )}
                          {post.photos.length > 2 && (
                            <img src={post.photos[2].url} alt="" aria-hidden />
                          )}
                        </div>
                        {post.photos.length > 1 && (
                          <span className="profile-view__thumb-count">
                            {post.photos.length}
                          </span>
                        )}
                      </div>

                      <div className="profile-view__card-body">
                        {post.title && (
                          <div className="profile-view__card-title">{post.title}</div>
                        )}
                        {firstCaption && (
                          <div className="profile-view__card-caption">{firstCaption}</div>
                        )}
                        {!post.title && !firstCaption && (
                          <div className="profile-view__card-caption" style={{ color: '#ccc' }}>
                            {post.photos.length} 张照片
                          </div>
                        )}
                        <div className="profile-view__card-actions">
                          <button
                            type="button"
                            className="profile-view__card-edit-btn"
                            onClick={() => onOpenPost(post)}
                          >
                            查看
                          </button>
                          <button
                            type="button"
                            className="profile-view__card-delete-btn"
                            onClick={() => {
                              if (!window.confirm('确定删除这一组作品吗？')) return
                              onDeletePost(post)
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

              {standalonePhotos.map((photo) => (
                <div key={photo.id} className="profile-view__card">
                  <div
                    className="profile-view__card-img"
                    onClick={() => onOpenPhoto(photo)}
                    role="button"
                    tabIndex={0}
                    aria-label="查看照片"
                  >
                    <img src={photo.url} alt="" />
                  </div>

                  <div className="profile-view__card-body">
                    {editingPhotoId === photo.id ? (
                      <div className="profile-view__card-edit-row">
                        <input
                          type="text"
                          className="profile-view__card-edit-input"
                          value={editValue}
                          onChange={(e) => {
                            if (e.target.value.length <= 50) setEditValue(e.target.value)
                          }}
                          maxLength={50}
                          autoFocus
                          placeholder="输入文字说明"
                        />
                        <button
                          type="button"
                          className="profile-view__card-edit-save"
                          onClick={() => saveEdit(photo.id)}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          className="profile-view__card-edit-cancel"
                          onClick={cancelEdit}
                        >
                          取消
                        </button>
                      </div>
                    ) : photo.caption ? (
                      <div className="profile-view__card-caption">{photo.caption}</div>
                    ) : null}

                    {editingPhotoId !== photo.id && (
                      <div className="profile-view__card-actions">
                        <button
                          type="button"
                          className="profile-view__card-edit-btn"
                          onClick={() => startEdit(photo.id, photo.caption ?? '')}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="profile-view__card-delete-btn"
                          onClick={() => {
                            if (!window.confirm('确定删除这张照片吗？')) return
                            onDeletePhoto(photo.id)
                          }}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      <button type="button" className="profile-view__logout" onClick={onLogout}>
        退出登录
      </button>
    </div>
  )
}
