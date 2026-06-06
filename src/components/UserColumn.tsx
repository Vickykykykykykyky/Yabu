import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UserProfile } from '../types'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { normalizePhotoUrls, resolvePhotoUrl } from '../utils/photos'
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

function postIndexForPhotoIndex(postCount: number, postLengths: number[], photoIndex: number): number {
  let acc = 0
  for (let i = 0; i < postCount; i++) {
    acc += postLengths[i]
    if (photoIndex < acc) return i
  }
  return Math.max(0, postCount - 1)
}

export function UserColumn({ user, isMine, isFullWidth, onViewPhoto, onSelectUser, onToggleLike, onToggleFavorite }: Props) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const showSpread = Boolean(isFullWidth && !isMobile)
  const posts = useMemo(
    () => (user.posts ?? []).filter((p) => p.photos.length > 0),
    [user.posts],
  )
  const [postIndex, setPostIndex] = useState(0)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [postPhotoIndex, setPostPhotoIndex] = useState(0)

  const postStartIndices = useMemo(() => {
    const starts: number[] = []
    let n = 0
    for (const post of posts) {
      starts.push(n)
      n += post.photos.length
    }
    return starts
  }, [posts])

  const postLengths = useMemo(() => posts.map((p) => p.photos.length), [posts])

  useEffect(() => {
    setPostIndex(0)
    setCarouselIndex(0)
    setPostPhotoIndex(0)
  }, [user.id, posts.length])

  useEffect(() => {
    setPostPhotoIndex(0)
  }, [postIndex, isFullWidth, isMobile])

  const activePost = posts[postIndex] ?? posts[0]
  const stackPhotos = useMemo(() => posts.flatMap((p) => p.photos), [posts])
  const groupPhotos = activePost?.photos ?? user.photos
  const carouselSourcePhotos = showSpread ? [] : (isFullWidth && isMobile ? groupPhotos : stackPhotos)
  const displayPhotos = showSpread ? groupPhotos : carouselSourcePhotos
  const photos = normalizePhotoUrls(displayPhotos.map((p) => resolvePhotoUrl(p.url)))
  const captions = displayPhotos.map((p) => p.caption)
  const photoIds = displayPhotos.map((p) => p.id)
  const groupTitle = activePost?.title
  const firstPostId = activePost?.id

  const handleCarouselIndexChange = useCallback(
    (visibleIdx: number) => {
      if (isFullWidth && isMobile) {
        setPostPhotoIndex(Math.max(0, groupPhotos.length - 1 - visibleIdx))
        return
      }
      const flatIdx = Math.max(0, stackPhotos.length - 1 - visibleIdx)
      setCarouselIndex(flatIdx)
      setPostIndex(postIndexForPhotoIndex(posts.length, postLengths, flatIdx))
    },
    [groupPhotos.length, isFullWidth, isMobile, postLengths, posts.length, stackPhotos.length],
  )

  const carouselVisibleIndex =
    displayPhotos.length > 0
      ? displayPhotos.length - 1 - (isFullWidth && isMobile ? postPhotoIndex : carouselIndex)
      : 0

  const handlePostNav = useCallback(
    (i: number) => {
      setPostIndex(i)
      if (isFullWidth && isMobile) {
        setPostPhotoIndex(0)
      } else {
        setCarouselIndex(postStartIndices[i] ?? 0)
      }
    },
    [isFullWidth, isMobile, postStartIndices],
  )

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
    // 仅控制横向间距，卡片尺寸见 CSS 固定值
    const spreadFactor = total <= 1 ? 0 : Math.min(22, 88 / total)
    const left = 50 + restOffset * spreadFactor

    const center = hoverIdx ?? Math.floor(mid)
    const hovOff = Math.abs(i - center)
    const scaleNum = 1 - hovOff * 0.06
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

      {showSpread ? (
        <div className="user-column__spread">
          {displayPhotos.map((photo, i) => {
            const { z, scaleNum, left } = getSpreadStyle(i, displayPhotos.length)
            return (
              <button
                key={photo.id}
                type="button"
                className="user-column__spread-card"
                style={{
                  transform: `translateX(-50%) scale(${scaleNum})`,
                  transformOrigin: '50% 100%',
                  zIndex: z,
                  left: `${left}%`,
                }}
                onClick={() => onViewPhoto?.(photos, captions, i, photoIds, isMine)}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <div className="user-column__spread-card-frame">
                  <img className="user-column__spread-card-img" src={resolvePhotoUrl(photo.url)} alt="" loading="eager" referrerPolicy="no-referrer" />
                </div>
                {photo.caption && (
                  <div className="user-column__spread-card-caption">{photo.caption}</div>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <UserPhotoCarousel
          photos={photos}
          captions={captions}
          photoIds={photoIds}
          label={user.displayName}
          isOwn={isMine}
          compact={isMobile}
          activeIndex={carouselVisibleIndex}
          onActiveIndexChange={handleCarouselIndexChange}
          onViewPhoto={onViewPhoto}
        />
      )}

      {posts.length > 1 && isFullWidth && (
        <div className="user-column__post-nav" role="tablist" aria-label="切换作品组">
          {posts.map((post, i) => (
            <button
              key={post.id}
              type="button"
              role="tab"
              aria-selected={i === postIndex}
              aria-label={`第 ${i + 1} 组${post.title ? `：${post.title}` : ''}`}
              className={`user-column__post-dot ${i === postIndex ? 'user-column__post-dot--active' : ''}`}
              onClick={() => handlePostNav(i)}
            />
          ))}
        </div>
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

      <span className="user-column__count">
        {posts.length > 0 ? `${posts.length} 组` : `${photos.length} 张`}
      </span>
    </article>
  )
}
