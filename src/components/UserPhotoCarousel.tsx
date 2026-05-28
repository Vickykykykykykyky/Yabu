import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import './UserPhotoCarousel.css'

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
  photos: string[]
  captions?: (string | undefined)[]
  photoIds?: string[]
  label: string
  isOwn?: boolean
  onViewPhoto?: (photos: string[], captions: (string | undefined)[], index: number, photoIds?: string[], isOwn?: boolean) => void
}

function arePhotoPropsEqual(
  a: Props,
  b: Props,
) {
  if (a.label !== b.label) return false
  if (a.photos.length !== b.photos.length) return false
  if (a.photos.some((url, i) => url !== b.photos[i])) return false
  if (a.captions?.length !== b.captions?.length) return false
  if (a.captions?.some((c, i) => c !== b.captions?.[i])) return false
  return true
}

export const UserPhotoCarousel = memo(function UserPhotoCarousel({ photos, captions, photoIds, label, isOwn, onViewPhoto }: Props) {
  const [index, setIndex] = useState(0)
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())

  const visible = useMemo(
    () => [...photos].reverse().filter((url) => !hidden.has(url)),
    [photos, hidden],
  )

  const currentCaption = captions?.[photos.length - 1 - index]

  const cardCount = Math.min(visible.length, MAX_VISIBLE)
  const fan = getFanConfig(cardCount)
  const hiddenCount = visible.length > MAX_VISIBLE ? visible.length - MAX_VISIBLE : 0

  useEffect(() => {
    setIndex(0)
    setHidden(new Set())
  }, [photos])

  useEffect(() => {
    if (index >= visible.length) {
      setIndex(Math.max(0, visible.length - 1))
    }
  }, [index, visible.length])

  const go = useCallback(
    (delta: number) => {
      if (visible.length <= 1) return
      setIndex((i) => (i + delta + visible.length) % visible.length)
    },
    [visible.length],
  )

  const onImageError = useCallback((url: string) => {
    setHidden((prev) => new Set(prev).add(url))
  }, [])

  if (photos.length === 0) {
    return <p className="photo-stack__empty">暂无照片</p>
  }

  if (visible.length === 0) {
    return <p className="photo-stack__empty">照片加载失败</p>
  }

  const hasMultiple = visible.length > 1

  const stackItems = visible
    .map((url, i) => ({
      url,
      i,
      depth: (i - index + visible.length) % visible.length,
    }))
    .filter(({ depth }) => depth < cardCount)
    .sort((a, b) => b.depth - a.depth)

  return (
    <div
      className="photo-stack"
      aria-label={`${label} 的照片`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="photo-stack__deck">
        {stackItems.map(({ url, i, depth }) => {
          const isTop = depth === 0
          return (
            <button
              key={`${url.slice(-48)}-${i}`}
              type="button"
              className={`photo-stack__card ${isTop ? 'photo-stack__card--top' : 'photo-stack__card--behind'}`}
              style={{
                zIndex: cardCount - depth,
                transform: getFanTransform(depth, fan),
              }}
              aria-label={isTop ? `当前第 ${index + 1} 张` : `查看第 ${i + 1} 张`}
              onClick={() => {
                if (isTop) {
                  const originalIndex = photos.indexOf(visible[index])
                  onViewPhoto?.(photos, captions ?? [], originalIndex >= 0 ? originalIndex : 0, photoIds, isOwn)
                } else setIndex(i)
              }}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                draggable={false}
                onError={() => onImageError(url)}
              />
            </button>
          )
        })}

        {hiddenCount > 0 && (
          <div className="photo-stack__overflow" aria-hidden>
            +{hiddenCount}
          </div>
        )}

        {hasMultiple ? (
          <>
            <button
              type="button"
              className="photo-stack__nav photo-stack__nav--prev"
              aria-label="上一张"
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="photo-stack__nav photo-stack__nav--next"
              aria-label="下一张"
              onClick={() => go(1)}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {currentCaption && (
        <p className="photo-stack__caption">{currentCaption}</p>
      )}

      {hasMultiple ? (
        <div className="photo-stack__footer">
          <div className="photo-stack__footer-row">
            <div className="photo-stack__dots" role="tablist" aria-label="选择照片">
              {visible.map((url, i) => (
                <button
                  key={url.slice(-48)}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`第 ${i + 1} 张`}
                  className={`photo-stack__dot ${i === index ? 'photo-stack__dot--active' : ''}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <span className="photo-stack__counter">
              {index + 1} / {visible.length}
            </span>
          </div>
        </div>
      ) : null}

    </div>
  )
}, arePhotoPropsEqual)
