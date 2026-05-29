import { memo, useCallback, useState } from 'react'
import type { UserProfile } from '../types'
import { normalizePhotoUrls } from '../utils/photos'
import { UserPhotoCarousel } from './UserPhotoCarousel'
import './UserColumn.css'

type Props = {
  user: UserProfile
  isMine: boolean
  isFullWidth?: boolean
  onViewPhoto?: (photos: string[], captions: (string | undefined)[], index: number, photoIds?: string[], isOwn?: boolean) => void
  onSelectUser?: (id: string) => void
}

function getInitials(name: string) {
  return name.slice(0, 2) || '?'
}

export const UserColumn = memo(function UserColumn({ user, isMine, isFullWidth, onViewPhoto, onSelectUser }: Props) {
  const photos = normalizePhotoUrls(user.photoUrls)
  const captions = user.photos.map((p) => p.caption)
  const photoIds = user.photos.map((p) => p.id)
  const groupTitle = user.posts?.find((p) => p.photos.length > 1)?.title

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

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

      <span className="user-column__count">{photos.length} 张</span>
    </article>
  )
})
