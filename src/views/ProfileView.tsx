import { useCallback, useMemo, useReducer, useState } from 'react'
import type { Post, UserPhoto, UserProfile } from '../types'
import './MediaViews.css'

type EditState = { photoId: string | null; value: string }

type EditAction =
  | { type: 'start'; photoId: string; value: string }
  | { type: 'typing'; value: string }
  | { type: 'cancel' }
  | { type: 'save' }

function editReducer(_state: EditState, action: EditAction): EditState {
  switch (action.type) {
    case 'start':
      return { photoId: action.photoId, value: action.value }
    case 'typing':
      return { photoId: _state.photoId, value: action.value }
    case 'cancel':
    case 'save':
      return { photoId: null, value: '' }
  }
}

type Props = {
  user: UserProfile
  onAvatarPick?: () => void
  onOpenPost: (post: Post) => void
  onDeletePost?: (post: Post) => void
  onOpenPhoto?: (photo: UserPhoto) => void
  onDeletePhoto?: (photoId: string) => void
  onUpdateCaption?: (photoId: string, caption: string) => void
  onUpdateName?: (id: string, name: string) => void
  onToggleLike?: (postId: string) => Promise<boolean | null>
  onToggleFavorite?: (postId: string) => Promise<boolean | null>
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
  onUpdateCaption,
  onUpdateName,
  onToggleLike,
  onToggleFavorite,
  onLogout,
}: Props) {
  const followerCount = user.followerCount ?? 0
  const isOwn = !!onAvatarPick

  const [likes, setLikes] = useState<Record<string, boolean>>({})
  const [favs, setFavs] = useState<Record<string, boolean>>({})
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

  const [edit, dispatchEdit] = useReducer(editReducer, { photoId: null, value: '' } as EditState)

  const startEdit = (photoId: string, currentCaption: string) => {
    dispatchEdit({ type: 'start', photoId, value: currentCaption })
  }

  const saveEdit = useCallback((photoId: string) => {
    if (edit.value.trim()) {
      onUpdateCaption?.(photoId, edit.value.trim())
    }
    dispatchEdit({ type: 'save' })
  }, [edit.value, onUpdateCaption])

  const cancelEdit = useCallback(() => {
    dispatchEdit({ type: 'cancel' })
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
                onKeyDown={(e) => { if (e.key === 'Enter') saveName() }}
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
                        <img className="profile-view__post-stack-sizer" src={post.photos[0].url} alt="" />
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
                    {edit.photoId === photo.id ? (
                      <div className="profile-view__card-edit-row">
                        <input
                          type="text"
                          className="profile-view__card-edit-input"
                          value={edit.value}
                          onChange={(e) => {
                            if (e.target.value.length <= 50) dispatchEdit({ type: 'typing', value: e.target.value })
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(photo.id)
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
                    ) : post.photos.length > 1 ? (
                      <div className="profile-view__card-caption" style={{ color: '#ccc' }}>
                        {post.photos.length} 张照片
                      </div>
                    ) : null}

                    <div className="profile-view__card-reactions">
                      <button
                        type="button"
                        className={`profile-view__card-action-btn ${likes[post.id] ? 'profile-view__card-action-btn--active' : ''}`}
                        onClick={async () => {
                          const r = await onToggleLike?.(post.id)
                          if (r !== null) setLikes((p) => ({ ...p, [post.id]: r! }))
                        }}
                      >
                        {likes[post.id] ? '❤️' : '🤍'}
                      </button>
                      <button
                        type="button"
                        className={`profile-view__card-action-btn ${favs[post.id] ? 'profile-view__card-action-btn--active' : ''}`}
                        onClick={async () => {
                          const r = await onToggleFavorite?.(post.id)
                          if (r !== null) setFavs((p) => ({ ...p, [post.id]: r! }))
                        }}
                      >
                        {favs[post.id] ? '⭐' : '☆'}
                      </button>
                    </div>

                    {edit.photoId !== photo.id && isOwn && (
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
                            if (post.photos.length > 1) {
                              if (!window.confirm('确定删除这一组作品吗？')) return
                              onDeletePost?.(post)
                            } else {
                              if (!window.confirm('确定删除这张照片吗？')) return
                              onDeletePhoto?.(post.id)
                            }
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
