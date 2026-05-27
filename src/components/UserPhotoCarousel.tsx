import { useCallback, useEffect, useMemo, useState } from 'react'
import './UserPhotoCarousel.css'

const MAX_REAL_WHEN_MANY = 3
const MAX_SHADOW_LAYERS = 4

type FanConfig = {
  frontRot: number
  rotStep: number
  txStep: number
  tyStep: number
}

const FAN_NORMAL: FanConfig = {
  frontRot: 8,
  rotStep: -9,
  txStep: -6,
  tyStep: -5,
}

const FAN_COMPACT: FanConfig = {
  frontRot: 6,
  rotStep: -5,
  txStep: -3.5,
  tyStep: -2.5,
}

function getFanTransform(depth: number, config: FanConfig): string {
  const rot = config.frontRot + depth * config.rotStep
  const tx = depth * config.txStep
  const ty = depth * config.tyStep
  return `translate(calc(-50% + ${tx}px), ${ty}px) rotate(${rot}deg)`
}

type Props = {
  photos: string[]
  label: string
}

export function UserPhotoCarousel({ photos, label }: Props) {
  const [index, setIndex] = useState(0)
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())

  const visible = useMemo(
    () => [...photos].reverse().filter((url) => !hidden.has(url)),
    [photos, hidden],
  )

  const compact = visible.length > MAX_REAL_WHEN_MANY
  const fan = compact ? FAN_COMPACT : FAN_NORMAL
  const maxRealCards = compact ? MAX_REAL_WHEN_MANY : visible.length
  const shadowCount = compact
    ? Math.min(visible.length - MAX_REAL_WHEN_MANY, MAX_SHADOW_LAYERS)
    : 0

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
    .filter(({ depth }) => depth < maxRealCards)
    .sort((a, b) => b.depth - a.depth)

  return (
    <div
      className="photo-stack"
      aria-label={`${label} 的照片`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div
        className={`photo-stack__deck ${compact ? 'photo-stack__deck--compact' : ''}`}
      >
        {stackItems.map(({ url, i, depth }) => {
          const isTop = depth === 0
          return (
            <button
              key={`${url.slice(-48)}-${i}`}
              type="button"
              className={`photo-stack__card ${isTop ? 'photo-stack__card--top' : 'photo-stack__card--behind'}`}
              style={{
                zIndex: maxRealCards + shadowCount - depth,
                transform: getFanTransform(depth, fan),
              }}
              aria-label={isTop ? `当前第 ${index + 1} 张` : `查看第 ${i + 1} 张`}
              onClick={() => {
                if (!isTop) setIndex(i)
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

        {shadowCount > 0
          ? Array.from({ length: shadowCount }, (_, i) => {
              const depth = maxRealCards + i
              return (
                <div
                  key={`shadow-${i}`}
                  className="photo-stack__shadow"
                  style={{
                    zIndex: shadowCount - i,
                    transform: getFanTransform(depth, fan),
                    opacity: 0.55 - i * 0.1,
                  }}
                  aria-hidden
                />
              )
            })
          : null}

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
}
