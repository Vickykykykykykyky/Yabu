import { useCallback, useEffect, useMemo, useState } from 'react'
import './PhotoViewer.css'

const MAX_VISIBLE = 5

type FanConfig = {
  frontRot: number
  rotStep: number
  txStep: number
  tyStep: number
}

function getFanConfig(count: number): FanConfig {
  if (count <= 1) return { frontRot: 0, rotStep: 0, txStep: 0, tyStep: 0 }
  const scale = 3 / count
  return {
    frontRot: 8,
    rotStep: -9 * scale,
    txStep: -6 * scale,
    tyStep: -5 * scale,
  }
}

function getFanTransform(depth: number, config: FanConfig): string {
  const rot = config.frontRot + depth * config.rotStep
  const tx = depth * config.txStep
  const ty = depth * config.tyStep
  return `translate(calc(-50% + ${tx}px), ${ty}px) rotate(${rot}deg)`
}

type Props = {
  urls: string[]
  captions?: (string | undefined)[]
  photoIds?: string[]
  startIndex: number
  isOwn?: boolean
  postTitle?: string
  onClose: () => void
  onUpdateCaption?: (photoId: string, caption: string) => void
  onDeletePhoto?: (photoId: string) => void
}

export function PhotoViewer({ urls, captions, photoIds, startIndex, isOwn, postTitle, onClose, onUpdateCaption, onDeletePhoto }: Props) {
  const [index, setIndex] = useState(startIndex)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const cardCount = Math.min(urls.length, MAX_VISIBLE)
  const fan = getFanConfig(cardCount)
  const hiddenCount = urls.length > MAX_VISIBLE ? urls.length - MAX_VISIBLE : 0

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) { cancelEdit(); return }
        onClose()
      }
      if (e.key === 'ArrowLeft' && !editing) go(-1)
      if (e.key === 'ArrowRight' && !editing) go(1)
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  })

  useEffect(() => {
    setEditing(false)
  }, [index])

  const go = useCallback(
    (delta: number) => {
      if (urls.length <= 1) return
      setIndex((i) => (i + delta + urls.length) % urls.length)
    },
    [urls.length],
  )

  const handleBgClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const startEdit = useCallback(() => {
    setEditValue(captions?.[index] ?? '')
    setEditing(true)
  }, [captions, index])

  const cancelEdit = useCallback(() => {
    setEditing(false)
    setEditValue('')
  }, [])

  const saveEdit = useCallback(() => {
    const photoId = photoIds?.[index]
    if (photoId && onUpdateCaption) {
      onUpdateCaption(photoId, editValue.trim())
    }
    setEditing(false)
  }, [photoIds, index, onUpdateCaption, editValue])

  const handleDelete = useCallback(() => {
    const photoId = photoIds?.[index]
    if (!photoId || !onDeletePhoto) return
    if (!window.confirm('确定删除这张照片吗？')) return
    onDeletePhoto(photoId)
  }, [photoIds, index, onDeletePhoto])

  const hasMultiple = urls.length > 1

  const stackItems = useMemo(
    () =>
      urls
        .map((url, i) => ({
          url,
          i,
          depth: (i - index + urls.length) % urls.length,
        }))
        .filter(({ depth }) => depth < cardCount)
        .sort((a, b) => b.depth - a.depth),
    [urls, index, cardCount],
  )

  return (
    <div className="photo-viewer" onClick={handleBgClick} role="dialog" aria-label="查看照片">
      <button
        type="button"
        className="photo-viewer__close"
        onClick={onClose}
        aria-label="关闭"
      >
        ✕
      </button>

      <div className="photo-viewer__carousel">
        <div className="photo-viewer__deck">
          {stackItems.map(({ url, i, depth }) => (
            <button
              key={i}
              type="button"
              className={`photo-viewer__card ${depth === 0 ? 'photo-viewer__card--top' : 'photo-viewer__card--behind'}`}
              style={{
                zIndex: cardCount - depth,
                transform: getFanTransform(depth, fan),
              }}
              onClick={() => {
                if (depth !== 0) setIndex(i)
              }}
            >
              <img src={url} alt="" draggable={false} />
            </button>
          ))}

          {hiddenCount > 0 && (
            <div className="photo-viewer__overflow" aria-hidden>
              +{hiddenCount}
            </div>
          )}

          {hasMultiple ? (
            <>
              <button
                type="button"
                className="photo-viewer__arrow photo-viewer__arrow--prev"
                aria-label="上一张"
                onClick={() => go(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="photo-viewer__arrow photo-viewer__arrow--next"
                aria-label="下一张"
                onClick={() => go(1)}
              >
                ›
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="photo-viewer__meta">
        {postTitle && <div className="photo-viewer__post-title">{postTitle}</div>}
        {editing ? (
          <div className="photo-viewer__edit-row">
            <input
              type="text"
              className="photo-viewer__edit-input"
              value={editValue}
              onChange={(e) => {
                if (e.target.value.length <= 50) setEditValue(e.target.value)
              }}
              maxLength={50}
              autoFocus
            />
            <button type="button" className="photo-viewer__edit-btn" onClick={saveEdit}>保存</button>
            <button type="button" className="photo-viewer__edit-btn photo-viewer__edit-btn--cancel" onClick={cancelEdit}>取消</button>
          </div>
        ) : (
          <div className="photo-viewer__title">{captions?.[index] ?? ''}</div>
        )}

        <div className="photo-viewer__meta-row">
          {hasMultiple && (
            <div className="photo-viewer__counter">
              {index + 1} / {urls.length}
            </div>
          )}
          {isOwn && !editing && (
            <div className="photo-viewer__actions">
              <button type="button" className="photo-viewer__action" onClick={startEdit} aria-label="编辑说明">✎</button>
              <button type="button" className="photo-viewer__action photo-viewer__action--delete" onClick={handleDelete} aria-label="删除照片">✕</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
