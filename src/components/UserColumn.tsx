import { useCallback, useEffect, useRef, useState } from 'react'
import type { UserProfile } from '../types'
import { normalizePhotoUrls } from '../utils/photos'
import { isSupabaseEnabled } from '../lib/supabase'
import { getSupabase } from '../lib/supabase'
import { UserPhotoCarousel } from './UserPhotoCarousel'
import './UserColumn.css'

type Props = {
  user: UserProfile
  isMine: boolean
  isFullWidth?: boolean
  onViewPhoto?: (photos: string[], captions: (string | undefined)[], index: number, photoIds?: string[], isOwn?: boolean) => void
  onSelectUser?: (id: string) => void
  onToggleLike?: (postId: string) => Promise<boolean | null>
  onToggleFavorite?: (postId: string) => Promise<boolean | null>
}

function getInitials(name: string) {
  return name.slice(0, 2) || '?'
}

export function UserColumn({ user, isMine, isFullWidth, onViewPhoto, onSelectUser, onToggleLike, onToggleFavorite }: Props) {
  const photos = normalizePhotoUrls(user.photoUrls)
  const captions = user.photos.map((p) => p.caption)
  const photoIds = user.photos.map((p) => p.id)
  const groupTitle = user.posts?.find((p) => p.photos.length > 1)?.title
  const firstPostId = user.posts?.[0]?.id

  const [likes, setLikes] = useState<Record<string, boolean>>({})
  const [favs, setFavs] = useState<Record<string, boolean>>({})
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([])
  const heartIdRef = useRef(0)
  const loadedRef = useRef(false)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useEffect(() => {
    if (loadedRef.current || !isSupabaseEnabled() || !user.id) return
    loadedRef.current = true
    const supabase = getSupabase()
    const postIds = (user.posts ?? []).map(p => p.id).filter(Boolean)
    if (postIds.length === 0) return
    Promise.all([
      supabase.from('likes').select('post_id').eq('profile_id', user.id).in('post_id', postIds),
      supabase.from('favorites').select('post_id').eq('profile_id', user.id).in('post_id', postIds),
    ]).then(([lRes, fRes]) => {
      const l: Record<string, boolean> = {}
      const f: Record<string, boolean> = {}
      for (const row of lRes.data ?? []) { l[row.post_id] = true }
      for (const row of fRes.data ?? []) { f[row.post_id] = true }
      setLikes(l)
      setFavs(f)
    }).catch(() => {})
  }, [user.id, user.posts])

  const spawnHeart = (x: number, y: number) => {
    const id = ++heartIdRef.current
    setHearts(p => [...p, { id, x, y }])
    setTimeout(() => setHearts(p => p.filter(h => h.id !== id)), 800)
  }

  const getSpreadStyle = useCallback((i: number, total: number) => {
    const mid = (total - 1) / 2
    const restOffset = i - mid
    const spreadFactor = Math.min(22, 80 / total)
    const left = 50 + restOffset * spreadFactor

    const center = hoverIdx ?? Math.floor(mid)
    const hovOff = Math.abs(i - center)
    const scaleFactor = Math.min(0.12, 0.8 / total)
    const scaleNum = 1 - hovOff * scaleFactor
    const z = total - hovOff
    return { z, scaleNum, left }
  }, [hoverIdx])

  return (
    <article
      className={`user-column ${isMine ? 'user-column--active' : ''} ${isFullWidth ? 'user-column--full' : ''}`}
      aria-label={isMine ? `我的照片墙：${user.displayName}` : `${user.displayName} 的照片墙`}
    >
      <div className="user-column__header">
        <button
          type="button"
          className="user-column__avatar"
          onClick={() => onSelectUser?.(user.id)}
          aria-label={`查看 ${user.displayName} 的主页`}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" />
          ) : (
            <span>{getInitials(user.displayName)}</span>
          )}
        </button>
        <div className="user-column__meta">
          {isMine && <span className="user-column__badge">我的</span>}
          <button
            type="button"
            className="user-column__name-btn"
            onClick={() => onSelectUser?.(user.id)}
          >
            {user.displayName}
          </button>
        </div>
      </div>

      {groupTitle && (
        <div className="user-column__group-title">{groupTitle}</div>
      )}

      {isFullWidth ? (
        <div className="user-column__spread">
          {user.photos.map((photo, i) => {
            const { z, scaleNum, left } = getSpreadStyle(i, user.photos.length)
            return (
              <button
                key={photo.id}
                type="button"
                className="user-column__spread-card"
                style={{
                  transform: `translateX(-50%) scale(${scaleNum})`,
                  zIndex: z,
                  left: `${left}%`,
                }}
                onClick={() => onViewPhoto?.(photos, captions, i, photoIds, isMine)}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <img className="user-column__spread-card-img" src={photo.url} alt="" />
                {photo.caption && (
                  <div className="user-column__spread-card-caption">{photo.caption}</div>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <UserPhotoCarousel photos={photos} captions={captions} photoIds={photoIds} label={user.displayName} isOwn={isMine} onViewPhoto={onViewPhoto} />
      )}

      <div className="user-column__reactions">
        <button className="user-column__react-btn" onClick={(e) => {
          e.stopPropagation()
          if (!firstPostId) return
          const wasLiked = likes[firstPostId] ?? user.posts?.[0]?.isLiked
          const next = !wasLiked
          setLikes(p => ({ ...p, [firstPostId]: next }))
          if (next) {
            const rect = (e.target as HTMLElement).getBoundingClientRect()
            spawnHeart(rect.left + rect.width / 2, rect.top)
          }
          onToggleLike?.(firstPostId).then(r => {
            if (r !== null && r !== next) setLikes(p => ({ ...p, [firstPostId]: r }))
          })
        }}>
          {firstPostId && (likes[firstPostId] ?? user.posts?.[0]?.isLiked) ? '❤️' : '🤍'}
        </button>
        <button className="user-column__react-btn" onClick={(e) => {
          e.stopPropagation()
          if (!firstPostId) return
          const wasFav = favs[firstPostId] ?? user.posts?.[0]?.isFavorited
          const next = !wasFav
          setFavs(p => ({ ...p, [firstPostId]: next }))
          onToggleFavorite?.(firstPostId).then(r => {
            if (r !== null && r !== next) setFavs(p => ({ ...p, [firstPostId]: r }))
          })
        }}>
          {firstPostId && (favs[firstPostId] ?? user.posts?.[0]?.isFavorited) ? '⭐' : '☆'}
        </button>
      </div>

      {hearts.map(h => (
        <span
          key={h.id}
          className="user-column__float-heart"
          style={{ left: h.x, top: h.y }}
        >
          ❤️
        </span>
      ))}

      <span className="user-column__count">{photos.length} 张</span>
    </article>
  )
}
