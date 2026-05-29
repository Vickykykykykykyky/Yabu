import { useCallback, useMemo, useState } from 'react'
import type { Post, UserPhoto, UserProfile } from '../types'
import './MediaViews.css'

type Props = {
  user: UserProfile
  onAvatarPick?: () => void
  onOpenPost: (post: Post) => void
  onDeletePost?: (post: Post) => void
  onOpenPhoto?: (photo: UserPhoto) => void
  onDeletePhoto?: (photoId: string) => void
  onUpdateCaption?: (photoId: string, caption: string) => void
  onUpdateName?: (id: string, name: string) => void
  onLogout?: () => void
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
  onUpdateName,
  onLogout,
}: Props) {
  const followerCount = user.followerCount ?? 0
  const isOwn = !!onAvatarPick

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')

  const startNameEdit = useCallback(() => {
    setNameValue(user.displayName)
    setEditingName(true)
  }, [user.displayName])

  const saveName = useCallback(() => {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== user.displayName) {
      onUpdateName?.(user.id, trimmed)
    }
    setEditingName(false)
  }, [nameValue, user.displayName, user.id, onUpdateName])

  const cancelName = useCallback(() => {
    setEditingName(false)
  }, [])

  const standalonePhotos = useMemo(
    () => user.photos.filter((p) => !p.postId),
    [user.photos],
  )

  const standalonePosts: Post[] = useMemo(
    () =>
      standalonePhotos.map((photo) => ({
        id: photo.id,
        profileId: user.id,
        title: undefined,
        photos: [photo],
        createdAt: 0,
      })),
    [standalonePhotos, user.id],
  )

  const standaloneIds = useMemo(
    () => new Set(standalonePhotos.map((p) => p.id)),
    [standalonePhotos],
  )

  const allPosts = useMemo(
    () => [...user.posts.filter((p) => p.photos.length > 0), ...standalonePosts],
    [user.posts, standalonePosts],
  )

  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = useCallback((photoId: string, currentCaption: string) => {
    setEditingPhotoId(photoId)
    setEditValue(currentCaption)
  }, [])

  const saveEdit = useCallback((photoId: string) => {
    if (editValue.trim()) {
      onUpdateCaption?.(photoId, editValue.trim())
    }
    setEditingPhotoId(null)
    setEditValue('')
  }, [editValue, onUpdateCaption])

  const cancelEdit = useCallback(() => {
    setEditingPhotoId(null)
    setEditValue('')
  }, [])

  return (
    <div className="profile-view">
      <header className="profile-view__hero">
        <button
          type="button"
          className="profile-view__avatar"
          onClick={onAvatarPick}
          aria-label={isOwn ? "更换头像" : "头像"}
          disabled={!isOwn}
          style={!isOwn ? { cursor: 'default' } : undefined}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" />
          ) : (
            <span>{getInitials(user.displayName)}</span>
          )}
        </button>

        <div className="profile-view__hero-meta">
          {editingName ? (
            <div className="profile-view__name-edit-row">
              <input
                type="text"
                className="profile-view__name-edit-input"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                maxLength={30}
                autoFocus
              />
              <button type="button" className="profile-view__card-edit-save" onClick={saveName}>保存</button>
              <button type="button" className="profile-view__card-edit-cancel" onClick={cancelName}>取消</button>
            </div>
          ) : (
            <h1
              className={`profile-view__name ${isOwn ? 'profile-view__name--editable' : ''}`}
              onClick={isOwn ? startNameEdit : undefined}
              title={isOwn ? '点击修改名称' : undefined}
            >
              {user.displayName}
            </h1>
          )}
          <p className="profile-view__id">{user.id}</p>
          <p className="profile-view__followers">
            <strong>{followerCount}</strong> 粉丝
          </p>
        </div>
      </header>

      <section className="profile-view__works" aria-labelledby="profile-works-title">
        <h2 id="profile-works-title" className="profile-view__works-title">
          作品
          <span className="profile-view__works-count">{allPosts.length}</span>
        </h2>

        <div className="profile-view__grid">
          {allPosts.length === 0 ? (
            <p className="profile-view__empty">还没有发布作品，点击 + 上传第一张照片</p>
          ) : (
            allPosts.map((post) => {
              const isStandalone = standaloneIds.has(post.id)
              const photo = post.photos[0]

              return (
                <div key={post.id} className="profile-view__card">
                  <div
                    className={`profile-view__card-img ${post.photos.length === 1 ? 'profile-view__card-img--single' : ''}`}
                    onClick={() => onOpenPost(post)}
                    role="button"
                    tabIndex={0}
                    aria-label="查看这一组作品"
                  >
                    {post.photos.length > 1 ? (
                      <div className="profile-view__post-stack">
                        <div className="profile-view__post-stack-cards">
                          <img src={post.photos[0].url} alt="" />
                          <img src={post.photos[1].url} alt="" aria-hidden />
                          {post.photos.length > 2 && (
                            <img src={post.photos[2].url} alt="" aria-hidden />
                          )}
                        </div>
                      </div>
                    ) : (
                      <img src={photo.url} alt="" />
                    )}
                    {post.title && (
                      <span className="profile-view__thumb-title">{post.title}</span>
                    )}
                    {post.photos.length > 1 && (
                      <span className="profile-view__thumb-count">
                        {post.photos.length}
                      </span>
                    )}
                  </div>

                  <div className="profile-view__card-body">
                    {editingPhotoId === post.id ? (
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
                          onClick={() => saveEdit(post.id)}
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
                    ) : post.photos.length > 1 ? (
                      <div className="profile-view__card-caption" style={{ color: '#ccc' }}>
                        {post.photos.length} 张照片
                      </div>
                    ) : null}

                    {editingPhotoId !== post.id && isStandalone && isOwn && (
                      <div className="profile-view__card-actions">
                        <button
                          type="button"
                          className="profile-view__card-edit-btn"
                          onClick={() => startEdit(post.id, photo.caption ?? '')}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="profile-view__card-delete-btn"
                          onClick={() => {
                            if (!window.confirm('确定删除这张照片吗？')) return
                            onDeletePhoto?.(post.id)
                          }}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {onLogout && (
        <button type="button" className="profile-view__logout" onClick={onLogout}>
          退出登录
        </button>
      )}
    </div>
  )
}
