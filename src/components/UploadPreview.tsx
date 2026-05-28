import { useCallback, useMemo, useState } from 'react'
import './UploadPreview.css'
import './UserPhotoCarousel.css'

export type PreviewItem = {
  dataUrl: string
  caption: string
}

type Props = {
  items: PreviewItem[]
  onConfirm: (title: string, items: PreviewItem[]) => void
  onCancel: () => void
}

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

export function UploadPreview({ items, onConfirm, onCancel }: Props) {
  const [index, setIndex] = useState(0)
  const [captions, setCaptions] = useState<string[]>(() => items.map(() => ''))
  const [title, setTitle] = useState('')

  const cardCount = Math.min(items.length, MAX_VISIBLE)
  const fan = getFanConfig(cardCount)
  const hiddenCount = items.length > MAX_VISIBLE ? items.length - MAX_VISIBLE : 0

  const updateCaption = useCallback((value: string) => {
    if (value.length > 50) return
    setCaptions((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }, [index])

  const handleConfirm = useCallback(() => {
    onConfirm(
      title.trim(),
      items.map((item, i) => ({
        ...item,
        caption: captions[i].trim(),
      })),
    )
  }, [items, captions, onConfirm, title])

  const go = useCallback(
    (delta: number) => {
      if (items.length <= 1) return
      setIndex((i) => (i + delta + items.length) % items.length)
    },
    [items.length],
  )

  const remaining = 50 - captions[index].length

  const stackItems = useMemo(
    () =>
      items
        .map((item, i) => ({
          url: item.dataUrl,
          i,
          depth: (i - index + items.length) % items.length,
        }))
        .filter(({ depth }) => depth < cardCount)
        .sort((a, b) => b.depth - a.depth),
    [items, index, cardCount],
  )

  const hasMultiple = items.length > 1

  return (
    <div className="upload-preview-overlay" onClick={onCancel}>
      <div
        className="upload-preview"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="预览照片"
      >
        <header className="upload-preview__header">
          <h2 className="upload-preview__title">
            预览 ({items.length} 张)
          </h2>
        </header>

        <div className="upload-preview__body">
          <div className="upload-preview__deck">
            {stackItems.map(({ url, i, depth }) => (
              <button
                key={i}
                type="button"
                className={`photo-stack__card ${depth === 0 ? 'photo-stack__card--top' : 'photo-stack__card--behind'}`}
                style={{
                  zIndex: cardCount - depth,
                  transform: getFanTransform(depth, fan),
                }}
                aria-label={depth === 0 ? `当前第 ${index + 1} 张` : `查看第 ${i + 1} 张`}
                onClick={() => {
                  if (depth !== 0) setIndex(i)
                }}
              >
                <img src={url} alt="" draggable={false} />
              </button>
            ))}

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

          <div className="upload-preview__caption-area">
            <input
              type="text"
              className="upload-preview__input"
              placeholder="给这一组取个标题（选填）"
              value={title}
              onChange={(e) => {
                const v = e.target.value
                if (v.length > 30) return
                setTitle(v)
              }}
              maxLength={30}
            />
            <span className="upload-preview__count">{30 - title.length}</span>
          </div>

          <div className="upload-preview__caption-area">
            <input
              type="text"
              className="upload-preview__input"
              placeholder="添加文字说明（选填）"
              value={captions[index]}
              onChange={(e) => updateCaption(e.target.value)}
              maxLength={50}
            />
            <span className="upload-preview__count">{remaining}</span>
          </div>
        </div>

        <footer className="upload-preview__footer">
          <div className="upload-preview__dots" role="tablist" aria-label="选择照片">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`第 ${i + 1} 张`}
                className={`upload-preview__dot ${i === index ? 'upload-preview__dot--active' : ''}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>

          <div className="upload-preview__footer-actions">
            <button
              type="button"
              className="upload-preview__btn upload-preview__btn--cancel"
              onClick={onCancel}
            >
              取消
            </button>
            <button
              type="button"
              className="upload-preview__btn upload-preview__btn--confirm"
              onClick={handleConfirm}
            >
              上传 {items.length} 张
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
